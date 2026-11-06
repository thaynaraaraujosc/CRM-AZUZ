import { describe, expect, it } from "vitest";

import { listaDaEvolution } from "@/lib/integracoes/lista-da-evolution";

describe("a lista dentro da resposta da Evolution", () => {
  it("lê o array cru", () => {
    expect(listaDaEvolution([{ a: 1 }])).toEqual([{ a: 1 }]);
  });

  it("lê os embrulhos de um nível", () => {
    expect(listaDaEvolution({ messages: [{ a: 1 }] })).toEqual([{ a: 1 }]);
    expect(listaDaEvolution({ records: [{ a: 1 }] })).toEqual([{ a: 1 }]);
    expect(listaDaEvolution({ chats: [{ a: 1 }] })).toEqual([{ a: 1 }]);
    expect(listaDaEvolution({ data: [{ a: 1 }] })).toEqual([{ a: 1 }]);
  });

  it("lê o PAGINADO da v2, que era o caso que quebrava", () => {
    /*
     * Esta é a resposta de `/chat/findMessages` na v2. O leitor antigo testava
     * `Array.isArray(dados.messages)` — e aqui `messages` é objeto — e `Array.isArray(dados.records)`
     * — e aqui `records` está um nível abaixo. Resultado: lista vazia, zero mensagem importada,
     * nenhum erro em lugar nenhum, e a importação se declarando concluída.
     */
    const resposta = {
      messages: { total: 412, pages: 3, currentPage: 1, records: [{ key: { id: "A" } }, { key: { id: "B" } }] },
    };
    expect(listaDaEvolution(resposta)).toHaveLength(2);
  });

  it("lê o paginado dos chats também", () => {
    expect(listaDaEvolution({ chats: { total: 2, records: [{ id: "x" }] } })).toEqual([{ id: "x" }]);
    expect(listaDaEvolution({ data: { records: [{ id: "y" }] } })).toEqual([{ id: "y" }]);
  });

  it("o que não dá pra interpretar vira lista vazia, e não um palpite", () => {
    expect(listaDaEvolution(null)).toEqual([]);
    expect(listaDaEvolution(undefined)).toEqual([]);
    expect(listaDaEvolution("texto")).toEqual([]);
    expect(listaDaEvolution({ erro: "deu ruim" })).toEqual([]);
    expect(listaDaEvolution({ messages: { total: 0 } })).toEqual([]);
  });
});
