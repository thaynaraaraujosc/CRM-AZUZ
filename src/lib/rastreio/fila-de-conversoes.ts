import { randomBytes } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  MAXIMO_DE_TENTATIVAS,
  chaveDeIdempotencia,
  motivoParaPular,
  proximaTentativaEm,
  resumirPedido,
  type PlataformaDeConversao,
} from "@/lib/rastreio/eventos-de-conversao";

/**
 * A FILA, do lado do banco: enfileirar, varrer, registrar o que aconteceu.
 *
 * O que decide mora em `eventos-de-conversao.ts`, que é puro e testável. Aqui é só o encanamento:
 * gravar a linha sem duplicar, achar o que está vencido, e anotar o resultado de cada tentativa.
 *
 * NUNCA LANÇA pra fora nas funções chamadas de dentro de um fluxo de usuário: enfileirar uma
 * conversão não pode derrubar a mudança de etapa que a originou. Conversão é o acessório; mover o
 * card é o essencial.
 */

export type PedidoDeConversao = {
  workspaceId: string;
  contatoId: string;
  plataforma: PlataformaDeConversao;
  contaId?: string | null;
  evento: string;
  eventoEm?: Date;
  valor?: number | null;
  moeda?: string | null;
  /** O que identifica ESTE resultado (o negócio, a reunião). Entra na chave de idempotência. */
  resultadoId?: string | null;
  /** Os identificadores do lead, só pra decidir se dá pra mandar. Não são gravados. */
  identificadores: {
    gclid?: string | null;
    fbclid?: string | null;
    ctwaClid?: string | null;
    ttclid?: string | null;
    igSid?: string | null;
    gclientid?: string | null;
    email?: string | null;
    telefone?: string | null;
  };
};

export type ResultadoDoEnfileiramento =
  | { enfileirado: true; id: string }
  | { enfileirado: false; motivo: "ja-existe" | "pulado" | "falha"; detalhe?: string };

/**
 * Põe uma conversão na fila — ou explica por que ela não vai.
 *
 * A linha "pulada" é gravada IGUAL, e isso é de propósito: "este lead não foi mandado porque não
 * tem gclid nem e-mail" é exatamente a resposta que falta quando alguém compara o relatório do
 * CRM com o do Google. Não gravar nada deixaria o caso invisível, que é como ele era antes.
 */
export async function enfileirarConversao(
  cliente: PrismaClient,
  pedido: PedidoDeConversao,
): Promise<ResultadoDoEnfileiramento> {
  const chave = chaveDeIdempotencia({
    workspaceId: pedido.workspaceId,
    contatoId: pedido.contatoId,
    plataforma: pedido.plataforma,
    evento: pedido.evento,
    resultadoId: pedido.resultadoId,
  });

  const veredito = motivoParaPular({
    evento: pedido.evento,
    valor: pedido.valor,
    moeda: pedido.moeda,
    identificadores: pedido.identificadores,
    plataforma: pedido.plataforma,
  });

  try {
    const jaExiste = await cliente.eventoDeConversao.findUnique({ where: { chaveIdempotencia: chave } });
    if (jaExiste) return { enfileirado: false, motivo: "ja-existe" };

    await cliente.eventoDeConversao.create({
      data: {
        id: `conv-${randomBytes(12).toString("hex")}`,
        workspaceId: pedido.workspaceId,
        contatoId: pedido.contatoId,
        plataforma: pedido.plataforma,
        contaId: pedido.contaId ?? null,
        evento: pedido.evento,
        eventoEm: pedido.eventoEm ?? new Date(),
        valor: pedido.valor ?? null,
        moeda: pedido.moeda ?? null,
        chaveIdempotencia: chave,
        status: veredito.pular ? "pulado" : "pendente",
        motivo: veredito.pular ? veredito.motivo : null,
        resumoPedido: resumirPedido({
          plataforma: pedido.plataforma,
          evento: pedido.evento,
          valor: pedido.valor,
          moeda: pedido.moeda,
          identificadores: pedido.identificadores,
        }),
      },
    });
    if (veredito.pular) return { enfileirado: false, motivo: "pulado", detalhe: veredito.motivo };
    return { enfileirado: true, id: chave };
  } catch (erro) {
    // Corrida entre duas rodadas: a chave única do banco recusou a segunda. É o comportamento
    // certo, e não é erro — o importante é que só uma linha existe.
    if (erro && typeof erro === "object" && "code" in erro && (erro as { code?: string }).code === "P2002") {
      return { enfileirado: false, motivo: "ja-existe" };
    }
    // Nenhum dado do lead no log: id do contato e nada mais.
    console.error("[conversoes] falha ao enfileirar:", { contatoId: pedido.contatoId, erro });
    return { enfileirado: false, motivo: "falha" };
  }
}

