/**
 * O ENVIO FALHOU POR FALTA DE CAMINHO ATÉ A PESSOA?
 *
 * Existe pra separar duas famílias de falha que a automação trata de forma oposta.
 *
 * - FALTA DE CAMINHO: não há conversa aberta, ou a janela de 24 horas fechou. Não é defeito de
 *   nada — é o estado normal de quem acabou de comentar numa publicação e nunca mandou mensagem.
 *   Pra essa família existe uma saída: a resposta privada ao comentário (ver
 *   `enviarRespostaPrivadaDeComentario`).
 * - QUALQUER OUTRA: token vencido, conta desconectada, texto recusado, número inválido. Aqui
 *   insistir por outro caminho seria mascarar o problema — e o problema precisa chegar a quem pode
 *   consertá-lo.
 *
 * A comparação é por TRECHO e não por igualdade porque os motivos são frases escritas pra pessoa
 * ler, e elas vão mudar de pontuação com o tempo. O que não muda é o assunto.
 */
const TRECHOS_DE_FALTA_DE_CAMINHO = [
  "conversa sem destinatário",
  "janela de 24 horas",
  "janela de 24h",
];

export function semCaminhoAteOContato(motivo: string | undefined): boolean {
  if (!motivo) return false;
  const texto = motivo.toLowerCase();
  return TRECHOS_DE_FALTA_DE_CAMINHO.some((trecho) => texto.includes(trecho.toLowerCase()));
}
