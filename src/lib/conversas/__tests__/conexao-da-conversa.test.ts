import { describe, expect, it } from "vitest";

import {
  conexaoDaConversa,
  precisaDistinguirConexao,
} from "../conexao-da-conversa";

describe("de qual conexão de WhatsApp é a conversa", () => {
  it("separa a API oficial do QR Code", () => {
    expect(conexaoDaConversa("meta_whatsapp:123456")).toBe("oficial");
    expect(conexaoDaConversa("whatsapp_nao_oficial:556293961473")).toBe("qrcode");
  });

  it("entende o prefixo antigo do QR Code", () => {
    expect(conexaoDaConversa("whatsapp_baileys:556293961473")).toBe("qrcode");
  });

  it("não chuta pra Instagram nem pra histórico sem marca", () => {
    expect(conexaoDaConversa("meta_instagram:998877")).toBe(null);
    expect(conexaoDaConversa(null)).toBe(null);
    expect(conexaoDaConversa("")).toBe(null);
  });
});

describe("quando a etiqueta de conexão aparece", () => {
  it("aparece só com as duas conexões na mesma lista", () => {
    expect(
      precisaDistinguirConexao([
        { contaCanal: "meta_whatsapp:1" },
        { contaCanal: "whatsapp_nao_oficial:2" },
      ]),
    ).toBe(true);
  });

  it("não aparece quando tudo veio do mesmo lugar", () => {
    expect(
      precisaDistinguirConexao([
        { contaCanal: "whatsapp_nao_oficial:2" },
        { contaCanal: "whatsapp_nao_oficial:2" },
        { contaCanal: "meta_instagram:9" },
        { contaCanal: null },
      ]),
    ).toBe(false);
  });

  it("lista vazia não pede etiqueta nenhuma", () => {
    expect(precisaDistinguirConexao([])).toBe(false);
  });
});
