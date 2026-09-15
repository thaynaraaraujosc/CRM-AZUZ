import { describe, expect, it } from "vitest";

import { gerarCodigo, lerCodigoDaMensagem, limparMarca, marcarMensagem } from "../codigo";

/**
 * O código é o único fio que liga o clique no anúncio à conversa no WhatsApp.
 *
 * Entre os dois a pessoa troca de aplicativo, e nada do navegador sobrevive: nem cookie, nem
 * endereço, nem sessão. Se o código não atravessar, o lead chega sem origem, e a venda dele nunca
 * volta pro Google. O erro é invisível: a conversa acontece normalmente, o atendimento funciona,
 * e só meses depois alguém percebe que a tela de Tráfego não explica de onde vieram os clientes.
 */
describe("gerarCodigo", () => {
  it("tem seis caracteres", () => {
    expect(gerarCodigo()).toHaveLength(6);
  });

  /**
   * O código aparece pra quem vai mandar a mensagem, e pode ser lido em voz alta, digitado à mão
   * ou transcrito de um print no suporte. `O` e `0` juntos viram lead sem origem.
   */
  it("não usa letra que se confunde com número", () => {
    for (let i = 0; i < 300; i += 1) {
      expect(gerarCodigo()).not.toMatch(/[O0I1]/);
    }
  });

  it("não repete", () => {
    const vistos = new Set(Array.from({ length: 500 }, () => gerarCodigo()));
    expect(vistos.size).toBeGreaterThan(495);
  });
});

describe("marcarMensagem", () => {
  it("põe a marca no fim, onde ela não assusta quem vai enviar", () => {
    expect(marcarMensagem("Olá! Quero saber mais sobre implantes.", "A7K2M9")).toBe(
      "Olá! Quero saber mais sobre implantes. [AZ-A7K2M9]",
    );
  });

  it("funciona sem mensagem nenhuma", () => {
    expect(marcarMensagem("", "A7K2M9")).toBe("[AZ-A7K2M9]");
  });
});

describe("lerCodigoDaMensagem", () => {
  it("acha o código da mensagem que chegou", () => {
    expect(lerCodigoDaMensagem("Olá! Quero saber mais. [AZ-A7K2M9]")).toBe("A7K2M9");
  });

  /**
   * A mensagem passa por teclado de celular, corretor automático e às vezes pelo dedo de quem
   * resolveu editar antes de enviar. Ser rígido aqui joga fora atribuição que estava lá.
   */
  it("aguenta minúscula e espaço sobrando", () => {
    expect(lerCodigoDaMensagem("oi [az- a7k2m9 ]")).toBe("A7K2M9");
    expect(lerCodigoDaMensagem("oi [AZ-a7k2m9]")).toBe("A7K2M9");
  });

  // A esmagadora maioria das mensagens não tem código, e isso não é erro nenhum.
  it("devolve nada quando não há código", () => {
    expect(lerCodigoDaMensagem("Bom dia, tudo bem?")).toBeNull();
    expect(lerCodigoDaMensagem("")).toBeNull();
    expect(lerCodigoDaMensagem(null)).toBeNull();
  });

  /**
   * Texto que PARECE código mas não é. Aceitar geraria busca por algo que nunca existiu e, no pior
   * caso, atribuiria a origem de outra pessoa a este lead.
   */
  it("recusa o que tem a cara certa mas não é do nosso alfabeto", () => {
    expect(lerCodigoDaMensagem("[AZ-ABC01I]")).toBeNull();
  });

  it("recusa tamanho errado", () => {
    expect(lerCodigoDaMensagem("[AZ-ABC]")).toBeNull();
    expect(lerCodigoDaMensagem("[AZ-ABCDEFGH]")).toBeNull();
  });

  it("lê de volta o que acabou de marcar", () => {
    for (let i = 0; i < 200; i += 1) {
      const codigo = gerarCodigo();
      expect(lerCodigoDaMensagem(marcarMensagem("Olá!", codigo))).toBe(codigo);
    }
  });
});

describe("limparMarca", () => {
  // Quem atende não precisa ver o código, e cliente nenhum deveria ver marca de sistema na tela.
  it("tira a marca antes de a mensagem ser mostrada", () => {
    expect(limparMarca("Olá! Quero saber mais. [AZ-A7K2M9]")).toBe("Olá! Quero saber mais.");
  });

  it("não estraga mensagem sem marca", () => {
    expect(limparMarca("Bom dia, tudo bem?")).toBe("Bom dia, tudo bem?");
  });

  it("não deixa espaço duplo onde a marca estava no meio", () => {
    expect(limparMarca("Olá [AZ-A7K2M9] tudo bem?")).toBe("Olá tudo bem?");
  });
});
