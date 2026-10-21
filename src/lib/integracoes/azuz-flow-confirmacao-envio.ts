import { prisma } from "@/lib/prisma";
import { RITMO } from "@/lib/campanhas/ritmo";
import { enviarTextoPeloCanal } from "@/lib/conversas/enviar-pelo-canal";
import { numeroTemWhatsapp } from "@/lib/integracoes/evolution";
import { anotarNaConversa } from "@/lib/integracoes/azuz-flow-confirmacao-fila";
import { configDoFlow } from "@/lib/integracoes/azuz-flow-config";
import { lerDisjuntor, registrarFalha, registrarSucesso } from "@/lib/integracoes/azuz-flow-disjuntor";

/**
 * A fila das confirmações, processada pelo cron que já existe.
 *
 * SEM `sleep` EM NENHUM LUGAR. O ritmo não vem de dormir dentro de uma função serverless — vem de
 * duas coisas que o banco já guarda: o `enviarApos` de cada linha, sorteado com variação na hora de
 * enfileirar, e o teto de quantas saem por rodada. O cron bate de minuto em minuto; cada batida
 * leva no máximo o que cabe no ritmo do canal.
 *
 * TUDO QUE ACONTECE AQUI VIRA ESTADO NO BANCO E BOLHA NA CONVERSA. Uma confirmação que não saiu
 * precisa dizer por que não saiu, no lugar onde quem atende vai procurar — senão é uma pessoa
 * esperando uma mensagem que ninguém sabe que não foi mandada.
 */

/** Quantas tentativas antes de desistir de uma linha. Além disso, insistir é só ruído. */
const TENTATIVAS_MAXIMAS = 3;

/**
 * As duas coisas que esta fila faz FORA do banco: perguntar se o número tem WhatsApp, e mandar.
 *
 * Injetáveis pela mesma razão que as dependências da entrada do lead são: existe um teste que roda
 * contra banco de VERDADE (`scripts/teste-da-confirmacao-de-reuniao.ts`), e ele precisa exercer o
 * teto diário, o disjuntor e a janela sem mandar mensagem pra ninguém. Sem isto, provar essas
 * proteções significaria mandar WhatsApp de teste pra números de teste — ou não provar.
 */
export type DependenciasDoEnvio = {
  conferirNumero: (workspaceId: string, numero: string) => Promise<boolean | null>;
  enviar: (params: {
    workspaceId: string;
    conversaNome: string;
    texto: string;
  }) => Promise<{ enviado: boolean; motivo?: string }>;
};

const ENVIO_REAL: DependenciasDoEnvio = {
  conferirNumero: numeroTemWhatsapp,
  enviar: enviarTextoPeloCanal,
};

export type ResultadoDaRodada = {
  enviadas: number;
  /** Decididas como "não vai sair", com motivo gravado. */
  recusadas: number;
  /** Deixadas na fila pra próxima batida (pausa, teto do dia, checagem indisponível). */
  adiadas: number;
};

export async function processarConfirmacoesDeReuniao(
  limite = 30,
  deps: DependenciasDoEnvio = ENVIO_REAL,
): Promise<ResultadoDaRodada> {
  const resultado: ResultadoDaRodada = { enviadas: 0, recusadas: 0, adiadas: 0 };

  let pendentes: Awaited<ReturnType<typeof buscarPendentes>>;
  try {
    pendentes = await buscarPendentes(limite);
  } catch (erro) {
    // Tabela ainda não aplicada neste banco, ou banco fora: a rodada não acontece e o cron segue
    // com o resto do trabalho dele.
    console.error("[azuz-flow] não deu pra ler a fila de confirmações:", erro);
    return resultado;
  }
  if (!pendentes.length) return resultado;

  // Quantas já saíram por empresa NESTA rodada. É o gotejamento: o ritmo do canal não oficial são
  // 3 por minuto, e o cron bate uma vez por minuto.
  const enviadasAgora = new Map<string, number>();

  for (const linha of pendentes) {
    const jaNesta = enviadasAgora.get(linha.workspaceId) ?? 0;
    if (jaNesta >= RITMO.whatsapp_nao_oficial.porMinuto) {
      resultado.adiadas += 1;
      continue;
    }

    const saida = await tratarUma(linha, deps);
    resultado[saida] += 1;
    if (saida === "enviadas") enviadasAgora.set(linha.workspaceId, jaNesta + 1);
  }

  return resultado;
}

function buscarPendentes(limite: number) {
  return prisma.confirmacaoDeReuniao.findMany({
    where: { situacao: "na_fila", enviarApos: { lte: new Date() } },
    orderBy: { enviarApos: "asc" },
    take: limite,
  });
}

type LinhaDaFila = Awaited<ReturnType<typeof buscarPendentes>>[number];

