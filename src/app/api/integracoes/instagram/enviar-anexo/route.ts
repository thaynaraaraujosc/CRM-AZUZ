import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import {
  enviarAnexoDirectInstagram,
  enviarDirectInstagram,
  type TipoAnexoInstagram,
} from "@/lib/integracoes/instagram-login";
import { limparAnexosVencidos, publicarAnexoTemporario } from "@/lib/integracoes/anexo-publico";

/**
 * Envia um anexo (documento, imagem, vídeo, áudio) pelo Direct do Instagram.
 *
 * O caminho é indireto por exigência da Meta: ela não aceita o arquivo na chamada, só um endereço
 * que ela mesma vai buscar. Então o arquivo é publicado num link assinado e de vida curta (ver
 * `anexo-publico.ts`), o link é entregue à Meta, e ele vence pouco depois.
 *
 * Até existir esta rota, mandar um PDF pelo CRM criava a bolha na tela e não enviava nada — o
 * vendedor achava que a proposta tinha chegado.
 */

/** Teto do que vale a pena publicar. O Direct aceita até 25 MB; acima disso a Meta recusa e o
 * arquivo teria ficado exposto à toa. */
const TAMANHO_MAX = 25 * 1024 * 1024;

const TIPOS: TipoAnexoInstagram[] = ["image", "video", "audio", "file"];

/**
 * Validade do link quando o arquivo vai como LINK, não como anexo.
 *
 * O Direct só aceita imagem, vídeo e áudio — documento a Meta recusa com "This attachment format
 * is not supported" (o próprio app do Instagram também não deixa mandar PDF numa conversa). A
 * saída é mandar o endereço do arquivo no texto, que é o que qualquer pessoa faria na mão.
 *
 * Aí o prazo não pode ser de uma hora: quem recebe abre a proposta quando puder, não em segundos.
 * 30 dias é o meio-termo entre a pessoa conseguir abrir depois e o link não ficar de pé pra
 * sempre. O endereço continua assinado e com id aleatório — não é público no sentido de
 * "descobrível", só no de "não pede login".
 */
const VALIDADE_LINK_MS = 30 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const corpo = (await request.json()) as {
    destinatario?: string;
    /** Alternativa a `destinatario`: o nome da conversa, e o servidor resolve o resto. É o que as
     * telas novas usam — quem chama não precisa saber o id interno da thread nem o canal. */
    conversaNome?: string;
    dataUrl?: string;
    nome?: string;
    tipo?: TipoAnexoInstagram;
  };
  const { dataUrl, nome, tipo } = corpo;
  if (!dataUrl?.startsWith("data:") || !tipo || !TIPOS.includes(tipo)) {
    return NextResponse.json({ erro: "dataUrl e tipo são obrigatórios" }, { status: 400 });
  }

  let destinatario = corpo.destinatario?.trim();
  if (!destinatario && corpo.conversaNome) {
    const conversa = await prisma.conversa.findUnique({
      where: { workspaceId_nome: { workspaceId, nome: corpo.conversaNome } },
    });
    if (conversa?.canal !== "Instagram") {
      return NextResponse.json(
        { erro: "Por enquanto o CRM só envia anexo por conversas do Instagram." },
        { status: 400 },
      );
    }
    destinatario = conversa.contato ?? undefined;
  }
  if (!destinatario) {
    return NextResponse.json({ erro: "Conversa sem destinatário" }, { status: 400 });
  }

  // Base64 infla ~33%: o tamanho real do arquivo é ~3/4 do que chegou aqui.
  const tamanhoAproximado = Math.floor((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
  if (tamanhoAproximado > TAMANHO_MAX) {
    return NextResponse.json(
      { erro: "Arquivo acima de 25 MB — o Instagram não aceita anexo desse tamanho." },
      { status: 400 },
    );
  }

  const integracao = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId, provedor: "meta_instagram" } },
  });
  if (!integracao || integracao.status !== "conectado" || !integracao.accessTokenCriptografado) {
    return NextResponse.json({ erro: "Instagram não está conectado." }, { status: 400 });
  }

  await limparAnexosVencidos();

  let publicado: { id: string; url: string } | null = null;
  try {
    // Documento vai como link no texto; o resto vai como anexo de verdade.
    const comoLink = tipo === "file";
    const nomeArquivo = nome?.trim() || "arquivo";

    publicado = await publicarAnexoTemporario({
      workspaceId,
      nome: nomeArquivo,
      dataUrl,
      validadeMs: comoLink ? VALIDADE_LINK_MS : undefined,
    });

    const token = decriptar(integracao.accessTokenCriptografado);
    const messageId = comoLink
      ? await enviarDirectInstagram(token, destinatario, `📎 ${nomeArquivo}\n${publicado.url}`)
      : await enviarAnexoDirectInstagram(token, destinatario.trim(), tipo, publicado.url);

    return NextResponse.json({ ok: true, messageId, comoLink });
  } catch (erro) {
    // Falhou o envio: o link não tem mais razão de existir, então sai na hora em vez de esperar o
    // prazo — não faz sentido manter exposto um arquivo que não chegou a lugar nenhum.
    if (publicado) {
      await prisma.anexoPublico.delete({ where: { id: publicado.id } }).catch(() => {});
    }
    const texto = erro instanceof Error ? erro.message : "Falha ao enviar o anexo.";
    return NextResponse.json({ erro: texto }, { status: 502 });
  }
}
