import { describe, expect, it } from "vitest";

import { decidirSobreLote } from "../lote-de-mensagens";

/**
 * A REGRESSÃO QUE ESTES TESTES PRENDEM: mensagem de grupo não chegando no CRM, e nada em lugar
 * nenhum dizendo por quê.
 *
 * A rota descartava todo evento com `type` diferente de `"notify"`. No Baileys, `"append"` é como
 * chegam mensagem de grupo e mensagem espelhada de outro aparelho — não é histórico. O CRM
 * respondia `200 OK`, não gravava e não registrava descarte: silêncio completo dos dois lados.
 */
describe("decidirSobreLote", () => {
  it('processa o type "append", que é como chega mensagem de grupo', () => {
    const d = decidirSobreLote({ type: "append", messages: [{ key: { id: "a" } }] });

    expect(d.acao).toBe("processar");
  });

  it('processa o type "notify" (mensagem individual ao vivo)', () => {
    expect(decidirSobreLote({ type: "notify", messages: [{ key: { id: "a" } }] }).acao).toBe("processar");
  });

  it("processa um type desconhecido em vez de engolir a mensagem", () => {
    // Qualquer valor novo que a Evolution invente não pode voltar a sumir mensagem em silêncio.
    expect(decidirSobreLote({ type: "qualquer-coisa-nova", messages: [{ key: { id: "a" } }] }).acao).toBe("processar");
  });

  it("aceita o formato achatado, sem `messages`, que é o normal da Evolution", () => {
    const d = decidirSobreLote({ key: { id: "a" } } as never);

    expect(d.acao).toBe("processar");
    if (d.acao === "processar") expect(d.mensagens).toHaveLength(1);
  });

  // A trava que de fato segura sincronização de histórico, e que continua de pé.
  it("descarta lote grande, que é sincronização de histórico", () => {
    const d = decidirSobreLote({ type: "notify", messages: Array.from({ length: 21 }, (_, i) => ({ i })) });

    expect(d.acao).toBe("descartar");
    if (d.acao === "descartar") expect(d.motivo).toBe("lote grande");
  });

  it("o lote grande leva o type no detalhe, pra investigação não ficar no escuro", () => {
    const d = decidirSobreLote({ type: "append", messages: Array.from({ length: 50 }, (_, i) => ({ i })) });

    if (d.acao === "descartar") expect(d.detalhe).toContain("append");
  });

  it("exatamente 20 ainda passa; é o limite, não o corte", () => {
    expect(decidirSobreLote({ messages: Array.from({ length: 20 }, (_, i) => ({ i })) }).acao).toBe("processar");
  });

  it("devolve o type pra quem chama poder registrá-lo", () => {
    const d = decidirSobreLote({ type: "append", messages: [{}] });

    if (d.acao === "processar") expect(d.tipo).toBe("append");
  });
});