async function tratarUma(
  linha: LinhaDaFila,
  deps: DependenciasDoEnvio,
): Promise<"enviadas" | "recusadas" | "adiadas"> {
  const config = await configDoFlow(linha.workspaceId);

  // Desligada ou pausada: FICA NA FILA. Pausar é "pare agora", não "descarte o que estava pra
  // sair" — quem religa espera encontrar o trabalho onde deixou.
  if (!config.confirmacao.ativa || config.confirmacao.pausada) return "adiadas";

  const disjuntor = await lerDisjuntor(linha.workspaceId);
  if (disjuntor.pausadoEm) return "adiadas";

  // A reunião já começou. Vale conferir AQUI de novo, e não só ao enfileirar: entre uma coisa e
  // outra passaram horas, e é justamente a fila que pode ter segurado até depois da hora.
  if (linha.inicio.getTime() <= Date.now()) {
    return recusar(linha, "Confirmação não enviada: a reunião já havia começado.");
  }

  const vinteEQuatroHoras = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Teto do dia, por empresa. Estourou: fica na fila. Não é recusa — amanhã cabe, e a reunião pode
  // ser semana que vem.
  const noDia = await prisma.confirmacaoDeReuniao.count({
    where: { workspaceId: linha.workspaceId, situacao: "enviada", enviadaEm: { gte: vinteEQuatroHoras } },
  });
  if (noDia >= config.confirmacao.tetoDiario) return "adiadas";

  // Teto por número. Este É recusa: a mesma pessoa recebendo quatro mensagens em um dia é o
  // comportamento que faz alguém denunciar, e esperar não melhora nada.
  const paraEsteNumero = await prisma.confirmacaoDeReuniao.count({
    where: {
      workspaceId: linha.workspaceId,
      telefone: linha.telefone,
      situacao: "enviada",
      enviadaEm: { gte: vinteEQuatroHoras },
    },
  });
  if (paraEsteNumero >= config.confirmacao.tetoPorNumero) {
    return recusar(
      linha,
      `Confirmação não enviada: este número já recebeu ${paraEsteNumero} confirmações nas últimas 24 horas.`,
    );
  }

  /*
   * O número tem WhatsApp?
   *
   * Três respostas. `false` é recusa definitiva. `null` é "não deu pra saber" — e aí NÃO se envia:
   * a dúvida pesa a favor de proteger o número, porque uma sequência de envios recusados é lida
   * como robô varrendo números. Fica na fila e tenta de novo, até o teto de tentativas.
   */
  const temWhatsapp = await deps.conferirNumero(linha.workspaceId, linha.telefone);
  if (temWhatsapp === false) {
    return recusar(linha, "Confirmação não enviada: este número não tem WhatsApp.");
  }
  if (temWhatsapp === null) {
    return await insistirOuDesistir(
      linha,
      "Confirmação não enviada: não deu pra conferir se o número tem WhatsApp.",
    );
  }

  if (!linha.conversaNome) {
    return recusar(linha, "Confirmação não enviada: a conversa não existe mais.");
  }

  const envio = await deps.enviar({
    workspaceId: linha.workspaceId,
    conversaNome: linha.conversaNome,
    texto: linha.texto ?? "",
  });

  if (envio.enviado) {
    await prisma.confirmacaoDeReuniao.update({
      where: { id: linha.id },
      data: { situacao: "enviada", enviadaEm: new Date(), motivo: null },
    });
    await anotarNaConversa({
      workspaceId: linha.workspaceId,
      conversaNome: linha.conversaNome,
      contaCanal: linha.canal,
      marca: "enviada",
      telefone: linha.telefone,
      inicio: linha.inicio,
      texto: "Confirmação de reunião enviada.",
    });
    await registrarSucesso(linha.workspaceId);
    return "enviadas";
  }

  const motivo = `Confirmação não enviada: ${envio.motivo ?? "o envio falhou"}.`;
  await registrarFalha({
    workspaceId: linha.workspaceId,
    motivo: envio.motivo ?? "o envio falhou",
    falhasParaPausar: config.confirmacao.falhasParaPausar,
  });
  return await insistirOuDesistir(linha, motivo);
}

/** Mais uma tentativa, ou a desistência registrada. */
async function insistirOuDesistir(linha: LinhaDaFila, motivo: string): Promise<"recusadas" | "adiadas"> {
  const tentativas = linha.tentativas + 1;
  if (tentativas >= TENTATIVAS_MAXIMAS) return recusar(linha, motivo, tentativas);

  await prisma.confirmacaoDeReuniao.update({
    where: { id: linha.id },
    data: {
      tentativas,
      motivo,
      // Espera crescente entre tentativas: insistir de minuto em minuto numa coisa que acabou de
      // falhar é o que o disjuntor existe pra impedir, em menor escala.
      enviarApos: new Date(Date.now() + tentativas * 10 * 60_000),
    },
  });
  return "adiadas";
}

async function recusar(linha: LinhaDaFila, motivo: string, tentativas?: number): Promise<"recusadas"> {
  await prisma.confirmacaoDeReuniao.update({
    where: { id: linha.id },
    data: { situacao: "nao_enviada", motivo, ...(tentativas ? { tentativas } : {}) },
  });
  if (linha.conversaNome) {
    await anotarNaConversa({
      workspaceId: linha.workspaceId,
      conversaNome: linha.conversaNome,
      contaCanal: linha.canal,
      // A marca entra no id da bolha: sem ela, a recusa gravada na entrega e a recusa gravada aqui
      // teriam o mesmo id e a segunda sumiria em silêncio.
      marca: "recusa-fila",
      telefone: linha.telefone,
      inicio: linha.inicio,
      texto: motivo,
    });
  }
  return "recusadas";
}
