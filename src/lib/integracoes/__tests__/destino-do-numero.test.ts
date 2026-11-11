import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PRA ONDE VAI O LEAD QUE CHEGOU POR ESTE NÚMERO.
 *
 * O que cada caso aqui protege é a mesma coisa: a conta que nunca configurou nada precisa
 * continuar funcionando exatamente como funcionava. Um `null` virando um funil qualquer é um lead
 * nascendo num quadro que ninguém olha.
 */

let conexoes: { provedor: string; metadados: unknown }[] = [];
/** Os funis da empresa, com o número de cada um. Ver `Funil.contaCanal`. */
let funis: { id: string; contaCanal: string | null }[] = [];

vi.mock("@/lib/integracoes/conexoes-cache", () => ({
  conexoesDeConversa: async () => conexoes,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    funil: {
      findFirst: async ({ where }: { where: { contaCanal: string } }) =>
        funis.find((f) => f.contaCanal === where.contaCanal) ?? null,
    },
  },
}));

const { destinoDoNumero } = await import("../destino-do-numero");

beforeEach(() => {
  funis = [];
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

/**
 * O FUNIL É QUEM DIZ DE QUAL NÚMERO ELE É.
 *
 * "Nenhum funil pode ter mais do que um número. Não pode receber mensagens de WhatsApps
 * diferentes." Com o vínculo nos metadados da conexão, ele ia na direção errada — o número
 * apontava pro funil, e dois números podiam apontar pro mesmo quadro. Agora quem manda é a coluna
 * do funil; o metadado fica como segunda opção, pra não quebrar quem já configurou.
 */
describe("o funil é o dono do número", () => {
  it("a coluna do funil ganha do metadado da conexão", async () => {
    funis = [{ id: "funil-novo", contaCanal: "meta_whatsapp:109876543210" }];
    expect(await destinoDoNumero("w1", "meta_whatsapp:109876543210")).toEqual({
      funilId: "funil-novo",
      responsavel: "Marina",
    });
  });

  it("sem funil com número, vale o metadado de antes", async () => {
    // A conta que já estava configurada continua funcionando enquanto os funis novos não existem.
    expect(await destinoDoNumero("w1", "meta_whatsapp:109876543210")).toEqual({
      funilId: "funil-oficial",
      responsavel: "Marina",
    });
  });

  it("o nome antigo do canal de QR Code acha o funil novo", async () => {
    funis = [{ id: "funil-lucas", contaCanal: "whatsapp_nao_oficial:5511977776666" }];
    expect(await destinoDoNumero("w1", "whatsapp_baileys:5511977776666")).toEqual({
      funilId: "funil-lucas",
      responsavel: "João",
    });
  });

  it("número desconectado ainda cai no funil dele", async () => {
    // O vínculo é configuração, não estado: a conexão caiu, o quadro continua sendo o daquele
    // número, e o lead que chegar por ele vai pra lá.
    conexoes = [];
    funis = [{ id: "funil-lucas", contaCanal: "whatsapp_nao_oficial:5511977776666" }];
    expect(await destinoDoNumero("w1", "whatsapp_nao_oficial:5511977776666")).toEqual({
      funilId: "funil-lucas",
      responsavel: null,
    });
  });
});
