/**
 * A FILA DE CONVERSÕES: o que vai ser mandado pra plataforma de anúncio, e o que já foi.
 *
 * Tudo aqui é PURO — sem banco, sem rede, sem React. É a parte que decide: qual é a chave que
 * impede o envio duplicado, quando tentar de novo depois de uma falha, o que é motivo pra não
 * mandar, e como resumir um pedido sem copiar dado pessoal pra dentro de um log.
 *
 * POR QUE UMA FILA, e não mandar na hora em que a venda é marcada. Marcar um negócio como ganho é
 * uma ação da pessoa, no meio do trabalho dela: pendurar nela uma chamada de rede faria o botão
 * demorar e faria a venda deixar de ser devolvida sempre que a plataforma estivesse fora do ar.
 * Com fila, o clique grava uma linha e acabou; quem conversa com o Google e com a Meta é uma
 * rodada que tenta de novo sozinha e que ninguém está esperando.
 */

/** Os eventos genéricos do CRM. O nome que cada plataforma usa é tradução do adaptador dela. */
export const EVENTOS_DE_CONVERSAO = [
  { valor: "lead_created", label: "Lead novo" },
  { valor: "lead_qualified", label: "Lead qualificado" },
  { valor: "appointment_scheduled", label: "Consulta/reunião agendada" },
  { valor: "proposal_sent", label: "Proposta enviada" },
  { valor: "purchase", label: "Venda ganha" },
  { valor: "lead_lost", label: "Venda perdida" },
] as const;

export type EventoDeConversao = (typeof EVENTOS_DE_CONVERSAO)[number]["valor"];

export const PLATAFORMAS_DE_CONVERSAO = [
  { valor: "meta", label: "Meta (Conversions API)" },
  { valor: "google", label: "Google Ads" },
  { valor: "tiktok", label: "TikTok Ads" },
  { valor: "ga4", label: "Google Analytics 4" },
] as const;

export type PlataformaDeConversao = (typeof PLATAFORMAS_DE_CONVERSAO)[number]["valor"];

export type StatusDaConversao = "pendente" | "enviado" | "falhou" | "pulado" | "estornado";

export function rotuloDoEvento(evento: string): string {
  return EVENTOS_DE_CONVERSAO.find((e) => e.valor === evento)?.label ?? evento;
}

export function rotuloDaPlataforma(plataforma: string): string {
  return PLATAFORMAS_DE_CONVERSAO.find((p) => p.valor === plataforma)?.label ?? plataforma;
}

export const ROTULO_DO_STATUS: Record<StatusDaConversao, string> = {
  pendente: "Na fila",
  enviado: "Enviado",
  falhou: "Falhou",
  pulado: "Não enviado",
  estornado: "Estornado",
};

/**
 * A CHAVE QUE IMPEDE A MESMA CONVERSÃO DE IR DUAS VEZES.
 *
 * Workspace, lead, plataforma, evento e RESULTADO. O resultado entra porque o mesmo lead pode
 * fechar duas vendas de verdade — e aí são duas conversões legítimas, com negócios diferentes —,
 * enquanto a mesma venda reprocessada tem o mesmo resultado e precisa ser recusada.
 *
 * Sem o resultado, reprocessar uma venda reenviaria; com ele, reprocessar ACHA a linha existente e
 * mexe nela, que é o comportamento certo. É por isso que ela é `@unique` no banco e não só uma
 * conferência no código: duas rodadas ao mesmo tempo passariam pela conferência e as duas
 * gravariam.
 */
export function chaveDeIdempotencia(params: {
  workspaceId: string;
  contatoId: string;
  plataforma: string;
  evento: string;
  /** O negócio, a reunião, a etapa — o que identifica ESTE resultado. Vazio vira "unico". */
  resultadoId?: string | null;
}): string {
  const resultado = (params.resultadoId ?? "").trim() || "unico";
  return [params.workspaceId, params.contatoId, params.plataforma, params.evento, resultado].join(":");
}

/** Depois de quantas falhas a fila desiste e deixa a linha parada esperando alguém. */
export const MAXIMO_DE_TENTATIVAS = 5;

/**
 * QUANDO TENTAR DE NOVO: 5min, 20min, 1h20, 5h20, e aí para.
 *
 * Crescente porque as falhas que valem a pena repetir são as passageiras (rede, limite de uso,
 * plataforma fora do ar) e elas se resolvem em minutos ou horas. Repetir de minuto em minuto não
 * acelera nada e multiplica a chance de bater num limite de uso — que é justamente uma das falhas
 * que estamos tentando contornar.
 */
export function proximaTentativaEm(tentativas: number, agora: Date = new Date()): Date | null {
  if (tentativas >= MAXIMO_DE_TENTATIVAS) return null;
  const minutos = 5 * Math.pow(4, Math.max(0, tentativas - 1));
  return new Date(agora.getTime() + minutos * 60_000);
}

export type MotivoParaPular =
  | { pular: false }
  | { pular: true; motivo: string };

