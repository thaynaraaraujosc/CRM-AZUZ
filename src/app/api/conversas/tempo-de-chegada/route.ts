import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { contasCanalVisiveis, filtroContaCanal } from "@/lib/integracoes/conta-canal";
import { INTERVALO_POLLING_MS } from "@/lib/conversas/polling";
import { esperaDaTela, resumirTempoDeChegada } from "@/lib/conversas/tempo-de-chegada";

/**
 * "Com quanto tempo a mensagem chega aqui?"
 *
 * Responde com medição, não com estimativa. Os dois carimbos que a conta usa (`recebidoEm` e
 * `gravadoEm`) são gravados pelos webhooks desde que esta rota existe — então ela é VAZIA até
 * chegar a primeira mensagem depois da publicação, e isso é dito na resposta em vez de ser
 * preenchido com número inventado.
 *
 * Mede também a ida e volta ao banco, e essa parte não é curiosidade: toda a espera de quem olha a
 * tela é feita de idas e voltas ao banco, em série, tanto no webhook que grava quanto na busca que
 * a tela repete a cada poucos segundos. Com a função e o banco no mesmo lugar isso é ~1 ms; com
 * eles em continentes diferentes é ~120 ms CADA, e aí uma dezena delas vira mais de um segundo
 * sem nenhuma linha de código ser culpada. `regiao` diz de onde a função respondeu, pra que a
 * conclusão não depender de palpite sobre a configuração da hospedagem.
 */
export const dynamic = "force-dynamic";

/** Teto de amostras. As mais recentes, que é o que descreve como está HOJE. */
const AMOSTRAS = 400;

export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const visiveis = await contasCanalVisiveis(workspaceId);

  const linhas = await prisma.mensagemExtra.findMany({
    where: {
      workspaceId,
      ...filtroContaCanal(visiveis),
      // Só o que CHEGOU. Mensagem que o CRM enviou não tem transporte de entrada pra medir.
      tipo: "in",
      recebidoEm: { not: null },
    },
    orderBy: { criadoEm: "desc" },
    take: AMOSTRAS,
    select: { canal: true, criadoEm: true, recebidoEm: true, gravadoEm: true },
  });

  /*
   * A ida e volta ao banco, medida três vezes.
   *
   * A PRIMEIRA sai separada porque ela inclui pegar conexão no pool (e, em função fria, abrir a
   * conexão inteira: TCP mais o aperto de mão de autenticação, que são várias idas e voltas).
   * Misturar as duas coisas num número só esconde qual delas é o problema — e as duas têm
   * consertos diferentes.
   */
  const idas: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    const inicio = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    idas.push(Math.round(performance.now() - inicio));
  }
  const seguintes = idas.slice(1).sort((a, b) => a - b);

  const canais = resumirTempoDeChegada(linhas);

  return NextResponse.json(
    {
      canais,
      /** Nenhuma mensagem recebida desde que a medição passou a ser gravada. */
      semAmostras: canais.length === 0,
      banco: {
        primeiraIda: idas[0],
        idaEVolta: seguintes[Math.floor(seguintes.length / 2)],
      },
      /** De onde a função respondeu. `null` fora da Vercel (ex.: rodando na máquina de alguém). */
      regiao: process.env.VERCEL_REGION ?? null,
      /** Não medido: é o intervalo do polling da tela. Ver `polling.ts`. */
      espera: esperaDaTela(INTERVALO_POLLING_MS),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
