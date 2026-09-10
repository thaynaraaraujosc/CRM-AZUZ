import { describe, expect, it } from "vitest";

import { ordenarContatos, origemNoFiltro } from "@/lib/contatos/ordenacao";

const c = (nome: string, ultima = "") => ({ nome, ultima });

describe("origem no filtro", () => {
  it('contato antigo gravado como "Indicação" aparece em "Salvo manualmente"', () => {
    expect(origemNoFiltro("Indicação")).toBe("Salvo manualmente");
  });

  it("origem sem chip próprio não é traduzida: continua aparecendo em Todos", () => {
    expect(origemNoFiltro("Meta Ads")).toBe("Meta Ads");
    expect(origemNoFiltro("Direto")).toBe("Direto");
  });

  it("os canais passam direto", () => {
    expect(origemNoFiltro("WhatsApp")).toBe("WhatsApp");
    expect(origemNoFiltro("Instagram")).toBe("Instagram");
  });
});

describe("ordenar contatos", () => {
  it("A → Z ignora acento e caixa", () => {
    const lista = [c("Ângela"), c("ana"), c("Bruno")];
    expect(ordenarContatos(lista, "az").map((x) => x.nome)).toEqual(["ana", "Ângela", "Bruno"]);
  });

  it("Z → A é o inverso", () => {
    const lista = [c("Ana"), c("Bruno"), c("Carla")];
    expect(ordenarContatos(lista, "za").map((x) => x.nome)).toEqual(["Carla", "Bruno", "Ana"]);
  });

  it("mais recentes usa a ordem de chegada, do fim pro começo", () => {
    const lista = [c("primeiro"), c("segundo"), c("terceiro")];
    expect(ordenarContatos(lista, "recentes").map((x) => x.nome)).toEqual(["terceiro", "segundo", "primeiro"]);
  });

  it("última interação põe o mais recente na frente", () => {
    const lista = [c("velho", "Há 3 dias"), c("agora", "Agora"), c("medio", "Há 2h")];
    expect(ordenarContatos(lista, "interacao").map((x) => x.nome)).toEqual(["agora", "medio", "velho"]);
  });

  it("quem não tem informação de interação vai pro fim, nunca pro topo", () => {
    const lista = [c("sem"), c("com", "Hoje")];
    expect(ordenarContatos(lista, "interacao").map((x) => x.nome)).toEqual(["com", "sem"]);
  });

  it("não mexe na lista original", () => {
    const lista = [c("Bruno"), c("Ana")];
    ordenarContatos(lista, "az");
    expect(lista.map((x) => x.nome)).toEqual(["Bruno", "Ana"]);
  });
});
