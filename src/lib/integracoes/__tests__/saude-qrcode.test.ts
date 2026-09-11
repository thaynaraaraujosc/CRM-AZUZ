import { describe, expect, it } from "vitest";

import { explicarSaude, semToken } from "../saude-qrcode";

/**
 * O defeito que estes testes prendem: "está chegando mensagem no meu celular e não está chegando
 * no CRM".
 *
 * O WhatsApp por QR Code depende de um elo guardado no servidor da Evolution, não neste banco: o
 * aviso que ela dispara a cada mensagem. Quando esse registro se perde, tudo continua parecendo
 * certo (celular recebendo, conexão marcada como conectada) e nenhuma mensagem chega. A frase que
 * a pessoa lê precisa apontar pra causa certa em cada combinação, senão ela vai reconectar o
 * WhatsApp à toa num problema que reconectar não resolve.
 */
const base = {
  statusNoCrm: "conectado",
  estadoNaEvolution: "open",
  webhookCerto: true,
  webhookAtivo: true as boolean | null,
  reparado: false,
  minutosDesdeOUltimoEvento: 2 as number | null,
};

describe("explicarSaude", () => {
  it("manda reconectar quando nada está conectado", () => {
    const frase = explicarSaude({ ...base, statusNoCrm: "desconectado", estadoNaEvolution: null });
    expect(frase).toContain("não está conectado");
  });

  it("avisa quando o CRM acha que está conectado e o celular caiu", () => {
    const frase = explicarSaude({ ...base, estadoNaEvolution: "close" });
    expect(frase).toContain("caiu");
  });

  it("conta que consertou sozinho, sem mandar a pessoa fazer nada", () => {
    const frase = explicarSaude({ ...base, webhookCerto: true, reparado: true });
    expect(frase).toContain("corrigido");
    expect(frase).not.toContain("Leia o QR Code");
  });

  it("assume o problema quando o aviso está errado e não deu pra consertar", () => {
    const frase = explicarSaude({ ...base, webhookCerto: false, reparado: false });
    expect(frase).toContain("não está registrado");
  });

  it("pede uma mensagem de teste quando está tudo certo e nunca chegou nada", () => {
    const frase = explicarSaude({ ...base, minutosDesdeOUltimoEvento: null });
    expect(frase).toContain("mensagem de teste");
  });

  it("pede uma mensagem de teste quando faz mais de uma hora que nada chega", () => {
    const frase = explicarSaude({ ...base, minutosDesdeOUltimoEvento: 240 });
    expect(frase).toContain("4 hora(s)");
  });

  it("diz que está saudável quando está", () => {
    expect(explicarSaude(base)).toContain("saudável");
  });

  // O aviso desligado é tão ruim quanto o aviso apontando pro lugar errado: não chega mensagem
  // nenhuma nos dois casos, e a frase precisa ser a mesma.
  it("trata aviso desligado como aviso errado", () => {
    const frase = explicarSaude({ ...base, webhookAtivo: false });
    expect(frase).toContain("não está registrado");
  });
});

describe("semToken", () => {
  // O token autentica a Evolution contra este CRM. Não pode aparecer em tela, log nem resposta.
  it("tira a query string inteira do endereço", () => {
    expect(semToken("https://azuzcrm.com.br/api/webhooks/evolution?token=abc123")).toBe(
      "https://azuzcrm.com.br/api/webhooks/evolution",
    );
  });

  it("aceita nulo", () => {
    expect(semToken(null)).toBeNull();
  });
});
