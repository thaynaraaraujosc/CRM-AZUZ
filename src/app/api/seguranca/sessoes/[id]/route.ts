import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * DELETE — encerra uma sessão de verdade: marca `revogadaEm`, e o callback `jwt` em
 * `src/lib/auth.ts` confere isso a cada request daquela sessão — a próxima vez que o dispositivo
 * revogado tentar usar o CRM, cai pro login. Só encerra sessão do próprio Membro (nunca de outra
 * conta) e nunca a sessão atual por aqui (isso é "Sair", já existe no menu da conta).
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const alvo = await prisma.sessaoAtiva.findUnique({ where: { id } });
  if (!alvo || alvo.membroId !== sessao.user.id) {
    return NextResponse.json({ erro: "Sessão não encontrada." }, { status: 404 });
  }
  if (alvo.jti === sessao.jti) {
    return NextResponse.json({ erro: "Use \"Sair\" pra encerrar a sessão atual." }, { status: 400 });
  }

  await prisma.sessaoAtiva.update({ where: { id }, data: { revogadaEm: new Date() } });
  return NextResponse.json({ ok: true });
}
