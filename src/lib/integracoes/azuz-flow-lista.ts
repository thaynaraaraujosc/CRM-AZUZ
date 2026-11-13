import type { PayloadDaLista, LeadDaLista, SeJaTemCard } from "./azuz-flow-lista-payload";

/**
 * A COLUNA DO FLOW VIRANDO LEADS DO CRM.
 *
 * "No show" no quadro do Flow, um clique, e aquelas pessoas entram num funil e numa etapa do CRM
 * escolhidos por quem clicou — porque é NA ETAPA que mora a automação que vai aquecê-las. O Flow
 * só entrega; quem conversa é o CRM.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * O QUE ESTA ROTA FAZ E O QUE ELA NÃO FAZ, e a segunda lista importa mais:
 *
 *  · NÃO dispara `formulario_preenchido`. Isto é lista, não formulário. O gatilho existe pra quem
 *    respondeu alguma coisa, e um robô montado pra formulário rodando sobre uma coluna inteira
 *    mandaria "recebemos sua resposta" pra gente que não respondeu nada.
 *  · NÃO dispara a confirmação de reunião por WhatsApp. Mesma razão: ninguém marcou reunião aqui.
 *  · NÃO afirma nada sobre consentimento. O lead do Flow não carrega essa informação, e gravar
 *    `true` seria inventar permissão; gravar `false` bloquearia modelo pra quem talvez possa
 *    receber. Fica como está — a guarda do CRM (`=== false` bloqueia) continua valendo sozinha.
 *
 * O que ela FAZ, além do contato e do card: dispara os gatilhos DA ETAPA de destino, como se
 * alguém tivesse arrastado o card até lá. Sem isso a agência monta o robô e ele nunca roda — o que
 * é pior do que não ter a opção, porque ela só descobre dias depois, pelo silêncio.
 *
 * Com dependências injetadas: a decisão por lead é regra, e regra se prova sem banco.
 */

export type SituacaoDoContato = "criado" | "existente" | "ignorado";
export type SituacaoDoCard = "criado" | "movido" | "ja_estava" | "sem_card";

export type ResultadoDeUmLead = {
  /** O id do lead NO FLOW. A resposta volta por ele, nunca pelo nome. */
  id: string;
  contato: SituacaoDoContato;
  card: SituacaoDoCard;
  /** Frase curta em português. O Flow mostra pra quem clicou. */
  aviso: string | null;
};

export type RespostaDaLista = { resultados: ResultadoDeUmLead[]; avisos: string[] };

/** O card que o contato já tem neste funil, quando tem. */
export type CardExistente = { id: string; etapaId: string };

export type DependenciasDaLista = {
  /** O destino existe NESTA empresa e a etapa é do funil? Devolve o motivo quando não. */
  conferirDestino: (funilId: string, etapaId: string) => Promise<{ ok: true } | { ok: false; erro: string }>;

  acharContatoPorTelefone: (telefone: string) => Promise<{ id: string; nome: string } | null>;
  acharContatoPorEmail: (email: string) => Promise<{ id: string; nome: string } | null>;
  acharContatoPorNome: (nome: string) => Promise<{ id: string; nome: string } | null>;
  lerContato: (nome: string) => Promise<Record<string, unknown> | null>;
  nomeOcupado: (nome: string) => Promise<boolean>;
  criarContato: (dados: Record<string, unknown> & { nome: string }) => Promise<{ id: string; nome: string }>;
  atualizarContato: (nome: string, dados: Record<string, unknown>) => Promise<void>;

  /** A conversa que permite a automação da etapa enviar. `null` quando não há canal utilizável. */
  garantirConversa: (params: {
    nome: string;
    telefone: string;
    contatoId: string;
  }) => Promise<{ id: string } | null | { erro: string }>;

  cardNoFunil: (contatoNome: string, funilId: string) => Promise<CardExistente | null>;
  criarCard: (params: {
    contatoNome: string;
    funilId: string;
    etapaId: string;
    origem: string;
  }) => Promise<CardExistente | null>;
  moverCard: (params: { cardId: string; etapaId: string }) => Promise<void>;

  /** Os gatilhos da etapa, como o arrastar dispara. Nunca `formulario_preenchido`. */
  dispararGatilhoDaEtapa: (params: {
    etapaId: string;
    contatoNome: string;
    evento: "criado" | "movido";
  }) => Promise<void>;
};

/** Os campos do lead que viram campos do contato. Nome fica de fora: ele é a chave. */
function camposDoLead(lead: LeadDaLista): [string, string | null][] {
  return [
    ["whatsapp", lead.whatsapp],
    ["email", lead.email],
    ["empresa", lead.empresa],
    ["instagram", lead.instagram],
    ["segmento", lead.segmento],
  ];
}

