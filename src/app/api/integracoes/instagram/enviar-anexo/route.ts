import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import { enviarAnexoDirectInstagram, type TipoAnexoInstagram } from "@/lib/integracoes/instagram-login";
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

export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const { destinatario, dataUrl, nome, tipo } = (await request.json()) as {
    destinatario?: string;
    dataUrl?: string;
    nome?: string;
    tipo?: TipoAnexoInstagram;
  };
  if (!destinatario?.trim() || !dataUrl?.startsWith("data:") || !tipo || !TIPOS.includes(tipo)) {
    return NextResponse.json({ erro: "destinatario, dataUrl e tipo são obrigatórios" }, { status: 400 });
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
    publicado = await publicarAnexoTemporario({
      workspaceId,
      nome: nome?.trim() || "arquivo",
      dataUrl,
    });
    const messageId = await enviarAnexoDirectInstagram(
      decriptar(integracao.accessTokenCriptografado),
      destinatario.trim(),
      tipo,
      publicado.url,
    );
    return NextResponse.json({ ok: true, messageId });
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
