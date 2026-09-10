import { dispararAutomacoesDoCrm } from "@/lib/automation-flow/disparar-no-servidor";
import { dispararGatilhosDoLead } from "@/lib/funil/gatilhos-etapa";
import { emSegundoPlano } from "./segundo-plano";

/**
 * Os gatilhos que nascem de uma mudança no próprio CRM. E não de uma mensagem que chegou.
 *
 * Estes blocos existiam na biblioteca e nunca disparavam: ninguém os acionava. Quem montasse um
 * fluxo com "Etiqueta adicionada" ficava esperando pra sempre, sem nenhum erro na tela. O pior
 * tipo de defeito, porque parece que a automação está funcionando e só não deu a hora.
 *
 * Tudo aqui falha em silêncio de propósito: disparar automação é efeito secundário de salvar um
 * contato. Se der errado, o contato tem que ficar salvo do mesmo jeito.
 */
function disparar(params: Parameters<typeof dispararAutomacoesDoCrm>[0]): void {
  // `emSegundoPlano` e não `void promessa`: ver o comentário longo em `segundo-plano.ts`. Com
  // `void`, a plataforma podia matar o disparo no instante em que a resposta HTTP saía, e a
  // automação simplesmente não acontecia, sem erro em lugar nenhum.
  emSegundoPlano(`gatilho ${params.tipoGatilho}`, () => dispararAutomacoesDoCrm(params));

  // O mesmo evento também acorda os gatilhos da ETAPA em que o lead está. É o que faz "quando
  // mudarem a etiqueta de alguém que está em Follow-up" existir de verdade, e não só na tela.
  emSegundoPlano(`gatilho de etapa ${params.tipoGatilho}`, () =>
    dispararGatilhosDoLead({
      workspaceId: params.workspaceId,
      contatoNome: params.contatoNome,
      tipoGatilho: params.tipoGatilho,
    }),
  );
}

/** Contato novo no CRM: veio de mensagem, de formulário, de importação ou da mão de alguém. */
export function aoCriarContato(params: { workspaceId: string; contatoNome: string; contatoId?: string }): void {
  disparar({
    workspaceId: params.workspaceId,
    contatoNome: params.contatoNome,
    tipoGatilho: "lead_criado",
    // Um contato só é criado uma vez; a chave impede o disparo duplo de dois cliques ou de um
    // retry de rede.
    chaveEvento: `contato:${params.contatoId ?? params.contatoNome}`,
  });
}

type FotoDoContato = {
  etiquetas?: unknown;
  responsavel?: string | null;
  [campo: string]: unknown;
};

/** Lista de etiquetas, seja qual for o formato guardado (Json do banco, array, nulo). */
function etiquetasDe(contato: FotoDoContato | null | undefined): string[] {
  const valor = contato?.etiquetas;
  return Array.isArray(valor) ? valor.filter((e): e is string => typeof e === "string") : [];
}

/**
 * Compara o contato antes e depois de uma edição e dispara o que mudou.
 *
 * Uma edição pode acionar mais de um gatilho. Trocar o responsável e acrescentar uma etiqueta no
 * mesmo salvamento são duas coisas que aconteceram, e cada fluxo interessado precisa saber da sua.
 */
