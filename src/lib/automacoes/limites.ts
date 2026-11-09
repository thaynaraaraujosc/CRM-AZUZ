import { prisma } from "@/lib/prisma";
import type { ConfiguracoesFluxo } from "@/lib/automation-flow/types";

import { encerrarExecucao, execucoesVivasDoContato, SITUACOES_VIVAS } from "./execucoes";

/**
 * As regras de "pode começar de novo?": que existiam nas Configurações do fluxo mas nunca eram
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

export type ModoDeConcorrencia = NonNullable<ConfiguracoesFluxo["concorrencia"]>;

/**
 * O CONTATO JÁ ESTÁ EM OUTRA AUTOMAÇÃO: esta começa, não começa, ou derruba as outras?
 *
 * Pura de propósito, e separada da ida ao banco: é a tabela de decisão da chave "Outras
 * automações ao mesmo tempo", e é ela que tem teste. `outras` são as execuções VIVAS do contato em
 * fluxos DIFERENTES deste — o mesmo fluxo já é assunto de "não iniciar se já estiver nesse fluxo"
 * e de "cancelar a execução anterior", e governá-lo duas vezes faria duas chaves se contradizerem.
 */
export function decidirConcorrencia(
  modo: ModoDeConcorrencia,
  outras: { id: string; fluxoId: string }[],
): { pode: boolean; encerrar: string[]; motivo?: string } {
  if (modo === "permitir" || outras.length === 0) return { pode: true, encerrar: [] };
  if (modo === "nao_iniciar") {
    return {
      pode: false,
      encerrar: [],
      motivo:
        outras.length === 1
          ? "o contato já está em outra automação"
          : `o contato já está em outras ${outras.length} automações`,
    };
  }
  return { pode: true, encerrar: outras.map((e) => e.id) };
}

export async function podeIniciar(params: {
  workspaceId: string;
  fluxoId: string;
  contatoNome: string;
  configuracoes: ConfiguracoesFluxo | null | undefined;
  agora?: Date;
  /**
   * Pula a regra de concorrência.
   *
   * É o bloco "Executar robô" chamando o próximo: aquilo é passagem de bastão desenhada à mão, e
   * quem a desenhou sabia que o robô de origem ainda estava vivo — ele é quem está chamando.
   * Bloquear ali seria desligar o desenho em vez de evitar atropelo.
   */
  ignorarConcorrencia?: boolean;
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
  if (limite === "sempre" || limite === "uma_vez_por_entrada") return concorrencia(params, cfg);

  if (limite === "no_maximo") {
    const teto = Math.max(1, Math.round(cfg.maximoExecucoes ?? 1));
    const quantas = await prisma.execucaoAutomacao.count({
      where: { workspaceId: params.workspaceId, fluxoId: params.fluxoId, contatoNome: params.contatoNome },
    });
    if (quantas >= teto) {
      return {
        pode: false,
        motivo: `esse fluxo já rodou ${quantas} ${quantas === 1 ? "vez" : "vezes"} para este contato (o teto é ${teto})`,
      };
    }
    return concorrencia(params, cfg);
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
  if (!jaRodou) return concorrencia(params, cfg);

  return { pode: false, motivo: MOTIVO[limite] ?? "limite de execução atingido" };
}

/**
 * A regra de concorrência, aplicada POR ÚLTIMO.
 *
 * Por último porque "encerrar as outras" derruba execução de verdade: fazer isso antes de saber se
 * esta automação pode rodar deixaria o contato sem nenhuma — a dela bloqueada por "uma vez por
 * contato" e as outras já canceladas.
 */
async function concorrencia(
  params: { workspaceId: string; fluxoId: string; contatoNome: string; ignorarConcorrencia?: boolean },
  cfg: ConfiguracoesFluxo,
): Promise<Veredito> {
  const modo = cfg.concorrencia ?? "permitir";
  if (modo === "permitir" || params.ignorarConcorrencia) return { pode: true };

  const vivas = await execucoesVivasDoContato(params.workspaceId, params.contatoNome);
  const decisao = decidirConcorrencia(
    modo,
    vivas.filter((e) => e.fluxoId !== params.fluxoId),
  );
  if (!decisao.pode) return { pode: false, motivo: decisao.motivo ?? "o contato já está em outra automação" };

  for (const execucaoId of decisao.encerrar) {
    await encerrarExecucao({
      execucaoId,
      situacao: "cancelada",
      erroMensagem: "Encerrada por outra automação que não divide o contato.",
    });
  }
  return { pode: true };
}

const MOTIVO: Record<string, string> = {
  uma_vez_por_contato: "esse fluxo já rodou uma vez para este contato",
  uma_vez_por_dia: "esse fluxo já rodou para este contato nas últimas 24 horas",
  uma_vez_por_semana: "esse fluxo já rodou para este contato nos últimos 7 dias",
  uma_vez_por_mes: "esse fluxo já rodou para este contato nos últimos 30 dias",
};

/** Quantas execuções vivas o workspace tem. Usado pra não deixar um fluxo em laço consumir tudo. */
export async function execucoesVivasNoWorkspace(workspaceId: string): Promise<number> {
  return prisma.execucaoAutomacao.count({ where: { workspaceId, situacao: { in: [...SITUACOES_VIVAS] } } });
}
