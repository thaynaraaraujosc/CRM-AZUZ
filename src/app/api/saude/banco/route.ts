import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/**
 * O banco está respondendo?
 *
 * Existe por causa de um sintoma enganoso no login: quando o banco está fora do ar, `authorize`
 * não consegue conferir a senha e o NextAuth devolve o MESMO erro de credencial inválida — a tela
 * dizia "E-mail ou senha incorretos" para uma pessoa cuja senha estava perfeitamente certa. Quem
 * está do outro lado tenta de novo, troca a senha, e nada resolve, porque o problema não é a senha.
 *
 * A tela de login chama isto DEPOIS de uma falha, só pra saber qual das duas frases mostrar.
 * Não expõe host, credencial nem detalhe do erro: só "dá pra falar com o banco ou não".
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch (erro) {
    console.error("[saude/banco] banco inacessível:", erro instanceof Error ? erro.message : erro);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
