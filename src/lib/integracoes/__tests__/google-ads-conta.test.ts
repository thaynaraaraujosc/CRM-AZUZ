import { describe, expect, it } from "vitest";

import { precisaRenovar } from "../google-ads-conta";

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
