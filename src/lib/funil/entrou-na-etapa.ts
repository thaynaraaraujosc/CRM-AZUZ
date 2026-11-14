import { primeiraVezPara } from "@/lib/automacoes/idempotencia";
import { minutoLocal, type QuandoGatilho } from "./gatilhos-etapa-tipos";

/**
 * "O LEAD CHEGOU NESTA ETAPA" — a porta única por onde todo mundo avisa os gatilhos.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO PRECISOU EXISTIR.
 *
 * "Às vezes o movido será que atende também às necessidades quando a pessoa entra no tráfego
 * pago? Porque pode ser na hora que eu vou mover ele para lá e pode ser quando ele entra. Ou ele
 * entrou de primeiro contato. Ele entrou direto."
 *
 * A pergunta estava certa e a resposta era pior do que ela imaginava: "Quando criado nesta etapa"
 * aparecia no menu, dava pra salvar, e NUNCA disparava pro lead que entra direto.
 *
 * O card do lead novo nasce em `funis/upsert.ts` — é por lá que passa a primeira mensagem do
 * WhatsApp (os dois webhooks) e a lista do Azuz Flow. E aquele arquivo criava o card e ia embora.
 * O único lugar que disparava "criado" era o `PUT /api/funis`, que é a tela do funil salvando o
 * quadro: ou seja, só o card criado NO BRAÇO, por quem já estava com o CRM aberto. O lead de
 * anúncio, que é justamente o que ninguém vê chegar, era o único que não acionava nada.
 *
 * Formulário tinha o mesmo buraco: a rota pública criava o card direto na etapa, sem avisar.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * E A TRAVA, QUE É O QUE TORNA ISTO SEGURO.
 *
 * Com a entrada avisando de verdade, um gatilho pode mover o lead pra outra etapa, e a etapa de
 * destino pode ter um gatilho que o move de volta. Sem trava isso gira pra sempre, mandando
 * mensagem a cada volta.
 *
 * A trava é por (etapa, contato, evento, MINUTO), e é do banco, não da memória: o processo que
 * atendeu o webhook morre em segundos e não existe estado compartilhado entre eles. Um ciclo
 * A→B→A morre na segunda chegada em A, dentro do mesmo minuto. Ela também absorve de graça o
 * reenvio de webhook da Meta e o clique repetido, que chegam juntos.
 *
 * Por MINUTO, e não pra sempre: sair da etapa e voltar amanhã é uma entrada nova de verdade, e
 * tem que disparar de novo. É a mesma régua que `/api/funis/mover` já usava.
 */

/** A chave da trava. Fora daqui ninguém formata isto: duas grafias seriam duas travas. */
export function chaveDeEntrada(
  etapaId: string,
  contatoNome: string,
  evento: QuandoGatilho,
  agora: Date,
): string {
  return `entrou:${etapaId}:${contatoNome}:${evento}:${minutoLocal(agora)}`;
}

/** Só pra teste: a trava e o disparo entram por aqui pra não precisar de banco. */
export type DependenciasDaEntrada = {
  primeiraVez: (params: { workspaceId: string; fluxoId: string; chaveEvento: string }) => Promise<boolean>;
  disparar: (params: {
    workspaceId: string;
    etapaId: string;
    contatoNome: string;
    evento: QuandoGatilho;
    agora?: Date;
  }) => Promise<void>;
};

/**
 * O IMPORT DO DISPARADOR É PREGUIÇOSO DE PROPÓSITO.
 *
 * `gatilhos-etapa.ts` importa `acoes.ts`, e `acoes.ts` precisa chamar esta função quando um robô
 * move o lead. Importado no topo, isso fecha um ciclo de módulos e um dos dois nasce `undefined`
 * — um erro que não aparece no `tsc`, só em produção, e só no caminho que roda menos.
 */
async function disparadorReal(): Promise<DependenciasDaEntrada["disparar"]> {
  const { dispararGatilhosDaEtapa } = await import("./gatilhos-etapa");
  return dispararGatilhosDaEtapa;
}

/**
 * Avisa os gatilhos daquela etapa que o lead chegou nela.
 *
 * Devolve `true` quando o disparo aconteceu e `false` quando a trava segurou. Nunca estoura: uma
 * automação com problema não pode impedir a mensagem de ser gravada nem o lead de entrar no funil.
 */
export async function avisarQueEntrouNaEtapa(params: {
  workspaceId: string;
  etapaId: string;
  contatoNome: string;
  /** "criado" pra quem nasceu aqui; "movido" pra quem veio de outra etapa. */
  evento: Extract<QuandoGatilho, "criado" | "movido">;
  agora?: Date;
  deps?: Partial<DependenciasDaEntrada>;
}): Promise<boolean> {
  const { workspaceId, etapaId, contatoNome, evento } = params;
  if (!workspaceId || !etapaId || !contatoNome) return false;

  const agora = params.agora ?? new Date();
  const trava = params.deps?.primeiraVez ?? primeiraVezPara;
  const disparar = params.deps?.disparar ?? (await disparadorReal());

  try {
    const liberado = await trava({
      workspaceId,
      // `fluxoId` aqui não é um fluxo: é o dono da trava. A tabela de execuções é a mesma que
      // todo canal já usa, e o prefixo deixa claro de quem é a linha quando alguém for investigar.
      fluxoId: `etapa:${etapaId}`,
      chaveEvento: chaveDeEntrada(etapaId, contatoNome, evento, agora),
    });
    if (!liberado) return false;

    await disparar({ workspaceId, etapaId, contatoNome, evento, agora });
    return true;
  } catch (erro) {
    console.error("[entrou-na-etapa] falha ao disparar gatilhos de entrada:", erro);
    return false;
  }
}
