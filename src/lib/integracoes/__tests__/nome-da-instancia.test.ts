import { describe, expect, it } from "vitest";

import { conexaoDaInstancia, nomeInstancia, workspaceIdDaInstancia } from "@/lib/integracoes/evolution";

/**
 * O NOME DA INSTÂNCIA É O ENDEREÇO DE UMA SESSÃO DO WHATSAPP.
 *
 * Errar aqui não dá erro em lugar nenhum: dá a conversa de uma empresa caindo na caixa de entrada
 * de outra, ou o número do closer respondendo pelo número do comercial. É a decisão mais perigosa
 * de todo o suporte a vários números, e a mais barata de testar.
 */
describe("o nome da instância na Evolution", () => {
  it("o slot 1 continua igual ao que sempre foi", () => {
    // É o que faz a mudança não pedir que ninguém leia o QR de novo: a instância que está de pé,
    // com a sessão da cliente dentro, continua sendo encontrada pelo mesmo nome.
    expect(nomeInstancia("azuz-digital")).toBe("crm-azuz-digital");
    expect(nomeInstancia("azuz-digital", 1)).toBe("crm-azuz-digital");
  });

  it("do segundo número em diante, ganha sufixo", () => {
    expect(nomeInstancia("azuz-digital", 2)).toBe("crm-azuz-digital_2");
    expect(nomeInstancia("azuz-digital", 10)).toBe("crm-azuz-digital_10");
  });

  it("a volta devolve a empresa e a conexão", () => {
    expect(conexaoDaInstancia("crm-azuz-digital")).toEqual({ workspaceId: "azuz-digital", slot: 1 });
    expect(conexaoDaInstancia("crm-azuz-digital_2")).toEqual({ workspaceId: "azuz-digital", slot: 2 });
  });

  it("ida e volta fecham pra qualquer slot", () => {
    for (const slot of [1, 2, 3, 10, 99]) {
      expect(conexaoDaInstancia(nomeInstancia("empresa-x", slot))).toEqual({
        workspaceId: "empresa-x",
        slot,
      });
    }
  });

  it("empresa com número no nome não vira slot", () => {
    /*
     * O CASO QUE O SEPARADOR EXISTE PRA EVITAR.
     *
     * Com hífen, "crm-empresa-2" seria ambíguo: empresa "empresa-2" no slot 1, ou empresa
     * "empresa" no slot 2? Duas conexões disputando o mesmo nome é a conversa de uma caindo na
     * caixa da outra. `slugId` nunca produz `_`, então ele separa sem ambiguidade.
     */
    expect(conexaoDaInstancia("crm-empresa-2")).toEqual({ workspaceId: "empresa-2", slot: 1 });
    expect(nomeInstancia("empresa-2")).toBe("crm-empresa-2");
    expect(nomeInstancia("empresa", 2)).toBe("crm-empresa_2");
  });

  it("instância de outro uso do mesmo servidor é ignorada", () => {
    expect(conexaoDaInstancia("outra-coisa")).toBeNull();
    expect(conexaoDaInstancia("crm-")).toBeNull();
    expect(workspaceIdDaInstancia("outra-coisa")).toBeNull();
  });

  it("sufixo que não é número não vira slot", () => {
    // Ler um sufixo estranho como slot mandaria o evento pra uma empresa que não existe.
    expect(conexaoDaInstancia("crm-empresa_teste")).toEqual({ workspaceId: "empresa_teste", slot: 1 });
  });
});
