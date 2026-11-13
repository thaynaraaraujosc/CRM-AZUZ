import { BLOCOS_DISPONIVEIS } from "@/lib/automation-flow/blocos";
import { blocoApareceNaArea, grupoDeGatilhoValeNaArea, type AreaAutomacao } from "@/lib/canais/capacidades";
import type { FlowNodeType } from "@/lib/automation-flow/types";

/**
 * O QUE A GAVETA DE GATILHOS MOSTRA, EM CADA ÁREA.
 *
 * "Deixa essa automação idêntica à do Social Selling. Só não precisa colocar as coisas que é pro
 * Instagram aqui, mas o resto deixa idêntico."
 *
 * A gaveta nasceu no Social Seller e tinha o Instagram escrito por dentro: a lista dos principais,
 * a explicação de cada gatilho e a etapa de configuração eram constantes com nomes de gatilho de
 * Instagram. Passar o mesmo desenho pro WhatsApp sem este arquivo seria copiar a gaveta — e duas
 * cópias de uma tela de quatro etapas é como se chega, meses depois, numa que tem "Adicionar outra
 * resposta" e na outra não.
 *
 * Aqui mora só a PARTE QUE MUDA POR ÁREA. O desenho continua um só.
 */

/**
 * Os que aparecem primeiro, em cada área. O resto vai pra "Opções avançadas".
 *
 * No comercial são vinte e quatro gatilhos: mostrar todos de uma vez é a lista em que não se acha
 * nada. Os cinco escolhidos são os que respondem "o lead se mexeu no funil" e "o lead falou" —
 * que é o que leva alguém a abrir esta gaveta. Agenda, etiqueta, campo e relógio ficam no avançado
 * porque são robôs de quem já sabe o que quer.
 */
const PRINCIPAIS: Record<AreaAutomacao, FlowNodeType[]> = {
  social: [
    "comentario_instagram",
    "instagram_story_respondido",
    "instagram_direct_recebido",
    "instagram_comentario_live",
    "instagram_mencao_story",
  ],
  comercial: [
    "lead_entrou_etapa",
    "lead_criado",
    "mensagem_recebida",
    "palavra_chave",
    "lead_nao_respondeu",
  ],
};

/**
 * A explicação de cada gatilho em uma frase: o que a pessoa faz e o que a automação faz em
 * seguida. É o conteúdo do "Como funciona cada gatilho?".
 *
 * A seta no meio não é enfeite: a `descricao` do bloco já diz "dispara quando…", e repetir isso
 * numa gaveta inteira de "dispara quando" não ajuda ninguém a escolher. O que ajuda é ver o par —
 * o que acontece lá fora, e o que o robô faz por causa disso.
 */
const COMO_FUNCIONA: Partial<Record<FlowNodeType, string>> = {
  // Instagram
  comentario_instagram: "Comentam no seu post ou Reels → a automação chama a pessoa no Direct.",
  instagram_story_respondido: "Respondem a um story seu → a automação continua a conversa no Direct.",
  instagram_direct_recebido: "Te mandam mensagem no Direct → a automação responde na hora.",
  instagram_mencao_story: "Marcam você em um story → a automação responde no Direct.",
  instagram_comentario_live:
    "Comentam durante a sua live → a automação chama a pessoa no Direct, e a conversa continua depois que a live acaba.",
  instagram_midia_recebida: "Mandam foto, vídeo ou áudio no Direct → a automação responde na hora.",
  instagram_publicacao_compartilhada: "Encaminham uma publicação pra você no Direct → a automação responde.",
  instagram_reacao_recebida: "Reagem com emoji a uma mensagem sua → a automação segue dali.",
  instagram_resposta_comentario: "Respondem a um comentário na sua publicação → a automação entra na conversa.",

  // Comercial
  lead_criado: "Um contato novo entra no CRM → a automação dá as boas-vindas.",
  lead_entrou_etapa: "Você arrasta o lead pra uma etapa (ou ele cai nela sozinho) → a automação fala com ele.",
  lead_saiu_etapa: "O lead deixa uma etapa → a automação faz o encerramento daquela fase.",
  lead_parado_etapa: "O lead passa tempo demais na mesma etapa sem falar → a automação cutuca.",
  lead_respondeu: "O lead responde no WhatsApp → a automação segue a conversa.",
  lead_nao_respondeu: "Você falou e o lead sumiu pelo prazo que escolher → a automação faz o follow-up.",
  palavra_chave: "O lead manda uma palavra que você escolheu → a automação responde aquilo.",
  mensagem_recebida: "Chega qualquer mensagem no canal escolhido → a automação responde.",
  etiqueta_adicionada: "Alguém põe uma etiqueta no contato → a automação age por causa dela.",
  etiqueta_removida: "A etiqueta sai do contato → a automação age por causa disso.",
  campo_alterado: "Um campo da ficha muda de valor → a automação reage à mudança.",
  responsavel_alterado: "O lead troca de atendente → a automação avisa quem assumiu.",
  tarefa_criada: "Uma tarefa é criada pro contato → a automação acompanha.",
  tarefa_concluida: "A tarefa do contato é concluída → a automação segue pro próximo passo.",
  tarefa_vencida: "A tarefa vence sem ninguém concluir → a automação cobra.",
  consulta_agendada: "A consulta é marcada → a automação confirma com o paciente.",
  consulta_confirmada: "O paciente confirma presença → a automação prepara o atendimento.",
  consulta_cancelada: "A consulta é cancelada → a automação tenta remarcar.",
  cliente_nao_compareceu: "O paciente falta → a automação chama de volta.",
  formulario_preenchido: "O lead preenche um formulário → a automação responde o que ele pediu.",
  aniversario: "Chega o aniversário do contato → a automação parabeniza no horário escolhido.",
  data_personalizada: "Chega a data que você marcou → a automação fala com quem estiver na etapa.",
  horario_programado: "No horário de todo dia → a automação passa por quem estiver na etapa.",
};

