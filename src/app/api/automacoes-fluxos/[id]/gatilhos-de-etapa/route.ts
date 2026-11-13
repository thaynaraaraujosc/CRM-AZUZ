import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * QUAIS ETAPAS DE FUNIL EXECUTAM ESTE ROBÔ.
 *
 * "Tô tentando fazer uma automação simples, que é mandar uma mensagem quando o lead entra na
 * etapa, e tá falando que nada dispara essa automação — sendo que quando eu vou criar o gatilho eu
 * já falo quando que é pra executar. Não faz sentido."
 *
 * Não fazia mesmo. Um robô pode ser disparado de dois jeitos: por um bloco de gatilho DENTRO do
 * quadro, ou por uma etapa do funil que manda executá-lo ("Executar robô", no Automatizar do
 * funil). O segundo é o caminho normal de quem cria pelo funil — e o robô nasce de propósito sem
 * bloco de gatilho, porque quem dispara é a etapa.
 *
 * Só que o editor não tinha como saber disso. A ligação mora em `GatilhoEtapa.fluxoId`, do lado do
 * funil; o editor olhava apenas para dentro do fluxo e concluía que nada o disparava. O robô
 * estava certo, ligado e configurado, e a tela dizia o contrário — na aba que a pessoa abre
 * justamente pra saber se está tudo certo.
 *
 * Esta rota responde a pergunta na fonte certa. Devolve a lista, não um sim/não, porque o mesmo
 * robô pode ser executado por várias etapas e a tela mostra quais: saber QUE dispara é metade da
 * resposta; a outra metade é DE ONDE.
 *
 * Nada de denormalizar isto numa coluna do fluxo: `FluxoAutomacao` tem `funilId`/`etapaId`, que
 * guardam UMA etapa e envelhecem calados quando o gatilho é movido ou apagado do lado do funil.
 * Eles continuam sendo lidos como reserva (robôs antigos os têm preenchidos), mas a verdade é a
 * tabela de gatilhos.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/automacoes-fluxos/[id]/gatilhos-de-etapa">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const { id } = await ctx.params;

  const gatilhos = await prisma.gatilhoEtapa.findMany({
    where: { workspaceId, fluxoId: id, tipoAcao: "robo" },
    select: { id: true, quando: true, ativo: true, funilId: true, etapaId: true },
    orderBy: [{ funilId: "asc" }, { ordem: "asc" }],
  });

  if (!gatilhos.length) {
    return NextResponse.json({ gatilhos: [] }, { headers: { "cache-control": "no-store" } });
  }

  // Os nomes numa busca só, em vez de um `include` por linha: a tela escreve "etapa Novo lead, do
  // funil Vendas", e são no máximo um punhado de etapas.
  const [etapas, funis] = await Promise.all([
    prisma.funilEtapa.findMany({
      where: { workspaceId, id: { in: [...new Set(gatilhos.map((g) => g.etapaId))] } },
      select: { id: true, titulo: true },
    }),
    prisma.funil.findMany({
      where: { workspaceId, id: { in: [...new Set(gatilhos.map((g) => g.funilId))] } },
      select: { id: true, nome: true },
    }),
  ]);
  const tituloDaEtapa = new Map(etapas.map((e) => [e.id, e.titulo]));
  const nomeDoFunil = new Map(funis.map((f) => [f.id, f.nome]));

  return NextResponse.json(
    {
      gatilhos: gatilhos.map((g) => ({
        id: g.id,
        quando: g.quando,
        ativo: g.ativo,
        funilId: g.funilId,
        etapaId: g.etapaId,
        etapaTitulo: tituloDaEtapa.get(g.etapaId) ?? null,
        funilNome: nomeDoFunil.get(g.funilId) ?? null,
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
