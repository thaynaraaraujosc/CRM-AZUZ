import { describe, expect, it } from "vitest";

import { escolhaPorNumero, escolherCanalDoFlow } from "../azuz-flow-canal";

/**
 * O QUE ESTES TESTES PRENDEM: o lead do Flow entrando sem conversa — e, sem conversa, toda
 * automação que fosse falar com a pessoa falhando com "conversa sem destinatário".
 *
 * Era o que acontecia sempre que o WhatsApp oficial não estava conectado, porque ele era a única
 * resposta possível. Com o oficial em revisão na Meta, isso é o produto parado.
 */

const SO_OFICIAL = { oficial: "1234567890", qrcode: null };
const SO_QR = { oficial: null, qrcode: { numero: "5562999990001" } };
const OS_DOIS = { oficial: "1234567890", qrcode: { numero: "5562999990001" } };
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

describe("o QR ligado sem o número conhecido", () => {
  /*
   * O DEFEITO DE 21/10/2026, e por que ele é fácil de voltar a cometer.
   *
   * O número da conexão do QR só é aprendido no evento `connection.update` da Evolution, e esse
   * evento se perde (instância recriada, webhook fora do ar no momento certo, servidor
   * restaurado). Quando se perde, a conexão segue de pé — mandando e recebendo o dia inteiro — e
   * o CRM fica sem saber o número dela.
   *
   * Tratar isso como "desconectado" fazia o lead do Flow entrar SEM CONVERSA. Sem conversa não há
   * confirmação de reunião, e quem preencheu o formulário não recebia nada, com o canal
   * funcionando o tempo todo.
   */
  it("atende o lead mesmo sem o número: a conversa nasce sem marca de dono", () => {
    const r = escolherCanalDoFlow("qrcode", { oficial: null, qrcode: { numero: null } });

    expect(r.conexao).toBe("qrcode");
    // Sem dono: é como todo o histórico anterior à coluna `contaCanal` já é tratado, e
    // `contasCanalVisiveis` mostra essas conversas quando o QR está ligado.
    expect(r.contaCanal).toBeNull();
    // E NENHUM aviso: não falta nada pra pessoa resolver. O canal está conectado.
    expect(r.aviso).toBeNull();
  });

  it("o pedido do formulário também é atendido", () => {
    const r = escolherCanalDoFlow("oficial", { oficial: null, qrcode: { numero: null } }, "qrcode");
    expect(r.conexao).toBe("qrcode");
  });

  it("desligado continua sendo desligado", () => {
    // A distinção que importa: `null` é "não está ligado"; `{ numero: null }` é "ligado e eu não
    // sei o número". Confundir os dois foi exatamente o defeito.
    const r = escolherCanalDoFlow("qrcode", { oficial: null, qrcode: null });
    expect(r.conexao).toBeNull();
    expect(r.aviso).toContain("não está conectado");
  });
});

describe("escolhaPorNumero", () => {
  const ligados = [
    { contaCanal: "meta_whatsapp:109", canal: "whatsapp_oficial", nome: "Comercial" },
    { contaCanal: "whatsapp_nao_oficial:5562994361377", canal: "whatsapp_nao_oficial", nome: "Thaynara" },
  ];

  it("o número escolhido é o que manda, e o canal vem dele", () => {
    expect(escolhaPorNumero("meta_whatsapp:109", ligados)).toEqual({
      contaCanal: "meta_whatsapp:109",
      conexao: "oficial",
      aviso: null,
    });
    expect(escolhaPorNumero("whatsapp_nao_oficial:5562994361377", ligados).conexao).toBe("qrcode");
  });

  it("dois números do MESMO canal se distinguem — é o que só a conta resolve", () => {
    const comDois = [
      ...ligados,
      { contaCanal: "whatsapp_nao_oficial:5511999998888", canal: "whatsapp_nao_oficial", nome: "Closer" },
    ];
    expect(escolhaPorNumero("whatsapp_nao_oficial:5511999998888", comDois).contaCanal).toBe(
      "whatsapp_nao_oficial:5511999998888",
    );
  });

  it("número escolhido fora do ar NÃO cai noutro: fica sem conversa, com o motivo", () => {
    /*
     * Mesma regra do pedido por canal, e pela mesma razão: quem escolheu um número escolheu contra
     * os outros. Cair noutro manda a confirmação pelo número errado — pior do que não mandar, e em
     * silêncio, porque ninguém confere um lead que "deu certo".
     */
    const fora = escolhaPorNumero("meta_whatsapp:999", ligados);
    expect(fora.contaCanal).toBeNull();
    expect(fora.conexao).toBeNull();
    expect(fora.aviso).toMatch(/não está conectado/i);
  });
});
