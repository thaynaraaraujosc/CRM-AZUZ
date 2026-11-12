import { describe, expect, it } from "vitest";

import { somenteCamposDeConversa } from "@/lib/conversas/campos-editaveis";

/**
 * O `PATCH` mandava o corpo inteiro pro Prisma. A tipagem em TypeScript parecia uma lista fechada,
 * mas tipo não existe em tempo de execução — e o que passava era gravado.
 */
describe("somenteCamposDeConversa", () => {
  it("deixa passar o que a tela de fato edita", () => {
    expect(
      somenteCamposDeConversa({ naoLidas: 0, favorita: true, status: "Em conversa" }),
    ).toEqual({ naoLidas: 0, favorita: true, status: "Em conversa" });
  });

  it("NÃO deixa passar workspaceId: era mover a conversa inteira pra outra empresa", () => {
    expect(somenteCamposDeConversa({ workspaceId: "outra-empresa", favorita: true })).toEqual({
      favorita: true,
    });
  });

  it("NÃO deixa passar nome nem contato", () => {
    /*
     * `nome` é a chave com que as mensagens são guardadas: trocá-lo por fora separa a thread das
     * próprias mensagens. `contato` é o telefone de destino: reescrevê-lo manda a próxima
     * mensagem pra outra pessoa.
     */
    expect(somenteCamposDeConversa({ nome: "Outro", contato: "5511999999999" })).toEqual({});
  });

  it("NÃO deixa passar id nem criadoEm", () => {
    expect(somenteCamposDeConversa({ id: "colidir", criadoEm: "2020-01-01" })).toEqual({});
  });

  it("campo ausente continua ausente — `undefined` é 'não mexa nisso'", () => {
    expect(somenteCamposDeConversa({ favorita: undefined, naoLidas: 3 })).toEqual({ naoLidas: 3 });
  });

  it("deixa passar contaCanal, que a rota confere contra as conexões antes de gravar", () => {
    expect(somenteCamposDeConversa({ contaCanal: "meta_whatsapp:1" })).toEqual({
      contaCanal: "meta_whatsapp:1",
    });
  });
});
