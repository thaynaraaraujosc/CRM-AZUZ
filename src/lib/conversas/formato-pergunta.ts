import { CAPACIDADES, type CanalId } from "@/lib/canais/capacidades";

/**
 * EM QUE FORMATO UMA PERGUNTA COM OPÇÕES CHEGA, por canal.
 *
 * Isto morava inteiro dentro de `enviar-pergunta.ts`, que abre o banco e fala com a Meta — um
 * arquivo que o editor não pode importar sem arrastar o Prisma pro navegador. Só que a tela PRECISA
 * dessa decisão: a prévia do bloco promete ao cliente o que o envio vai fazer, e duas cópias da
 * mesma regra é como se chega numa tela mostrando três botões bonitos pra uma mensagem que sai como
 * lista numerada.
 *
 * Então a regra mora aqui, sem dependência nenhuma, e os dois leem a mesma função.
 */

/** Teto de caracteres do rótulo nos formatos interativos da Meta (botão, item de lista, resposta rápida). */
export const MAX_ROTULO = 20;

export type OpcaoPergunta = {
  id: string;
  rotulo: string;
  /** Botão de URL: a opção leva a um endereço em vez de esperar resposta. */
  url?: string;
};

export type FormatoEnviado = "botoes" | "lista" | "respostas_rapidas" | "numerado";

/** Encurta o rótulo pro teto do canal. Exportado porque a leitura da resposta precisa comparar
 * contra o MESMO texto que foi enviado. A pessoa clica no botão encurtado. */
export function rotuloCurto(rotulo: string, max = MAX_ROTULO): string {
  const limpo = rotulo.trim();
  return limpo.length <= max ? limpo : `${limpo.slice(0, max - 1)}…`;
}

/** O menu numerado: a pergunta seguida de "1 - …", "2 - …". Funciona em qualquer canal. */
export function textoNumerado(texto: string, opcoes: OpcaoPergunta[]): string {
  if (!opcoes.length) return texto;
  // A opção com endereço leva o endereço junto: é o único jeito de a pessoa chegar no link, já
  // que nenhum destes canais manda botão de URL por aqui.
  const linhas = opcoes.map((o, i) => (o.url ? `${i + 1} - ${o.rotulo}: ${o.url}` : `${i + 1} - ${o.rotulo}`));
  return `${texto}\n\n${linhas.join("\n")}`;
}

/**
 * Uma opção com endereço não cabe em botão interativo aqui, e misturar formatos deixaria metade
 * das opções invisível. Com qualquer uma delas, a pergunta inteira sai numerada.
 */
export function temBotaoDeUrl(opcoes: OpcaoPergunta[]): boolean {
  return opcoes.some((o) => !!o.url?.trim());
}

/**
 * O FORMATO QUE AQUELE CANAL REALMENTE ENTREGA pra essa quantidade de opções.
 *
 * Os tetos saem da tabela de capacidades, que é onde eles são documentados com a razão de cada um
 * (3 botões e 10 linhas de lista na Cloud API; 13 respostas rápidas no Direct; nada confiável no
 * QR Code). Não cabendo em formato interativo, é menu numerado — que é melhor do que falhar, e o
 * motor sabe ler o número de volta.
 *
 * Esta função não sabe de janela de 24 horas nem de conexão desligada: isso é condição do momento
 * do envio, e quem decide é `enviarPerguntaPeloCanal`.
 */
export function formatoDaPergunta(canal: CanalId, opcoes: OpcaoPergunta[]): FormatoEnviado {
  const capacidade = CAPACIDADES[canal];
  if (!opcoes.length || temBotaoDeUrl(opcoes)) return "numerado";
  if (capacidade.botoes && opcoes.length <= capacidade.botoes) {
    // No Direct não é botão: é resposta rápida, que aparece acima do teclado e some depois de
    // usada. São coisas diferentes na tela de quem recebe, então têm nomes diferentes aqui.
    return canal === "instagram" ? "respostas_rapidas" : "botoes";
  }
  if (capacidade.lista && opcoes.length <= capacidade.lista) return "lista";
  return "numerado";
}
