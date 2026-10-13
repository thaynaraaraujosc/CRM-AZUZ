import { describe, expect, it } from "vitest";

import { JANELA_DO_ECO_MS, criteriosDeEcoDoCrm } from "../eco-do-direct";

const base = { workspaceId: "w1", contato: "@fulano", agora: new Date("2026-10-13T12:00:00Z") };

describe("criteriosDeEcoDoCrm", () => {
  it("não casa mensagem RECEBIDA: ela nunca é nossa", () => {
    expect(criteriosDeEcoDoCrm({ ...base, ehEco: false, texto: "ola" })).toBeNull();
  });

  it("não casa eco sem texto: anexo não dá pra comparar com segurança", () => {
    expect(criteriosDeEcoDoCrm({ ...base, ehEco: true, texto: undefined })).toBeNull();
    expect(criteriosDeEcoDoCrm({ ...base, ehEco: true, texto: "" })).toBeNull();
  });

  it("procura só saída da MESMA conversa com o MESMO texto", () => {
    const c = criteriosDeEcoDoCrm({ ...base, ehEco: true, texto: "ola" })!;
    expect(c.workspaceId).toBe("w1");
    expect(c.contato).toBe("@fulano");
    expect(c.tipo).toBe("out");
    expect(c.texto).toBe("ola");
  });

  it("exige `wamid` vazio — é o que faz dois envios iguais consumirem um eco cada", () => {
    const c = criteriosDeEcoDoCrm({ ...base, ehEco: true, texto: "ola" })!;
    expect(c.wamid).toBeNull();
  });

  it("limita a janela, pra não alcançar um 'ok' de semanas atrás", () => {
    const c = criteriosDeEcoDoCrm({ ...base, ehEco: true, texto: "ok" })!;
    expect(c.criadoEm.gte.getTime()).toBe(base.agora.getTime() - JANELA_DO_ECO_MS);
    expect(JANELA_DO_ECO_MS).toBeLessThanOrEqual(10 * 60_000);
  });
});
