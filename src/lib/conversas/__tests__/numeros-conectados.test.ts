import { describe, expect, it } from "vitest";

import {
  conversaDoNumero,
  mapaDeNumeros,
  nomeDoNumeroDaConversa,
  precisaEscolherNumero,
} from "@/lib/conversas/numeros-conectados";

const numeros = [
  {
    chave: "meta_whatsapp:109876543210",
    provedor: "meta_whatsapp",
    slot: 1,
    nome: "WhatsApp oficial",
    numeroLegivel: "+55 62 3961-4730",
    status: "conectado",
  },
  {
    chave: "whatsapp_nao_oficial:5511977776666",
    provedor: "whatsapp_nao_oficial",
    slot: 2,
    nome: "Closer — João",
    numeroLegivel: "+55 (11) 97777-6666",
    status: "conectado",
  },
];

describe("de qual número é a conversa", () => {
  const mapa = mapaDeNumeros(numeros);

  it("responde pelos dois canais, não só pelo QR Code", () => {
    // A identidade da oficial é o id da Meta, e não um telefone: comparar dígitos não acharia nada.
    expect(nomeDoNumeroDaConversa(mapa, "meta_whatsapp:109876543210")).toBe("WhatsApp oficial");
    expect(nomeDoNumeroDaConversa(mapa, "whatsapp_nao_oficial:5511977776666")).toBe("Closer — João");
  });

  it("o nome antigo do canal de QR Code continua casando", () => {
    expect(nomeDoNumeroDaConversa(mapa, "whatsapp_baileys:5511977776666")).toBe("Closer — João");
  });

  it("não inventa nome pra conversa sem marca", () => {
    expect(nomeDoNumeroDaConversa(mapa, null)).toBeNull();
    expect(nomeDoNumeroDaConversa(mapa, "whatsapp_nao_oficial:5531900000000")).toBeNull();
  });
});

describe("quando o filtro por número vale a pena", () => {
  it("com dois conectados, sim — inclusive um de cada canal", () => {
    expect(precisaEscolherNumero(numeros)).toBe(true);
  });

  it("com um só, não: seria escolher entre 'todos' e 'o único'", () => {
    expect(precisaEscolherNumero([numeros[0], { ...numeros[1], status: "desconectado" }])).toBe(false);
  });
});

describe("o filtro em si", () => {
  it("deixa tudo passar em 'Todos'", () => {
    expect(conversaDoNumero(null, "Todos")).toBe(true);
    expect(conversaDoNumero("meta_whatsapp:109876543210", "Todos")).toBe(true);
  });

  it("casa a conexão escolhida", () => {
    expect(conversaDoNumero("meta_whatsapp:109876543210", "meta_whatsapp:109876543210")).toBe(true);
    expect(conversaDoNumero("whatsapp_nao_oficial:5511977776666", "meta_whatsapp:109876543210")).toBe(false);
  });

  it("conversa gravada com o nome antigo do canal entra no filtro do número certo", () => {
    expect(conversaDoNumero("whatsapp_baileys:5511977776666", "whatsapp_nao_oficial:5511977776666")).toBe(true);
  });

  it("conversa sem marca não entra no filtro de ninguém", () => {
    // Ela é histórico de antes da coluna: dizer que é de um número seria afirmar o que não se sabe.
    expect(conversaDoNumero(null, "meta_whatsapp:109876543210")).toBe(false);
  });
});
