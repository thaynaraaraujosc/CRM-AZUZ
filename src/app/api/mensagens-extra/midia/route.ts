import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { lerMidiaNoCaminho } from "@/lib/conversas/midia-mensagem";

/**
 * Serve UM anexo de UMA mensagem, como arquivo de verdade.
 *
 * O anexo continua guardado embutido na mensagem (data URL, ver `midia-mensagem.ts`); o que muda é
 * a entrega. Antes ele viajava dentro do JSON de `GET /api/mensagens-extra`, que traz o histórico
 * inteiro do workspace de uma vez — o navegador precisava baixar todos os anexos antes de desenhar
 * a primeira bolha. Aqui cada `<img>`/`<audio>` busca o seu, sob demanda e em paralelo.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const parametros = new URL(request.url).searchParams;
  const id = parametros.get("id");
  const campo = parametros.get("campo");
  if (!id || !campo) return NextResponse.json({ erro: "id e campo são obrigatórios" }, { status: 400 });

  const mensagem = await prisma.mensagemExtra.findUnique({ where: { id } });
  // Mensagem de outro workspace responde igual a mensagem inexistente — um id adivinhado não pode
  // virar um jeito de ler anexo de outra empresa, nem de descobrir que ele existe.
  if (!mensagem || mensagem.workspaceId !== sessao.user.workspaceId) {
    return NextResponse.json({ erro: "Anexo não encontrado" }, { status: 404 });
  }

  const dataUrl = lerMidiaNoCaminho(mensagem.extras, campo);
  if (!dataUrl) return NextResponse.json({ erro: "Anexo não encontrado" }, { status: 404 });

  const separador = dataUrl.indexOf(",");
  const cabecalho = dataUrl.slice(5, separador); // "image/jpeg;base64"
  const tipo = cabecalho.split(";")[0] || "application/octet-stream";
  const bytes = Buffer.from(dataUrl.slice(separador + 1), "base64");

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": tipo,
      "content-length": String(bytes.length),
      // O conteúdo de uma mensagem já enviada nunca muda, então o navegador pode guardar pra
      // sempre — é o que faz a segunda visita à conversa não baixar nada de novo. `private` porque
      // é conteúdo de um workspace só: nenhum cache compartilhado pode reter isso.
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
}
