import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";

/**
 * O estado de uma automação rodando para um contato — a peça que faltava.
 *
 * Hoje o motor roda o fluxo inteiro numa chamada e joga o resultado fora. Um bloco "aguardar 2
 * horas" simplesmente descarta a execução: nada retoma, e a automação nunca continua. Aqui o
 * estado passa a viver no banco, e as duas formas de retomar ficam explícitas:
 *
 * - **por tempo**: `aguardandoAte` vence e o cron pega (mesmo padrão do disparo em massa);
 * - **por evento**: o webhook procura a execução que espera aquele contato ANTES de avaliar
 *   gatilhos novos — é isso que faz "clicou em Sim" continuar o fluxo em vez de começar outro.
 *
 * Este arquivo é só a camada de acesso: criar, avançar, parar, retomar, registrar passo. Quem
 * decide o que executar é o motor (fase seguinte).
 */

export type SituacaoExecucao =
  | "em_andamento"
  | "aguardando_tempo"
  | "aguardando_evento"
  | "concluida"
  | "cancelada"
  | "erro";

export type ContextoExecucaoPersistido = Record<string, unknown>;

export type ExecucaoAtiva = {
  id: string;
  workspaceId: string;
  fluxoId: string;
  versaoId: string | null;
  contatoId: string | null;
  contatoNome: string;
  gatilho: string;
  situacao: string;
  noAtualId: string | null;
  contexto: ContextoExecucaoPersistido;
  aguardandoEvento: string | null;
  aguardandoNoId: string | null;
  aguardandoAte: Date | null;
};

function paraExecucao(linha: {
  id: string;
  workspaceId: string;
  fluxoId: string;
  versaoId: string | null;
  contatoId: string | null;
  contatoNome: string;
  gatilho: string;
  situacao: string;
  noAtualId: string | null;
  contexto: unknown;
  aguardandoEvento: string | null;
  aguardandoNoId: string | null;
  aguardandoAte: Date | null;
}): ExecucaoAtiva {
  return {
    ...linha,
    contexto: (linha.contexto ?? {}) as ContextoExecucaoPersistido,
  };
}

/** Situações em que a execução ainda pode andar — o oposto de terminada. */
export const SITUACOES_VIVAS = ["em_andamento", "aguardando_tempo", "aguardando_evento"] as const;

export async function criarExecucao(params: {
  workspaceId: string;
  fluxoId: string;
  versaoId: string | null;
  contatoId: string | null;
  contatoNome: string;
  gatilho: string;
  noInicialId: string;
  contexto: ContextoExecucaoPersistido;
}): Promise<ExecucaoAtiva> {
  const linha = await prisma.execucaoAutomacao.create({
    data: {
      id: `exec-${randomUUID()}`,
      workspaceId: params.workspaceId,
      fluxoId: params.fluxoId,
      versaoId: params.versaoId,
      contatoId: params.contatoId,
      contatoNome: params.contatoNome,
      gatilho: params.gatilho,
      situacao: "em_andamento",
      noAtualId: params.noInicialId,
      contexto: params.contexto as never,
    },
  });
  return paraExecucao(linha);
}

/** Move a execução pro próximo nó, atualizando o que já se sabe do contato. */
export async function avancarPara(execucaoId: string, noId: string, contexto: ContextoExecucaoPersistido): Promise<void> {
  await prisma.execucaoAutomacao.update({
    where: { id: execucaoId },
    data: { noAtualId: noId, contexto: contexto as never, situacao: "em_andamento" },
  });
}

/** Para a execução esperando o relógio. O cron retoma quando `ate` passar. */
export async function aguardarTempo(params: {
  execucaoId: string;
  noId: string;
  ate: Date;
  contexto: ContextoExecucaoPersistido;
  /** Quando a espera também termina por resposta ("resposta OU 2 horas"). */
  evento?: string | null;
}): Promise<void> {
  await prisma.execucaoAutomacao.update({
    where: { id: params.execucaoId },
    data: {
      situacao: "aguardando_tempo",
      noAtualId: params.noId,
      aguardandoNoId: params.noId,
      aguardandoAte: params.ate,
      aguardandoEvento: params.evento ?? null,
      contexto: params.contexto as never,
    },
  });
}

/** Para a execução esperando algo do contato (resposta, clique). Sem prazo. */
export async function aguardarEvento(params: {
  execucaoId: string;
  noId: string;
  evento: string;
  contexto: ContextoExecucaoPersistido;
  /** Prazo máximo, quando houver — a espera vira "evento OU tempo". */
  ate?: Date | null;
}): Promise<void> {
  await prisma.execucaoAutomacao.update({
    where: { id: params.execucaoId },
    data: {
      situacao: params.ate ? "aguardando_tempo" : "aguardando_evento",
      noAtualId: params.noId,
      aguardandoNoId: params.noId,
      aguardandoEvento: params.evento,
      aguardandoAte: params.ate ?? null,
      contexto: params.contexto as never,
    },
  });
}

