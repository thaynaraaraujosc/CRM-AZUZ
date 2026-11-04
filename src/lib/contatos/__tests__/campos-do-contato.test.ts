import { describe, expect, it } from "vitest";

import {
  MAXIMO_DE_CAMPOS,
  lerCamposDoContato,
  lerValoresDeCampos,
  novoIdDeCampo,
  sanearValoresDeCampos,
  type CampoDoContato,
} from "../campos-do-contato";

/**
 * A lista de campos vem de JSON gravado por uma versão anterior do produto, e os valores vêm do
 * NAVEGADOR. Nenhum dos dois é confiável por contrato: o que estes testes prendem é que nada
 * daquilo chegue torto na tela nem inchado no banco.
 */
describe("lerCamposDoContato", () => {
  it("lê uma lista normal", () => {
    const campos = lerCamposDoContato([
      { id: "c1", nome: "Origem do paciente", tipo: "escolha", opcoes: ["Indicação", "Instagram"] },
      { id: "c2", nome: "Placa", tipo: "texto" },
    ]);
    expect(campos).toHaveLength(2);
    expect(campos[0].opcoes).toEqual(["Indicação", "Instagram"]);
    expect(campos[1].tipo).toBe("texto");
  });

  it("descarta campo sem id e campo sem nome", () => {
    // Sem id não há como amarrar valor nenhum; sem nome é uma linha em branco no painel.
    const campos = lerCamposDoContato([
      { nome: "Sem id", tipo: "texto" },
      { id: "c1", nome: "   ", tipo: "texto" },
      { id: "c2", nome: "Serve", tipo: "texto" },
    ]);
    expect(campos.map((c) => c.id)).toEqual(["c2"]);
  });

  it("não repete id", () => {
    const campos = lerCamposDoContato([
      { id: "c1", nome: "Primeiro", tipo: "texto" },
      { id: "c1", nome: "Segundo", tipo: "texto" },
    ]);
    expect(campos.map((c) => c.nome)).toEqual(["Primeiro"]);
  });

  it("tipo desconhecido vira texto, que é o que sempre funciona", () => {
    const campos = lerCamposDoContato([{ id: "c1", nome: "X", tipo: "planilha" }]);
    expect(campos[0].tipo).toBe("texto");
  });

  it("corta no teto", () => {
    const muitos = Array.from({ length: MAXIMO_DE_CAMPOS + 10 }, (_, i) => ({
      id: `c${i}`,
      nome: `Campo ${i}`,
      tipo: "texto",
    }));
    expect(lerCamposDoContato(muitos)).toHaveLength(MAXIMO_DE_CAMPOS);
  });

  it("o que não é lista vira lista vazia", () => {
    expect(lerCamposDoContato(null)).toEqual([]);
    expect(lerCamposDoContato({ id: "c1" })).toEqual([]);
    expect(lerCamposDoContato("c1")).toEqual([]);
  });
});

describe("lerValoresDeCampos", () => {
  const campos: CampoDoContato[] = [
    { id: "c1", nome: "Placa", tipo: "texto" },
    { id: "c2", nome: "Turma", tipo: "texto" },
  ];

  it("só devolve valor de campo que ainda existe", () => {
    // Apagar um campo tem que sumir com ele da tela. Valor órfão guardado reapareceria se alguém
    // recriasse um campo com o mesmo id.
    const valores = lerValoresDeCampos({ c1: "ABC-1234", c9: "de um campo apagado" }, campos);
    expect(valores).toEqual({ c1: "ABC-1234" });
  });

  it("valor vazio não é guardado como string vazia", () => {
    expect(lerValoresDeCampos({ c1: "   ", c2: "2026" }, campos)).toEqual({ c2: "2026" });
  });

  it("número vira texto em vez de sumir", () => {
    expect(lerValoresDeCampos({ c2: 2026 }, campos)).toEqual({ c2: "2026" });
  });
});

describe("sanearValoresDeCampos", () => {
  it("corta no teto de campos", () => {
    const cru: Record<string, string> = {};
    for (let i = 0; i < MAXIMO_DE_CAMPOS + 50; i += 1) cru[`c${i}`] = "x";
    expect(Object.keys(sanearValoresDeCampos(cru))).toHaveLength(MAXIMO_DE_CAMPOS);
  });

  it("corta valor comprido e chave comprida", () => {
    const saneado = sanearValoresDeCampos({
      c1: "a".repeat(2000),
      ["k".repeat(100)]: "entra não",
    });
    expect(saneado.c1).toHaveLength(500);
    expect(Object.keys(saneado)).toEqual(["c1"]);
  });

  it("o que não é objeto de pares vira objeto vazio", () => {
    expect(sanearValoresDeCampos(["c1", "c2"])).toEqual({});
    expect(sanearValoresDeCampos("c1")).toEqual({});
    expect(sanearValoresDeCampos(null)).toEqual({});
  });

  it("valor que não é texto nem número é descartado, não gravado como objeto", () => {
    expect(sanearValoresDeCampos({ c1: { aninhado: true }, c2: "ok" })).toEqual({ c2: "ok" });
  });
});

describe("novoIdDeCampo", () => {
  it("não colide com os que já existem", () => {
    const existentes: CampoDoContato[] = Array.from({ length: 20 }, (_, i) => ({
      id: `c${i}`,
      nome: `Campo ${i}`,
      tipo: "texto" as const,
    }));
    const id = novoIdDeCampo(existentes);
    expect(existentes.some((c) => c.id === id)).toBe(false);
  });
});
