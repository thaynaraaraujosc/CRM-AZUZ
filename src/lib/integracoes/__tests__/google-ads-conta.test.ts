import { describe, expect, it } from "vitest";

import { mensagemDeAutorizacaoPerdida, precisaRenovar } from "../google-ads-conta";

/**
 * A diferença entre o Google e a Meta que derruba a integração no dia seguinte.
 *
 * O token de acesso do Google dura UMA HORA. A conexão é feita à tarde, funciona, mostra campanha,
 * e no dia seguinte a tela abre "conectada" e sem campanha nenhuma. É o pior formato de defeito:
 * a tela afirma que está tudo certo.
 *
 * A folga de um minuto existe porque um token que vence ENTRE a checagem e a chegada da chamada no
 * Google devolve 401, e o 401 não diz que o token venceu no caminho.
 */
describe("precisaRenovar", () => {
  const agora = new Date("2026-09-14T12:00:00Z");

  it("renova quando nunca houve validade guardada", () => {
    expect(precisaRenovar(null, agora)).toBe(true);
  });

  it("renova o token já vencido", () => {
    expect(precisaRenovar(new Date("2026-09-14T11:59:00Z"), agora)).toBe(true);
  });

  it("renova o que vence dentro do minuto seguinte, antes de dar 401 no meio do voo", () => {
    expect(precisaRenovar(new Date("2026-09-14T12:00:30Z"), agora)).toBe(true);
  });

  it("não renova à toa quem ainda tem tempo de sobra", () => {
    expect(precisaRenovar(new Date("2026-09-14T12:30:00Z"), agora)).toBe(false);
  });
});

/**
 * A frase que a pessoa lê quando a conexão morre.
 *
 * Tem data marcada pra acontecer: enquanto a tela de permissão OAuth estiver em "Testes", o Google
 * mata todo refresh token em SETE DIAS. O que volta é `invalid_grant`, seco. Sem tradução, a tela
 * mostraria "Google Ads conectado" e nenhuma campanha, e quem olha conclui que não investiu nada
 * em vez de que a autorização venceu.
 */
describe("mensagemDeAutorizacaoPerdida", () => {
  it("diz o que fazer quando o token de sete dias vence", () => {
    const frase = mensagemDeAutorizacaoPerdida("invalid_grant");
    expect(frase).toContain("Conectar Google Ads");
  });

  it("dá a mesma saída quando o cliente revoga o acesso", () => {
    // Causas diferentes, conserto idêntico: reconectar.
    for (const causa of ["Token has been expired or revoked.", "invalid_grant: token revoked"]) {
      expect(mensagemDeAutorizacaoPerdida(causa), causa).toContain("Conectar Google Ads");
    }
  });

  it("não engole um motivo que não seja de autorização", () => {
    // Inventar "reconecte" pra uma falha de rede mandaria a pessoa refazer algo que estava certo.
    const frase = mensagemDeAutorizacaoPerdida("servidor do Google fora do ar");
    expect(frase).toContain("servidor do Google fora do ar");
    expect(frase).not.toContain("Conectar Google Ads");
  });

  it("aguenta recusa sem mensagem nenhuma", () => {
    expect(mensagemDeAutorizacaoPerdida("")).toContain("motivo não informado");
  });
});