function etiquetasAtuais(contato: Record<string, unknown> | null): string[] {
  const brutas = contato?.etiquetas;
  if (!Array.isArray(brutas)) return [];
  return brutas.map((e) => String(e).trim()).filter(Boolean);
}

/**
 * ACHAR A PESSOA: WhatsApp, depois e-mail, depois nome.
 *
 * A ordem não é arbitrária — ela vai do mais identificador pro menos. Telefone é único por pessoa;
 * e-mail quase sempre; nome é o mais fraco dos três (dois "João Silva" acontecem toda semana) e por
 * isso é o último. Inverter faria a lista fundir pessoas diferentes num contato só, e fundir é o
 * único erro aqui que não dá pra desfazer depois.
 */
async function acharContato(deps: DependenciasDaLista, lead: LeadDaLista) {
  if (lead.whatsapp) {
    const porTelefone = await deps.acharContatoPorTelefone(lead.whatsapp);
    if (porTelefone) return porTelefone;
  }
  if (lead.email) {
    const porEmail = await deps.acharContatoPorEmail(lead.email);
    if (porEmail) return porEmail;
  }
  return deps.acharContatoPorNome(lead.nome);
}

/**
 * O que gravar num contato que JÁ EXISTE: só o que está vazio.
 *
 * "Nunca sobrescreva o que a agência já digitou." O dado do Flow é de um formulário respondido por
 * um desconhecido; o dado do CRM foi digitado por alguém que falou com a pessoa. Quando os dois
 * discordam, quem está certo é o segundo — e descobrir isso por cima de um telefone trocado custa
 * uma ligação pra quem não é mais cliente.
 */
function somenteCamposVazios(
  atual: Record<string, unknown> | null,
  lead: LeadDaLista,
): Record<string, unknown> {
  const dados: Record<string, unknown> = {};
  for (const [campo, valor] of camposDoLead(lead)) {
    if (!valor) continue;
    const jaTem = atual?.[campo];
    if (typeof jaTem === "string" && jaTem.trim()) continue;
    dados[campo] = valor;
  }
  return dados;
}

async function nomeLivre(deps: DependenciasDaLista, lead: LeadDaLista): Promise<string> {
  if (!(await deps.nomeOcupado(lead.nome))) return lead.nome;
  /*
   * Homônimo: desempata pelo id do lead no Flow, que é único por definição.
   *
   * Vale notar o que NÃO se faz aqui: juntar os dois no mesmo contato. Nome igual não é a mesma
   * pessoa, e a busca por telefone/e-mail já teria encontrado se fosse.
   */
  const comId = `${lead.nome} (${lead.id.slice(-6)})`.slice(0, 120);
  return comId;
}

