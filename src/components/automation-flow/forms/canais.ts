import { CAPACIDADES, CANAIS_DA_AREA, type AreaAutomacao, type CanalId } from "@/lib/canais/capacidades";
import type { CanalMensagem, FlowNodeType } from "@/lib/automation-flow/types";

/**
 * Os canais que o seletor de um bloco de mensagem oferece, conforme a área do fluxo.
 *
 * Um bloco de mensagem fala de UM canal de conversa, e o CRM tem duas conexões de WhatsApp que se
 * comportam como uma só pra quem monta o fluxo: quem decide por onde a mensagem sai é a CONVERSA
 * do contato, não o bloco. Por isso as duas aparecem como uma opção só. O que muda entre elas
 * (botão no oficial, menu numerado no QR Code) o envio resolve sozinho, e a tela avisa.
 *
 * O que NÃO pode acontecer é o Instagram aparecer num robô comercial e o WhatsApp num robô social:
 * é assim que alguém monta um fluxo inteiro que nunca vai rodar naquele canal.
 */
export function canaisDaAreaParaBloco(area: AreaAutomacao): { valor: CanalMensagem; label: string }[] {
  if (area === "social") {
    /* O "(Direct)" SAIU DO NOME DO CANAL.
       Ele estava grudado aqui como se fosse parte do nome, e não é: o Instagram recebe mensagem
       em dois lugares — o Direct e os comentários da publicação —, e o bloco escolhe em qual
       (ver `DESTINOS_INSTAGRAM`). Com "(Direct)" no nome do canal, escolher "comentário" deixava
       o cartão dizendo "Instagram (Direct)" em cima de uma resposta pública. */
    return CANAIS_DA_AREA.social
      .filter((id) => CAPACIDADES[id].disponivel)
      .map((id) => ({ valor: id as CanalMensagem, label: CAPACIDADES[id].label }));
  }
  return [{ valor: "whatsapp", label: "WhatsApp (oficial ou QR Code)" }];
}

/** O canal padrão da área. É o que um bloco recém-arrastado assume. */
export function canalPadraoDaArea(area: AreaAutomacao): CanalMensagem {
  return area === "social" ? "instagram" : "whatsapp";
}

/**
 * A frase sobre a janela de envio daquela área, ou vazio quando não há janela a explicar.
 *
 * Existe pra que o limite apareça ENQUANTO a pessoa monta, e não depois, com o lead do outro lado
 * esperando uma mensagem que o provedor recusou.
 */
export function avisoDeJanela(area: AreaAutomacao): string {
  const comJanela = CANAIS_DA_AREA[area]
    .map((id) => CAPACIDADES[id])
    .filter((c) => c.disponivel && c.janelaHoras !== null);
  return comJanela.map((c) => c.janelaExplicacao).join(" ");
}

/** Como aquele canal chama a opção clicável ("botões de resposta", "respostas rápidas"). */
export function nomeDoBotao(canal: CanalId): string {
  return CAPACIDADES[canal].nomeDoBotao;
}

/* -------------------------------------------------------------------------- */
/* Para onde a mensagem sai, no Instagram                                     */
/* -------------------------------------------------------------------------- */

/**
 * ONDE O BLOCO ESCREVE: no Direct ou embaixo do comentário.
 *
 * "Lá em canal está escrito Instagram Direct, mas às vezes vai ser comentário." É verdade, e o
 * cartão mentia: dizia Direct em cima de qualquer mensagem, inclusive das que respondem
 * publicamente. São dois lugares de verdade, com regras diferentes:
 *
 * - DIRECT: mensagem privada. Só dentro das 24 horas depois de a pessoa escrever, e para quem
 *   tem conversa. É o padrão, e é o que atende quase todo robô.
 * - COMENTÁRIO: resposta pública, embaixo do comentário que disparou a automação. Todo mundo vê,
 *   não depende de janela nenhuma — e só existe quando o disparo VEIO de um comentário. Num fluxo
 *   que começou por Direct recebido, o motor registra "ignorado: este disparo não veio de um
 *   comentário" em vez de inventar onde publicar.
 *
 * Ausência quer dizer Direct: fluxo publicado antes disto continua enviando igual.
 */
export type DestinoInstagram = "direct" | "comentario";

export const DESTINOS_INSTAGRAM: {
  valor: DestinoInstagram;
  /** Como aparece na linha do cartão, entre parênteses depois do canal. */
  curto: string;
  label: string;
  descricao: string;
}[] = [
  {
    valor: "direct",
    curto: "Direct",
    label: "Direct (mensagem privada)",
    descricao: "Chega só pra pessoa, na caixa de mensagens. Vale dentro das 24 horas depois de ela escrever.",
  },
  {
    valor: "comentario",
    curto: "comentário",
    label: "Comentário (resposta pública)",
    descricao:
      "Responde embaixo do comentário, onde todo mundo vê. Só funciona quando a automação foi disparada por um comentário.",
  },
];

/** O destino gravado no bloco. Sem nada gravado, é o Direct. */
export function destinoDoBloco(dados: unknown): DestinoInstagram {
  const bruto = (dados as { destino?: unknown } | null | undefined)?.destino;
  return bruto === "comentario" ? "comentario" : "direct";
}

/** "Instagram (Direct)" ou "Instagram (comentário)": o canal e, entre parênteses, onde ele escreve. */
export function rotuloDoCanalComDestino(labelDoCanal: string, destino: DestinoInstagram): string {
  const curto = DESTINOS_INSTAGRAM.find((d) => d.valor === destino)?.curto;
  return curto ? `${labelDoCanal} (${curto})` : labelDoCanal;
}

/**
 * ESTE BLOCO PODE ESCOLHER ENTRE DIRECT E COMENTÁRIO?
 *
 * Só o de texto puro. Uma resposta de comentário é texto e nada mais: a API de comentários da Meta
 * não leva anexo nem botão. Oferecer "comentário" num bloco de imagem ou num de botões seria o
 * botão falso que `capacidades.ts` existe pra impedir — a pessoa montaria o fluxo em volta de um
 * passo que a Meta recusa na hora do envio.
 *
 * Mídia e botão continuam indo pro Direct, que é onde eles existem.
 */
export function blocoEscolheDestinoNoInstagram(tipo: FlowNodeType): boolean {
  return tipo === "mensagem_texto";
}
