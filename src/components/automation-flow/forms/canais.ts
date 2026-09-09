import { CAPACIDADES, CANAIS_DA_AREA, type AreaAutomacao, type CanalId } from "@/lib/canais/capacidades";
import type { CanalMensagem } from "@/lib/automation-flow/types";

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
    return CANAIS_DA_AREA.social
      .filter((id) => CAPACIDADES[id].disponivel)
      .map((id) => ({ valor: id as CanalMensagem, label: `${CAPACIDADES[id].label} (Direct)` }));
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
