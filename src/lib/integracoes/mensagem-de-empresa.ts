/**
 * MENSAGEM MANDADA POR EMPRESA: quem mandou, e os botões que vieram junto.
 *
 * `texto-da-mensagem.ts` já sabia achar o TEXTO desses formatos (template, botões, lista,
 * interativa) — foi o que tirou essas mensagens do descarte. Mas só o texto: o resto da mensagem
 * era jogado fora no mesmo movimento. E o resto é justamente o que distingue uma mensagem de
 * empresa de uma mensagem de pessoa:
 *
 *   - QUEM MANDOU é uma conta comercial verificada pela Meta, com o nome que ela verificou.
 *   - A mensagem oferece BOTÕES de resposta, que no celular são clicáveis.
 *
 * No CRM, as duas coisas sumiam. Chegava um texto solto, sem dizer que era empresa, e com as
 * opções de resposta ou ausentes ou derretidas dentro do corpo. Quem atende não tinha como
 * distinguir uma oferta automática de uma pessoa escrevendo, nem como responder "SIM" sem digitar.
 *
 * NADA AQUI É INVENTADO, e isso limita o que dá pra mostrar. O webhook não traz seguidores,
 * categoria do negócio nem o cartão de perfil que o WhatsApp desenha no celular — aquilo o app
 * monta com dados que ele busca à parte. O que chega é o nome verificado e os botões. É o que esta
 * função devolve, e é só o que a tela deve mostrar.
 */

type Mensagem = Record<string, unknown> | null | undefined;

/** Um botão que veio NA mensagem recebida: o que a pessoa veria pra clicar no celular. */
export type BotaoRecebido = {
  /** O que está escrito no botão. */
  rotulo: string;
  /** O identificador que a empresa deu. Guardado pra o histórico, não usado pra responder. */
  id?: string;
  /** Botão de link: abre um endereço em vez de responder. */
  url?: string;
  /** Botão de ligar. */
  telefone?: string;
};

/** O que se sabe sobre a conta que mandou — apenas o que veio no payload. */
export type ContaComercial = {
  /**
   * O nome como a META verificou. Só chega de conta comercial verificada (o selo azul), e é a
   * única afirmação de identidade aqui que não é inferência nossa.
   */
  nome?: string;
  /**
   * O formato da mensagem só existe na API de negócios.
   *
   * É uma inferência, mas não é um palpite: template, lista, botões e mensagem interativa são
   * formatos que o WhatsApp comum não deixa ninguém mandar. Quando a mensagem chega num deles, ela
   * saiu de um sistema, não de alguém digitando. Vale mesmo quando a conta não é verificada — e é
   * aí que esta parte faz diferença, porque `nome` fica vazio.
   */
  peloFormato: boolean;
};

const obj = (valor: unknown): Record<string, unknown> | undefined =>
  valor && typeof valor === "object" ? (valor as Record<string, unknown>) : undefined;

const txt = (valor: unknown): string | undefined =>
  typeof valor === "string" && valor.trim() ? valor.trim() : undefined;

/** Os formatos que só a API de negócios do WhatsApp consegue mandar. */
const FORMATOS_DE_EMPRESA = [
  "templateMessage",
  "buttonsMessage",
  "listMessage",
  "interactiveMessage",
  "highlyStructuredMessage",
] as const;

/**
 * A mensagem veio num formato que só empresa manda?
 *
 * Recebe a mensagem JÁ DESEMBRULHADA (ver `desembrulharMensagem`): uma mensagem de empresa dentro
 * de uma conversa temporária chega embrulhada igual qualquer outra, e olhar só o nível de cima
 * responderia "não" pra ela.
 */
export function formatoDeEmpresa(desembrulhada: Mensagem): boolean {
  if (!desembrulhada) return false;
  return FORMATOS_DE_EMPRESA.some((chave) => Boolean(desembrulhada[chave]));
}

/**
 * O que dá pra afirmar sobre quem mandou. `null` quando não há nada — que é o caso de toda
 * mensagem de pessoa, e aí a tela não mostra marca nenhuma.
 *
 * `verifiedBizName` mora no nível da MENSAGEM (irmão de `key` e `pushName`), não dentro de
 * `message`: é informação sobre o remetente, não sobre o conteúdo.
 */
export function contaComercialDaMensagem(
  evento: Mensagem,
  desembrulhada: Mensagem,
): ContaComercial | null {
  const nome = txt(evento?.verifiedBizName);
  const peloFormato = formatoDeEmpresa(desembrulhada);
  if (!nome && !peloFormato) return null;
  return { ...(nome ? { nome } : {}), peloFormato };
}

/** `buttonParamsJson` chega como TEXTO com JSON dentro. Mal formado, vira botão nenhum — e não
 *  uma exceção que derruba o recebimento da mensagem inteira. */
function lerParametros(valor: unknown): Record<string, unknown> | undefined {
  const bruto = txt(valor);
  if (!bruto) return undefined;
  try {
    return obj(JSON.parse(bruto));
  } catch {
    return undefined;
  }
}

