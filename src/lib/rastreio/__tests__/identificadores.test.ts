import { describe, expect, it } from "vitest";

import { emailParaEnvio, identificadoresDoContato, telefoneParaEnvio } from "../identificadores";

/**
 * A falha que estes testes existem pra prender é SILENCIOSA.
 *
 * Se a normalização estiver errada, o Google aceita a conversão, não casa com ninguém, e não
 * reclama. Ninguém descobre: a campanha simplesmente "não converte". Por isso cada regra tem
 * teste, mesmo as que parecem óbvias.
 */

describe("emailParaEnvio", () => {
  it("normaliza maiuscula e espaco antes de embaralhar", () => {
    expect(emailParaEnvio("  Ana@Gmail.COM ")).toBe(emailParaEnvio("ana@gmail.com"));
  });

  it("produz sempre o mesmo resumo pro mesmo endereco", () => {
    expect(emailParaEnvio("ana@gmail.com")).toBe(emailParaEnvio("ana@gmail.com"));
  });

  it("devolve hexadecimal de 64 caracteres, que e o formato exigido", () => {
    expect(emailParaEnvio("ana@gmail.com")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("nao mantem o endereco original em lugar nenhum do resultado", () => {
    expect(emailParaEnvio("ana@gmail.com")).not.toContain("ana");
  });

  it("recusa o que nao e e-mail", () => {
    expect(emailParaEnvio("ana")).toBeNull();
    expect(emailParaEnvio("")).toBeNull();
    expect(emailParaEnvio(null)).toBeNull();
    expect(emailParaEnvio("   ")).toBeNull();
  });

  it("NAO tira o ponto do nome, porque o Google guarda o endereco como foi digitado", () => {
    expect(emailParaEnvio("a.na@gmail.com")).not.toBe(emailParaEnvio("ana@gmail.com"));
  });
});

describe("telefoneParaEnvio", () => {
  it("poe o codigo do Brasil no celular com DDD", () => {
    // 11 digitos (DDD + 9 + numero) e o mesmo numero ja com o 55 precisam casar.
    expect(telefoneParaEnvio("11993154058")).toBe(telefoneParaEnvio("5511993154058"));
  });

  it("poe o codigo do Brasil no fixo com DDD", () => {
    expect(telefoneParaEnvio("1133334444")).toBe(telefoneParaEnvio("551133334444"));
  });

  it("ignora mascara: o mesmo numero escrito de tres jeitos vira um resumo so", () => {
    const a = telefoneParaEnvio("(11) 99315-4058");
    expect(telefoneParaEnvio("11 99315 4058")).toBe(a);
    expect(telefoneParaEnvio("+55 11 99315-4058")).toBe(a);
  });

  it("recusa numero curto demais pra ser real", () => {
    expect(telefoneParaEnvio("99315")).toBeNull();
    expect(telefoneParaEnvio("")).toBeNull();
    expect(telefoneParaEnvio(null)).toBeNull();
  });

  it("recusa numero longo demais pro padrao internacional", () => {
    expect(telefoneParaEnvio("1234567890123456")).toBeNull();
  });
});

describe("identificadoresDoContato", () => {
  it("manda os dois quando existem, porque mais identificador casa mais", () => {
    const ids = identificadoresDoContato({ email: "ana@gmail.com", whatsapp: "11993154058" });
    expect(ids).toHaveLength(2);
    expect(ids.some((i) => "hashedEmail" in i)).toBe(true);
    expect(ids.some((i) => "hashedPhoneNumber" in i)).toBe(true);
  });

  it("manda so o que existe", () => {
    expect(identificadoresDoContato({ email: null, whatsapp: "11993154058" })).toHaveLength(1);
    expect(identificadoresDoContato({ email: "ana@gmail.com", whatsapp: null })).toHaveLength(1);
  });

  it("devolve lista vazia quando o contato nao tem nenhum dos dois", () => {
    expect(identificadoresDoContato({ email: null, whatsapp: null })).toEqual([]);
  });
});
