import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { POLITICAS, contarChamada, ipDeQuemChamou, respostaDeLimiteExcedido } from "@/lib/seguranca/limite-de-uso";

/**
 * O banco está respondendo?
 *
 * Existe por causa de um sintoma enganoso no login: quando o banco está fora do ar, `authorize`
 * não consegue conferir a senha e o NextAuth devolve o MESMO erro de credencial inválida. A tela
 * dizia "E-mail ou senha incorretos" para uma pessoa cuja senha estava perfeitamente certa. Quem
 * está do outro lado tenta de novo, troca a senha, e nada resolve, porque o problema não é a senha.
 *
 * A tela de login chama isto DEPOIS de uma falha, só pra saber qual das duas frases mostrar.
 * Não expõe host, credencial nem detalhe do erro: só "dá pra falar com o banco ou não".
 */
export const dynamic = "force-dynamic";

export async function GET() {
  // Pública por necessidade (a tela de login consulta antes de ter sessão) e, por isso mesmo, com
  // limite: cada chamada bate no banco, e sem teto isso vira um jeito barato de pressionar o banco
  // de fora.
  const ip = await ipDeQuemChamou();
  const limite = contarChamada(`saude-banco:${ip}`, POLITICAS.recuperacaoDeSenha);
  if (!limite.permitido) return respostaDeLimiteExcedido(limite.esperarSegundos);

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch (erro) {
    console.error("[saude/banco] banco inacessível:", erro instanceof Error ? erro.message : erro);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