/**
 * A PERGUNTA DA ÚLTIMA ETAPA, pelo gatilho que manda.
 *
 * "Responda quem comentar no seu feed" e "Responda quem responder seu story" são pessoas em
 * momentos diferentes, e a frase que se escreve pra uma não serve pra outra. Com vários gatilhos
 * marcados, vale o primeiro da lista.
 */
const PERGUNTA_DA_RESPOSTA: Partial<Record<FlowNodeType, string>> = {
  comentario_instagram: "Responda quem comentar no seu feed",
  instagram_comentario_live: "Responda quem comentar na sua live",
  instagram_story_respondido: "Responda quem responder seu story",
  instagram_mencao_story: "Responda quem mencionar você num story",
  instagram_direct_recebido: "Responda quem mandar mensagem no Direct",

  lead_entrou_etapa: "O que o robô manda pra quem entrar na etapa",
  lead_saiu_etapa: "O que o robô manda pra quem sair da etapa",
  lead_parado_etapa: "O que o robô manda pra quem parou na etapa",
  lead_criado: "O que o robô manda pro lead novo",
  lead_respondeu: "Responda quem acabou de responder",
  lead_nao_respondeu: "O que o robô manda pra quem sumiu",
  palavra_chave: "Responda quem mandar a palavra-chave",
  mensagem_recebida: "Responda quem mandar mensagem",
  formulario_preenchido: "O que o robô manda pra quem preencheu o formulário",
  aniversario: "A mensagem de aniversário",
};

/** A frase da última etapa, com o primeiro marcado que tiver uma. */
export function perguntaDaResposta(marcados: FlowNodeType[]): string {
  for (const tipo of marcados) {
    const frase = PERGUNTA_DA_RESPOSTA[tipo];
    if (frase) return frase;
  }
  return "O que o robô responde";
}

/** A explicação em uma frase, pro "Como funciona cada gatilho?". */
export function comoFunciona(tipo: FlowNodeType): string | undefined {
  return COMO_FUNCIONA[tipo];
}

/** Os gatilhos que esta área oferece, já separados entre os principais e o avançado. */
export function gatilhosDaArea(area: AreaAutomacao): {
  principais: typeof BLOCOS_DISPONIVEIS;
  avancados: typeof BLOCOS_DISPONIVEIS;
} {
  const todos = BLOCOS_DISPONIVEIS.filter(
    (b) =>
      b.categoria === "gatilho" &&
      blocoApareceNaArea(b, area) &&
      // A mesma regra da biblioteca: um robô de Instagram não começa porque uma tarefa venceu.
      grupoDeGatilhoValeNaArea(b.grupo, area),
  );
  const ordem = PRINCIPAIS[area];
  return {
    principais: ordem
      .map((t) => todos.find((b) => b.tipo === t))
      .filter((b): b is (typeof todos)[number] => Boolean(b)),
    avancados: todos.filter((b) => !ordem.includes(b.tipo)),
  };
}

