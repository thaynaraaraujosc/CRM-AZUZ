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

/**
 * POR QUAL CANAL ESTA CONEXÃO FALA — derivado da conexão, não perguntado de novo.
 *
 * "Se eu escolhi lá em contatos que eu quero mandar mensagem pela API oficial, não precisa
 * aparecer pra mim essas duas mensagens aqui. Tá redundante, são três perguntas pra me falar que
 * eu quero mandar por aqui."
 *
 * Ela está certa, e havia um defeito escondido na redundância: escolher o NÚMERO na ficha do
 * contato nunca definia o CANAL. A `chave` da conexão é `meta_whatsapp:<id>` ou
 * `whatsapp_nao_oficial:<numero>` — ou seja, o canal já está decidido no instante em que o número
 * é escolhido. Mesmo assim o compositor continuava com a preferência dele (QR Code, por padrão) e
 * perguntava outra vez. Quem escolhia o número oficial na ficha podia cair num compositor marcado
 * como QR Code: não era só uma pergunta repetida, era a tela respondendo diferente de si mesma.
 *
 * `null` quando não há conexão escolhida — aí vale `canalDeSaida`, a regra de sempre.
 */
export function canalDaConexao(chave: string | null | undefined): CanalDeSaida | null {
  if (!chave) return null;
  if (chave.startsWith("meta_whatsapp")) return "whatsapp_oficial";
  if (chave.startsWith("whatsapp_nao_oficial")) return "whatsapp_nao_oficial";
  /* `whatsapp_baileys` é o nome ANTIGO desta mesma conexão, e ele ainda está gravado em mensagem
     de automação. Lido como "não é QR Code", ele mandaria pelo oficial uma conversa que corre pelo
     aparelho — e pelo oficial, sem modelo aprovado, a Meta recusa. */
  if (chave.startsWith("whatsapp_baileys")) return "whatsapp_nao_oficial";
  // Conexão de um provedor que ainda não existia quando isto foi escrito: melhor não afirmar
  // canal nenhum do que afirmar o errado — quem decide volta a ser `canalDeSaida`.
  return null;
}
