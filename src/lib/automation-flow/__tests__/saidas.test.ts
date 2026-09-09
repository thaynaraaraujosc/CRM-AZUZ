import { describe, expect, it } from "vitest";

import { saidasDoNo } from "../resumo";
import type { FlowNode } from "../types";

function no(tipo: string, categoria: string, data: Record<string, unknown> = {}): FlowNode {
  return {
    id: "n1",
    type: tipo as FlowNode["type"],
    category: categoria as FlowNode["category"],
    position: { x: 0, y: 0 },
    data,
  };
}

describe("saídas de um bloco", () => {
  it("mensagem ganha o caminho de falha, e o de sucesso continua sem handle", () => {
    const saidas = saidasDoNo(no("mensagem_texto", "mensagem", { texto: "oi" }));
    expect(saidas).toHaveLength(2);
    // Sem handle no sucesso de propósito: é o que mantém ligada a seta dos fluxos que já existem.
    expect(saidas[0].handleId).toBeUndefined();
    expect(saidas[1].handleId).toBe("falha");
  });

  it("imagem, vídeo, áudio e documento também", () => {
    for (const tipo of ["mensagem_imagem", "mensagem_video", "mensagem_audio", "mensagem_documento"]) {
      expect(saidasDoNo(no(tipo, "mensagem")).some((s) => s.handleId === "falha")).toBe(true);
    }
  });

  it("bloco que não envia nada não ganha caminho de falha", () => {
    expect(saidasDoNo(no("adicionar_etiqueta", "acao")).map((s) => s.handleId)).toEqual([undefined]);
    expect(saidasDoNo(no("executar_robo", "acao")).map((s) => s.handleId)).toEqual([undefined]);
  });

  it("pergunta continua com as saídas dela, sem caminho de falha", () => {
    const saidas = saidasDoNo(
      no("mensagem_botoes", "mensagem", { opcoes: [{ id: "o1", rotulo: "Sim" }] }),
    );
    expect(saidas.map((s) => s.handleId)).toEqual(["o1", "outra_resposta", "nao_respondeu"]);
  });

  it("bloco de fim não tem saída nenhuma", () => {
    expect(saidasDoNo(no("encerrar_fluxo", "fim"))).toEqual([]);
  });
});
