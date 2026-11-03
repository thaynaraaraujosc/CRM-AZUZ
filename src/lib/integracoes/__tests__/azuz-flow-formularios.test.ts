import { describe, expect, it } from "vitest";

import { LISTA_VAZIA, lerListaDeFormularios } from "@/lib/integracoes/azuz-flow-formularios";

describe("lerListaDeFormularios", () => {
  it("lê a lista que o Flow manda", () => {
    expect(
      lerListaDeFormularios({
        formularios: [
          { id: "f1", nome: "Diagnóstico", publicado: true, enviaAoCrm: true },
          { id: "f2", nome: "Campanha de verão", publicado: false, enviaAoCrm: false },
        ],
        sincronizadaEm: "2026-11-03T12:00:00.000Z",
      }),
    ).toEqual({
      formularios: [
        { id: "f1", nome: "Diagnóstico", publicado: true, enviaAoCrm: true },
        { id: "f2", nome: "Campanha de verão", publicado: false, enviaAoCrm: false },
      ],
      sincronizadaEm: "2026-11-03T12:00:00.000Z",
    });
  });

  it("devolve lista vazia pro que não é lista", () => {
    expect(lerListaDeFormularios(null)).toEqual(LISTA_VAZIA);
    expect(lerListaDeFormularios("nada")).toEqual(LISTA_VAZIA);
    expect(lerListaDeFormularios({})).toEqual(LISTA_VAZIA);
    expect(lerListaDeFormularios({ formularios: "nada" })).toEqual(LISTA_VAZIA);
  });

  /*
   * CORTAR, NÃO RECUSAR — a mesma regra do resto da integração. Um nome gigante não pode deixar a
   * agência sem NENHUM formulário na tela por causa de um campo que ninguém lê até o fim.
   */
  it("apara o que é grande demais em vez de descartar a lista", () => {
    const [f] = lerListaDeFormularios({ formularios: [{ id: "f1", nome: "x".repeat(500) }] }).formularios;
    expect(f.nome).toHaveLength(200);
    expect(f.id).toBe("f1");
  });

  /*
   * Sem id não há a que prender um robô: o gatilho compara por id, e uma entrada sem ele seria uma
   * linha na tela que nunca dispara nada.
   */
  it("descarta entrada sem id, e mantém as boas", () => {
    expect(
      lerListaDeFormularios({ formularios: [{ nome: "sem id" }, { id: "  ", nome: "vazio" }, { id: "f1" }] })
        .formularios,
    ).toEqual([{ id: "f1", nome: "f1", publicado: false, enviaAoCrm: false }]);
  });

  it("usa o id como nome quando o nome não veio, em vez de inventar um", () => {
    expect(lerListaDeFormularios({ formularios: [{ id: "f1" }] }).formularios[0].nome).toBe("f1");
  });

  it("não repete o mesmo formulário quando o Flow manda duplicado", () => {
    expect(
      lerListaDeFormularios({
        formularios: [
          { id: "f1", nome: "Primeiro" },
          { id: "f1", nome: "De novo" },
        ],
      }).formularios,
    ).toEqual([{ id: "f1", nome: "Primeiro", publicado: false, enviaAoCrm: false }]);
  });

  /*
   * O campo que responde "por que este formulário nunca chega": no Flow, "enviar ao CRM" é um
   * liga/desliga de CADA formulário. Conectar a agência não conecta os formulários dela.
   */
  it("lê se o formulário está ligado ao CRM lá no Flow", () => {
    const lista = lerListaDeFormularios({
      formularios: [
        { id: "a", enviaAoCrm: true },
        { id: "b", enviaAoCrm: false },
        { id: "c" },
      ],
    }).formularios;
    expect(lista.map((f) => f.enviaAoCrm)).toEqual([true, false, false]);
  });

  it("só aceita `publicado` quando é exatamente true", () => {
    const lista = lerListaDeFormularios({
      formularios: [
        { id: "a", publicado: true },
        { id: "b", publicado: "sim" },
        { id: "c" },
      ],
    }).formularios;
    expect(lista.map((f) => f.publicado)).toEqual([true, false, false]);
  });

  it("limita uma lista absurda", () => {
    const muitos = Array.from({ length: 600 }, (_, i) => ({ id: `f${i}` }));
    expect(lerListaDeFormularios({ formularios: muitos }).formularios).toHaveLength(300);
  });

  it("tira caractere de controle do nome, que vai pra tela", () => {
    expect(
      lerListaDeFormularios({ formularios: [{ id: "f1", nome: "Diag\u0000nóstico\r\nnovo" }] }).formularios[0].nome,
    ).toBe("Diag nóstico novo");
  });
});
