import { describe, expect, it } from "vitest";

import { bloqueadoPorFaltaDeConsentimento } from "../consentimento-whatsapp";

describe("bloqueadoPorFaltaDeConsentimento", () => {
  it("bloqueia só quem recusou de verdade", () => {
    expect(bloqueadoPorFaltaDeConsentimento(false)).toBe(true);
  });

  it("deixa passar quem consentiu", () => {
    expect(bloqueadoPorFaltaDeConsentimento(true)).toBe(false);
  });

  it("deixa passar quem não tem registro: é a maioria do banco e quem escreveu primeiro", () => {
    // Todo contato criado antes desta coluna existir cai aqui. Tratar ausência como recusa calaria
    // o CRM de clientes que vêm conversando há meses.
    expect(bloqueadoPorFaltaDeConsentimento(null)).toBe(false);
    expect(bloqueadoPorFaltaDeConsentimento(undefined)).toBe(false);
  });
});
