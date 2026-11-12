import { describe, expect, it } from "vitest";

import { canalDaConexao, canalDeSaida, primeiraMensagemPrecisaDeModelo } from "../canal-de-saida";

/**
 * "NÃO CONSEGUI CONVERSAR COM NINGUÉM PELA API OFICIAL."
 *
 * O padrão da conversa sem dono era o QR Code, FIXO. Com o QR desconectado e o oficial de pé — o
 * estado de quem acabou de trocar de celular — o CRM continuava se achando no QR: escondia o
 * caminho do modelo aprovado (o único jeito de falar primeiro pelo oficial) e deixava escrever
 * texto livre, que a Meta recusa. Ficava sem saída e sem explicação.
 */

const SO_OFICIAL = { oficialConectado: true, qrConectado: false };
const SO_QR = { oficialConectado: false, qrConectado: true };
const OS_DOIS = { oficialConectado: true, qrConectado: true };
const NENHUM = { oficialConectado: false, qrConectado: false };

describe("canalDeSaida", () => {
  /* O caso que motivou tudo: a preferência era QR, mas QR não existe mais ali. */
  it("com só o oficial ligado, é o oficial — mesmo com a preferência no QR", () => {
    expect(canalDeSaida("whatsapp_nao_oficial", SO_OFICIAL)).toBe("whatsapp_oficial");
    expect(canalDeSaida("whatsapp_oficial", SO_OFICIAL)).toBe("whatsapp_oficial");
  });

  it("com só o QR ligado, é o QR", () => {
    expect(canalDeSaida("whatsapp_oficial", SO_QR)).toBe("whatsapp_nao_oficial");
    expect(canalDeSaida("whatsapp_nao_oficial", SO_QR)).toBe("whatsapp_nao_oficial");
  });

  /* Com dois caminhos existe escolha de verdade, e ela é de quem está atendendo. */
  it("com os dois ligados, vale a preferência", () => {
    expect(canalDeSaida("whatsapp_oficial", OS_DOIS)).toBe("whatsapp_oficial");
    expect(canalDeSaida("whatsapp_nao_oficial", OS_DOIS)).toBe("whatsapp_nao_oficial");
  });

  /*
   * SEM NADA LIGADO, O QR — e isto é escolha, não descuido.
   *
   * É o estado de quem ainda não carregou o status das conexões. Assumir o oficial aqui faria a
   * faixa de "precisa de modelo aprovado" piscar pra todo mundo a cada carregamento, inclusive pra
   * quem só usa QR Code e nunca vai ver um modelo na vida.
   */
  it("sem nenhuma conexão, cai no QR", () => {
    expect(canalDeSaida("whatsapp_oficial", NENHUM)).toBe("whatsapp_nao_oficial");
  });
});

describe("primeiraMensagemPrecisaDeModelo", () => {
  it("o oficial exige modelo aprovado", () => {
    expect(primeiraMensagemPrecisaDeModelo("whatsapp_oficial")).toBe(true);
  });

  /* O QR Code é o mesmo aplicativo de sempre: não tem janela de 24h nem modelo no caminho. */
  it("o QR Code não exige", () => {
    expect(primeiraMensagemPrecisaDeModelo("whatsapp_nao_oficial")).toBe(false);
  });
});

describe("canalDaConexao", () => {
  /*
   * O defeito que isto tranca: escolher o número na ficha do contato definia o número e NÃO o
   * canal. Quem escolhia a conexão oficial caía num compositor que ainda se achava no QR Code —
   * e o QR Code deixa escrever texto livre, que pelo oficial a Meta recusa.
   */
  it("a chave da conexão já diz o canal: não precisa perguntar de novo", () => {
    expect(canalDaConexao("meta_whatsapp:123456789")).toBe("whatsapp_oficial");
    expect(canalDaConexao("whatsapp_nao_oficial:5562994361377")).toBe("whatsapp_nao_oficial");
  });

  it("o nome antigo da conexão não oficial continua valendo", () => {
    // `whatsapp_baileys` ainda está gravado em mensagem de automação. Lido como "não é QR Code",
    // mandaria pelo oficial uma conversa que corre pelo aparelho — e lá, sem modelo aprovado, a
    // Meta recusa.
    expect(canalDaConexao("whatsapp_baileys:5562994361377")).toBe("whatsapp_nao_oficial");
  });

  it("sem conexão escolhida, quem decide continua sendo `canalDeSaida`", () => {
    expect(canalDaConexao(null)).toBeNull();
    expect(canalDaConexao(undefined)).toBeNull();
    expect(canalDaConexao("")).toBeNull();
  });

  it("provedor desconhecido não vira palpite: afirmar o canal errado é pior do que não afirmar", () => {
    expect(canalDaConexao("telegram:999")).toBeNull();
  });
});
