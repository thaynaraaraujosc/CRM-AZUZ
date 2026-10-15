import { describe, expect, it } from "vitest";

import { interpretarMensagem, type Trecho } from "../formatacao-mensagem";

/**
 * O que estes testes prendem é a tela da conversa parecendo com o WhatsApp — e, antes disso, não
 * mentindo.
 *
 * O caso que originou o arquivo: `@33230329753761` chegava inteiro no detector de telefone, que
 * mordia onze dos quatorze dígitos, pendurava "WhatsApp" e "Ligar" no meio da frase e deixava
 * `761` solto depois. A mensagem ficava ilegível e oferecia uma ligação que ninguém pediu.
 */

/** Resolvedor de mentirinha: devolve nome pra um número conhecido e o próprio número pro resto. */
const resolver = (digitos: string) => (digitos === "5587600555651" ? "Raquel" : `+${digitos}`);

/** O texto que sai na tela, concatenado, pra afirmar sobre o conteúdo sem desenhar nada. */
function textoVisivel(trechos: Trecho[]): string {
  return trechos
    .map((t) => {
      if (t.tipo === "negrito") return textoVisivel(t.partes);
      if (t.tipo === "mencao") return `@${t.rotulo}`;
      if (t.tipo === "texto") return t.valor;
      return t.rotulo;
    })
    .join("");
}

const tipos = (trechos: Trecho[]) => trechos.map((t) => t.tipo);

describe("menção", () => {
  it("vira o nome de quem foi mencionado, sem virar atalho de ligação", () => {
    const trechos = interpretarMensagem("@5587600555651 disponibilizei as cenas", resolver);

    expect(tipos(trechos)).toEqual(["mencao", "texto"]);
    expect(textoVisivel(trechos)).toBe("@Raquel disponibilizei as cenas");
  });

  it("número de menção não é oferecido ao detector de telefone", () => {
    /*
     * A regressão, com o número do print: 14 dígitos. O detector casava com 11 deles e sobrava
     * `761` como texto solto. A menção é a primeira alternativa do padrão justamente pra isso.
     */
    const trechos = interpretarMensagem("@33230329753761 consegue me enviar?", resolver);

    expect(tipos(trechos)).toEqual(["mencao", "texto"]);
    expect(trechos.some((t) => t.tipo === "telefone")).toBe(false);
  });

  it("não confunde e-mail nem @ de usuário com menção", () => {
    const trechos = interpretarMensagem("manda pra contato@azuz.com e chama o @joao", resolver);

    expect(trechos.every((t) => t.tipo !== "mencao")).toBe(true);
  });

  it("resolve várias menções na mesma mensagem", () => {
    const trechos = interpretarMensagem("@5587600555651 e @5562999990001, podem ver?", resolver);

    expect(textoVisivel(trechos)).toBe("@Raquel e @+5562999990001, podem ver?");
  });
});

describe("negrito do WhatsApp", () => {
  it("asterisco nas duas pontas vira negrito, e o asterisco some", () => {
    const trechos = interpretarMensagem("*RELATÓRIO ANÚNCIO* segue abaixo", resolver);

    expect(tipos(trechos)).toEqual(["negrito", "texto"]);
    expect(textoVisivel(trechos)).toBe("RELATÓRIO ANÚNCIO segue abaixo");
  });

  it("vale pra mensagem recebida e enviada igualmente", () => {
    // Não há distinção no interpretador de propósito: é o mesmo texto, venha de quem vier.
    expect(tipos(interpretarMensagem("*oi*", resolver))).toEqual(["negrito"]);
  });

  it("conta com asterisco no meio da frase não vira formatação", () => {
    // `2 * 3`: o asterisco tem espaço dos dois lados. Sem essa regra, metade da conversa ficaria
    // em negrito por causa de uma multiplicação.
    const trechos = interpretarMensagem("são 2 * 3 reais * por peça", resolver);

    expect(trechos.every((t) => t.tipo !== "negrito")).toBe(true);
  });

  it("asterisco sozinho e sem par continua sendo asterisco", () => {
    expect(textoVisivel(interpretarMensagem("custou 5 * o preço", resolver))).toBe("custou 5 * o preço");
  });

  it("não atravessa linha, pra lista com asterisco não virar um bloco só", () => {
    const trechos = interpretarMensagem("*item um\n*item dois", resolver);

    expect(trechos.every((t) => t.tipo !== "negrito")).toBe(true);
  });

  it("negrito com menção dentro mantém as duas coisas", () => {
    const trechos = interpretarMensagem("*urgente @5587600555651 olha isso*", resolver);

    expect(tipos(trechos)).toEqual(["negrito"]);
    expect(textoVisivel(trechos)).toBe("urgente @Raquel olha isso");
    const negrito = trechos[0];
    expect(negrito.tipo === "negrito" && negrito.partes.some((p) => p.tipo === "mencao")).toBe(true);
  });
});

describe("endereços", () => {
  it("link enviado e link recebido são o mesmo trecho clicável", () => {
    const trechos = interpretarMensagem("olha https://www.instagram.com/reel/DOuCYsiEVYC/ aqui", resolver);

    expect(tipos(trechos)).toEqual(["texto", "link", "texto"]);
  });

  it("endereço sem esquema ganha https, senão o navegador trataria como caminho do CRM", () => {
    const trechos = interpretarMensagem("entra em www.azuzcrm.com.br", resolver);
    const link = trechos.find((t) => t.tipo === "link");

    expect(link).toMatchObject({ rotulo: "www.azuzcrm.com.br", href: "https://www.azuzcrm.com.br" });
  });

  it("ponto final da frase não entra no link", () => {
    // Sublinhar o ponto final junto faz parecer que ele é do endereço — e colado numa URL, às
    // vezes é mesmo. Fora do link ele volta a ser pontuação.
    const trechos = interpretarMensagem("veja em https://azuz.com.br.", resolver);

    expect(trechos.find((t) => t.tipo === "link")).toMatchObject({ href: "https://azuz.com.br" });
    expect(textoVisivel(trechos)).toBe("veja em https://azuz.com.br.");
  });
});

describe("telefone solto", () => {
  it("continua virando atalho, que é o que a menção deixou de fazer", () => {
    const trechos = interpretarMensagem("meu número é (62) 99999-0001", resolver);

    expect(trechos.find((t) => t.tipo === "telefone")).toMatchObject({ numero: "5562999990001" });
  });

  it("preço e número curto não viram ligação", () => {
    expect(interpretarMensagem("custou 153,78", resolver).every((t) => t.tipo !== "telefone")).toBe(true);
  });
});

describe("texto comum", () => {
  it("mensagem sem nada especial sai inteira, em um pedaço só", () => {
    const trechos = interpretarMensagem("bom dia, tudo bem?", resolver);

    expect(trechos).toEqual([{ tipo: "texto", valor: "bom dia, tudo bem?" }]);
  });

  it("texto vazio não vira pedaço nenhum", () => {
    expect(interpretarMensagem("", resolver)).toEqual([]);
  });

  it("a mesma constante de regex serve duas mensagens seguidas", () => {
    // Regex global guarda `lastIndex` entre chamadas. Reusar com `exec` em laço daria resultado
    // errado na segunda mensagem — por isso o interpretador usa `matchAll`.
    const primeira = interpretarMensagem("@5587600555651 oi", resolver);
    const segunda = interpretarMensagem("@5587600555651 oi", resolver);

    expect(segunda).toEqual(primeira);
  });
});
