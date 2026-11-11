import { describe, expect, it } from "vitest";

import { identificadoresDoLead } from "@/lib/rastreio/identificadores-do-lead";

const SEM_CONTATO = { email: null, whatsapp: null };

/**
 * Mandar o código do clique no CAMPO ERRADO faz a plataforma aceitar e descartar em silêncio — o
 * pior resultado possível, porque parece que funcionou. `OrigemDoLead` guarda um código e o tipo
 * dele; é esse tipo que decide o campo.
 */
describe("identificadoresDoLead", () => {
  it("gclid vai pro campo do Google", () => {
    const i = identificadoresDoLead({ cliqueId: "abc", tipoDoClique: "gclid" }, SEM_CONTATO);
    expect(i.gclid).toBe("abc");
    expect(i.fbclid).toBeNull();
    expect(i.ctwaClid).toBeNull();
  });

  it("gbraid e wbraid também são do Google", () => {
    expect(identificadoresDoLead({ cliqueId: "g1", tipoDoClique: "gbraid" }, SEM_CONTATO).gclid).toBe("g1");
    expect(identificadoresDoLead({ cliqueId: "w1", tipoDoClique: "wbraid" }, SEM_CONTATO).gclid).toBe("w1");
  });

  it("fbclid é da Meta, e não vaza pro Google", () => {
    const i = identificadoresDoLead({ cliqueId: "fb1", tipoDoClique: "fbclid" }, SEM_CONTATO);
    expect(i.fbclid).toBe("fb1");
    expect(i.gclid).toBeNull();
  });

  it("ctwa_clid é o do Click-to-WhatsApp, num campo só dele", () => {
    const i = identificadoresDoLead({ cliqueId: "ct1", tipoDoClique: "ctwa_clid" }, SEM_CONTATO);
    expect(i.ctwaClid).toBe("ct1");
    expect(i.gclid).toBeNull();
    expect(i.fbclid).toBeNull();
  });

  it("código sem tipo não vai pra campo nenhum", () => {
    // Melhor não mandar do que mandar no campo errado: no campo errado a plataforma aceita e
    // descarta, e fica parecendo que funcionou.
    const i = identificadoresDoLead({ cliqueId: "x", tipoDoClique: null }, SEM_CONTATO);
    expect(i.gclid).toBeNull();
    expect(i.fbclid).toBeNull();
    expect(i.ctwaClid).toBeNull();
  });

  it("os identificadores que têm campo próprio passam direto", () => {
    const i = identificadoresDoLead(
      { ttclid: "tt", igSid: "ig", gclientid: "ga" },
      { email: "a@b.com", whatsapp: "5562999990000" },
    );
    expect(i).toMatchObject({
      ttclid: "tt",
      igSid: "ig",
      gclientid: "ga",
      email: "a@b.com",
      telefone: "5562999990000",
    });
  });

  it("sem origem nenhuma, só e-mail e telefone", () => {
    const i = identificadoresDoLead(null, { email: "a@b.com", whatsapp: null });
    expect(i.email).toBe("a@b.com");
    expect(i.gclid).toBeNull();
    expect(i.ttclid).toBeNull();
  });
});
