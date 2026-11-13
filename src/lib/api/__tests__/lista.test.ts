import { afterEach, describe, expect, it, vi } from "vitest";

import { listaDaApi } from "@/lib/api/lista";

/**
 * A GUARDA QUE FALTAVA EM QUINZE CONTEXTOS.
 *
 * O defeito que ela corrige já derrubou a caixa de entrada inteira em produção: sessão expirada
 * numa aba aberta a noite toda, `/api/funis` respondendo `{ erro: "Não autenticado" }`, o objeto
 * gravado onde devia haver array, e `funis.find(...)` matando a tela com "find is not a function".
 */

afterEach(() => vi.restoreAllMocks());

describe("listaDaApi", () => {
  it("lista passa intacta — é o caso de todo dia", () => {
    const dados = [{ id: "a" }, { id: "b" }];
    expect(listaDaApi(dados, "/api/funis")).toBe(dados);
  });

  it("lista vazia é uma lista, não um problema", () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(listaDaApi([], "/api/funis")).toEqual([]);
    expect(erro).not.toHaveBeenCalled();
  });

  it("`{ erro }` vira lista vazia, e o console diz o motivo que a rota deu", () => {
    /*
     * O caso de verdade. A rota está CERTA em responder assim; o defeito era o contexto confiar na
     * forma. E o motivo vai pro console: a tela segue de pé, mas o sumiço não é silencioso pra
     * quem investiga.
     */
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(listaDaApi({ erro: "Não autenticado" }, "/api/funis")).toEqual([]);
    expect(erro).toHaveBeenCalledWith("[api] /api/funis não devolveu uma lista: Não autenticado");
  });

  it("qualquer outra forma também vira lista vazia", () => {
    // `.json()` de uma página de erro, um 500 sem corpo, um `null` de rede cortada.
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(listaDaApi(null, "/api/conversas")).toEqual([]);
    expect(listaDaApi("texto", "/api/conversas")).toEqual([]);
    expect(listaDaApi(undefined, "/api/conversas")).toEqual([]);
    expect(listaDaApi({ total: 3 }, "/api/conversas")).toEqual([]);
    expect(erro).toHaveBeenCalledTimes(4);
  });

  it("diz QUEM pediu, porque quinze contextos usam a mesma guarda", () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    listaDaApi({ erro: "x" }, "/api/contatos");
    expect(erro.mock.calls[0][0]).toContain("/api/contatos");
  });
});

describe("os contextos que carregam lista usam a guarda", () => {
  /*
   * FIO DE SEGURANÇA, não análise.
   *
   * O defeito não foi de lógica: foi de CONFIANÇA — quinze contextos assumindo que `.json()`
   * devolve o que a rota promete no caminho feliz. Um contexto novo escrito amanhã, copiando o
   * formato de um antigo, reintroduz o mesmo buraco sem quebrar teste nenhum.
   *
   * Este teste só confere que os que carregam lista importam a guarda. Não prova que eles a usam
   * em TODOS os pontos — isso é leitura de código. Prova que ninguém a removeu inteira.
   */
  it("importam `listaDaApi`", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const deLista = [
      "funis-context.tsx",
      "conversas-context.tsx",
      "contatos-context.tsx",
      "equipe-context.tsx",
      "automation-flow-context.tsx",
      "documentos-context.tsx",
      "biblioteca-documentos-context.tsx",
    ];
    for (const arquivo of deLista) {
      const fonte = readFileSync(join(process.cwd(), "src/lib", arquivo), "utf-8");
      expect(fonte, arquivo).toContain("listaDaApi");
    }
  });
});
