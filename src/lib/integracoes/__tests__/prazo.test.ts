import { describe, expect, it } from "vitest";

import { ehEstouroDePrazo, motivoDaFalha, prazoDe } from "@/lib/integracoes/prazo";

describe("prazoDe", () => {
  it("devolve um sinal novo a cada chamada", () => {
    // Importa: um `AbortSignal.timeout` guardado e reutilizado abortaria TODAS as chamadas que o
    // usassem no momento em que o primeiro prazo estourasse.
    expect(prazoDe(1000)).not.toBe(prazoDe(1000));
  });

  it("começa sem estar abortado", () => {
    expect(prazoDe(1000).aborted).toBe(false);
  });
});

describe("ehEstouroDePrazo", () => {
  it("reconhece o erro que o prazo do fetch levanta", () => {
    expect(ehEstouroDePrazo(new DOMException("tempo", "TimeoutError"))).toBe(true);
    expect(ehEstouroDePrazo(new DOMException("cancelado", "AbortError"))).toBe(true);
  });

  it("não confunde com outra falha de rede", () => {
    expect(ehEstouroDePrazo(new TypeError("fetch failed"))).toBe(false);
    expect(ehEstouroDePrazo(null)).toBe(false);
    expect(ehEstouroDePrazo("erro")).toBe(false);
  });
});

describe("motivoDaFalha", () => {
  it("diz o prazo quando foi prazo", () => {
    expect(motivoDaFalha(new DOMException("tempo", "TimeoutError"), 15_000)).toBe("não respondeu em 15s");
  });

  it("repassa a mensagem quando foi outra coisa", () => {
    expect(motivoDaFalha(new Error("403 Forbidden"), 15_000)).toBe("403 Forbidden");
  });
});
