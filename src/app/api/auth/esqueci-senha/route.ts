import { NextResponse } from "next/server";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import {
  POLITICAS,
  contarChamada,
  ipDeQuemChamou,
  respostaDeLimiteExcedido,
} from "@/lib/seguranca/limite-de-uso";
import { enviarEmail, templateRedefinicaoSenha } from "@/lib/email";

/**
 * POST — gera um link de redefinição de senha e manda por e-mail (Resend). Sempre responde
 * com a mesma mensagem genérica, exista ou não conta com esse e-mail — não dá pra usar essa rota
 * pra descobrir quais e-mails têm cadastro no CRM.
 */
export async function POST(request: Request) {
  const dados = await request.json().catch(() => null);
  const email = typeof dados?.email === "string" ? dados.email.trim().toLowerCase() : "";

  const RESPOSTA_GENERICA = NextResponse.json({
    mensagem: "Se esse e-mail tiver uma conta no CRM AZUZ, enviamos um link de redefinição pra ele.",
  });

  if (!email) return RESPOSTA_GENERICA;

  // Cada chamada aqui dispara um e-mail. Sem limite, isso é um canhão de spam apontado pra caixa
  // de entrada de qualquer pessoa, e também uma forma de descobrir quais e-mails têm conta pelo
  // tempo de resposta. A resposta continua sendo a mesma frase genérica em todos os casos.
  const ip = await ipDeQuemChamou();
  const limite = contarChamada(`esqueci-senha:${ip}`, POLITICAS.recuperacaoDeSenha);
  if (!limite.permitido) return respostaDeLimiteExcedido(limite.esperarSegundos);

  const membro = await prisma.membro.findFirst({ where: { email, ativo: true } });
  if (!membro) return RESPOSTA_GENERICA;

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  await prisma.tokenRedefinicaoSenha.create({
    data: {
      id: randomUUID(),
      membroId: membro.id,
      tokenHash,
      expiraEm: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const link = `${process.env.APP_URL ?? "https://azuzcrm.com.br"}/redefinir-senha/${token}`;
  await enviarEmail({
    to: membro.email,
    subject: "Redefinir sua senha — CRM AZUZ",
    html: templateRedefinicaoSenha(membro.nome, link),
  });

  return RESPOSTA_GENERICA;
}