export function aoAtualizarContato(params: {
  workspaceId: string;
  contatoNome: string;
  antes: FotoDoContato | null;
  depois: FotoDoContato;
}): void {
  const { workspaceId, contatoNome, antes, depois } = params;
  if (!antes) return;

  const etiquetasAntes = etiquetasDe(antes);
  const etiquetasDepois = etiquetasDe(depois);

  for (const nova of etiquetasDepois.filter((e) => !etiquetasAntes.includes(e))) {
    disparar({ workspaceId, contatoNome, tipoGatilho: "etiqueta_adicionada", chaveEvento: chave("etiqueta+", contatoNome, nova) });
  }
  for (const saiu of etiquetasAntes.filter((e) => !etiquetasDepois.includes(e))) {
    disparar({ workspaceId, contatoNome, tipoGatilho: "etiqueta_removida", chaveEvento: chave("etiqueta-", contatoNome, saiu) });
  }

  if ((antes.responsavel ?? null) !== (depois.responsavel ?? null)) {
    disparar({
      workspaceId,
      contatoNome,
      tipoGatilho: "responsavel_alterado",
      chaveEvento: chave("responsavel", contatoNome, String(depois.responsavel ?? "")),
    });
  }

  // Qualquer outro campo do contato. Etiqueta e responsável ficam de fora porque já têm gatilho
  // próprio: senão uma troca de responsável dispararia dois fluxos diferentes sem a pessoa pedir.
  const ignorados = new Set(["etiquetas", "responsavel", "atualizadoEm", "criadoEm", "id", "workspaceId"]);
  const mudou = Object.keys(depois).some(
    (campo) => !ignorados.has(campo) && JSON.stringify(antes[campo] ?? null) !== JSON.stringify(depois[campo] ?? null),
  );
  if (mudou) {
    disparar({ workspaceId, contatoNome, tipoGatilho: "campo_alterado", chaveEvento: chave("campo", contatoNome, "") });
  }
}

/** O lead saiu de uma etapa do funil. O par de "entrou". */
export function aoSairDaEtapa(params: {
  workspaceId: string;
  contatoNome: string;
  funilId?: string;
  etapaId: string;
  etapaTitulo?: string;
  cardId: string;
}): void {
  disparar({
    workspaceId: params.workspaceId,
    contatoNome: params.contatoNome,
    tipoGatilho: "lead_saiu_etapa",
    funilId: params.funilId,
    etapaId: params.etapaId,
    etapaTitulo: params.etapaTitulo,
    chaveEvento: chave("saiu", params.cardId, params.etapaId),
  });
}

/** Chave de idempotência com o minuto: segura clique repetido e retry de rede, sem segurar a mesma
 * mudança feita de novo amanhã. Que é um acontecimento novo. */
function chave(prefixo: string, alvo: string, valor: string): string {
  return `${prefixo}:${alvo}:${valor}:${new Date().toISOString().slice(0, 16)}`;
}


/** Tarefa criada pra um contato. */
export function aoCriarTarefa(params: { workspaceId: string; contatoNome: string; tarefaId: string }): void {
  if (!params.contatoNome?.trim()) return;
  disparar({
    workspaceId: params.workspaceId,
    contatoNome: params.contatoNome,
    tipoGatilho: "tarefa_criada",
    chaveEvento: `tarefa+:${params.tarefaId}`,
  });
}

/** Tarefa marcada como concluída. Só na virada: marcar uma tarefa já concluída não é acontecimento. */
export function aoConcluirTarefa(params: {
  workspaceId: string;
  contatoNome: string;
  tarefaId: string;
  estavaConcluida: boolean;
  agoraConcluida: boolean;
}): void {
  if (!params.contatoNome?.trim()) return;
  if (params.estavaConcluida || !params.agoraConcluida) return;
  disparar({
    workspaceId: params.workspaceId,
    contatoNome: params.contatoNome,
    tipoGatilho: "tarefa_concluida",
    chaveEvento: `tarefa-ok:${params.tarefaId}`,
  });
}

/** Compromisso da agenda: agendado, confirmado, cancelado, ou o cliente não apareceu. */
export function aoMudarCompromisso(params: {
  workspaceId: string;
  contatoNome: string;
  compromissoId: string;
  situacao: string;
}): void {
  if (!params.contatoNome?.trim()) return;
  const porSituacao: Record<string, string> = {
    agendado: "consulta_agendada",
    confirmado: "consulta_confirmada",
    cancelado: "consulta_cancelada",
    faltou: "cliente_nao_compareceu",
    nao_compareceu: "cliente_nao_compareceu",
  };
  const tipoGatilho = porSituacao[params.situacao?.toLowerCase()];
  if (!tipoGatilho) return;
  disparar({
    workspaceId: params.workspaceId,
    contatoNome: params.contatoNome,
    tipoGatilho,
    chaveEvento: `agenda:${params.compromissoId}:${tipoGatilho}`,
  });
}
