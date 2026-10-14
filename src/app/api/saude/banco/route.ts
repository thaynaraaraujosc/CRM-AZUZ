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
 *
 * ---
 *
 * POR QUE AGORA ELA DIZ A CAUSA
 *
 * Em 14/10/2026 o CRM caiu e levou mais de uma hora pra descobrir por quê — não por falta de
 * hipótese, mas porque o único sinal disponível era "não consegui", igual para causas
 * completamente diferentes: variável de ambiente apagada sem querer, senha recusada, rede
 * bloqueada, banco parado. Cada uma tem um conserto distinto, e a tela não distinguia nenhuma.
 *
 * O que sai daqui é CATEGORIA e CÓDIGO do driver, nunca endereço, usuário, senha nem mensagem
 * crua. `P1001` ou `ER_ACCESS_DENIED_ERROR` não contam nada a quem está de fora que o próprio
 * "o banco está fora do ar" já não contasse — e poupam uma hora de quem precisa consertar.
 */
export const dynamic = "force-dynamic";

/** Categorias com consertos diferentes. É pra isso que elas existem separadas. */
type Causa = "sem_variavel" | "nao_conectou";

function codigoDoErro(erro: unknown): string {
  if (typeof erro !== "object" || erro === null) return "desconhecido";
  const possiveis = erro as { code?: unknown; errno?: unknown };
  if (typeof possiveis.code === "string") return possiveis.code;
  if (typeof possiveis.errno === "number") return String(possiveis.errno);
  return "desconhecido";
}

function foraDoAr(causa: Causa, codigo?: string) {
  return NextResponse.json({ ok: false, causa, codigo }, { status: 503, headers: { "cache-control": "no-store" } });
}

export async function GET() {
  /*
   * O HANDLER INTEIRO dentro de um try.
   *
   * Em 14/10/2026 esta rota passou a responder 500 — não 503 —, e com isso a tela de login ficou
   * sem causa nenhuma pra mostrar: um 500 do Next não tem corpo JSON. A rota que existe pra
   * explicar a falha passou a falhar sem explicação, bem no meio de uma queda.
   *
   * Qualquer coisa que estoure aqui dentro vira JSON com o NOME do erro. Nome e código, nunca a
   * mensagem: mensagem de erro de banco costuma carregar endereço e usuário dentro.
   */
  try {
    return await responder();
  } catch (erro) {
    const nome = erro instanceof Error ? erro.name : typeof erro;
    const codigo = codigoDoErro(erro);
    console.error("[saude/banco] a própria rota de saúde estourou:", erro);
    return NextResponse.json(
      { ok: false, causa: "excecao", erro: nome, codigo },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

async function responder() {
  // Pública por necessidade (a tela de login consulta antes de ter sessão) e, por isso mesmo, com
  // limite: cada chamada bate no banco, e sem teto isso vira um jeito barato de pressionar o banco
  // de fora.
  const ip = await ipDeQuemChamou();
  const limite = contarChamada(`saude-banco:${ip}`, POLITICAS.recuperacaoDeSenha);
  if (!limite.permitido) return respostaDeLimiteExcedido(limite.esperarSegundos);

  // Antes de tentar conectar: a variável existe? Sem ela não há nem o que tentar, e o erro que
  // apareceria seria um `TypeError` de dentro do driver — que não diz nada a ninguém.
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[saude/banco] DATABASE_URL ausente ou vazia neste ambiente.");
    return foraDoAr("sem_variavel");
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (erro) {
    const codigo = codigoDoErro(erro);
    console.error(`[saude/banco] banco inacessível (${codigo}):`, erro instanceof Error ? erro.message : erro);
    return foraDoAr("nao_conectou", codigo);
  }
}
