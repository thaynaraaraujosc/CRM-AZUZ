import { describe, expect, it } from "vitest";

import { explicarErroDoInstagram } from "../erro-instagram";

/**
 * O atendimento que estes testes evitam: horas atrás de um problema de sessão que não existe.
 *
 * A Meta devolve "You cannot access the app till you log in to www.instagram.com and follow the
 * instructions given". Lida ao pé da letra, a frase manda entrar no Instagram, que é exatamente o
 * que a pessoa acabou de fazer, e sugere que o problema é a sessão dela. Não é: o app está em modo
 * de desenvolvimento e a conta não aceitou o convite de testadora, que fica em outro lugar.
 */
describe("explicarErroDoInstagram", () => {
  it("explica o convite de testadora, que é o caso real", () => {
    const bruto =
      "400 Session Invalid. Error validating access token: You cannot access the app till you log in to www.instagram.com and follow the instructions given.";
    const traduzido = explicarErroDoInstagram(bruto);
    expect(traduzido).toContain("testadora");
    expect(traduzido).toContain("Convites de testador");
    // Não pode repetir a frase que confunde.
    expect(traduzido).not.toContain("follow the instructions");
  });

  it("reconhece a mesma causa quando a Meta muda a forma da frase", () => {
    expect(explicarErroDoInstagram("Session Invalid")).toContain("testadora");
    expect(explicarErroDoInstagram("You cannot access the app till you log in")).toContain("testadora");
  });

  it("explica conta pessoal em vez de profissional", () => {
    expect(explicarErroDoInstagram("The account must be a professional account")).toContain("Profissional");
  });

  it("explica permissão de mensagens faltando", () => {
    const t = explicarErroDoInstagram("Missing permission for messaging");
    expect(t).toContain("mensagens");
  });

  // Erro que não conhecemos passa inteiro: inventar explicação pra causa desconhecida manda a
  // pessoa pro lugar errado, que é pior do que mostrar o texto cru.
  it("deixa passar o que não sabe explicar", () => {
    const desconhecido = "Some brand new Meta error nobody has seen";
    expect(explicarErroDoInstagram(desconhecido)).toBe(desconhecido);
  });
});
