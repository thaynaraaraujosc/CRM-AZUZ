import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PRA ONDE VAI O LEAD QUE CHEGOU POR ESTE NÚMERO.
 *
 * O que cada caso aqui protege é a mesma coisa: a conta que nunca configurou nada precisa
 * continuar funcionando exatamente como funcionava. Um `null` virando um funil qualquer é um lead
 * nascendo num quadro que ninguém olha.
 */

let conexoes: { provedor: string; metadados: unknown }[] = [];
vi.mock("@/lib/integracoes/conexoes-cache", () => ({
  conexoesDeConversa: async () => conexoes,
}));

const { destinoDoNumero } = await import("../destino-do-numero");

beforeEach(() => {
  conexoes = [
    {
      provedor: "meta_whatsapp",
      metadados: { phoneNumberId: "109876543210", funilId: "funil-oficial", responsavel: "Marina" },
    },
    {
      provedor: "whatsapp_nao_oficial",
      metadados: { numero: "5511977776666", funilId: "funil-closer", responsavel: "João" },
    },
  ];
});

describe("de qual número veio, pra onde vai", () => {
  it("acha a conexão oficial pelo id da Meta", async () => {
    // A identidade da oficial NÃO é o telefone: é o `phoneNumberId`.
    expect(await destinoDoNumero("w1", "meta_whatsapp:109876543210")).toEqual({
      funilId: "funil-oficial",
      responsavel: "Marina",
    });
  });

  it("acha a conexão de QR Code pelo número", async () => {
    expect(await destinoDoNumero("w1", "whatsapp_nao_oficial:5511977776666")).toEqual({
      funilId: "funil-closer",
      responsavel: "João",
    });
  });

  it("o nome antigo do canal continua achando a conexão certa", async () => {
    expect(await destinoDoNumero("w1", "whatsapp_baileys:5511977776666")).toEqual({
      funilId: "funil-closer",
      responsavel: "João",
    });
  });
});

describe("quando não há destino, nada muda", () => {
  it("conversa sem marca não escolhe funil nem dono", async () => {
    // É o histórico anterior à coluna. Inventar um destino aqui mandaria lead antigo pra um
    // funil novo no primeiro deploy.
    expect(await destinoDoNumero("w1", null)).toEqual({ funilId: null, responsavel: null });
  });

  it("número que não é de nenhuma conexão ligada não escolhe nada", async () => {
    expect(await destinoDoNumero("w1", "whatsapp_nao_oficial:5531900000000")).toEqual({
      funilId: null,
      responsavel: null,
    });
  });

  it("conexão sem configuração devolve os dois nulos, que é a conta de hoje", async () => {
    conexoes = [{ provedor: "whatsapp_nao_oficial", metadados: { numero: "5511977776666" } }];
    expect(await destinoDoNumero("w1", "whatsapp_nao_oficial:5511977776666")).toEqual({
      funilId: null,
      responsavel: null,
    });
  });
});
