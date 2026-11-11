import { describe, expect, it } from "vitest";

import { slotDaConversa } from "../conexoes-whatsapp";

/**
 * O NÚMERO ESCOLHIDO NA TELA RESOLVE PELO MESMO CAMINHO DA CONVERSA.
 *
 * "Preciso da opção de escolher aqui o número que eu vou mandar mensagem, mesmo já tendo falado com
 * o contato por outro número." A escolha chega no mesmo formato do `contaCanal` da conversa, e é de
 * propósito: dois jeitos de apontar pro mesmo número é como eles passam a discordar.
 *
 * `slotEscolhidoParaEnvio` consulta o banco, então quem tem teste é a regra pura embaixo dela.
 */
const LIGADAS = [
  { slot: 1, numero: "5562963404 38" },
  { slot: 2, numero: "+55 11 97393-5384" },
];

describe("resolver o número escolhido", () => {
  it("acha o slot pela chave do número, ignorando a formatação", () => {
    expect(slotDaConversa(LIGADAS, "whatsapp_nao_oficial:5562963404 38")).toBe(1);
    expect(slotDaConversa(LIGADAS, "whatsapp_nao_oficial:5511973935384")).toBe(2);
  });

  /* Chave de um número que não está ligado não vira envio: quem chama devolve motivo em vez de
     escolher outro por conta própria. Escolher um número que caiu acontece — a tela foi carregada
     antes de ele cair. */
  it("número que não está ligado não resolve", () => {
    expect(slotDaConversa(LIGADAS, "whatsapp_nao_oficial:5500000000000")).toBeNull();
  });

  /* Com uma conexão só, qualquer chave cai nela: não há outra pra onde ir, e recusar aqui
     desligaria o envio numa conta que tem exatamente um número. */
  it("com um número só, é ele", () => {
    expect(slotDaConversa([LIGADAS[0]], "whatsapp_nao_oficial:5500000000000")).toBe(1);
  });
});
