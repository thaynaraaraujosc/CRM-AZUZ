import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { enviarConversoesMeta } from "../meta-conversoes";

/**
 * O que estes testes prendem são as duas armadilhas que a Meta NÃO reclama.
 *
 * O carimbo de tempo em milissegundos: ela aceita e joga o evento a cinquenta mil anos no futuro,
 * onde ele nunca casa com o clique. E a origem marcada como site em vez de conversa: ela aceita e
 * não liga o evento a anúncio nenhum. Os dois respondem "sucesso".
 */
describe("enviarConversoesMeta", () => {
  const original = globalThis.fetch;
  let enviado: { data: Record<string, unknown>[]; access_token?: string } | null = null;

  beforeEach(() => {
    enviado = null;
    globalThis.fetch = (async (_url: string, init?: { body?: string }) => {
      enviado = JSON.parse(init?.body ?? "{}");
      return { ok: true, status: 200, json: async () => ({ events_received: 1 }) };
    }) as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = original;
  });

  async function mandarUm(extra: Partial<Parameters<typeof enviarConversoesMeta>[0]["conversoes"][number]> = {}) {
    await enviarConversoesMeta({
      accessToken: "t",
      datasetId: "999",
      conversoes: [
        {
          ctwaClid: "CLID",
          quando: new Date("2026-09-20T15:30:00Z"),
          valor: 3200,
          idDoNegocio: "card-1",
          ...extra,
        },
      ],
    });
    return enviado!.data[0] as Record<string, unknown>;
  }

  it("marca a origem como conversa, nao como site", async () => {
    const e = await mandarUm();
    expect(e.action_source).toBe("business_messaging");
    expect(e.messaging_channel).toBe("whatsapp");
  });

  it("manda o carimbo em SEGUNDOS", async () => {
    const e = await mandarUm();
    expect(e.event_time).toBe(Math.floor(new Date("2026-09-20T15:30:00Z").getTime() / 1000));
    // Se fosse em milissegundos passaria de 10 dígitos e a Meta jogaria o evento pro futuro.
    expect(String(e.event_time)).toHaveLength(10);
  });

  it("leva o codigo do clique que liga o evento ao anuncio", async () => {
    const e = await mandarUm();
    expect((e.user_data as Record<string, unknown>).ctwa_clid).toBe("CLID");
  });

  it("usa o negocio como event_id, que e o que deduplica contra o pixel do site", async () => {
    const e = await mandarUm();
    expect(e.event_id).toBe("card-1");
  });

  it("embaralha telefone e e-mail, e nunca manda em texto puro", async () => {
    const e = await mandarUm({ email: "Ana@Gmail.com", telefone: "(11) 99315-4058" });
    const dados = e.user_data as Record<string, string[]>;
    expect(dados.em[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(dados.ph[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(e)).not.toContain("Ana@Gmail.com");
    expect(JSON.stringify(e)).not.toContain("99315");
  });

  it("poe o codigo do Brasil no telefone antes de embaralhar", async () => {
    const semDdi = await mandarUm({ telefone: "11993154058" });
    const comDdi = await mandarUm({ telefone: "5511993154058" });
    expect((semDdi.user_data as Record<string, string[]>).ph[0]).toBe(
      (comDdi.user_data as Record<string, string[]>).ph[0],
    );
  });

  it("manda valor e moeda", async () => {
    const e = await mandarUm();
    expect(e.custom_data).toEqual({ value: 3200, currency: "BRL" });
  });

  it("lote vazio nao chama a rede", async () => {
    const r = await enviarConversoesMeta({ accessToken: "t", datasetId: "1", conversoes: [] });
    expect(r).toEqual({ ok: true, recebidos: 0 });
    expect(enviado).toBeNull();
  });
});
