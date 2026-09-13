import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * A regressão que estes testes prendem: o CRM inteiro ficou lento.
 *
 * O paywall passou a valer também em `/api`, que era a metade que faltava pra ele existir de
 * verdade. Só que isso trocou "uma consulta por navegação de página" por "uma consulta por
 * requisição", e o CRM faz muitas: cada tela busca vários endereços ao abrir e reconsulta de
 * poucos em poucos segundos.
 *
 * A saída não é abrir mão do bloqueio, é parar de perguntar a mesma coisa dezenas de vezes por
 * minuto.
 */
const findUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { assinatura: { findUnique: (...a: unknown[]) => findUnique(...a) } } }));

const { statusDaAssinatura, esquecerStatus } = await import("../status-cache");

beforeEach(() => {
  findUnique.mockReset();
  findUnique.mockResolvedValue({ status: "ativa" });
  esquecerStatus("empresa-a");
  esquecerStatus("empresa-b");
});

describe("statusDaAssinatura", () => {
  it("consulta o banco na primeira vez", async () => {
    expect(await statusDaAssinatura("empresa-a")).toBe("ativa");
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  // O ponto todo: a segunda, a terceira e a quinquagésima requisição não podem bater no banco.
  it("não consulta de novo dentro da janela", async () => {
    await statusDaAssinatura("empresa-a");
    for (let i = 0; i < 50; i += 1) await statusDaAssinatura("empresa-a");
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it("guarda separado por empresa, sem misturar", async () => {
    findUnique.mockResolvedValueOnce({ status: "ativa" }).mockResolvedValueOnce({ status: "atrasada" });
    expect(await statusDaAssinatura("empresa-a")).toBe("ativa");
    expect(await statusDaAssinatura("empresa-b")).toBe("atrasada");
    expect(await statusDaAssinatura("empresa-a")).toBe("ativa");
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  // Ausência de assinatura é uma resposta válida e precisa ser guardada também, senão toda
  // requisição de quem não pagou volta a bater no banco: justamente o caso que mais se repete.
  it("guarda também a ausência de assinatura", async () => {
    findUnique.mockResolvedValue(null);
    expect(await statusDaAssinatura("empresa-a")).toBeNull();
    expect(await statusDaAssinatura("empresa-a")).toBeNull();
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  // Quem acabou de pagar não pode continuar vendo a tela de cobrança: é a pior hora possível pra
  // o produto parecer quebrado.
  it("esquecer força uma leitura nova na hora", async () => {
    await statusDaAssinatura("empresa-a");
    findUnique.mockResolvedValue({ status: "ativa" });
    esquecerStatus("empresa-a");
    await statusDaAssinatura("empresa-a");
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it("esquecer uma empresa não derruba o cache da outra", async () => {
    await statusDaAssinatura("empresa-a");
    await statusDaAssinatura("empresa-b");
    esquecerStatus("empresa-a");
    await statusDaAssinatura("empresa-b");
    expect(findUnique).toHaveBeenCalledTimes(2);
  });
});
