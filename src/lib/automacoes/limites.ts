import { prisma } from "@/lib/prisma";
import type { ConfiguracoesFluxo } from "@/lib/automation-flow/types";

import { encerrarExecucao, execucoesVivasDoContato, SITUACOES_VIVAS } from "./execucoes";

/**
 * As regras de "pode começar de novo?" — que existiam nas Configurações do fluxo mas nunca eram
 * consultadas por ninguém.
 *
 * Era um caso de botão que não faz nada: a pessoa marcava "uma vez por contato" e o fluxo disparava
 * toda vez assim mesmo. Agora as três regras valem de verdade, e é o histórico de execuções (que só
 * o motor com estado mantém) que permite responder à pergunta.
 */
export type Veredito = { pode: true } | { pode: false; motivo: string };

const JANELAS: Record<string, number | null> = {
  // `null` = sem janela: vale pra vida inteira do contato.
  uma_vez_por_contato: null,
  uma_vez_por_dia: 24 * 60 * 60 * 1000,
  uma_vez_por_semana: 7 * 24 * 60 * 60 * 1000,
  uma_vez_por_mes: 30 * 24 * 60 * 60 * 1000,
};

export async function podeIniciar(params: {
  workspaceId: string;
  fluxoId: string;
  contatoNome: string;
  configuracoes: ConfiguracoesFluxo | null | undefined;
  agora?: Date;
}): Promise<Veredito> {
  const cfg = params.configuracoes ?? {};
  const agora = params.agora ?? new Date();

  // "Cancelar execução anterior" vem primeiro de propósito: ele muda o estado que as outras regras
  // leem. Reiniciar o fluxo significa que a execução antiga não está mais no caminho de ninguém.
  if (cfg.cancelarExecucaoAnterior) {
    const vivas = await execucoesVivasDoContato(params.workspaceId, params.contatoNome);
    for (const viva of vivas.filter((e) => e.fluxoId === params.fluxoId)) {
      await encerrarExecucao({ execucaoId: viva.id, situacao: "cancelada", erroMensagem: "Reiniciado por um disparo novo." });
    }
  } else if (cfg.naoIniciarSeJaNoFluxo) {
    const vivas = await execucoesVivasDoContato(params.workspaceId, params.contatoNome);
    if (vivas.some((e) => e.fluxoId === params.fluxoId)) {
      return { pode: false, motivo: "o contato já está nesse fluxo" };
    }
  }

  const limite = cfg.limiteExecucao ?? "sempre";
  // "sempre" e "uma vez por entrada" não travam nada aqui: cada entrada na etapa é um evento novo,
  // e é o próprio gatilho que decide se houve entrada.
  if (limite === "sempre" || limite === "uma_vez_por_entrada") return { pode: true };

  if (limite === "no_maximo") {
    const teto = Math.max(1, Math.round(cfg.maximoExecucoes ?? 1));
    const quantas = await prisma.execucaoAutomacao.count({
      where: { workspaceId: params.workspaceId, fluxoId: params.fluxoId, contatoNome: params.contatoNome },
    });
    return quantas < teto
      ? { pode: true }
      : { pode: false, motivo: `esse fluxo já rodou ${quantas} ${quantas === 1 ? "vez" : "vezes"} para este contato (o teto é ${teto})` };
  }

  const janela = JANELAS[limite];
  const desde = janela === null || janela === undefined ? undefined : new Date(agora.getTime() - janela);

  const jaRodou = await prisma.execucaoAutomacao.count({
    where: {
      workspaceId: params.workspaceId,
      fluxoId: params.fluxoId,
      contatoNome: params.contatoNome,
      ...(desde ? { iniciadaEm: { gte: desde } } : {}),
    },
  });
  if (!jaRodou) return { pode: true };

  return { pode: false, motivo: MOTIVO[limite] ?? "limite de execução atingido" };
}

const MOTIVO: Record<string, string> = {
  uma_vez_por_contato: "esse fluxo já rodou uma vez para este contato",
  uma_vez_por_dia: "esse fluxo já rodou para este contato nas últimas 24 horas",
  uma_vez_por_semana: "esse fluxo já rodou para este contato nos últimos 7 dias",
  uma_vez_por_mes: "esse fluxo já rodou para este contato nos últimos 30 dias",
};

/** Quantas execuções vivas o workspace tem — usado pra não deixar um fluxo em laço consumir tudo. */
export async function execucoesVivasNoWorkspace(workspaceId: string): Promise<number> {
  return prisma.execucaoAutomacao.count({ where: { workspaceId, situacao: { in: [...SITUACOES_VIVAS] } } });
}
