import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gerarSenhaAleatoria } from "@/lib/senha-aleatoria";

/** POST — versão do reset de senha pro admin de um workspace resolver o acesso do próprio time,
 * sem precisar do super-admin (`/api/admin/membros/[id]/resetar-senha`, mesma lógica, escopo
 * global). Só mexe em membro do mesmo workspace de quem está logado, e só se quem está logado for
 * admin — mesmo padrão de posse de `/api/equipe/[id]`. */
export async function POST(_request: Request, ctx: RouteContext<"/api/equipe/[id]/resetar-senha">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (sessao.user.papelTipo !== "admin") {
    return NextResponse.json({ erro: "Só administradores podem resetar senha." }, { status: 403 });
  }

  const { id } = await ctx.params;
  const novaSenha = gerarSenhaAleatoria();
  const hash = await bcrypt.hash(novaSenha, 10);

  const { count } = await prisma.membro.updateMany({
    where: { id, workspaceId: sessao.user.workspaceId },
    data: { senha: hash },
  });
  if (count === 0) return NextResponse.json({ erro: "Membro não encontrado" }, { status: 404 });

  return NextResponse.json({ senha: novaSenha });
}
