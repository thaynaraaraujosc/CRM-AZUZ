/**
 * DE ONDE ESTE LEAD VEIO — a marcação à mão, quando o rastreio não deu conta.
 *
 * "Eu sei que essa cliente olhou o tráfego, viu o tráfego, aí foi lá, viu meu Instagram, viu
 * minhas redes sociais e mandou mensagem por fora, pelo WhatsApp. Não veio direto do tráfego.
 * Então eu posso colocar aqui que ela veio do tráfego, só que ela não clicou no tráfego. E aí eu
 * tenho que ter a opção de colocar manual."
 *
 * ERA O ELO QUE FALTAVA, e o Tráfego inteiro dependia dele sem dizer. A tela conta negócio cuja
 * origem é anúncio pago; a origem só era gravada automaticamente, por quem clica no anúncio e cai
 * direto no WhatsApp. Quem viu o anúncio, procurou o perfil e mandou mensagem por fora — que é o
 * caminho mais comum em serviço — nascia como "Salvo manualmente" e nunca mais mudava, porque não
 * existia nenhum lugar na ficha pra dizer o contrário. Resultado: a Meta cobrando por 9 leads e o
 * funil de tráfego mostrando 0.
 *
 * Isto não é "melhorar a atribuição": é dar à pessoa que CONVERSOU com o lead o único jeito de
 * registrar o que só ela sabe. O algoritmo não tem como saber; ela tem.
 *
 * AS OPÇÕES SÃO POUCAS DE PROPÓSITO. Lista grande em campo de marcação vira campo não preenchido:
 * quem está no meio de um atendimento não para pra escolher entre quinze. São os caminhos por onde
 * um lead realmente chega — e `Outro` existe pra não forçar uma mentira quando não é nenhum deles.
 */

import type { Origem } from "@/lib/data";

export type OpcaoDeOrigem = {
  valor: Origem | "Indicação" | "Outro";
  label: string;
  /** O que esta escolha quer dizer, pra não virar adivinhação de quem marca. */
  descricao: string;
  /** Custou mídia? É isto que decide se o lead entra no funil de tráfego e no custo por lead. */
  paga: boolean;
};

export const ORIGENS_DO_LEAD: OpcaoDeOrigem[] = [
  {
    valor: "Meta Ads",
    label: "Meta Ads",
    descricao: "Veio de anúncio no Instagram ou Facebook — inclusive quem viu o anúncio e mandou mensagem por fora.",
    paga: true,
  },
  {
    valor: "Google Ads",
    label: "Google Ads",
    descricao: "Veio de anúncio no Google ou no YouTube.",
    paga: true,
  },
  {
    valor: "TikTok",
    label: "TikTok Ads",
    descricao: "Veio de anúncio no TikTok.",
    paga: true,
  },
  {
    valor: "Instagram",
    label: "Instagram",
    descricao: "Achou o perfil sozinha, pelo conteúdo — sem anúncio no meio.",
    paga: false,
  },
  {
    valor: "Indicação",
    label: "Indicação",
    descricao: "Alguém indicou. É o lead mais barato que existe, e some do relatório se ninguém marcar.",
    paga: false,
  },
  {
    valor: "Formulário",
    label: "Formulário",
    descricao: "Preencheu um formulário do site ou da landing page.",
    paga: false,
  },
  {
    valor: "WhatsApp",
    label: "WhatsApp",
    descricao: "Chegou direto no número, sem dar pra saber por onde soube.",
    paga: false,
  },
  {
    valor: "Outro",
    label: "Outro",
    descricao: "Nenhum dos de cima. Melhor do que marcar um errado.",
    paga: false,
  },
];

/**
 * As origens que custaram mídia. É a lista que o funil de tráfego conta — e é por isso que ela
 * mora aqui, ao lado das opções, em vez de solta numa tela: marcar "Meta Ads" na ficha e ver o
 * lead aparecer no Tráfego precisa ser a MESMA decisão, não duas listas que combinam por acaso.
 */
export const ORIGENS_PAGAS: readonly string[] = ORIGENS_DO_LEAD.filter((o) => o.paga).map((o) => o.valor);

/** Esta origem custou mídia? */
export function origemEhPaga(origem: string | null | undefined): boolean {
  return Boolean(origem) && ORIGENS_PAGAS.includes(origem as string);
}

/**
 * Esta origem é uma MARCAÇÃO de procedência, ou só o canal por onde a mensagem chegou?
 *
 * `Contato.origem` guarda as duas coisas no mesmo campo: o que alguém escolheu na ficha ("Meta
 * Ads", "Indicação") e o que o CRM gravou sozinho ao receber a primeira mensagem ("WhatsApp",
 * "Salvo manualmente"). No quadro do funil isso importa — a primeira responde de onde a pessoa
 * veio, a segunda não responde nada, e mostrar a segunda em destaque dourado seria dar relevo a
 * vinte cartões dizendo a mesma palavra.
 */
const SO_O_CANAL: readonly string[] = ["WhatsApp", "Instagram Direct", "Salvo manualmente", "Direto", "Outro"];

export function origemMarcavel(origem: string | null | undefined): boolean {
  const limpa = origem?.trim();
  if (!limpa) return false;
  return !SO_O_CANAL.includes(limpa);
}

/**
 * O RÓTULO CURTO DA ORIGEM, pro cartão do funil.
 *
 * `Contato.origem` pode chegar como `"Formulário: Consultoria Gratis"` — é assim que o lead do
 * AZUZ Flow é gravado. No cartão isso ocupa duas linhas, empurra a data e o botão de conversa pro
 * lado e deixa a coluna com cartões de alturas diferentes. Um quadro que se lê de relance não
 * sobrevive a isso.
 *
 * CORTA PELA PARTE QUE INFORMA, não pelo tamanho. "Formulário" é o genérico — a empresa tem vários
 * — e o que distingue um cartão do outro é o NOME: "Consultoria Gratis" é aquisição, "Seleção
 * Desing" é contratação, e são funis diferentes da mesma agência. Truncar com reticências no meio
 * ("FORMULÁRIO: CONSUL…") perderia exatamente o pedaço que decide.
 *
 * O texto inteiro continua no `title`, pra quem precisar conferir.
 */
export function rotuloCurtoDaOrigem(origem: string): string {
  const corte = origem.indexOf(":");
  if (corte < 0) return origem.trim();
  const depois = origem.slice(corte + 1).trim();
  // Prefixo sem nada depois ("Formulário:") não vira etiqueta vazia.
  return depois || origem.trim();
}
