import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { assinaturaConfere } from "@/lib/integracoes/anexo-publico";

/**
 * Entrega um anexo pra quem tem o link assinado — SEM exigir sessão.
 *
 * É a única rota de arquivo do CRM sem login, e existe por um motivo só: a API do Instagram recebe
 * um endereço e busca o conteúdo ela mesma, de fora. O que substitui a sessão aqui é a assinatura
 * do id (`?a=`) mais o prazo de validade; ver `anexo-publico.ts`.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request, contexto: RouteContext<"/api/anexos/publico/[id]">) {
  const { id } = await contexto.params;
  const assinatura = new URL(request.url).searchParams.get("a");

  // Assinatura conferida ANTES de tocar no banco: sem isso, a rota viraria um jeito de descobrir
  // quais ids existem só pela diferença entre as respostas.
  if (!assinaturaConfere(id, assinatura)) {
    return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
  }

  const anexo = await prisma.anexoPublico.findUnique({ where: { id } });
  if (!anexo || anexo.expiraEm < new Date()) {
    return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
  }

  const bytes = Buffer.from(anexo.conteudo, "base64");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": anexo.mimeType,
      "content-length": String(bytes.length),
      "content-disposition": `inline; filename="${anexo.nome.replace(/"/g, "")}"`,
      // Nada de cache: o link é temporário de propósito, e um intermediário guardando cópia
      // manteria o arquivo acessível depois do prazo que a gente definiu.
      "cache-control": "no-store",
    },
  });
}
