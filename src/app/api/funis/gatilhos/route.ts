import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { AcaoDados, GatilhoEtapaVisao, TipoAcaoGatilho } from "@/lib/funil/gatilhos-etapa-tipos";

/**
 * Os gatilhos que moram nas etapas do funil.
 *
 * O `workspaceId` nunca vem do cliente: vem da sessão. Um id de etapa de outro workspace não
 * encontra nada, e a resposta é a mesma de uma etapa que não existe.
 */

function paraVisao(linha: {
  id: string;
  funilId: string;
  etapaId: string;
  quando: string;
  tipoAcao: string;
  fluxoId: string | null;
  acaoDados: unknown;
  condicao: unknown;
  diasAtivos: unknown;
  horaInicio: string | null;
  horaFim: string | null;
  horarioDiario: string | null;
  dataHora: string | null;
  esperaValor: number | null;
  esperaUnidade: string | null;
  ativo: boolean;
  ordem: number;
  grupoId: string | null;
}): GatilhoEtapaVisao {
  return {
    ...linha,
    quando: linha.quando as GatilhoEtapaVisao["quando"],
    tipoAcao: (linha.tipoAcao ?? "robo") as TipoAcaoGatilho,
    acaoDados: (linha.acaoDados as AcaoDados) ?? null,
    condicao: (linha.condicao as GatilhoEtapaVisao["condicao"]) ?? null,
    diasAtivos: Array.isArray(linha.diasAtivos) ? (linha.diasAtivos as number[]) : null,
  };
}

/** GET lista os gatilhos do workspace. `?funilId=` limita a um funil. */
export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const funilId = new URL(request.url).searchParams.get("funilId") ?? undefined;
  const linhas = await prisma.gatilhoEtapa.findMany({
    where: { workspaceId: sessao.user.workspaceId, ...(funilId ? { funilId } : {}) },
    orderBy: [{ etapaId: "asc" }, { ordem: "asc" }],
  });

  // O nome do robô junto: a faixa do funil mostra "Executar robô: NOME PACIENTE", e sem isso a
  // tela teria que buscar cada fluxo separado só pra escrever um nome.
  const fluxos = await prisma.fluxoAutomacao.findMany({
    where: {
      workspaceId: sessao.user.workspaceId,
      id: { in: linhas.map((l) => l.fluxoId).filter((id): id is string => !!id) },
    },
    select: { id: true, nome: true },
  });
  const nomePorId = new Map(fluxos.map((f) => [f.id, f.nome]));

  return NextResponse.json(
    linhas.map((l) => ({ ...paraVisao(l), fluxoNome: l.fluxoId ? nomePorId.get(l.fluxoId) : undefined })),
    { headers: { "cache-control": "no-store" } },
  );
}