/**
 * A ETAPA DE CONFIGURAÇÃO DE UM GATILHO: tem, e de que tipo?
 *
 * Nem todo gatilho pergunta alguma coisa. "Direct recebido" e "Lead criado" não escolhem nada —
 * criar uma etapa pra eles seria uma tela em branco com um botão "Continuar".
 *
 * QUEM TEM PERGUNTA É QUEM TEM CAMPO, e isso se lê do próprio bloco: `dataPadrao()` vazio quer
 * dizer que não há o que configurar. Derivado em vez de listado à mão porque uma lista à mão
 * envelhece calada — o gatilho que ganha um campo amanhã passaria direto pela gaveta, e a pessoa
 * descobriria o campo faltando só quando o robô não disparasse.
 *
 * Dois desenhos:
 *  - `alcance`: a grade de publicações e stories do Instagram (`EscolhaDeMidia`).
 *  - `formulario`: o formulário do próprio bloco, o MESMO que o painel da direita abre. Nenhum
 *    campo novo foi inventado pro comercial: "em qual etapa?" já tem uma tela certa, e repeti-la
 *    aqui criaria duas respostas pra mesma pergunta.
 */
export type EtapaDeConfiguracao = {
  tipo: "alcance" | "formulario";
  titulo: string;
  pergunta: string;
};

/** Os dois do Instagram que escolhem publicações/stories. O resto do Instagram não pergunta nada. */
const ALCANCE: Partial<Record<FlowNodeType, { titulo: string; pergunta: string }>> = {
  comentario_instagram: {
    // As palavras são as da referência, e isso importa mais do que parece: a tela anterior chama
    // o gatilho de "Comentário no Feed ou Reels" e a pergunta falava em "publicações". Duas
    // palavras pra mesma coisa, em telas seguidas, fazem a pessoa procurar a diferença.
    titulo: "Comentário em Posts ou Reels",
    pergunta: "Em quais Posts ou Reels a automação deve funcionar?",
  },
  instagram_story_respondido: {
    titulo: "Resposta nos stories",
    pergunta: "Em quais stories a automação deve funcionar?",
  },
};

/** A pergunta de cada gatilho comercial, na voz de quem está montando. */
const PERGUNTA_DO_FORMULARIO: Partial<Record<FlowNodeType, string>> = {
  lead_entrou_etapa: "De qual etapa a automação toma conta?",
  lead_saiu_etapa: "De qual etapa o lead tem que sair?",
  lead_parado_etapa: "Em qual etapa, e parado por quanto tempo?",
  lead_nao_respondeu: "Quanto tempo de silêncio antes do robô cobrar?",
  palavra_chave: "Qual palavra ativa a automação?",
  mensagem_recebida: "Em qual canal?",
  etiqueta_adicionada: "Qual etiqueta?",
  etiqueta_removida: "Qual etiqueta?",
  campo_alterado: "Qual campo da ficha?",
  tarefa_criada: "Quais tarefas contam?",
  tarefa_concluida: "Quais tarefas contam?",
  aniversario: "A que horas a mensagem sai?",
  data_personalizada: "Em que data, e pra quem?",
  horario_programado: "Em que horário, e pra quem?",
};

export function etapaDeConfiguracao(tipo: FlowNodeType): EtapaDeConfiguracao | null {
  const doAlcance = ALCANCE[tipo];
  if (doAlcance) return { tipo: "alcance", ...doAlcance };

  const bloco = BLOCOS_DISPONIVEIS.find((b) => b.tipo === tipo);
  if (!bloco) return null;
  // Instagram que não é de alcance não tem etapa própria: o que ele filtra são as palavras, e
  // aquela etapa é uma só, pra todos.
  if (bloco.grupo === "instagram") return null;

  const padrao = (bloco.dataPadrao?.() ?? {}) as Record<string, unknown>;
  if (!Object.keys(padrao).length) return null;

  return {
    tipo: "formulario",
    titulo: bloco.label,
    pergunta: PERGUNTA_DO_FORMULARIO[tipo] ?? "Como este gatilho deve funcionar?",
  };
}

/**
 * A ETAPA DE PALAVRAS-CHAVE vale pra área inteira?
 *
 * No Instagram sim: a palavra filtra comentário, story e Direct do mesmo jeito, então ela é uma
 * pergunta só, feita uma vez, gravada em todos os gatilhos marcados.
 *
 * No comercial não. Ali a palavra é um GATILHO ("Palavra-chave recebida"), com o campo dele e um
 * formato próprio (`palavra`, no singular). Uma etapa de palavras valendo pra todos escreveria um
 * campo que "Lead entrou na etapa" não tem e ninguém pediu — e deixaria duas telas gravando a
 * mesma coisa de jeitos diferentes.
 */
export function temEtapaDePalavras(area: AreaAutomacao): boolean {
  return area === "social";
}
