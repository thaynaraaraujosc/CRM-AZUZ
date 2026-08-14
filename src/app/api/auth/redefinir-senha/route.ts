import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

/** POST — valida o token (existe, não expirou, não foi usado) e troca a senha do Membro dono dele. */
export async function POST(request: Request) {
  const dados = await request.json().catch(() => null);
  const token = typeof dados?.token === "string" ? dados.token : "";
  const novaSenha = typeof dados?.novaSenha === "string" ? dados.novaSenha : "";

  if (!token) return NextResponse.json({ erro: "Link inválido." }, { status: 400 });
  if (novaSenha.length < 8) {
    return NextResponse.json({ erro: "A senha precisa ter pelo menos 8 caracteres." }, { status: 400 });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const registro = await prisma.tokenRedefinicaoSenha.findUnique({ where: { tokenHash } });

  if (!registro || registro.usadoEm || registro.expiraEm < new Date()) {
    return NextResponse.json({ erro: "Esse link expirou ou já foi usado. Peça um novo." }, { status: 400 });
  }

  const hash = await bcrypt.hash(novaSenha, 10);
  await prisma.$transaction([
    prisma.membro.update({ where: { id: registro.membroId }, data: { senha: hash } }),
    prisma.tokenRedefinicaoSenha.update({ where: { id: registro.id }, data: { usadoEm: new Date() } }),
  ]);

  return NextResponse.json({ ok: true });
}
