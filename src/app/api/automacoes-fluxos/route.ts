import { NextResponse } from "next/server";

import type { Prisma } from "@/generated/prisma/client";
import type { FluxoAutomacao } from "@/lib/automation-flow/types";
import { prisma } from "@/lib/prisma";

/** nodes/edges/configuracoes/historicoVersoes têm tipos TS ricos (genéricos, uniões) que o Prisma
 * não consegue casar estruturalmente com `InputJsonValue` — o valor em runtime já é JSON puro (veio
 * de `request.json()`), então o cast é só pra satisfazer o TS. */
function comoJson(valor: unknown): Prisma.InputJsonValue {
  return valor as Prisma.InputJsonValue;
}

function paraFluxo(linha: {
  nodes: unknown;
  edges: unknown;
  configuracoes: unknown;
  historicoVersoes: unknown;
  [k: string]: unknown;
}): FluxoAutomacao {
  return {
    ...linha,
    nodes: linha.nodes as FluxoAutomacao["nodes"],
    edges: linha.edges as FluxoAutomacao["edges"],
    configuracoes: linha.configuracoes as FluxoAutomacao["configuracoes"],
    historicoVersoes: linha.historicoVersoes as FluxoAutomacao["historicoVersoes"],
  } as FluxoAutomacao;
}

/** GET lista todos os fluxos de automação. */
export async function GET() {
  const linhas = await prisma.fluxoAutomacao.findMany({ orderBy: { criadoEm: "asc" } });
  return NextResponse.json(linhas.map(paraFluxo));
}

/** POST cria um fluxo novo (ou uma cópia) — mesma semântica de `criarFluxo`/`duplicarFluxo`. */
export async function POST(request: Request) {
  const dados = (await request.json()) as FluxoAutomacao;

  const linha = await prisma.fluxoAutomacao.create({
    data: {
      id: dados.id,
      nome: dados.nome,
      descricao: dados.descricao,
      funilId: dados.funilId,
      etapaId: dados.etapaId,
      categoria: dados.categoria,
      status: dados.status,
      ativa: dados.ativa,
      arquivada: dados.arquivada ?? false,
      nodes: comoJson(dados.nodes),
      edges: comoJson(dados.edges),
      versaoAtual: dados.versaoAtual,
      publicadoEm: dados.publicadoEm ? new Date(dados.publicadoEm) : null,
      publicadoPor: dados.publicadoPor,
      configuracoes: comoJson(dados.configuracoes),
      execucoes: dados.execucoes,
      historicoVersoes: comoJson(dados.historicoVersoes),
      modeloDemonstracao: dados.modeloDemonstracao ?? false,
      objetivo: dados.objetivo,
    },
  });

  return NextResponse.json(paraFluxo(linha), { status: 201 });
}
