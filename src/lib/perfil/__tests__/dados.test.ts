import { describe, expect, it } from "vitest";

import {
  formatarTelefoneDoPerfil,
  iniciaisDe,
  lerNomeDoPerfil,
  lerTelefoneDoPerfil,
} from "@/lib/perfil/dados";

describe("lerNomeDoPerfil", () => {
  it("recusa nome em branco", () => {
    expect(lerNomeDoPerfil("   ")).toEqual({ ok: false, erro: "O nome não pode ficar em branco." });
  });

  it("junta espaços repetidos em vez de recusar", () => {
    expect(lerNomeDoPerfil("  Thaynara   Araújo ")).toEqual({ ok: true, valor: "Thaynara Araújo" });
  });

  it("recusa nome longo demais", () => {
    expect(lerNomeDoPerfil("a".repeat(81)).ok).toBe(false);
  });
});

describe("lerTelefoneDoPerfil", () => {
  it("aceita vazio: o telefone é opcional", () => {
    expect(lerTelefoneDoPerfil("")).toEqual({ ok: true, valor: "" });
  });

  it("formata celular de 11 dígitos", () => {
    expect(lerTelefoneDoPerfil("11999887766")).toEqual({ ok: true, valor: "(11) 99988-7766" });
  });

  it("formata fixo de 10 dígitos", () => {
    expect(lerTelefoneDoPerfil("1133224455")).toEqual({ ok: true, valor: "(11) 3322-4455" });
  });

  it("recusa número incompleto", () => {
    expect(lerTelefoneDoPerfil("1199988").ok).toBe(false);
  });

  it("ignora o que não é dígito no que veio digitado", () => {
    expect(lerTelefoneDoPerfil("+55 (11) 99988-7766").ok).toBe(false);
    expect(lerTelefoneDoPerfil("(11) 99988-7766")).toEqual({ ok: true, valor: "(11) 99988-7766" });
  });
});

describe("formatarTelefoneDoPerfil", () => {
  it("vai montando a máscara enquanto se digita", () => {
    expect(formatarTelefoneDoPerfil("1")).toBe("1");
    expect(formatarTelefoneDoPerfil("11")).toBe("11");
    expect(formatarTelefoneDoPerfil("1199")).toBe("(11) 99");
    expect(formatarTelefoneDoPerfil("1199887")).toBe("(11) 9988-7");
    expect(formatarTelefoneDoPerfil("11998877665")).toBe("(11) 99887-7665");
  });

  it("não deixa passar de 11 dígitos", () => {
    expect(formatarTelefoneDoPerfil("119988776655555")).toBe("(11) 99887-7665");
  });
});

describe("iniciaisDe", () => {
  it("usa o primeiro e o último nome", () => {
    expect(iniciaisDe("Thaynara Araújo")).toBe("TA");
    expect(iniciaisDe("Ana Clara de Souza")).toBe("AS");
  });

  it("devolve uma letra só quando há um nome só", () => {
    expect(iniciaisDe("Ana")).toBe("A");
  });

  it("não quebra com nome vazio", () => {
    expect(iniciaisDe("   ")).toBe("?");
  });
});