/** POST cria um gatilho numa etapa. */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const dados = (await request.json()) as Partial<GatilhoEtapaVisao> & { etapasIds?: unknown };
  const tipoAcao = (dados.tipoAcao ?? "robo") as TipoAcaoGatilho;

  /*
   * UM GATILHO PARA VÁRIAS ETAPAS: uma LINHA POR ETAPA, todas com o mesmo `grupoId`.
   *
   * "Diariamente às 12h" vale para o funil inteiro, e repetir a mesma configuração catorze vezes
   * seria catorze coisas pra manter em vez de uma. A alternativa — guardar a lista de etapas
   * dentro de uma linha só — obrigaria o motor a mudar: hoje ele acha os gatilhos de uma etapa
   * por `etapaId`, e passaria a procurar dentro de um Json em toda linha do workspace. Com linhas
   * irmãs, o motor não muda nada; quem agrupa é a tela.
   */
  const etapasPedidas = Array.isArray(dados.etapasIds)
    ? dados.etapasIds.filter((x): x is string => typeof x === "string")
    : dados.etapaId
      ? [dados.etapaId]
      : [];

  if (!etapasPedidas.length || !dados.quando) {
    return NextResponse.json({ erro: "Faltam etapa ou quando." }, { status: 400 });
  }
  if (tipoAcao === "robo" && !dados.fluxoId) {
    return NextResponse.json({ erro: "Gatilho de robô precisa de um robô escolhido." }, { status: 400 });
  }
  /*
   * O QUE CADA GATILHO DE RELÓGIO PRECISA, conferido também aqui.
   *
   * A tela já cobra, mas a tela não é a guarda: sem data o gatilho "numa data e hora" nunca
   * dispararia, e sem tempo o de silêncio cairia no padrão sem que ninguém tivesse escolhido —
   * duas automações que parecem configuradas e não são.
   */
  if (dados.quando === "data_hora" && !String(dados.dataHora ?? "").trim()) {
    return NextResponse.json({ erro: "Escolha a data e a hora do gatilho." }, { status: 400 });
  }
  if (dados.quando === "sem_resposta" && !(Number(dados.esperaValor) > 0)) {
    return NextResponse.json({ erro: "Diga quanto tempo de silêncio o gatilho espera." }, { status: 400 });
  }
  if (dados.quando === "diariamente" && !String(dados.horarioDiario ?? "").trim()) {
    return NextResponse.json({ erro: "Escolha a hora da varredura diária." }, { status: 400 });
  }

  // As etapas e o robô têm que ser DESTE workspace. Sem esta checagem, um id chutado ligaria um
  // gatilho no funil de outro cliente.
  const etapas = await prisma.funilEtapa.findMany({
    where: { id: { in: etapasPedidas }, workspaceId },
    select: { id: true, funilId: true, ordem: true },
    orderBy: { ordem: "asc" },
  });
  if (etapas.length !== etapasPedidas.length) {
    return NextResponse.json({ erro: "Etapa não encontrada" }, { status: 404 });
  }
  // Um gatilho não atravessa dois funis: a faixa é uma coisa só, e ela mora numa grade só.
  if (new Set(etapas.map((e) => e.funilId)).size > 1) {
    return NextResponse.json({ erro: "As etapas precisam ser do mesmo funil." }, { status: 400 });
  }
  const etapa = etapas[0];

  // O robô só é conferido quando a ação é de robô: uma ação direta não tem fluxo nenhum.
  let fluxoId: string | null = null;
  if (tipoAcao === "robo") {
    const fluxo = await prisma.fluxoAutomacao.findFirst({
      where: { id: dados.fluxoId!, workspaceId },
      select: { id: true },
    });
    if (!fluxo) return NextResponse.json({ erro: "Robô não encontrado" }, { status: 404 });
    fluxoId = fluxo.id;
  }

  /*
   * A MESMA `ordem` PRA TODAS AS IRMÃS, e por isso o máximo entre elas.
   *
   * A faixa só aparece como uma faixa se as linhas caírem na MESMA fileira da grade — e a fileira
   * é a `ordem`. Com uma etapa que já tem dois gatilhos e outra que não tem nenhum, calcular
   * "último + 1" em cada uma poria uma na fileira 2 e a outra na 0: duas metades soltas, em
   * alturas diferentes, do que deveria ser um retângulo só.
   */
  const ultimos = await prisma.gatilhoEtapa.groupBy({
    by: ["etapaId"],
    where: { workspaceId, etapaId: { in: etapas.map((e) => e.id) } },
    _max: { ordem: true },
  });
  const proximaOrdem = ultimos.reduce((max, u) => Math.max(max, (u._max.ordem ?? -1) + 1), 0);

  const grupoId = etapas.length > 1 ? `grp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` : null;
  const comum = {
    workspaceId,
    funilId: etapa.funilId,
    quando: dados.quando,
    tipoAcao,
    fluxoId,
    acaoDados: dados.acaoDados ?? undefined,
    condicao: dados.condicao ?? undefined,
    diasAtivos: dados.diasAtivos ?? undefined,
    horaInicio: dados.horaInicio ?? null,
    horaFim: dados.horaFim ?? null,
    horarioDiario: dados.horarioDiario ?? null,
    dataHora: dados.dataHora ?? null,
    esperaValor: Number(dados.esperaValor) > 0 ? Number(dados.esperaValor) : null,
    esperaUnidade: dados.esperaUnidade ?? null,
    ativo: dados.ativo ?? true,
    ordem: proximaOrdem,
    grupoId,
  };

  await prisma.gatilhoEtapa.createMany({
    data: etapas.map((e, i) => ({
      ...comum,
      id: `gat-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      etapaId: e.id,
    })),
  });

  const criadas = await prisma.gatilhoEtapa.findMany({
    where: grupoId
      ? { workspaceId, grupoId }
      : { workspaceId, etapaId: etapa.id, ordem: proximaOrdem },
    orderBy: { id: "asc" },
  });

  // Devolve a primeira por compatibilidade com quem já lia um objeto só, e a lista inteira pra
  // quem acabou de criar uma faixa e precisa das irmãs.
  return NextResponse.json(
    { ...paraVisao(criadas[0]), irmaos: criadas.map(paraVisao) },
    { status: 201 },
  );
}
