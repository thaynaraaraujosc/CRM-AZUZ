import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { guardarArquivo, urlDiretaDoArquivo } from "@/lib/armazenamento/midia";

/**
 * O ARQUIVO QUE UM BLOCO DE MENSAGEM VAI MANDAR: áudio gravado na hora, imagem, documento.
 *
 * Por que uma rota própria e não gravar o arquivo dentro do fluxo: o fluxo é um JSON que vai e
 * volta inteiro a cada alteração do canvas. Um áudio de trinta segundos em base64 são algumas
 * centenas de kilobytes que passariam a viajar em TODA gravação do rascunho — inclusive quando o
 * que mudou foi arrastar um bloco dois pixels pro lado.
 *
 * Aqui o arquivo sobe uma vez, vai pro R2 (ver `armazenamento/midia.ts`) e no fluxo fica só a
 * referência `r2:<chave>`. Se o R2 não estiver configurado, `guardarArquivo` devolve a própria
 * data URL e tudo continua funcionando — mais pesado, e sem dia da virada.
 *
 * O TETO DE 16 MB é o do WhatsApp pra mídia: aceitar mais aqui seria deixar a pessoa montar um
 * robô que o canal recusa na hora de enviar, e descobrir isso só quando o lead não recebe nada.
 */
export const dynamic = "force-dynamic";

/** 16 MB, o teto de mídia do WhatsApp. Medido no base64, que é ~33% maior que o arquivo. */
const TETO_BYTES = Math.ceil(16 * 1024 * 1024 * 1.34);

export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const corpo = (await request.json().catch(() => null)) as { dataUrl?: unknown; nome?: unknown } | null;
  const dataUrl = typeof corpo?.dataUrl === "string" ? corpo.dataUrl : "";
  if (!dataUrl.startsWith("data:")) {
    return NextResponse.json({ erro: "Arquivo inválido." }, { status: 400 });
  }
  if (dataUrl.length > TETO_BYTES) {
    return NextResponse.json({ erro: "O arquivo passa de 16 MB, que é o limite do WhatsApp." }, { status: 413 });
  }

  const referencia = await guardarArquivo({
    workspaceId: sessao.user.workspaceId,
    dataUrl,
    origem: "envio",
  });

  /*
   * A URL temporária volta junto pra tela poder TOCAR o áudio que acabou de ser gravado.
   *
   * Sem ela o editor teria que pedir o arquivo de volta numa segunda viagem só pra desenhar o
   * player. Ela é assinada e vence; quem precisar dela depois pede de novo.
   */
  return NextResponse.json({
    referencia,
    url: urlDiretaDoArquivo(referencia) ?? (referencia.startsWith("data:") ? referencia : null),
    nome: typeof corpo?.nome === "string" ? corpo.nome : undefined,
  });
}
