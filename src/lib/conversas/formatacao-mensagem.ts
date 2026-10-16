/**
 * O texto de uma mensagem, lido uma vez só e quebrado em pedaços com significado.
 *
 * Antes isto estava partido em dois lugares que não se conheciam: `aplicarMencoes` trocava a
 * menção pelo nome num passe de texto, e `renderizarTextoComLinks` varria o resultado atrás de
 * endereço e telefone. Dois passes independentes sobre o mesmo texto, e o segundo não tinha como
 * saber o que o primeiro tinha achado — então uma menção que o CRM não reconhecia (`@33230329753761`)
 * chegava inteira no detector de telefone, que mordia onze dos quatorze dígitos, pendurava os
 * atalhos "WhatsApp" e "Ligar" no meio da frase e deixava os três dígitos restantes soltos. Citar
 * alguém virava um convite a ligar pra essa pessoa, com o número partido ao meio.
 *
 * Aqui é um passe só, e a ordem das alternativas é a regra: menção primeiro. O que já foi
 * reconhecido como menção não é oferecido a mais ninguém.
 *
 * Puro de propósito, sem React: é regra de texto, e regra de texto se prova sem navegador.
 */

/** Um pedaço de mensagem já classificado. `negrito` aninha porque `*fala com o @556299...*` é uma
 *  frase inteira em negrito com uma menção dentro, não duas coisas lado a lado. */
export type Trecho =
  | { tipo: "texto"; valor: string }
  | { tipo: "negrito"; partes: Trecho[] }
  | { tipo: "link"; rotulo: string; href: string }
  | { tipo: "telefone"; rotulo: string; numero: string }
  | { tipo: "mencao"; rotulo: string };

/**
 * O negrito do WhatsApp: `*assim*`.
 *
 * As duas bordas exigem caractere visível colado no asterisco, e é isso que separa formatação de
 * asterisco à toa. `2 * 3` não abre negrito (tem espaço depois do asterisco) e `custou 5 *` não
 * fecha (tem espaço antes). Sem essa exigência, uma conta no meio da conversa deixaria metade da
 * mensagem em negrito.
 *
 * Não atravessa linha, e isso é escolha: lista escrita com `*` no começo de cada item é comum, e
 * deixá-la atravessar transformaria a lista inteira num bloco em negrito. Errar pra menos aqui
 * custa um asterisco visível; errar pra mais estraga a mensagem toda.
 */
const NEGRITO = /\*(\S|\S[^*\n]*?\S)\*/g;

/**
 * Menção, endereço e telefone, nesta ordem, num só padrão.
 *
 * A menção vem primeiro porque ela é a mais específica: `@` seguido de 8 a 15 dígitos é o formato
 * que o WhatsApp grava ao marcar alguém, e qualquer um desses números também casaria com o padrão
 * de telefone logo abaixo. Primeira alternativa que casa é a que vale.
 *
 * O telefone cobre o jeito que as pessoas escrevem de verdade: com e sem +55, com DDD entre
 * parênteses, com hífen, com espaço. De 10 a 13 dígitos pra não transformar preço, CEP ou número
 * de pedido em link de ligação.
 */
const PEDACOS = /(@\d{8,15})\b|(https?:\/\/\S+|www\.\S+)|((?:\+?55\s?)?(?:\(?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4})/g;

/** Pontuação que encosta no fim de um endereço e não faz parte dele. "Olha o https://azuz.com." tem
 *  um ponto final, não um endereço terminado em ponto. */
const PONTUACAO_FINAL = /[.,;:!?]+$/;

/** Só dígitos, com o 55 do Brasil na frente: o formato que o `wa.me` exige. */
export function numeroParaWhatsapp(bruto: string): string | null {
  const digitos = bruto.replace(/\D/g, "");
  if (digitos.length < 10 || digitos.length > 13) return null;
  return digitos.startsWith("55") ? digitos : `55${digitos}`;
}

function textoSeTiver(valor: string): Trecho[] {
  return valor ? [{ tipo: "texto", valor }] : [];
}

/** Classifica um trecho que já se sabe não ter negrito dentro. */
function interpretarSemNegrito(texto: string, resolverMencao: (digitos: string) => string): Trecho[] {
  const trechos: Trecho[] = [];
  let fim = 0;

  // `matchAll` em vez de `exec` em laço: a regex é global e guarda `lastIndex` entre chamadas, o
  // que dá resultado errado quando a mesma constante é usada por duas mensagens seguidas.
  for (const casou of texto.matchAll(PEDACOS)) {
    const inicio = casou.index;
    trechos.push(...textoSeTiver(texto.slice(fim, inicio)));
    fim = inicio + casou[0].length;

    const [, mencao, endereco, telefone] = casou;

    if (mencao) {
      trechos.push({ tipo: "mencao", rotulo: resolverMencao(mencao.slice(1)) });
      continue;
    }

    if (endereco) {
      // A pontuação final volta a ser texto: sublinhar o ponto final da frase junto com o endereço
      // faz parecer que ele faz parte do link, e colado numa URL ele às vezes faz.
      const limpo = endereco.replace(PONTUACAO_FINAL, "");
      const sobra = endereco.slice(limpo.length);
      trechos.push({
        tipo: "link",
        rotulo: limpo,
        // `www.` sem esquema não navega: o navegador leria como caminho relativo do próprio CRM.
        href: limpo.startsWith("www.") ? `https://${limpo}` : limpo,
      });
      trechos.push(...textoSeTiver(sobra));
      continue;
    }

    if (telefone) {
      const numero = numeroParaWhatsapp(telefone);
      trechos.push(numero ? { tipo: "telefone", rotulo: telefone, numero } : { tipo: "texto", valor: telefone });
    }
  }

  trechos.push(...textoSeTiver(texto.slice(fim)));
  return trechos;
}

/** O texto da mensagem em pedaços classificados, prontos pra virar tela. */
export function interpretarMensagem(texto: string, resolverMencao: (digitos: string) => string): Trecho[] {
  if (!texto) return [];

  const trechos: Trecho[] = [];
  let fim = 0;

  for (const casou of texto.matchAll(NEGRITO)) {
    const inicio = casou.index;
    trechos.push(...interpretarSemNegrito(texto.slice(fim, inicio), resolverMencao));
    fim = inicio + casou[0].length;
    trechos.push({ tipo: "negrito", partes: interpretarSemNegrito(casou[1], resolverMencao) });
  }

  trechos.push(...interpretarSemNegrito(texto.slice(fim), resolverMencao));
  return trechos;
}
