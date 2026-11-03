import { describe, expect, it } from "vitest";

import {
  ehFormularioDoFlow,
  gatilhoServeAoFormulario,
  idSemPrefixo,
  identificadorDoFormularioDoCrm,
  identificadorDoFormularioDoFlow,
} from "@/lib/automation-flow/formulario-do-gatilho";

describe("identificador do formulário", () => {
  it("marca de qual produto o formulário é", () => {
    expect(identificadorDoFormularioDoFlow("abc")).toBe("flow:abc");
    expect(identificadorDoFormularioDoCrm("abc")).toBe("abc");
  });

  /*
   * O motivo do prefixo: sem ele, um id do Flow igual a um id do CRM faria um robô do CRM
   * responder a um lead do Flow. Remoto, mudo, e impossível de achar depois.
   */
  it("não confunde um id do Flow com o mesmo id no CRM", () => {
    expect(
      gatilhoServeAoFormulario(identificadorDoFormularioDoCrm("abc"), identificadorDoFormularioDoFlow("abc")),
    ).toBe(false);
  });

  it("sabe dizer de onde o formulário é, e devolver o id cru", () => {
    expect(ehFormularioDoFlow("flow:abc")).toBe(true);
    expect(ehFormularioDoFlow("abc")).toBe(false);
    expect(idSemPrefixo("flow:abc")).toBe("abc");
    expect(idSemPrefixo("abc")).toBe("abc");
  });
});

describe("gatilhoServeAoFormulario", () => {
  it("atende só ao formulário escolhido", () => {
    expect(gatilhoServeAoFormulario("flow:a", "flow:a")).toBe(true);
    expect(gatilhoServeAoFormulario("flow:a", "flow:b")).toBe(false);
  });

  /*
   * A COMPATIBILIDADE QUE IMPEDE UM APAGÃO. Nenhum robô já publicado tem formulário escolhido — o
   * campo existia no tipo e nunca foi preenchido por tela nenhuma. Se "sem escolha" passasse a
   * significar "não atende ninguém", a primeira publicação desta regra faria todo robô de
   * formulário parar de disparar, sem erro em lugar nenhum.
   */
  it("atende a todos quando o bloco não escolheu formulário", () => {
    expect(gatilhoServeAoFormulario(undefined, "flow:a")).toBe(true);
    expect(gatilhoServeAoFormulario("", "flow:a")).toBe(true);
    expect(gatilhoServeAoFormulario("   ", null)).toBe(true);
  });

  /*
   * O outro lado: a tela pediu "só o formulário X" e o evento não diz de qual veio. Afirmar que é
   * o X seria repetir o defeito que esta função conserta, agora com a tela prometendo o contrário.
   */
  it("não atende quando o bloco escolheu e o evento não diz de qual formulário veio", () => {
    expect(gatilhoServeAoFormulario("flow:a", undefined)).toBe(false);
    expect(gatilhoServeAoFormulario("flow:a", "")).toBe(false);
  });

  it("ignora espaço em volta dos dois lados", () => {
    expect(gatilhoServeAoFormulario(" flow:a ", "flow:a")).toBe(true);
  });
});
