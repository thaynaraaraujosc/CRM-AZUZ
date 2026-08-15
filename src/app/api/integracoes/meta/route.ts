import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET devolve o status da integração da Meta (`?provedor=`, default `meta_whatsapp`) do workspace
 * de quem está logado — nunca o token, só o que a UI precisa mostrar (status, dados, erro). */
export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const provedor = new URL(request.url).searchParams.get("provedor") ?? "meta_whatsapp";

  const linha = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId: sessao.user.workspaceId, provedor } },
    select: { status: true, metadados: true, erroMensagem: true, atualizadoEm: true },
  });

  return NextResponse.json(
    linha ?? { status: "desconectado", metadados: null, erroMensagem: null, atualizadoEm: null },
  );
}
