import { describe, expect, it } from "vitest";

import { mostraCapa, textoDoBotaoDaCapa } from "@/lib/formularios-context";
import { tituloAutomatico } from "../passo-a-passo";
import { enderecoCompleto, separarLinks } from "../texto-com-links";

/**
 * A capa é a PRIMEIRA tela que o cliente da empresa vê. Um erro aqui não aparece pra quem monta:
 * aparece pra quem recebeu o link, uma vez só, e essa pessoa fecha a aba em vez de avisar.
 */
describe("mostraCapa", () => {
  it("não mostra capa desligada, nem formulário antigo que não tem o campo", () => {
    expect(mostraCapa(undefined)).toBe(false);
    expect(mostraCapa({})).toBe(false);
    expect(mostraCapa({ ativa: false, titulo: "Vamos começar" })).toBe(false);
  });

  it("ligada mas em branco não vira tela: seria um clique a mais dizendo nada", () => {
    expect(mostraCapa({ ativa: true })).toBe(false);
    expect(mostraCapa({ ativa: true, titulo: "   ", texto: "  " })).toBe(false);
    expect(mostraCapa({ ativa: true, textoDoBotao: "Começar" })).toBe(false);
  });

  it("título OU texto já bastam", () => {
    expect(mostraCapa({ ativa: true, titulo: "Vamos começar" })).toBe(true);
    expect(mostraCapa({ ativa: true, texto: "São 8 perguntas." })).toBe(true);
  });
});

describe("textoDoBotaoDaCapa", () => {
  it("cai no padrão quando ninguém escreveu nada", () => {
    expect(textoDoBotaoDaCapa(undefined)).toBe("Começar");
    expect(textoDoBotaoDaCapa({ textoDoBotao: "   " })).toBe("Começar");
  });

  it("usa o que a empresa escreveu", () => {
    expect(textoDoBotaoDaCapa({ textoDoBotao: "Quero participar" })).toBe("Quero participar");
  });
});

describe("tituloAutomatico", () => {
  it("reconhece o nome que o próprio construtor dá", () => {
    expect(tituloAutomatico("Página 1")).toBe(true);
    expect(tituloAutomatico("pagina 2")).toBe(true);
    expect(tituloAutomatico("  PÁGINA  10  ")).toBe(true);
    expect(tituloAutomatico("Página")).toBe(true);
  });

  it("título vazio não é título automático — é ausência de título, e quem desenha já não imprime", () => {
    expect(tituloAutomatico(undefined)).toBe(false);
    expect(tituloAutomatico("")).toBe(false);
  });

  it("não toca no título que alguém escreveu de verdade", () => {
    expect(tituloAutomatico("Seus dados")).toBe(false);
    expect(tituloAutomatico("Página do cliente")).toBe(false);
    expect(tituloAutomatico("Dados da página 2")).toBe(false);
  });
});

describe("separarLinks", () => {
  it("texto sem endereço volta inteiro, num pedaço só", () => {
    expect(separarLinks("São 8 perguntas e leva 2 minutos.")).toEqual([
      { texto: "São 8 perguntas e leva 2 minutos.", link: false },
    ]);
  });

  it("separa o endereço do texto em volta", () => {
    expect(separarLinks("Veja https://azuz.com.br antes")).toEqual([
      { texto: "Veja ", link: false },
      { texto: "https://azuz.com.br", link: true },
      { texto: " antes", link: false },
    ]);
  });

  it("a pontuação que fecha a frase não entra no endereço", () => {
    expect(separarLinks("Tudo em www.azuz.com.br.")).toEqual([
      { texto: "Tudo em ", link: false },
      { texto: "www.azuz.com.br", link: true },
      { texto: ".", link: false },
    ]);
  });

  it("não transforma telefone em link: isso é coisa da conversa, não da capa", () => {
    expect(separarLinks("Ligue (62) 99999-0000")).toEqual([{ texto: "Ligue (62) 99999-0000", link: false }]);
  });

  it("ignora esquema que não é http: a capa é página aberta a qualquer um", () => {
    const partes = separarLinks("clique javascript:alert(1) aqui");
    expect(partes.some((p) => p.link)).toBe(false);
  });
});

describe("enderecoCompleto", () => {
  it("põe o esquema no que foi escrito sem ele, senão viraria caminho relativo", () => {
    expect(enderecoCompleto("www.azuz.com.br")).toBe("https://www.azuz.com.br");
    expect(enderecoCompleto("https://azuz.com.br")).toBe("https://azuz.com.br");
  });
});
