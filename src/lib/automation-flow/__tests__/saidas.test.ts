import { describe, expect, it } from "vitest";

import { saidasDoNo } from "../resumo";
import type { AguardarData, FlowNode } from "../types";

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

  it("a pergunta tem uma saída por opção, mais outra resposta e falha", () => {
    const saidas = saidasDoNo(
      no("mensagem_botoes", "mensagem", { opcoes: [{ id: "o1", rotulo: "Sim" }] }),
    );
    expect(saidas.map((s) => s.handleId)).toEqual(["o1", "outra_resposta", "falha"]);
  });

  it("botão de URL não vira saída: quem clica sai e não responde", () => {
    const saidas = saidasDoNo(
      no("mensagem_botoes", "mensagem", {
        opcoes: [
          { id: "o1", rotulo: "Falar com atendente" },
          { id: "o2", rotulo: "Ver o site", url: "https://azuz.com.br" },
        ],
      }),
    );
    expect(saidas.map((s) => s.handleId)).toEqual(["o1", "outra_resposta", "falha"]);
    // A numeração segue a posição real na lista, não a posição depois de tirar os de URL: é o
    // número que o contato vê na mensagem.
    expect(saidas[0].label).toBe("1 · Falar com atendente");
  });

  it("a pergunta só oferece \"sem resposta\" quando tem prazo", () => {
    const semPrazo = saidasDoNo(no("mensagem_botoes", "mensagem", { opcoes: [{ id: "o1", rotulo: "Sim" }] }));
    expect(semPrazo.some((s) => s.handleId === "nao_respondeu")).toBe(false);

    const comPrazo = saidasDoNo(
      no("mensagem_botoes", "mensagem", { opcoes: [{ id: "o1", rotulo: "Sim" }], esperaMinutos: 30 }),
    );
    expect(comPrazo.some((s) => s.handleId === "nao_respondeu")).toBe(true);
  });

  it("a pergunta só oferece \"errou demais\" quando tem limite de tentativas", () => {
    const semLimite = saidasDoNo(no("mensagem_botoes", "mensagem", { opcoes: [{ id: "o1", rotulo: "Sim" }] }));
    expect(semLimite.some((s) => s.handleId === "tentativas_esgotadas")).toBe(false);

    const comLimite = saidasDoNo(
      no("mensagem_botoes", "mensagem", { opcoes: [{ id: "o1", rotulo: "Sim" }], tentativasMaximas: 3 }),
    );
    expect(comLimite.some((s) => s.handleId === "tentativas_esgotadas")).toBe(true);
  });

  it("a pergunta também tem caminho de falha no envio", () => {
    const saidas = saidasDoNo(no("mensagem_botoes", "mensagem", { opcoes: [{ id: "o1", rotulo: "Sim" }] }));
    expect(saidas.some((s) => s.handleId === "falha")).toBe(true);
  });

  it("bloco de fim não tem saída nenhuma", () => {
    expect(saidasDoNo(no("encerrar_fluxo", "fim"))).toEqual([]);
  });
});

describe("espera com cronômetro que a resposta interrompe", () => {
  function espera(data: AguardarData): FlowNode {
    return { id: "e1", type: "aguardar", category: "espera", position: { x: 0, y: 0 }, data };
  }

  it("ganha os dois caminhos, com nome de gente", () => {
    // É o "pausar 24 horas, mas seguir na hora se ele responder": o bloco termina de duas formas,
    // então precisa de duas saídas. "ok"/"timeout" continuam sendo os handles pra não desligar as
    // arestas de fluxos que já existem.
    const saidas = saidasDoNo(espera({ modo: "horas", valor: 24, interromperSeResponder: true }));
    expect(saidas.map((s) => s.handleId)).toEqual(["ok", "timeout"]);
    expect(saidas[0].label).toContain("Respondeu");
    expect(saidas[1].label).toContain("Não respondeu");
  });

  it("sem a marca, a espera tem um caminho só", () => {
    const saidas = saidasDoNo(espera({ modo: "horas", valor: 24 }));
    expect(saidas).toHaveLength(1);
    expect(saidas[0].handleId).toBeUndefined();
  });
});
