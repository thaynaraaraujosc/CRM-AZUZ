import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { exigirSuperAdmin } from "@/lib/admin/guard";

/** Gera um alfabeto sem caracteres ambíguos (0/O, 1/I/l) — a senha vai ser lida em voz alta ou
 * copiada por alguém tentando resolver um problema de acesso, então evita confusão visual. */
const ALFABETO = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

function gerarSenhaAleatoria(tamanho = 12): string {
  const bytes = randomBytes(tamanho);
  let senha = "";
  for (let i = 0; i < tamanho; i++) senha += ALFABETO[bytes[i] % ALFABETO.length];
  return senha;
}

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
