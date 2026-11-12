import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  VALIDADE_DO_CACHE_MS,
  buscarModelos,
  cacheAindaVale,
  limparCacheDeModelos,
  modelosEmCache,
} from "@/lib/conversas/modelos-whatsapp";

/**
 * "Tem alguma forma de já deixar pronto? Na hora que eu clico em escolher o modelo, já aparece."
 *
 * O que estes testes trancam é a parte que pode dar errado em silêncio: o cache servir modelo
 * velho pra sempre, e o aquecimento duplicar a ida à Meta em vez de evitá-la.
 */

const MODELO = {
  id: "1",
  nome: "primeiro_contato",
  idioma: "pt_BR",
  categoria: "MARKETING",
  status: "APPROVED",
  componentes: [],
};

describe("cacheAindaVale", () => {
  it("vale dentro do prazo e deixa de valer depois", () => {
    expect(cacheAindaVale(1000, 1000 + VALIDADE_DO_CACHE_MS - 1)).toBe(true);
    expect(cacheAindaVale(1000, 1000 + VALIDADE_DO_CACHE_MS)).toBe(false);
  });

  it("nunca buscado não vale", () => {
    // Sem isto, `buscadoEm: 0` com um relógio logo após a época passaria por cache quente e a
    // janela abriria vazia afirmando que não há modelo nenhum.
    expect(cacheAindaVale(0, 10)).toBe(false);
  });
});

describe("buscarModelos", () => {
  beforeEach(() => {
    limparCacheDeModelos();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    limparCacheDeModelos();
  });

  it("busca uma vez e serve do cache na segunda", async () => {
    const fetchFalso = vi.fn(async () => ({ ok: true, json: async () => [MODELO] }));
    vi.stubGlobal("fetch", fetchFalso);

    await buscarModelos();
    await buscarModelos();

    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(modelosEmCache()).toEqual([MODELO]);
  });

  it("duas chamadas ao mesmo tempo compartilham a MESMA ida", async () => {
    /*
     * É o caso real: a tela aquece ao abrir a conversa e a pessoa clica logo em seguida. Sem a
     * promessa compartilhada seriam duas idas à Meta pra receber a mesma resposta, e a segunda
     * sobrescreveria a primeira sem mudar nada.
     */
    const fetchFalso = vi.fn(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ ok: true, json: async () => [MODELO] }), 5),
        ),
    );
    vi.stubGlobal("fetch", fetchFalso);

    const [a, b] = await Promise.all([buscarModelos(), buscarModelos()]);

    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(a).toEqual([MODELO]);
    expect(b).toEqual([MODELO]);
  });

  it("depois do prazo, busca de novo — modelo aprovado agora precisa aparecer", async () => {
    const fetchFalso = vi.fn(async () => ({ ok: true, json: async () => [MODELO] }));
    vi.stubGlobal("fetch", fetchFalso);

    await buscarModelos();
    // Um instante além do prazo: é o que impede o cache de esconder um modelo recém-aprovado até
    // alguém recarregar a página.
    await buscarModelos(Date.now() + VALIDADE_DO_CACHE_MS + 1);

    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });

  it("erro não vira cache: a próxima tentativa busca de novo", async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ erro: "Token expirado" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [MODELO] });
    vi.stubGlobal("fetch", fetchFalso);

    await expect(buscarModelos()).rejects.toThrow("Token expirado");
    expect(modelosEmCache()).toBeNull();

    await expect(buscarModelos()).resolves.toEqual([MODELO]);
  });
});
