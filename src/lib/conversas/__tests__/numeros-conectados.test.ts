import { describe, expect, it } from "vitest";

import {
  conversaDoNumero,
  mapaDeNumeros,
  nomeDoNumeroDaConversa,
  precisaEscolherNumero,
} from "@/lib/conversas/numeros-conectados";

const numeros = [
  { slot: 1, nome: "Vendas — Marina", numero: "5562939614730", status: "conectado" },
  { slot: 2, nome: "Closer — João", numero: "5511977776666", status: "conectado" },
  { slot: 3, nome: "Número 3", numero: null, status: "desconectado" },
];

describe("de qual número é a conversa", () => {
  const mapa = mapaDeNumeros(numeros);

  it("responde o nome que a empresa deu", () => {
    expect(nomeDoNumeroDaConversa(mapa, "whatsapp_nao_oficial:5511977776666")).toBe("Closer — João");
  });

  it("não inventa nome pra conversa sem marca", () => {
    expect(nomeDoNumeroDaConversa(mapa, null)).toBeNull();
    expect(nomeDoNumeroDaConversa(mapa, "whatsapp_nao_oficial:5531900000000")).toBeNull();
  });
});

describe("quando o filtro por número vale a pena", () => {
  it("com dois conectados, sim", () => {
    expect(precisaEscolherNumero(numeros)).toBe(true);
  });

  it("com um só, não: seria escolher entre 'todos' e 'o único'", () => {
    expect(precisaEscolherNumero([numeros[0], numeros[2]])).toBe(false);
  });
});

describe("o filtro em si", () => {
  it("deixa tudo passar em 'Todos'", () => {
    expect(conversaDoNumero(null, "Todos")).toBe(true);
    expect(conversaDoNumero("whatsapp_nao_oficial:5562939614730", "Todos")).toBe(true);
  });

  it("casa o número escolhido", () => {
    expect(conversaDoNumero("whatsapp_nao_oficial:5562939614730", "5562939614730")).toBe(true);
    expect(conversaDoNumero("whatsapp_nao_oficial:5511977776666", "5562939614730")).toBe(false);
  });

  it("conversa sem marca não entra no filtro de ninguém", () => {
    // Ela é histórico de antes da coluna: dizer que é de um número seria afirmar o que não se sabe.
    expect(conversaDoNumero(null, "5562939614730")).toBe(false);
  });
});