export async function encerrarExecucao(params: {
  execucaoId: string;
  situacao: Extract<SituacaoExecucao, "concluida" | "cancelada" | "erro">;
  erroMensagem?: string | null;
}): Promise<void> {
  await prisma.execucaoAutomacao.update({
    where: { id: params.execucaoId },
    data: {
      situacao: params.situacao,
      noAtualId: null,
      aguardandoAte: null,
      aguardandoEvento: null,
      aguardandoNoId: null,
      erroMensagem: params.erroMensagem ?? null,
      finalizadaEm: new Date(),
    },
  });
}

/**
 * A execução que está esperando um evento deste contato, a mais recente primeiro.
 *
 * É a correlação que responde "a pessoa respondeu — que fluxo continua?". Sem isto, toda mensagem
 * recebida só consegue COMEÇAR um fluxo, nunca continuar um.
 */
export async function execucaoAguardandoDoContato(params: {
  workspaceId: string;
  contatoNome: string;
  /** Filtra por um tipo de espera ("resposta", "clique"); vazio aceita qualquer uma. */
  evento?: string;
}): Promise<ExecucaoAtiva | null> {
  const linha = await prisma.execucaoAutomacao.findFirst({
    where: {
      workspaceId: params.workspaceId,
      contatoNome: params.contatoNome,
      situacao: { in: ["aguardando_evento", "aguardando_tempo"] },
      aguardandoEvento: params.evento ?? { not: null },
    },
    orderBy: { atualizadoEm: "desc" },
  });
  return linha ? paraExecucao(linha) : null;
}

/**
 * Execuções cuja espera por tempo venceu — a varredura do cron.
 *
 * Não filtra por workspace de propósito: quem chama é o cron do sistema, não uma sessão. O limite
 * existe pra uma rodada não tentar retomar dez mil execuções de uma vez.
 */
export async function execucoesComEsperaVencida(limite = 50): Promise<ExecucaoAtiva[]> {
  const linhas = await prisma.execucaoAutomacao.findMany({
    where: { situacao: "aguardando_tempo", aguardandoAte: { lte: new Date() } },
    orderBy: { aguardandoAte: "asc" },
    take: limite,
  });
  return linhas.map(paraExecucao);
}

/** Execuções vivas de um contato — usado pelas regras de concorrência ("pausar as outras"). */
export async function execucoesVivasDoContato(workspaceId: string, contatoNome: string): Promise<ExecucaoAtiva[]> {
  const linhas = await prisma.execucaoAutomacao.findMany({
    where: { workspaceId, contatoNome, situacao: { in: [...SITUACOES_VIVAS] } },
    orderBy: { iniciadaEm: "desc" },
  });
  return linhas.map(paraExecucao);
}

/**
 * Registra o que aconteceu num nó. É o "Histórico de execuções" que hoje não existe — o motor atual
 * só imprime a contagem de passos no log do servidor.
 *
 * Nunca derruba a execução: log que quebra o fluxo é pior do que log faltando.
 */
export async function registrarPasso(params: {
  execucaoId: string;
  workspaceId: string;
  noId: string;
  noTipo: string;
  titulo?: string | null;
  resultado: "ok" | "condicao_falsa" | "aguardando" | "erro" | "pulado";
  detalhe?: string | null;
  /** Detalhe técnico pra investigação (código da Meta, corpo do erro). Nunca credencial. */
  erroTecnico?: string | null;
  tentativa?: number;
}): Promise<void> {
  try {
    await prisma.passoAutomacao.create({
      data: {
        id: `passo-${randomUUID()}`,
        execucaoId: params.execucaoId,
        workspaceId: params.workspaceId,
        noId: params.noId,
        noTipo: params.noTipo,
        titulo: params.titulo ?? null,
        resultado: params.resultado,
        detalhe: params.detalhe ?? null,
        erroTecnico: params.erroTecnico ?? null,
        tentativa: params.tentativa ?? 1,
      },
    });
  } catch (erro) {
    console.error("[automacao] falha ao registrar passo:", erro instanceof Error ? erro.message : erro);
  }
}

/** Os passos de uma execução, em ordem — a tela de histórico. */
export async function passosDaExecucao(workspaceId: string, execucaoId: string) {
  return prisma.passoAutomacao.findMany({
    where: { execucaoId, workspaceId },
    orderBy: { criadoEm: "asc" },
  });
}
