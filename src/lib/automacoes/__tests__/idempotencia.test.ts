import { describe, expect, it } from "vitest";

import { chaveDeEvento } from "../idempotencia";

/**
 * A chave é o que separa "a Meta reenviou o webhook" de "aconteceu duas vezes". Formato estável
 * importa: se ele mudar, todo evento já processado vira "novo" e a pessoa recebe tudo de novo.
 */
describe("chave de evento", () => {
  it("usa sempre origem:id", () => {
    expect(chaveDeEvento("mensagem", "wamid.ABC")).toBe("mensagem:wamid.ABC");
    expect(chaveDeEvento("comentario", "17900")).toBe("comentario:17900");
    expect(chaveDeEvento("etapa", "card-1:etapa-2")).toBe("etapa:card-1:etapa-2");
  });

  it("mantém o formato que o Instagram já gravou, pra não reprocessar o passado", () => {
    // `instagram-comentarios.ts` grava exatamente isto hoje.
    expect(chaveDeEvento("comentario", "abc123")).toBe("comentario:abc123");
  });
});
