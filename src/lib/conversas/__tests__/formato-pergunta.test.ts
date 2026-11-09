import { describe, expect, it } from "vitest";

import { formatoDaPergunta, rotuloCurto, textoNumerado } from "../formato-pergunta";

/**
 * O formato é o que a PRÉVIA promete e o que o envio faz. Os dois leem esta função, então é aqui
 * que a promessa fica guardada: um teto trocado sem querer aparece como teste vermelho, e não como
 * um cliente recebendo lista onde a tela mostrava botão.
 */
function opcoes(quantas: number) {
  return Array.from({ length: quantas }, (_, i) => ({ id: String(i), rotulo: `Opção ${i + 1}` }));
}

describe("o formato de uma pergunta com opções", () => {
  it("sem opção nenhuma é texto simples (que o motor manda como numerado, sem números)", () => {
    expect(formatoDaPergunta("instagram", [])).toBe("numerado");
    expect(formatoDaPergunta("whatsapp_oficial", [])).toBe("numerado");
  });

  it("no Direct são respostas rápidas até 13, e menu numerado acima disso", () => {
    expect(formatoDaPergunta("instagram", opcoes(1))).toBe("respostas_rapidas");
    expect(formatoDaPergunta("instagram", opcoes(13))).toBe("respostas_rapidas");
    expect(formatoDaPergunta("instagram", opcoes(14))).toBe("numerado");
  });

  it("no WhatsApp oficial são botões até 3, lista até 10 e numerado acima disso", () => {
    expect(formatoDaPergunta("whatsapp_oficial", opcoes(3))).toBe("botoes");
    expect(formatoDaPergunta("whatsapp_oficial", opcoes(4))).toBe("lista");
    expect(formatoDaPergunta("whatsapp_oficial", opcoes(10))).toBe("lista");
    expect(formatoDaPergunta("whatsapp_oficial", opcoes(11))).toBe("numerado");
  });

  it("no QR Code nunca é botão: aquela conexão não entrega botão confiável", () => {
    expect(formatoDaPergunta("whatsapp_qrcode", opcoes(2))).toBe("numerado");
  });

  it("opção com endereço derruba o formato interativo inteiro", () => {
    expect(
      formatoDaPergunta("instagram", [{ id: "1", rotulo: "Ver site", url: "https://exemplo.com" }]),
    ).toBe("numerado");
  });

  it("o rótulo é cortado em 20 caracteres, que é o teto da Meta", () => {
    expect(rotuloCurto("Quero falar com um atendente agora")).toHaveLength(20);
    expect(rotuloCurto("Quero agendar")).toBe("Quero agendar");
  });

  it("o menu numerado escreve as opções dentro do texto", () => {
    expect(textoNumerado("Como posso ajudar?", opcoes(2))).toBe(
      "Como posso ajudar?\n\n1 - Opção 1\n2 - Opção 2",
    );
    expect(textoNumerado("Oi", [])).toBe("Oi");
  });
});
