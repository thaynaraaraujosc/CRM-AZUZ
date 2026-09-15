import { randomInt } from "node:crypto";

/**
 * O código curto que atravessa do site até a conversa.
 *
 * Ele é a única coisa que liga o clique no anúncio à mensagem que chega no CRM. Entre um e outro a
 * pessoa troca de aplicativo, e nada do navegador sobrevive a essa travessia: nem cookie, nem
 * endereço, nem sessão. O que sobrevive é o texto que ela envia — então é dentro do texto que o
 * código viaja.
 */

/**
 * Alfabeto sem letra que se confunde com número.
 *
 * Fora `O`, `0`, `I` e `1`: o código aparece na tela de quem vai mandar a mensagem, e pode ser
 * lido em voz alta, digitado à mão ou transcrito de um print no suporte. Ambiguidade aqui vira
 * lead sem origem, que é o defeito que este arquivo existe pra evitar.
 */
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const TAMANHO = 6;

/** Marca que embrulha o código na mensagem. Curta, e improvável de aparecer num texto de verdade. */
const ABERTURA = "[AZ-";
const FECHAMENTO = "]";

export function gerarCodigo(): string {
  let codigo = "";
  // `randomInt` do Node, e não `Math.random`: o código circula por fora do CRM, e um gerador
  // previsível permitiria adivinhar o código de outra pessoa e roubar a atribuição dela.
  for (let i = 0; i < TAMANHO; i += 1) codigo += ALFABETO[randomInt(ALFABETO.length)];
  return codigo;
}

/**
 * Põe o código no fim da mensagem pronta.
 *
 * NO FIM, e não no começo, por um motivo de gente: quem abre o WhatsApp com uma mensagem pronta
 * costuma ler o começo e mandar. Código no começo é a primeira coisa que a pessoa vê, estranha, e
 * apaga. No fim ele passa despercebido e chega inteiro.
 */
export function marcarMensagem(texto: string, codigo: string): string {
  const base = texto.trim();
  const marca = `${ABERTURA}${codigo}${FECHAMENTO}`;
  return base ? `${base} ${marca}` : marca;
}

/**
 * Acha o código dentro da mensagem que chegou.
 *
 * Tolerante de propósito: aceita minúscula e espaço sobrando, porque a mensagem passa por teclado
 * de celular, corretor automático e às vezes pelo dedo de quem resolveu editar. Devolve `null`
 * quando não há código, que é o caso da esmagadora maioria das mensagens — e não é erro nenhum.
 */
export function lerCodigoDaMensagem(texto: string | null | undefined): string | null {
  if (!texto) return null;
  // `i` no fim: o teclado do celular corrige a caixa sozinho, e exigir maiúscula jogaria fora
  // atribuição que estava lá.
  const encontrado = texto.match(/\[\s*AZ-\s*([A-Za-z0-9]{6})\s*\]/i);
  if (!encontrado) return null;
  const codigo = encontrado[1].toUpperCase();
  // Confere contra o alfabeto: `[AZ-ABC01I]` não é código nosso, é coincidência. Aceitar geraria
  // uma busca no banco por algo que nunca existiu, e no pior caso atribuiria origem errada.
  return [...codigo].every((c) => ALFABETO.includes(c)) ? codigo : null;
}

/** Tira a marca antes de a mensagem ser mostrada e guardada. Quem atende não precisa ver isso. */
export function limparMarca(texto: string): string {
  return texto.replace(/\s*\[\s*AZ-\s*[A-Za-z0-9]{6}\s*\]\s*/gi, " ").trim();
}
