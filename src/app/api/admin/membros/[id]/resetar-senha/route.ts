import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { exigirSuperAdmin } from "@/lib/admin/guard";
import { gerarSenhaAleatoria } from "@/lib/senha-aleatoria";

/**
 * POST gera uma senha nova aleatória pro membro e já salva o hash dela no banco — a senha em
 * texto puro só existe nesta resposta, uma vez; não fica guardada em lugar nenhum depois disso
 * (nem loga). É a alternativa seguro pra "eu preciso conseguir resolver o acesso de alguém": em
 * vez de guardar a senha antiga (impossível, ela é hash de mão única — ver `auth.ts`), gera uma
 * nova que o super-admin repassa pro cliente.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/admin/membros/[id]/resetar-senha">) {
  const guarda = await exigirSuperAdmin();
  if (!guarda.ok) return guarda.resposta;

  const { id } = await ctx.params;
  const novaSenha = gerarSenhaAleatoria();
  const hash = await bcrypt.hash(novaSenha, 10);

  try {
    await prisma.membro.update({ where: { id }, data: { senha: hash } });
  } catch {
    return NextResponse.json({ erro: "Membro não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ senha: novaSenha });
}
