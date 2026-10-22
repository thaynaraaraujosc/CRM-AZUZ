import { describe, expect, it } from "vitest";

import { statusDoBaileys } from "@/app/api/webhooks/evolution/route";

/**
 * OS TIQUINHOS DO QR CODE.
 *
 * A tela, o ícone e a coluna já existiam desde o canal oficial — no QR Code nada os preenchia, e
 * toda mensagem enviada ficava com um tique só pra sempre.
 *
 * O que está provado aqui é a tradução, e ela importa por um motivo concreto: no canal oficial o
 * status chegou a ser gravado CRU, em inglês, e um valor fora do vocabulário da tela derrubava a
 * renderização inteira da conversa. Aqui, o que não é reconhecido vira `null` e não é gravado.
 */

describe("o que vira tiquinho", () => {
  it("entregue, lido e reproduzido, pelo nome", () => {
    expect(statusDoBaileys("DELIVERY_ACK")).toBe("entregue");
    expect(statusDoBaileys("READ")).toBe("lido");
    expect(statusDoBaileys("PLAYED")).toBe("reproduzido");
  });

  it("e pelo número, que é como algumas versões mandam", () => {
    expect(statusDoBaileys(3)).toBe("entregue");
    expect(statusDoBaileys(4)).toBe("lido");
    expect(statusDoBaileys(5)).toBe("reproduzido");
  });

  it("não se importa com a caixa", () => {
    expect(statusDoBaileys("delivery_ack")).toBe("entregue");
  });
});

describe("o que NÃO vira nada", () => {
  it("os estados que não rebaixam uma mensagem já enviada", () => {
    // `PENDING` e `SERVER_ACK` chegam depois do envio e diriam menos do que a bolha já diz.
    expect(statusDoBaileys("PENDING")).toBeNull();
    expect(statusDoBaileys("SERVER_ACK")).toBeNull();
  });

  it("o erro do Baileys, que chega sem motivo", () => {
    // Bolha vermelha sem explicação é pior do que um tique a menos: quem atende não tem o que
    // fazer com ela.
    expect(statusDoBaileys("ERROR")).toBeNull();
  });

  it("ausente, vazio ou desconhecido", () => {
    expect(statusDoBaileys(undefined)).toBeNull();
    expect(statusDoBaileys("")).toBeNull();
    expect(statusDoBaileys("INVENTADO")).toBeNull();
  });
});
