import { prisma } from "@/lib/prisma";
import type { ConfiguracoesFluxo, FlowEdge, FlowNode, VersaoFluxo } from "@/lib/automation-flow/types";

/**
 * Versões publicadas de uma automação.
 *
 * A regra que este arquivo existe pra sustentar: **o que roda é o que foi publicado**, não o que
 * está aberto no editor. Hoje o servidor executa `FluxoAutomacao.nodes`, que é o rascunho — quem
 * está mexendo no fluxo altera, sem querer, o comportamento dos leads naquele instante. Com a
 * versão numa linha própria, publicar é um ato, e uma execução aponta pra versão que ela começou.
 *
 * `FluxoAutomacao.historicoVersoes` (Json) continua sendo escrito pelo editor enquanto a migração
 * acontece — só que deixa de ser a fonte da verdade. Ver `scripts/migrar-versoes-automacao.ts`.
 */
export type VersaoPublicada = {
  id: string;
  fluxoId: string;
  versao: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  configuracoes: ConfiguracoesFluxo;
  publicadoEm: Date;
  publicadoPor: string | null;
};

function paraVersao(linha: {
  id: string;
  fluxoId: string;
  versao: number;
  nodes: unknown;
  edges: unknown;
  configuracoes: unknown;
  publicadoEm: Date;
  publicadoPor: string | null;
}): VersaoPublicada {
  return {
    id: linha.id,
    fluxoId: linha.fluxoId,
    versao: linha.versao,
    nodes: (linha.nodes ?? []) as FlowNode[],
    edges: (linha.edges ?? []) as FlowEdge[],
    configuracoes: (linha.configuracoes ?? {}) as ConfiguracoesFluxo,
    publicadoEm: linha.publicadoEm,
    publicadoPor: linha.publicadoPor,
  };
}

/**
 * Grava uma publicação. Idempotente por (fluxo, versão): publicar duas vezes o mesmo número — dois
 * cliques, um retry de rede — atualiza a linha em vez de criar outra ou estourar.
 */
export async function publicarVersao(params: {
  workspaceId: string;
  fluxoId: string;
  versao: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  configuracoes: ConfiguracoesFluxo;
  publicadoPor?: string | null;
  publicadoEm?: Date;
}): Promise<VersaoPublicada> {
  const conteudo = {
    nodes: params.nodes as never,
    edges: params.edges as never,
    configuracoes: params.configuracoes as never,
    publicadoPor: params.publicadoPor ?? null,
    ...(params.publicadoEm ? { publicadoEm: params.publicadoEm } : {}),
  };
  const linha = await prisma.versaoAutomacao.upsert({
    where: { fluxoId_versao: { fluxoId: params.fluxoId, versao: params.versao } },
    create: {
      id: `ver-${params.fluxoId}-${params.versao}`,
      workspaceId: params.workspaceId,
      fluxoId: params.fluxoId,
      versao: params.versao,
      ...conteudo,
    },
    update: conteudo,
  });
  return paraVersao(linha);
}

/** A versão publicada mais recente — é a que um lead novo começa a rodar. `null` quando o fluxo
 * nunca foi publicado (só rascunho): nesse caso ele não deve executar nada. */
export async function versaoAtualPublicada(workspaceId: string, fluxoId: string): Promise<VersaoPublicada | null> {
  const linha = await prisma.versaoAutomacao.findFirst({
    where: { workspaceId, fluxoId },
    orderBy: { versao: "desc" },
  });
  return linha ? paraVersao(linha) : null;
}

/** Uma versão específica — é o que uma execução em andamento carrega, pra terminar do jeito que
 * começou mesmo se o fluxo for republicado no meio. */
export async function versaoPorId(workspaceId: string, versaoId: string): Promise<VersaoPublicada | null> {
  const linha = await prisma.versaoAutomacao.findFirst({ where: { id: versaoId, workspaceId } });
  return linha ? paraVersao(linha) : null;
}

/** Todas as publicações de um fluxo, da mais nova pra mais antiga (tela de histórico). */
export async function listarVersoes(workspaceId: string, fluxoId: string): Promise<VersaoPublicada[]> {
  const linhas = await prisma.versaoAutomacao.findMany({
    where: { workspaceId, fluxoId },
    orderBy: { versao: "desc" },
  });
  return linhas.map(paraVersao);
}

/** Converte o formato antigo (dentro do Json do fluxo) pro que `publicarVersao` espera. Usado pela
 * migração e por qualquer código que ainda leia o histórico velho. */
export function daVersaoAntiga(v: VersaoFluxo): {
  versao: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  configuracoes: ConfiguracoesFluxo;
  publicadoPor: string | null;
  publicadoEm: Date | undefined;
} {
  return {
    versao: v.versao,
    nodes: v.nodes ?? [],
    edges: v.edges ?? [],
    configuracoes: v.configuracoes ?? {},
    publicadoPor: v.publicadoPor ?? null,
    publicadoEm: v.publicadoEm ? new Date(v.publicadoEm) : undefined,
  };
}