/** Um lead da lista, do começo ao fim. */
async function processarUmLead(params: {
  lead: LeadDaLista;
  destino: PayloadDaLista["destino"];
  rotulo: string;
  deps: DependenciasDaLista;
}): Promise<ResultadoDeUmLead> {
  const { lead, destino, rotulo, deps } = params;
  const avisos: string[] = [];

  // ----------------------------------------------------------------- contato
  const existente = await acharContato(deps, lead);
  let contatoNome: string;
  let contatoId: string;
  let situacaoDoContato: SituacaoDoContato;

  if (existente) {
    contatoNome = existente.nome;
    contatoId = existente.id;
    situacaoDoContato = "existente";
  } else {
    contatoNome = await nomeLivre(deps, lead);
    if (contatoNome !== lead.nome) {
      avisos.push(`Já havia outro contato chamado "${lead.nome}", então este entrou como "${contatoNome}".`);
    }
    const criado = await deps.criarContato({
      nome: contatoNome,
      origem: "AZUZ Flow",
      ...Object.fromEntries(camposDoLead(lead).filter(([, v]) => v)),
    });
    contatoId = criado.id;
    situacaoDoContato = "criado";
  }

  /*
   * A ETIQUETA É O CARIMBO DO ENVIO, e ela não sai sozinha.
   *
   * "Flow: No show" fica no contato mesmo depois de a pessoa sair daquela coluna no Flow — é o que
   * permite montar uma campanha pra "quem veio do No show" semanas depois. Tratá-la como espelho da
   * coluna faria a lista do CRM mudar sozinha quando alguém mexesse no quadro do outro produto.
   */
  const atual = await deps.lerContato(contatoNome);
  const etiquetas = new Set(etiquetasAtuais(atual));
  const tinhaEtiqueta = etiquetas.has(rotulo);
  etiquetas.add(rotulo);

  const aGravar: Record<string, unknown> = existente ? somenteCamposVazios(atual, lead) : {};
  if (!tinhaEtiqueta) aGravar.etiquetas = Array.from(etiquetas);
  if (Object.keys(aGravar).length) await deps.atualizarContato(contatoNome, aGravar);

  // ----------------------------------------------------------------- conversa
  /*
   * A CONVERSA É O QUE PERMITE A AUTOMAÇÃO FALAR. Sem ela, o robô da etapa falha com "conversa sem
   * destinatário" — e falha em silêncio, um lead por vez, depois de a agência já ter dado o envio
   * por certo.
   *
   * Sem WhatsApp não há conversa a criar, e isso não impede o card: o lead que só tem e-mail entra
   * no funil do mesmo jeito, só não recebe mensagem.
   */
  if (lead.whatsapp) {
    const conversa = await deps.garantirConversa({ nome: contatoNome, telefone: lead.whatsapp, contatoId });
    if (conversa && "erro" in conversa) avisos.push(conversa.erro);
  }

  // ----------------------------------------------------------------- card
  const jaTinha = await deps.cardNoFunil(contatoNome, destino.funilId);
  let situacaoDoCard: SituacaoDoCard;

  if (!jaTinha) {
    const criado = await deps.criarCard({
      contatoNome,
      funilId: destino.funilId,
      etapaId: destino.etapaId,
      origem: "AZUZ Flow",
    });
    if (criado) {
      situacaoDoCard = "criado";
      await deps.dispararGatilhoDaEtapa({ etapaId: destino.etapaId, contatoNome, evento: "criado" });
    } else {
      /*
       * Card recusado pelo próprio CRM: conversa arquivada ou grupo. São regras de lá, e elas
       * valem aqui também — arquivar é o gesto de "isso não está em atendimento", e um envio de
       * lista não pode desfazê-lo por fora.
       */
      situacaoDoCard = "sem_card";
      avisos.push("O contato entrou, mas não virou card: a conversa dele está arquivada ou é um grupo.");
    }
  } else if (jaTinha.etapaId === destino.etapaId) {
    // Já estava exatamente onde se queria pôr. Vale pros dois modos, e não dispara gatilho: ele
    // não ENTROU na etapa agora.
    situacaoDoCard = "ja_estava";
  } else if (destino.seJaTemCard === "mover") {
    /*
     * MOVER É DECISÃO EXPLÍCITA DE QUEM CLICOU, e é isso que a separa de uma mensagem nova que
     * chega — essa nunca move ninguém de etapa, porque seria o CRM desfazendo o trabalho de quem
     * organizou o funil.
     */
    await deps.moverCard({ cardId: jaTinha.id, etapaId: destino.etapaId });
    situacaoDoCard = "movido";
    await deps.dispararGatilhoDaEtapa({ etapaId: destino.etapaId, contatoNome, evento: "movido" });
  } else {
    situacaoDoCard = "ja_estava";
    avisos.push("Já tinha card neste funil, em outra etapa, e foi mantido onde estava.");
  }

  return {
    id: lead.id,
    contato: situacaoDoContato,
    card: situacaoDoCard,
    aviso: avisos.length ? avisos.join(" ") : null,
  };
}

/**
 * A lista inteira, um lead por vez.
 *
 * SEQUENCIAL de propósito, e não em paralelo: o ritmo não é o gargalo (50 leads cabem folgado no
 * orçamento), e duas escritas simultâneas sobre a MESMA pessoa — que acontece quando o Flow manda
 * a mesma pessoa em dois lotes — disputariam a chave do contato. O caminho de baixo já sabe
 * perder essa disputa sem estourar; não criá-la é mais barato.
 *
 * Um lead que estoura não derruba o lote: ele volta como `ignorado` com o motivo, e os outros 49
 * entram. Um erro de um lead derrubando os outros é o que faz a agência clicar de novo e de novo.
 */
export async function receberListaDoFlow(params: {
  payload: PayloadDaLista;
  deps: DependenciasDaLista;
}): Promise<RespostaDaLista | { erro: string }> {
  const { payload, deps } = params;

  const destinoOk = await deps.conferirDestino(payload.destino.funilId, payload.destino.etapaId);
  if (!destinoOk.ok) return { erro: destinoOk.erro };

  const resultados: ResultadoDeUmLead[] = [];
  for (const lead of payload.leads) {
    try {
      resultados.push(
        await processarUmLead({ lead, destino: payload.destino, rotulo: payload.origem.rotulo, deps }),
      );
    } catch (erro) {
      console.error(`[azuz-flow/lista] lead ${lead.id} falhou:`, erro instanceof Error ? erro.message : erro);
      resultados.push({
        id: lead.id,
        contato: "ignorado",
        card: "sem_card",
        aviso: "Não deu pra trazer este lead agora. Tente enviar a coluna de novo.",
      });
    }
  }

  return { resultados, avisos: [] };
}

export type { SeJaTemCard };
