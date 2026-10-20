import { describe, expect, it } from "vitest";

import { escolherCanalDoFlow } from "../azuz-flow-canal";

/**
 * O QUE ESTES TESTES PRENDEM: o lead do Flow entrando sem conversa — e, sem conversa, toda
 * automação que fosse falar com a pessoa falhando com "conversa sem destinatário".
 *
 * Era o que acontecia sempre que o WhatsApp oficial não estava conectado, porque ele era a única
 * resposta possível. Com o oficial em revisão na Meta, isso é o produto parado.
 */

const SO_OFICIAL = { oficial: "1234567890", qrcode: null };
const SO_QR = { oficial: null, qrcode: "5562999990001" };
const OS_DOIS = { oficial: "1234567890", qrcode: "5562999990001" };
const NENHUM = { oficial: null, qrcode: null };

describe("automático", () => {
  it("prefere o oficial quando os dois estão conectados", () => {
    /*
     * A ordem não é arbitrária: o oficial é canal declarado, com janela de 24h, modelo aprovado e
     * número que não corre risco de bloqueio. O QR é a saída, não a preferência.
     */
    expect(escolherCanalDoFlow("automatico", OS_DOIS)).toEqual({
      contaCanal: "meta_whatsapp:1234567890",
      conexao: "oficial",
      aviso: null,
    });
  });

  it("usa o QR quando só ele está conectado", () => {
    expect(escolherCanalDoFlow("automatico", SO_QR)).toEqual({
      contaCanal: "whatsapp_nao_oficial:5562999990001",
      conexao: "qrcode",
      aviso: null,
    });
  });

  it("sem nenhum canal, segue como antes: sem conversa, e com aviso", () => {
    const r = escolherCanalDoFlow("automatico", NENHUM);

    expect(r.contaCanal).toBeNull();
    expect(r.conexao).toBeNull();
    expect(r.aviso).toBe("Nenhum WhatsApp está conectado, então o lead entrou sem conversa.");
  });
});

describe("escolha fixa", () => {
  it("só oficial ignora o QR conectado", () => {
    // Caso real: o número do QR é de outra equipe, e o formulário tem que cair no comercial.
    const r = escolherCanalDoFlow("oficial", SO_QR);

    expect(r.contaCanal).toBeNull();
    expect(r.aviso).toContain("oficial não está conectado");
  });

  it("só QR ignora o oficial conectado", () => {
    const r = escolherCanalDoFlow("qrcode", SO_OFICIAL);

    expect(r.contaCanal).toBeNull();
    expect(r.aviso).toContain("QR Code não está conectado");
  });

  it("cada escolha fixa usa a sua conexão quando ela existe", () => {
    expect(escolherCanalDoFlow("oficial", OS_DOIS).conexao).toBe("oficial");
    expect(escolherCanalDoFlow("qrcode", OS_DOIS).conexao).toBe("qrcode");
  });
});

describe("o aviso", () => {
  it("é uma frase em português, pronta pra tela de Respostas do Flow", () => {
    // Quem lê é a agência no painel do Flow, não um desenvolvedor no log: a frase diz o que está
    // faltando e termina em ponto.
    for (const escolha of ["automatico", "oficial", "qrcode"] as const) {
      const aviso = escolherCanalDoFlow(escolha, NENHUM).aviso!;

      expect(aviso.endsWith(".")).toBe(true);
      expect(aviso).toContain("sem conversa");
    }
  });
});