/** O que está esperando: pendente, com a hora vencida, mais antigo primeiro. */
export async function conversoesPendentes(
  cliente: PrismaClient,
  workspaceId: string,
  limite = 50,
  agora: Date = new Date(),
) {
  return cliente.eventoDeConversao.findMany({
    where: {
      workspaceId,
      status: "pendente",
      OR: [{ proximaEm: null }, { proximaEm: { lte: agora } }],
    },
    orderBy: { criadoEm: "asc" },
    take: limite,
  });
}

export type ResultadoDoEnvio =
  | { ok: true; resposta?: string }
  | { ok: false; erro: string; codigo?: string; definitivo?: boolean };

/**
 * Anota o resultado de uma tentativa.
 *
 * Falha DEFINITIVA (conta desconectada, evento recusado por regra) não vira espera: repetir cinco
 * vezes algo que a plataforma já disse que não aceita só atrasa a descoberta. Falha passageira
 * (rede, limite de uso) ganha a próxima janela — e, esgotadas as tentativas, a linha para e fica
 * esperando alguém, que é o que o botão de reprocessar existe pra fazer.
 */
export async function registrarTentativa(
  cliente: PrismaClient,
  id: string,
  resultado: ResultadoDoEnvio,
  agora: Date = new Date(),
): Promise<void> {
  const linha = await cliente.eventoDeConversao.findUnique({ where: { id } });
  if (!linha) return;
  const tentativas = linha.tentativas + 1;

  if (resultado.ok) {
    await cliente.eventoDeConversao.update({
      where: { id },
      data: {
        status: "enviado",
        tentativas,
        enviadoEm: agora,
        proximaEm: null,
        motivo: null,
        codigoErro: null,
        resumoResposta: resultado.resposta?.slice(0, 500) ?? null,
      },
    });
    return;
  }

  const proxima = resultado.definitivo ? null : proximaTentativaEm(tentativas, agora);
  await cliente.eventoDeConversao.update({
    where: { id },
    data: {
      status: "falhou",
      tentativas,
      proximaEm: proxima,
      motivo: resultado.erro.slice(0, 500),
      codigoErro: resultado.codigo ?? null,
      resumoResposta: resultado.erro.slice(0, 500),
    },
  });
}

/**
 * Põe uma linha de volta na fila, à mão.
 *
 * Zera a espera e as tentativas, e NÃO mexe no que já foi enviado: é a chave única que garante
 * que reprocessar não produz um segundo envio da mesma conversão. Devolve `false` quando a linha
 * não pode ser reprocessada, pra a tela poder dizer por quê em vez de fingir que fez.
 */
export async function reprocessarConversao(
  cliente: PrismaClient,
  workspaceId: string,
  id: string,
): Promise<boolean> {
  const linha = await cliente.eventoDeConversao.findFirst({ where: { id, workspaceId } });
  if (!linha || (linha.status !== "falhou" && linha.status !== "pulado")) return false;
  await cliente.eventoDeConversao.update({
    where: { id },
    data: { status: "pendente", tentativas: 0, proximaEm: null, motivo: null, codigoErro: null },
  });
  return true;
}

/** Quantas linhas estão em cada estado. É o que o alerta da tela observa. */
export async function resumoDaFila(cliente: PrismaClient, workspaceId: string) {
  const linhas = await cliente.eventoDeConversao.groupBy({
    by: ["status"],
    where: { workspaceId },
    _count: { _all: true },
  });
  const por = (s: string) => linhas.find((l) => l.status === s)?._count._all ?? 0;
  const falharam = por("falhou");
  const enviados = por("enviado");
  return {
    pendentes: por("pendente"),
    enviados,
    falharam,
    pulados: por("pulado"),
    estornados: por("estornado"),
    /** Esgotou as tentativas e parou: ninguém mais vai tentar sem alguém apertar o botão. */
    paradas: await cliente.eventoDeConversao.count({
      where: { workspaceId, status: "falhou", tentativas: { gte: MAXIMO_DE_TENTATIVAS } },
    }),
  };
}
