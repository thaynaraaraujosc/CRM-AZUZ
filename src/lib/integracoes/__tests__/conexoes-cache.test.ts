import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O cache existe por causa de CONTA DE CONSULTA, então é a conta que o teste mede: quantas vezes
 * o banco é perguntado. Uma regra que "funciona" mas consulta igual não resolve nada.
 */
let chamadas = 0;
let linhas: { provedor: string; metadados: unknown }[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    integracao: {
      findMany: async () => {
        chamadas += 1;
        return linhas;
      },
    },
  },
}));

const { conexoesDeConversa, esquecerConexoes, esquecerTodasAsConexoes } = await import(
  "@/lib/integracoes/conexoes-cache"
);

beforeEach(() => {
  chamadas = 0;
  linhas = [{ provedor: "meta_whatsapp", metadados: { phoneNumberId: "123" } }];
  esquecerTodasAsConexoes();
});

describe("as conexões de conversa, com memória curta", () => {
  it("pergunta ao banco uma vez e serve as seguintes de memória", async () => {
    // É o caso real: as Conversas batem a cada 5 segundos, e duas funções diferentes precisavam
    // da mesma resposta na mesma requisição. Eram duas consultas idênticas por batida.
    await conexoesDeConversa("w1");
    await conexoesDeConversa("w1");
    await conexoesDeConversa("w1");
    expect(chamadas).toBe(1);
  });

  it("cada workspace tem a sua memória", async () => {
    // A chave é o workspace, e isso não é detalhe: servir a conexão de um pro outro mostraria a
    // caixa de entrada de uma empresa dentro de outra.
    await conexoesDeConversa("w1");
    await conexoesDeConversa("w2");
    expect(chamadas).toBe(2);
  });

  it("conectar ou desconectar derruba a memória daquele workspace, e só dele", async () => {
    await conexoesDeConversa("w1");
    await conexoesDeConversa("w2");
    esquecerConexoes("w1");
    await conexoesDeConversa("w1");
    await conexoesDeConversa("w2");
    expect(chamadas).toBe(3);
  });

  it("devolve o que o banco devolveu, sem inventar nem esconder", async () => {
    linhas = [
      { provedor: "meta_instagram", metadados: { instagramContaId: "ig" } },
      { provedor: "whatsapp_nao_oficial", metadados: { numero: "556299" } },
    ];
    expect(await conexoesDeConversa("w1")).toEqual(linhas);
  });
});
