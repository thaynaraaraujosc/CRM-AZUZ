import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enviarEmail, templateEmailAlterado } from "@/lib/email";

/**
 * POST — troca o e-mail de acesso (login) da própria conta. Exige a senha atual (não dá pra
 * simplesmente digitar um e-mail novo e pronto: é a senha que prova que é o dono da conta pedindo)
 * e avisa o e-mail antigo depois da troca, pra quem realmente é dono perceber se não foi ele.
 * Sem isso, trocar o e-mail seria a porta mais fácil pra sequestrar uma conta (muda o e-mail, pede
 * "esqueci minha senha" pro e-mail novo, entra sem nunca ter sabido a senha original).
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const dados = await request.json().catch(() => null);
  const senhaAtual = typeof dados?.senhaAtual === "string" ? dados.senhaAtual : "";
  const novoEmail = typeof dados?.novoEmail === "string" ? dados.novoEmail.trim().toLowerCase() : "";

  if (!senhaAtual || !novoEmail) {
    return NextResponse.json({ erro: "Preencha a senha atual e o novo e-mail." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novoEmail)) {
    return NextResponse.json({ erro: "E-mail inválido." }, { status: 400 });
  }

  const membro = await prisma.membro.findUnique({ where: { id: sessao.user.id } });
  if (!membro || !membro.senha) {
    return NextResponse.json({ erro: "Conta não encontrada." }, { status: 404 });
  }

  const senhaValida = await bcrypt.compare(senhaAtual, membro.senha);
  if (!senhaValida) {
    return NextResponse.json({ erro: "Senha atual incorreta." }, { status: 401 });
  }

  if (novoEmail === membro.email) {
    return NextResponse.json({ erro: "Esse já é o e-mail cadastrado." }, { status: 400 });
  }

  const emailEmUso = await prisma.membro.findUnique({ where: { email: novoEmail } });
  if (emailEmUso) {
    return NextResponse.json({ erro: "Esse e-mail já está em uso por outra conta." }, { status: 409 });
  }

  const emailAntigo = membro.email;
  await prisma.membro.update({ where: { id: membro.id }, data: { email: novoEmail } });

  await enviarEmail({
    to: emailAntigo,
    subject: "Seu e-mail de acesso foi alterado — CRM AZUZ",
    html: templateEmailAlterado(membro.nome, novoEmail),
  });

  return NextResponse.json({ ok: true, novoEmail });
}
