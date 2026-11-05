import { describe, expect, it } from "vitest";

import { ROTA_INICIAL, ROTAS_RESTRITAS, primeiraRotaPermitida } from "../rota-inicial";

describe("pra onde vai quem é barrado por permissão", () => {
  it("NUNCA manda pra uma rota que a pessoa também não pode ver", () => {
    /*
     * ERA ESTE O LAÇO. O destino era sempre `/conversas`, que é uma das rotas restringíveis: quem
     * não tinha permissão de Conversas era mandado pra Conversas, de novo e de novo, até o
     * navegador desistir com "redireções em excesso". A conta ficava inutilizável e a tela não
     * dizia nada.
     */
    const destino = primeiraRotaPermitida({ papelTipo: "padrao", permissoes: ["funil_visualizar"] });
    expect(destino).toBe("/funil");
    expect(destino).not.toBe(ROTA_INICIAL);
  });

  it("sem permissão nenhuma, não existe destino", () => {
    // `null` é a resposta certa: qualquer rota que o proxy escolhesse aqui recomeçaria o laço.
    expect(primeiraRotaPermitida({ papelTipo: "padrao", permissoes: [] })).toBeNull();
  });

  it("admin da conta e super-admin veem tudo", () => {
    expect(primeiraRotaPermitida({ papelTipo: "admin", permissoes: [] })).toBe(ROTA_INICIAL);
    expect(primeiraRotaPermitida({ superAdmin: true, papelTipo: "padrao", permissoes: [] })).toBe(ROTA_INICIAL);
  });

  it("quem tem Conversas vai pra Conversas", () => {
    expect(primeiraRotaPermitida({ papelTipo: "padrao", permissoes: ["wa_visualizar"] })).toBe(ROTA_INICIAL);
  });

  it("a rota inicial está na lista das restringíveis — é daí que o laço nascia", () => {
    expect(ROTAS_RESTRITAS.some((r) => r.rota === ROTA_INICIAL)).toBe(true);
  });
});
