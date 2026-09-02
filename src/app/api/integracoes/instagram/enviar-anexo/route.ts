import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { POLITICAS, contarChamada, respostaDeLimiteExcedido } from "@/lib/seguranca/limite-de-uso";
import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import {
  enviarAnexoDirectInstagram,
  enviarDirectInstagram,
  type TipoAnexoInstagram,
} from "@/lib/integracoes/instagram-login";
import { limparAnexosVencidos, publicarAnexoTemporario } from "@/lib/integracoes/anexo-publico";
import { apagarArquivo } from "@/lib/armazenamento/midia";

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

/**
 * O que o Direct do Instagram realmente aceita como anexo.
 *
 * A Meta responde "This attachment format is not supported" pra tudo que está fora desta lista —
 * uma frase igual pra formato errado, arquivo ilegível e link inalcançável, o que torna
 * impossível saber o que houve só pelo erro dela. Barrar aqui troca esse beco sem saída por uma
 * frase que diz o que fazer.
 *
 * WEBP e HEIC ficam de fora de propósito, e são justamente os que mais aparecem: HEIC é o padrão
 * de foto do iPhone e WEBP é o que o navegador salva ao baixar imagem de site. Os dois abrem
 * normalmente no Mac, então parecem arquivos comuns — e a Meta recusa os dois.
 */
const FORMATOS_ACEITOS: Record<Exclude<TipoAnexoInstagram, "file">, string[]> = {
  image: ["image/jpeg", "image/jpg", "image/png", "image/gif"],
  video: ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo", "video/ogg"],
  audio: ["audio/aac", "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/mpeg", "audio/wav", "audio/ogg"],
};

const NOME_AMIGAVEL: Record<string, string> = {
  "image/webp": "WEBP",
  "image/heic": "HEIC (formato de foto do iPhone)",
  "image/heif": "HEIC (formato de foto do iPhone)",
  "image/avif": "AVIF",
  "image/svg+xml": "SVG",
  "image/bmp": "BMP",
  "image/tiff": "TIFF",
};

/** Tipo declarado dentro da própria data URL (`data:image/webp;base64,...`). */
function tipoDoArquivo(dataUrl: string): string {
  const separador = dataUrl.indexOf(",");
  if (separador < 0) return "desconhecido";
  return dataUrl.slice(5, separador).split(";")[0] || "desconhecido";
}

export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  // Limite por WORKSPACE, não por pessoa: o custo e o risco de spam são da empresa, e várias
  // pessoas do mesmo cliente compartilham o mesmo número. Contar por usuário deixaria o teto real
  // ser multiplicado pelo tamanho da equipe.
  const limiteDeUso = contarChamada(`anexo-instagram:${sessao.user.workspaceId}`, POLITICAS.custoExterno);
  if (!limiteDeUso.permitido) return respostaDeLimiteExcedido(limiteDeUso.esperarSegundos);
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

  // Recusa ANTES de publicar o arquivo e chamar a Meta: sem isto, o formato errado só aparecia
  // como a mensagem genérica dela, depois de o arquivo já ter sido exposto num link público.
  const mimeType = tipoDoArquivo(dataUrl);
  if (tipo !== "file") {
    const aceitos = FORMATOS_ACEITOS[tipo];
    if (!aceitos.includes(mimeType.toLowerCase())) {
      const apelido = NOME_AMIGAVEL[mimeType.toLowerCase()] ?? mimeType;
      return NextResponse.json(
        {
          erro:
            `O Instagram não aceita arquivos em ${apelido}. ` +
            (tipo === "image"
              ? "Converta a imagem para JPG ou PNG e mande de novo."
              : tipo === "video"
                ? "Converta o vídeo para MP4 e mande de novo."
                : "Converta o áudio para MP3 ou M4A e mande de novo."),
        },
        { status: 400 },
      );
    }
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
      // Apaga o registro E o arquivo no R2. Só apagar a linha deixaria o objeto órfão no bucket,
      // ocupando espaço pago pra sempre sem nada no banco sabendo que ele existe.
      const registro = await prisma.anexoPublico
        .findUnique({ where: { id: publicado.id }, select: { conteudo: true } })
        .catch(() => null);
      if (registro) await apagarArquivo(registro.conteudo).catch(() => {});
      await prisma.anexoPublico.delete({ where: { id: publicado.id } }).catch(() => {});
    }
    // O tipo do arquivo vai junto do erro da Meta: a frase dela é a mesma pra formato recusado,
    // arquivo ilegível e link inalcançável, e sem saber o que foi enviado não dá pra separar.
    const texto = erro instanceof Error ? erro.message : "Falha ao enviar o anexo.";
    return NextResponse.json({ erro: `${texto} (arquivo enviado como ${mimeType})` }, { status: 502 });
  }
}
