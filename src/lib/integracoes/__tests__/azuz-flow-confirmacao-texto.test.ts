import { describe, expect, it } from "vitest";

import {
  TEXTO_PADRAO_DA_CONFIRMACAO,
  montarTextoDaConfirmacao,
} from "../azuz-flow-confirmacao-texto";

/**
 * Isto vai parar no WhatsApp de um cliente do cliente. Errar aqui não dá erro em lugar nenhum: dá
 * uma mensagem estranha chegando a uma pessoa de verdade, pelo número que pode ser bloqueado se
 * ela denunciar.
 */

// 20/10/2026 às 14:30 em Brasília = 17:30 UTC.
const VALORES = {
  primeiroNome: "Ana Paula Souza",
  inicio: new Date("2026-10-20T17:30:00.000Z"),
  link: "https://meet.google.com/abc-defg-hij",
  empresa: "Azuz Digital",
};

describe("as variáveis", () => {
  it("troca tudo pelo valor em Brasília", () => {
    const texto = montarTextoDaConfirmacao(
      "{{primeiroNome}} · {{data}} · {{dataCurta}} · {{hora}} · {{link}} · {{empresa}}",
      VALORES,
    );

    expect(texto).toContain("20/10/2026");
    expect(texto).toContain("14:30");
    expect(texto).toContain("https://meet.google.com/abc-defg-hij");
    expect(texto).toContain("Azuz Digital");
    expect(texto.toLowerCase()).toContain("20 de outubro");
  });

  it("usa só o PRIMEIRO nome", () => {
    // "Oi, Ana Paula Souza de Oliveira!" não é como ninguém escreve pra alguém — e o nome do
    // contato pode ter sufixo de homônimo, que ficaria à mostra na mensagem.
    expect(montarTextoDaConfirmacao("Oi, {{primeiroNome}}!", VALORES)).toBe("Oi, Ana!");
  });

  it("variável desconhecida fica à mostra em vez de sumir", () => {
    // Apagar em silêncio esconderia o erro de digitação de quem escreveu o texto.
    expect(montarTextoDaConfirmacao("Oi {{primeroNome}}", VALORES)).toBe("Oi {{primeroNome}}");
  });
});

describe("a linha do link", () => {
  it("some inteira quando não há link", () => {
    const semLink = montarTextoDaConfirmacao(TEXTO_PADRAO_DA_CONFIRMACAO, { ...VALORES, link: null });

    expect(semLink).not.toContain("http");
    // E não sobra buraco: nada de parágrafo em branco no meio da mensagem.
    expect(semLink).not.toMatch(/\n{3,}/);
    expect(semLink.trim()).toBe(semLink);
  });

  it("vazio e só espaço contam como sem link", () => {
    for (const vazio of ["", "   ", null]) {
      expect(montarTextoDaConfirmacao("a\n{{link}}\nb", { ...VALORES, link: vazio })).toBe("a\nb");
    }
  });

  it("mas uma linha COM palavras fica, mesmo sem o link", () => {
    // "Link: " sozinho é feio, e é o que quem escreveu pediu ao escrever as palavras. Sumir com a
    // frase da pessoa seria o CRM decidindo por ela.
    expect(montarTextoDaConfirmacao("Link: {{link}}", { ...VALORES, link: null })).toBe("Link:");
  });

  it("com link, a linha aparece normalmente", () => {
    expect(montarTextoDaConfirmacao("a\n{{link}}\nb", VALORES)).toBe(
      "a\nhttps://meet.google.com/abc-defg-hij\nb",
    );
  });
});

describe("o texto padrão", () => {
  it("diz de onde a pessoa veio e como parar", () => {
    /*
     * As duas frases não são educação: são o que separa a mensagem de um spam. Quem recebe não
     * lembra de ter dado o número, e quem não consegue sair denuncia — e denúncia é o que bloqueia
     * o número da agência.
     */
    const texto = montarTextoDaConfirmacao(TEXTO_PADRAO_DA_CONFIRMACAO, VALORES);

    expect(texto).toContain("formulário da Azuz Digital");
    expect(texto).toContain("SAIR");
  });

  it("sai pronto, sem variável sobrando", () => {
    expect(montarTextoDaConfirmacao(TEXTO_PADRAO_DA_CONFIRMACAO, VALORES)).not.toContain("{{");
  });
});

describe("a virada do dia", () => {
  it("23h30 de Brasília continua sendo o dia de Brasília, não o de Londres", () => {
    /*
     * 20/10 às 23h30 em Brasília é 21/10 às 02h30 em UTC. Formatar pelo instante cru mandaria a
     * pessoa pra reunião no dia seguinte — e só em algumas horas do dia, que é o tipo de defeito
     * que passa semanas sem ninguém reproduzir.
     */
    const texto = montarTextoDaConfirmacao("{{dataCurta}} {{hora}}", {
      ...VALORES,
      inicio: new Date("2026-10-21T02:30:00.000Z"),
    });

    expect(texto).toBe("20/10/2026 23:30");
  });
});
