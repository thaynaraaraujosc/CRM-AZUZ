import { describe, expect, it } from "vitest";
import { semNumerosFantasmas } from "@/lib/integracoes/numeros-de-whatsapp";
import type { NumeroDeWhatsApp } from "@/lib/integracoes/numeros-de-whatsapp";

function numero(parcial: Partial<NumeroDeWhatsApp>): NumeroDeWhatsApp {
  return {
    chave: "",
    provedor: "whatsapp_nao_oficial",
    slot: 1,
    nome: "",
    apelido: null,
    numeroLegivel: "",
    status: "conectado",
    erroMensagem: null,
    qrDataUrl: null,
    funilId: null,
    responsavel: null,
    ...parcial,
  } as NumeroDeWhatsApp;
}

describe("semNumerosFantasmas", () => {
  it("tira a posição desconectada quando o MESMO número está conectado em outra", () => {
    // É o caso exato do print: +55 62 9634-0438 duas vezes, uma desconectada em cima da conectada.
    const lista = semNumerosFantasmas([
      numero({ slot: 1, chave: "whatsapp_nao_oficial:556296340438", status: "desconectado" }),
      numero({ slot: 2, chave: "whatsapp_nao_oficial:556296340438", status: "conectado" }),
    ]);
    expect(lista).toHaveLength(1);
    expect(lista[0].slot).toBe(2);
  });

  it("tira a posição desconectada e sem número: é o que sobra de quem desconecta de propósito", () => {
    const lista = semNumerosFantasmas([
      numero({ slot: 1, chave: "", status: "desconectado" }),
      numero({ slot: 2, chave: "whatsapp_nao_oficial:556299990000", status: "conectado" }),
    ]);
    expect(lista.map((n) => n.slot)).toEqual([2]);
  });

  it("MANTÉM o número que caiu sozinho e não voltou", () => {
    // Essa linha não é sujeira: enquanto ela estiver assim, ninguém recebe por aquele número.
    const lista = semNumerosFantasmas([
      numero({ slot: 1, chave: "whatsapp_nao_oficial:556211112222", status: "desconectado" }),
      numero({ slot: 2, chave: "whatsapp_nao_oficial:556233334444", status: "conectado" }),
    ]);
    expect(lista.map((n) => n.slot)).toEqual([1, 2]);
  });

  it("mantém quem está esperando o QR Code e quem está com erro", () => {
    const lista = semNumerosFantasmas([
      numero({ slot: 1, chave: "", status: "aguardando_qr" }),
      numero({ slot: 2, chave: "whatsapp_nao_oficial:5562000", status: "erro" }),
    ]);
    expect(lista).toHaveLength(2);
  });

  it("nunca tira o número oficial, nem desconectado", () => {
    // Ele não se conecta por esta tela; sumir com ele esconderia o número principal da empresa.
    const lista = semNumerosFantasmas([
      numero({ slot: 1, provedor: "meta_whatsapp", chave: "", status: "desconectado" }),
    ]);
    expect(lista).toHaveLength(1);
  });

  it("dois fantasmas do mesmo número somem juntos", () => {
    const lista = semNumerosFantasmas([
      numero({ slot: 1, chave: "whatsapp_nao_oficial:556296340438", status: "desconectado" }),
      numero({ slot: 3, chave: "whatsapp_nao_oficial:556296340438", status: "desconectado" }),
      numero({ slot: 2, chave: "whatsapp_nao_oficial:556296340438", status: "conectado" }),
    ]);
    expect(lista.map((n) => n.slot)).toEqual([2]);
  });
});
