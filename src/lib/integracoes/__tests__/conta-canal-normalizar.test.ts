import { describe, expect, it } from "vitest";

import { grafiasDoContaCanal, normalizarContaCanal } from "@/lib/integracoes/conta-canal-normalizar";

describe("normalizarContaCanal", () => {
  it("troca o nome antigo do canal de QR Code pelo novo", () => {
    expect(normalizarContaCanal("whatsapp_baileys:5562963404")).toBe("whatsapp_nao_oficial:5562963404");
  });

  it("deixa o nome novo como está", () => {
    expect(normalizarContaCanal("whatsapp_nao_oficial:5562963404")).toBe("whatsapp_nao_oficial:5562963404");
  });

  it("não mexe no canal oficial", () => {
    expect(normalizarContaCanal("meta_whatsapp:1435889")).toBe("meta_whatsapp:1435889");
  });

  it("mantém nulo e vazio", () => {
    expect(normalizarContaCanal(null)).toBeNull();
    expect(normalizarContaCanal(undefined)).toBeUndefined();
    expect(normalizarContaCanal("")).toBe("");
  });
});

describe("grafiasDoContaCanal", () => {
  it("devolve as duas grafias do QR Code, qualquer que seja a de entrada", () => {
    const esperado = ["whatsapp_nao_oficial:556296340438", "whatsapp_baileys:556296340438"];
    expect(grafiasDoContaCanal("whatsapp_nao_oficial:556296340438")).toEqual(esperado);
    expect(grafiasDoContaCanal("whatsapp_baileys:556296340438")).toEqual(esperado);
  });

  it("canal oficial tem uma grafia só", () => {
    expect(grafiasDoContaCanal("meta_whatsapp:1435889")).toEqual(["meta_whatsapp:1435889"]);
  });
});
