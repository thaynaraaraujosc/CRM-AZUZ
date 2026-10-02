import { describe, expect, it } from "vitest";

import { aplicarMencoes } from "../mencoes";

/**
 * A REGRESSÃO QUE ESTES TESTES PRENDEM: menção a uma pessoa do grupo aparecendo como número cru,
 * com os atalhos "WhatsApp" e "Ligar" pendurados — um convite a ligar pra quem só foi citado.
 */
const participantes = [
  { nome: "Raquel Fernandes Brito", telefone: "5587600555651" },
  { nome: "Ariane Aires de Brito", telefone: "(62) 99999-0001" },
  { nome: "556299990002", telefone: "556299990002" },
];

describe("aplicarMencoes", () => {
  it("troca a menção pelo nome de quem foi mencionado", () => {
    expect(aplicarMencoes("@5587600555651 disponibilizei as cenas", participantes)).toBe(
      "@Raquel Fernandes Brito disponibilizei as cenas",
    );
  });

  it("casa mesmo com a lista do grupo em outro formato de número", () => {
    // A menção vem com DDI e sem máscara; a lista pode ter vindo como "(62) 99999-0001".
    expect(aplicarMencoes("bom dia @5562999990001", participantes)).toBe("bom dia @Ariane Aires de Brito");
  });

  it("troca várias menções na mesma mensagem", () => {
    const r = aplicarMencoes("@5587600555651 e @5562999990001, podem ver?", participantes);

    expect(r).toBe("@Raquel Fernandes Brito e @Ariane Aires de Brito, podem ver?");
  });

  it("quem não está na lista continua como veio", () => {
    // Melhor um número honesto do que um nome inventado.
    expect(aplicarMencoes("@5511888887777 vc viu?", participantes)).toBe("@5511888887777 vc viu?");
  });

  it("participante sem nome real não vira troca de número por número", () => {
    expect(aplicarMencoes("@556299990002 oi", participantes)).toBe("@556299990002 oi");
  });

  it("não mexe em texto sem menção", () => {
    expect(aplicarMencoes("o meu está indo rs", participantes)).toBe("o meu está indo rs");
  });

  it("não mexe em e-mail nem em @ de usuário", () => {
    expect(aplicarMencoes("manda pra contato@azuz.com e chama o @joao", participantes)).toBe(
      "manda pra contato@azuz.com e chama o @joao",
    );
  });

  it("sem lista de participantes, devolve o texto intacto", () => {
    expect(aplicarMencoes("@5587600555651 oi", null)).toBe("@5587600555651 oi");
    expect(aplicarMencoes("@5587600555651 oi", [])).toBe("@5587600555651 oi");
  });
});
