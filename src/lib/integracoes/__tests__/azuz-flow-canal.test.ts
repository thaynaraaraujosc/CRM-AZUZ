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

describe("o pedido do formulário", () => {
  it("manda sobre a opção da empresa", () => {
    // A empresa escolhe o padrão; o formulário escolhe a exceção. Um institucional pode cair no
    // número oficial e um de campanha no QR, na mesma conta.
    expect(escolherCanalDoFlow("oficial", OS_DOIS, "qrcode").conexao).toBe("qrcode");
    expect(escolherCanalDoFlow("qrcode", OS_DOIS, "oficial").conexao).toBe("oficial");
  });

  it("não tem plano B: canal pedido e desconectado não cai no outro", () => {
    /*
     * Cair no outro mandaria a mensagem pelo número errado, e em silêncio — ninguém revisa um lead
     * que "deu certo". Quem escolheu um canal escolheu contra o outro.
     */
    const pediuQr = escolherCanalDoFlow("automatico", SO_OFICIAL, "qrcode");
    expect(pediuQr.contaCanal).toBeNull();
    expect(pediuQr.aviso).toContain("O formulário pediu o WhatsApp QR Code");

    const pediuOficial = escolherCanalDoFlow("automatico", SO_QR, "oficial");
    expect(pediuOficial.contaCanal).toBeNull();
    expect(pediuOficial.aviso).toContain("O formulário pediu o WhatsApp oficial");
  });

  it("ausente devolve a decisão pra empresa", () => {
    // É o que mantém o comportamento de quem nunca mexeu em nada: o padrão da empresa é "só
    // oficial", igual a antes de tudo isto existir.
    for (const ausente of [null, undefined]) {
      expect(escolherCanalDoFlow("oficial", OS_DOIS, ausente).conexao).toBe("oficial");
      expect(escolherCanalDoFlow("qrcode", OS_DOIS, ausente).conexao).toBe("qrcode");
    }
  });

  it("o aviso diz QUAL conexão faltou, não só que faltou", () => {
    // Quem lê está no painel do Flow e precisa saber o que ligar. "Não foi possível" não diz nada.
    expect(escolherCanalDoFlow("automatico", NENHUM, "qrcode").aviso).toContain("QR Code");
    expect(escolherCanalDoFlow("automatico", NENHUM, "oficial").aviso).toContain("oficial");
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