function botoesDeTemplate(template: Record<string, unknown> | undefined): BotaoRecebido[] {
  const corpo =
    obj(template?.hydratedTemplate) ?? obj(template?.hydratedFourRowTemplate) ?? obj(template?.fourRowTemplate);
  const lista = corpo?.hydratedButtons ?? corpo?.buttons;
  if (!Array.isArray(lista)) return [];

  const botoes: BotaoRecebido[] = [];
  for (const item of lista) {
    const b = obj(item);
    if (!b) continue;
    const rapido = obj(b.quickReplyButton);
    const link = obj(b.urlButton);
    const ligar = obj(b.callButton);
    const rotulo = txt(rapido?.displayText) ?? txt(link?.displayText) ?? txt(ligar?.displayText);
    if (!rotulo) continue;
    botoes.push({
      rotulo,
      ...(txt(rapido?.id) ? { id: txt(rapido?.id) } : {}),
      ...(txt(link?.url) ? { url: txt(link?.url) } : {}),
      ...(txt(ligar?.phoneNumber) ? { telefone: txt(ligar?.phoneNumber) } : {}),
    });
  }
  return botoes;
}

function botoesSimples(botoesMessage: Record<string, unknown> | undefined): BotaoRecebido[] {
  const lista = botoesMessage?.buttons;
  if (!Array.isArray(lista)) return [];

  const botoes: BotaoRecebido[] = [];
  for (const item of lista) {
    const b = obj(item);
    const rotulo = txt(obj(b?.buttonText)?.displayText);
    if (!rotulo) continue;
    botoes.push({ rotulo, ...(txt(b?.buttonId) ? { id: txt(b?.buttonId) } : {}) });
  }
  return botoes;
}

function itensDeLista(listMessage: Record<string, unknown> | undefined): BotaoRecebido[] {
  const secoes = listMessage?.sections;
  if (!Array.isArray(secoes)) return [];

  const botoes: BotaoRecebido[] = [];
  for (const secao of secoes) {
    const linhas = obj(secao)?.rows;
    if (!Array.isArray(linhas)) continue;
    for (const linha of linhas) {
      const l = obj(linha);
      const rotulo = txt(l?.title);
      if (!rotulo) continue;
      botoes.push({ rotulo, ...(txt(l?.rowId) ? { id: txt(l?.rowId) } : {}) });
    }
  }
  return botoes;
}

function botoesInterativos(interativa: Record<string, unknown> | undefined): BotaoRecebido[] {
  const lista = obj(interativa?.nativeFlowMessage)?.buttons;
  if (!Array.isArray(lista)) return [];

  const botoes: BotaoRecebido[] = [];
  for (const item of lista) {
    const b = obj(item);
    const parametros = lerParametros(b?.buttonParamsJson);
    const rotulo = txt(parametros?.display_text) ?? txt(parametros?.title);
    if (!rotulo) continue;
    botoes.push({
      rotulo,
      ...(txt(parametros?.id) ? { id: txt(parametros?.id) } : {}),
      ...(txt(parametros?.url) ? { url: txt(parametros?.url) } : {}),
      ...(txt(parametros?.phone_number) ? { telefone: txt(parametros?.phone_number) } : {}),
    });
  }
  return botoes;
}

/**
 * Teto de botões guardados.
 *
 * O WhatsApp permite no máximo 3 botões e 10 itens de lista, então qualquer coisa acima disso é
 * payload estranho e não mensagem de verdade. O teto existe pra uma lista absurda não virar uma
 * parede de botões na conversa nem uma coluna `extras` inflada.
 */
const MAX_BOTOES = 12;

/**
 * Os botões que vieram na mensagem, em qualquer dos quatro formatos.
 *
 * Recebe a mensagem JÁ DESEMBRULHADA, pelo mesmo motivo de `formatoDeEmpresa`. Lista vazia quando
 * não há botão nenhum — que é o caso da esmagadora maioria das mensagens, inclusive das de
 * empresa: um "responda 1 para SIM" digitado no corpo do texto NÃO é botão, é texto, e continua
 * sendo texto aqui. Inventar botão a partir de um "1 SIM" escrito no meio da frase seria dar à
 * tela um botão que o celular de quem mandou não tem.
 */
export function botoesDaMensagem(desembrulhada: Mensagem): BotaoRecebido[] {
  if (!desembrulhada) return [];
  const m = desembrulhada;

  const todos = [
    ...botoesDeTemplate(obj(m.templateMessage)),
    ...botoesSimples(obj(m.buttonsMessage)),
    ...itensDeLista(obj(m.listMessage)),
    ...botoesInterativos(obj(m.interactiveMessage)),
  ];

  // Um rótulo repetido vira um botão só: a mesma opção em dois formatos (o template hidratado e o
  // interativo convivem em algumas versões) apareceria duas vezes na tela.
  const vistos = new Set<string>();
  const unicos: BotaoRecebido[] = [];
  for (const botao of todos) {
    const chave = botao.rotulo.toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    unicos.push(botao);
    if (unicos.length >= MAX_BOTOES) break;
  }
  return unicos;
}