/**
 * POR QUE ESTA CONVERSÃO NÃO PODE SER MANDADA — antes de tentar.
 *
 * Isto não é validação de formulário: é a diferença entre uma linha "falhou" (que a fila vai
 * repetir cinco vezes à toa) e uma linha "não enviado" com um motivo que a pessoa lê e resolve. A
 * plataforma recusaria do mesmo jeito; a diferença é que aqui alguém fica sabendo por quê.
 *
 * COMPRA SEM VALOR É BLOQUEADA de propósito. Uma venda enviada com valor zero não é "uma venda
 * sem valor": ela ensina o algoritmo que aquela campanha produz vendas que não valem nada, e o
 * leilão passa a caçar menos quem compra. É pior do que não mandar.
 */
export function motivoParaPular(params: {
  evento: string;
  valor?: number | null;
  moeda?: string | null;
  /** Os identificadores de atribuição que o lead tem. Vazio = não dá pra casar com anúncio. */
  identificadores: { gclid?: string | null; fbclid?: string | null; ctwaClid?: string | null; ttclid?: string | null; igSid?: string | null; gclientid?: string | null; email?: string | null; telefone?: string | null };
  plataforma: string;
}): MotivoParaPular {
  if (params.evento === "purchase") {
    if (!params.valor || params.valor <= 0) {
      return {
        pular: true,
        motivo: "Venda sem valor. Uma compra com valor zero ensina a plataforma que essa campanha produz vendas que não valem nada — é pior do que não mandar.",
      };
    }
    if (!params.moeda?.trim()) {
      return { pular: true, motivo: "Venda sem moeda. A plataforma precisa saber em que moeda é o valor." };
    }
  }

  const i = params.identificadores;
  const temAlgo = (v?: string | null) => Boolean(v && v.trim());

  /*
   * CADA PLATAFORMA RECONHECE UM CONJUNTO DIFERENTE, e por isso a conferência é por plataforma.
   *
   * O GA4 é o caso extremo: ele só aceita o `client_id` do navegador, e e-mail hasheado não
   * substitui. Mandar sem ele faz o GA4 aceitar o evento e inventar um usuário novo a cada envio,
   * que estraga o relatório em vez de preenchê-lo.
   */
  if (params.plataforma === "ga4" && !temAlgo(i.gclientid)) {
    return {
      pular: true,
      motivo: "Sem o identificador do navegador (gclientid). O GA4 não aceita e-mail nem telefone no lugar dele, e o evento viraria um usuário novo.",
    };
  }
  if (params.plataforma === "google" && !temAlgo(i.gclid) && !temAlgo(i.email) && !temAlgo(i.telefone)) {
    return {
      pular: true,
      motivo: "Lead sem gclid, e-mail ou telefone. Sem um dos três o Google não tem como reencontrar o clique.",
    };
  }
  if (params.plataforma === "meta" && !temAlgo(i.ctwaClid) && !temAlgo(i.fbclid) && !temAlgo(i.igSid) && !temAlgo(i.email) && !temAlgo(i.telefone)) {
    return {
      pular: true,
      motivo: "Lead sem nenhum identificador que a Meta reconheça (ctwa_clid, fbclid, IGSID, e-mail ou telefone).",
    };
  }
  if (params.plataforma === "tiktok" && !temAlgo(i.ttclid) && !temAlgo(i.email) && !temAlgo(i.telefone)) {
    return { pular: true, motivo: "Lead sem ttclid, e-mail ou telefone." };
  }

  return { pular: false };
}

/**
 * MASCARAR O QUE NÃO PODE SER LIDO NUM REGISTRO.
 *
 * O resumo do pedido serve pra conferir o que foi mandado — "foi com telefone e sem gclid" —, e
 * isso não exige o telefone. Guardar o dado cru num log é guardá-lo num lugar a mais, com outra
 * retenção, outro controle de acesso e nenhuma das duas coisas decididas de propósito.
 *
 * Mostra o começo e o fim porque é o bastante pra alguém reconhecer o próprio dado ao conferir um
 * caso específico, e insuficiente pra reconstruir qualquer coisa a partir do registro.
 */
export function mascarar(valor: string | null | undefined): string {
  const limpo = (valor ?? "").trim();
  if (!limpo) return "—";
  if (limpo.length <= 4) return "•".repeat(limpo.length);
  return `${limpo.slice(0, 2)}${"•".repeat(Math.min(8, limpo.length - 4))}${limpo.slice(-2)}`;
}

/** Resumo do pedido pra gravar no histórico: diz o que foi usado, nunca os valores. */
export function resumirPedido(params: {
  plataforma: string;
  evento: string;
  valor?: number | null;
  moeda?: string | null;
  identificadores: Record<string, string | null | undefined>;
}): string {
  const usados = Object.entries(params.identificadores)
    .filter(([, v]) => v && String(v).trim())
    .map(([k]) => k);
  const dinheiro =
    params.valor != null && params.moeda ? ` · ${params.moeda} ${params.valor.toFixed(2)}` : "";
  return `${params.plataforma}/${params.evento}${dinheiro} · com: ${usados.length ? usados.join(", ") : "nenhum identificador"}`;
}

/**
 * A linha pode ser reprocessada à mão?
 *
 * "Enviado" não pode, e é o ponto inteiro da fila: reprocessar algo que já chegou produziria a
 * venda em dobro no relatório da plataforma. "Estornado" também não — ele já é o desfazer.
 */
export function podeReprocessar(status: string): boolean {
  return status === "falhou" || status === "pulado";
}
