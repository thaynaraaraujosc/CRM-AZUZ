/**
 * POR ONDE A PRIMEIRA MENSAGEM VAI SAIR, quando a conversa ainda não tem dono.
 *
 * Uma conversa pertence à conexão por onde ela veio: depois da primeira mensagem, quem decide é o
 * histórico, e trocar no meio seria escrever do outro número, como se fosse outra empresa. Antes da
 * primeira, não há histórico — e é só aí que existe escolha.
 *
 * A REGRA É CURTA E JÁ CUSTOU CARO. A preferência da pessoa só vale quando há DOIS caminhos. Com
 * uma conexão só, não há escolha a respeitar, há um fato — e era exatamente isso que faltava: o
 * padrão era o QR Code, fixo, então com o QR Code desconectado e o oficial de pé (o estado de quem
 * acabou de trocar de celular) o CRM continuava se achando no QR Code.
 *
 * O estrago não era teórico. Achando-se no QR, ele escondia o caminho do modelo aprovado — o único
 * jeito de falar PRIMEIRO pelo oficial — e deixava escrever texto livre, que a Meta recusa. "Não
 * consegui conversar com ninguém pela API oficial."
 *
 * Sem nenhuma conexão a resposta é o QR Code, e isso é de propósito: é o estado de quem ainda não
 * carregou o status, e assumir o oficial ali levaria a tela de modelo aprovado a aparecer por um
 * instante em todo mundo, inclusive em quem só usa QR Code.
 */
export type CanalDeSaida = "whatsapp_oficial" | "whatsapp_nao_oficial";

export function canalDeSaida(
  preferido: CanalDeSaida,
  conexoes: { oficialConectado: boolean; qrConectado: boolean },
): CanalDeSaida {
  if (conexoes.oficialConectado && conexoes.qrConectado) return preferido;
  if (conexoes.oficialConectado) return "whatsapp_oficial";
  return "whatsapp_nao_oficial";
}

/**
 * Falar primeiro por aqui exige um modelo aprovado pela Meta?
 *
 * Só no oficial. O QR Code não tem janela de 24 horas nem modelo aprovado no caminho — é o mesmo
 * aplicativo de sempre, e por isso texto livre funciona.
 */
export function primeiraMensagemPrecisaDeModelo(canal: CanalDeSaida): boolean {
  return canal === "whatsapp_oficial";
}
