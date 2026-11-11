import { chaveDeContato } from "@/lib/contatos/chave-nome";
import { nomeAindaEhIdCru } from "@/lib/conversas/exibicao";
import { normalizarTelefoneParaComparacao } from "@/lib/telefone";

/**
 * A CONVERSA DAQUELE NEGÓCIO — pelo nome, e quando o nome falha, PELO TELEFONE.
 *
 * "O chat do WhatsApp deve ser idêntico ao chat do funil: toda conversa que tem lá com a pessoa
 * tem que ter no funil, porque é a mesma aba de conversa. Só que eu estou tentando procurar no meu
 * funil a minha cliente Gabriela. Lá no WhatsApp eu achei (…) só que no funil ela não aparece, o
 * número dela não está sendo encontrado. É como se não houvesse nenhuma conversa."
 *
 * O CRM liga card, contato e conversa pelo NOME. Funciona enquanto os três têm o mesmo nome, e eles
 * saem de sincronia sozinhos: o lead entra quando a primeira mensagem não trouxe o nome de perfil,
 * então o card nasce chamado "556384544268"; depois chega uma mensagem COM o nome e a conversa vira
 * "GABRIELA KTM". A troca move o card junto (ver `renomearConversa`), mas basta um caminho que
 * tenha criado o card fora dessa transação — ou uma grafia diferente — pra os dois lados do CRM
 * passarem a falar de pessoas diferentes. Na tela isso é o pior sintoma possível: o cartão abre uma
 * conversa VAZIA, e quem olha conclui que nunca falou com aquela pessoa.
 *
 * O telefone é a identidade que não muda. Quando o nome não casa, ele casa.
 *
 * Função pura, sem rede: é regra, e regra tem teste.
 */

export type ConversaParaCard = {
  nome: string;
  contato?: string | null;
  ehGrupo?: boolean;
};

export type IndicesDeConversa<T extends ConversaParaCard> = {
  porNome: Map<string, T>;
  porTelefone: Map<string, T>;
};

/**
 * Os dois índices, montados uma vez por desenho da tela.
 *
 * GRUPO FICA DE FORA DO ÍNDICE DE TELEFONE: ali `contato` é o JID do grupo (`<id>@g.us`), não o
 * telefone de ninguém, e deixá-lo entrar faria um card casar com uma conversa de grupo.
 */
export function indicesDeConversa<T extends ConversaParaCard>(conversas: T[]): IndicesDeConversa<T> {
  const porNome = new Map<string, T>();
  const porTelefone = new Map<string, T>();
  for (const conversa of conversas) {
    const chave = chaveDeContato(conversa.nome);
    if (chave && !porNome.has(chave)) porNome.set(chave, conversa);

    if (conversa.ehGrupo || !conversa.contato) continue;
    const telefone = normalizarTelefoneParaComparacao(conversa.contato);
    // `length >= 10` descarta o que não tem cara de telefone: o id interno de uma thread do
    // Instagram normalizado continua sendo dígitos, e casaria com um card de nome numérico.
    if (telefone.length >= 10 && !porTelefone.has(telefone)) porTelefone.set(telefone, conversa);
  }
  return { porNome, porTelefone };
}

/**
 * A conversa deste card, na ordem do mais confiável pro menos.
 *
 * 1. O NOME normalizado. É o caso comum e o mais barato, e é a ligação que o CRM inteiro usa.
 * 2. O TELEFONE DO CONTATO. Quando o contato existe, o telefone dele é a identidade estável — é
 *    assim que o card de "Gabriela" acha a conversa que hoje se chama "GABRIELA KTM".
 * 3. O NOME DO CARD, quando ele É um número. Card criado antes de a pessoa ter nome se chama pelo
 *    telefone dela: a string que está ali já é o endereço da conversa.
 */
export function conversaDoCard<T extends ConversaParaCard>(
  card: { nome: string },
  indices: IndicesDeConversa<T>,
  contato?: { whatsapp?: string | null } | null,
): T | null {
  const porNome = indices.porNome.get(chaveDeContato(card.nome));
  if (porNome) return porNome;

  const doContato = contato?.whatsapp ? normalizarTelefoneParaComparacao(contato.whatsapp) : "";
  if (doContato.length >= 10) {
    const achada = indices.porTelefone.get(doContato);
    if (achada) return achada;
  }

  if (nomeAindaEhIdCru(card.nome)) {
    const doNome = normalizarTelefoneParaComparacao(card.nome);
    if (doNome.length >= 10) return indices.porTelefone.get(doNome) ?? null;
  }

  return null;
}

/**
 * O CONTATO DAQUELE NEGÓCIO, pela mesma régua — e pelo mesmo motivo.
 *
 * No caso da Gabriela, o contato já estava com o nome certo ("GABRIELA KTM", telefone
 * 556384544268) e o card continuava chamado pelo número. Procurando só pelo nome, o cartão ficava
 * sem foto e sem a qualificação do lead: dois dados que existem, do lado de cá, e que a tela não
 * encontrava por causa de uma string.
 */
export type ContatoParaCard = { nome: string; whatsapp?: string | null };

export function indicesDeContato<T extends ContatoParaCard>(contatos: T[]): IndicesDeConversa<T> {
  const porNome = new Map<string, T>();
  const porTelefone = new Map<string, T>();
  for (const contato of contatos) {
    const chave = chaveDeContato(contato.nome);
    if (chave && !porNome.has(chave)) porNome.set(chave, contato);

    if (!contato.whatsapp) continue;
    const telefone = normalizarTelefoneParaComparacao(contato.whatsapp);
    if (telefone.length >= 10 && !porTelefone.has(telefone)) porTelefone.set(telefone, contato);
  }
  return { porNome, porTelefone };
}

export function contatoDoCard<T extends ContatoParaCard>(
  card: { nome: string },
  indices: IndicesDeConversa<T>,
  /** A conversa já encontrada, quando houver: o `contato` dela é o telefone da pessoa. */
  conversa?: ConversaParaCard | null,
): T | null {
  const porNome = indices.porNome.get(chaveDeContato(card.nome));
  if (porNome) return porNome;

  const candidatos = [
    conversa && !conversa.ehGrupo ? conversa.contato : null,
    nomeAindaEhIdCru(card.nome) ? card.nome : null,
  ];
  for (const bruto of candidatos) {
    if (!bruto) continue;
    const telefone = normalizarTelefoneParaComparacao(bruto);
    if (telefone.length < 10) continue;
    const achado = indices.porTelefone.get(telefone);
    if (achado) return achado;
  }
  return null;
}

/**
 * O NOME QUE O CARTÃO MOSTRA.
 *
 * Card ainda chamado pelo número, com a conversa já batizada, mostra o NOME DA CONVERSA: ela é
 * quem recebeu a mensagem com o nome de perfil, e é o nome que a pessoa vê no WhatsApp. "Não
 * aparece com o nome dela nem com as conversas" — as duas metades do mesmo problema.
 *
 * Só nessa direção: nome de verdade nunca é trocado por outro nome de verdade. Quem renomeou um
 * card à mão escolheu aquele nome, e sobrescrevê-lo pelo nome de perfil desfaria a escolha a cada
 * render.
 */
export function nomeParaOCartao(card: { nome: string }, conversa?: ConversaParaCard | null): string {
  if (!conversa || !nomeAindaEhIdCru(card.nome)) return card.nome;
  return nomeAindaEhIdCru(conversa.nome) ? card.nome : conversa.nome;
}
