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

  /*
   * NO DIRECT, OPÇÃO COM LINK VIRA BOTÃO DE VERDADE — o template de botão do Instagram.
   *
   * É a mensagem que todo mundo já recebeu: um texto e, embaixo, um botão largo que leva pro site.
   * Antes disto, uma opção com endereço caía no menu numerado e o link ia como texto no meio da
   * frase: a pessoa desenhava um botão e o cliente recebia uma URL solta.
   */
  const link = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: String(i), rotulo: `Link ${i + 1}`, url: "https://exemplo.com" }));

  it("no Direct, até três opções TODAS com link viram botão na mensagem", () => {
    expect(formatoDaPergunta("instagram", link(1))).toBe("botao_link_ig");
    expect(formatoDaPergunta("instagram", link(3))).toBe("botao_link_ig");
  });

  it("acima de três não cabe no template: volta pro menu numerado", () => {
    expect(formatoDaPergunta("instagram", link(4))).toBe("numerado");
  });

  /*
   * MISTURAR LINK COM AÇÃO VOLTA PRO NUMERADO, e isso é proposital.
   *
   * O template aceita botão de ação (`postback`), mas ele volta pelo webhook por um caminho que o
   * CRM não lê — seria um botão que, tocado, não continua o fluxo. Metade das opções ficaria sem
   * resposta, que é pior do que todas em texto.
   */
  it("misturar link e ação volta pro menu numerado", () => {
    expect(
      formatoDaPergunta("instagram", [
        { id: "1", rotulo: "Ver site", url: "https://exemplo.com" },
        { id: "2", rotulo: "Falar com alguém" },
      ]),
    ).toBe("numerado");
  });

  it("no WhatsApp, opção com endereço continua derrubando o formato interativo", () => {
    expect(
      formatoDaPergunta("whatsapp_oficial", [{ id: "1", rotulo: "Ver site", url: "https://exemplo.com" }]),
    ).toBe("numerado");
    expect(formatoDaPergunta("whatsapp_qrcode", link(1))).toBe("numerado");
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
