/**
 * QUAL NÚMERO RESPONDE ESTA PESSOA.
 *
 * "Dentro de cada etapa, cada quadro, eu escolher qual número que vai responder aquele quadro. Por
 * exemplo, no quadro de proposta é o closer: eu quero colocar o número do closer ali, que é ele que
 * vai responder naquela ali."
 *
 * E, no mesmo pedido, o complemento que fecha a ideia:
 *
 * "Ele pode ver todas as etapas, mas o número dele só responde uma. Ele não consegue responder as
 * outras."
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * SÃO DUAS PERGUNTAS DIFERENTES, e misturá-las é o que deixaria isto confuso:
 *
 *  1. POR ONDE A RESPOSTA SAI — decidido pela ETAPA em que o negócio está. É a divisão do
 *     trabalho: quem qualifica não é quem fecha, e mover o card pra "Proposta" passa a dizer, sem
 *     ninguém combinar nada, que dali em diante quem fala é o closer.
 *
 *  2. QUEM PODE RESPONDER — decidido pelas PERMISSÕES da pessoa (`ESCOPOS.numerosDeWhatsApp`). É
 *     o recorte que já existe: quem só tem o número do closer liberado não envia pelo da
 *     vendedora, esteja o card onde estiver.
 *
 * A etapa escolhe o caminho; a permissão diz se esta pessoa pode percorrê-lo. Um sem o outro seria
 * ou uma regra sem dono (qualquer um responde por qualquer número) ou um dono sem regra (o card
 * muda de etapa e nada acontece).
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * A ETAPA NÃO GANHA DE UMA ESCOLHA EXPLÍCITA. Se a pessoa escolheu um número na tela — na ficha do
 * contato ou no "+" da conversa —, é esse que vale. A etapa é o PADRÃO inteligente, não uma
 * amarra: ela responde "por onde isto costuma sair", e quem está atendendo sempre pode dizer outra
 * coisa pra aquela mensagem.
 *
 * Puro, sem banco: é regra de negócio, e regra de negócio se prova sem banco.
 */

export type EtapaComNumero = { id: string; contaCanal?: string | null };

export type DeOndeVeioONumero = "escolha" | "etapa" | "conversa";

export type NumeroDeSaida = {
  /** A conexão por onde a resposta sai. `null` = a da própria conversa, como sempre foi. */
  contaCanal: string | null;
  /** Quem decidiu. A tela usa pra dizer o porquê em vez de só mostrar o resultado. */
  origem: DeOndeVeioONumero;
};

/**
 * Por onde a resposta a esta conversa deve sair.
 *
 * `escolhaDaTela` é o número que a pessoa escolheu AGORA (ficha do contato, menu do "+"). Vazio
 * quando ela não escolheu nada, que é o caso normal.
 *
 * `etapaDoNegocio` é a etapa em que o negócio desta pessoa está. Sem negócio no funil, ou com a
 * etapa sem número próprio, a conversa decide — e "a conversa decide" é o comportamento de sempre.
 */
export function numeroQueResponde(params: {
  escolhaDaTela?: string | null;
  etapaDoNegocio?: EtapaComNumero | null;
  contaCanalDaConversa?: string | null;
}): NumeroDeSaida {
  const escolha = params.escolhaDaTela?.trim();
  if (escolha) return { contaCanal: escolha, origem: "escolha" };

  const daEtapa = params.etapaDoNegocio?.contaCanal?.trim();
  if (daEtapa) return { contaCanal: daEtapa, origem: "etapa" };

  return { contaCanal: params.contaCanalDaConversa ?? null, origem: "conversa" };
}

/**
 * Esta pessoa pode enviar por este número?
 *
 * `numerosPermitidos` é o recorte de `ESCOPOS.numerosDeWhatsApp`: `null` quer dizer NENHUM
 * MARCADO, que quer dizer TODOS — é a leitura de uma lista de caixas vazias, e é o que mantém quem
 * nunca abriu essa tela funcionando como sempre funcionou.
 */
export function podeResponderPor(
  numerosPermitidos: string[] | null,
  contaCanal: string | null | undefined,
): boolean {
  if (!numerosPermitidos) return true;
  // Sem número definido, a resposta sai pela conexão da conversa — e quem já enxerga a conversa
  // já foi autorizado a atendê-la. Barrar aqui tiraria o atendimento de quem tem permissão.
  if (!contaCanal) return true;
  return numerosPermitidos.includes(contaCanal);
}

/**
 * A frase que a tela mostra pra explicar por onde a mensagem vai sair.
 *
 * Existe porque o resultado sozinho não se explica: ver "Comercial" ali embaixo não diz se foi a
 * pessoa que escolheu, se foi a etapa que mandou, ou se é só a conversa seguindo o caminho dela —
 * e as três têm consequências diferentes na hora de mudar.
 */
export function porQueEsteNumero(origem: DeOndeVeioONumero, nomeDaEtapa?: string | null): string {
  if (origem === "escolha") return "Você escolheu este número para esta mensagem.";
  if (origem === "etapa") {
    return nomeDaEtapa
      ? `A etapa “${nomeDaEtapa}” responde por este número.`
      : "A etapa deste negócio responde por este número.";
  }
  return "Sai pelo mesmo número por onde esta conversa veio.";
}
