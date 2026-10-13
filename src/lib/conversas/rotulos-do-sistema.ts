/**
 * Texto de mensagem que o CRM escreveu, e não a pessoa.
 *
 * Quando chega uma foto, um áudio ou uma menção em story, não existe texto nenhum pra mostrar: o
 * servidor grava uma frase no lugar ("[Imagem]", "Você foi marcado em um story"). Essas frases
 * ficam gravadas em português no banco, junto das mensagens de verdade, no mesmo campo.
 *
 * É por isso que a tradução não pode ser `traduzir(msg.texto)` e pronto: o mesmo campo carrega o
 * que o CLIENTE escreveu, e passar isso pelo dicionário trocaria as palavras de uma pessoa real
 * por outras. Aqui a troca só acontece quando o texto é EXATAMENTE uma das frases que o próprio
 * sistema escreve. Qualquer outra coisa sai intacta.
 *
 * Reescrever o que já está gravado seria o outro caminho, e é pior: exigiria migração de banco, não
 * atenderia quem troca de idioma depois, e deixaria o histórico com duas línguas misturadas
 * conforme a data. Traduzir na hora de desenhar resolve os três.
 */
const ROTULOS_DO_SISTEMA = new Set([
  // Anexos, de `ROTULO_POR_ANEXO` nos dois webhooks.
  "[Imagem]",
  "[Vídeo]",
  "[Áudio]",
  "[Arquivo]",
  "[Documento]",
  "[Figurinha]",
  "[Localização]",
  "[Contato]",
  // Eventos do Instagram que não são "mandou um arquivo".
  "Compartilhou uma publicação",
  "Compartilhou um reel",
  "Respondeu ao seu story",
  "Você foi marcado em um story",
]);

/** `Respondeu ao story de @fulano`: o @ varia, então a frase não cabe num conjunto fixo. */
const RESPOSTA_A_STORY_DE = /^Respondeu ao story de (@\S+)$/;

export function traduzirRotuloDoSistema(
  texto: string,
  traduzir: (chave: string, valores?: Record<string, string | number>) => string,
): string {
  if (ROTULOS_DO_SISTEMA.has(texto)) return traduzir(texto);

  const comArroba = RESPOSTA_A_STORY_DE.exec(texto);
  if (comArroba) return traduzir("Respondeu ao story de {arroba}", { arroba: comArroba[1] });

  return texto;
}
