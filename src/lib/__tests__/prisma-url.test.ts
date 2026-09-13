import { describe, expect, it } from "vitest";

import { montarUrlDoBanco } from "../prisma";

/**
 * A garantia que decide se este deploy pode ou não derrubar o CRM.
 *
 * Duas tentativas de consertar o pool de conexões por deploy tiraram o produto do ar no mesmo dia.
 * A lição não foi "não mexer nunca", foi: mudança em conexão de banco precisa poder ser LIGADA E
 * DESLIGADA sem passar por build.
 *
 * Daí o `DATABASE_POOL_PARAMS`. Com ele ausente (que é o estado no momento do deploy), a string
 * precisa sair IDÊNTICA, caractere por caractere, à que já roda em produção. Um deploy que não
 * muda a string não tem como quebrar a conexão. É isso que o primeiro teste prova, e é por isso
 * que ele compara com o texto literal em vez de reusar a função: reusar provaria só que a função
 * concorda consigo mesma.
 */

const URL_REAL = "mysql://usuario:senha@host.proxy.rlwy.net:12345/railway";

describe("montarUrlDoBanco", () => {
  it("sem a variável, sai exatamente o que já rodava antes dela existir", () => {
    expect(montarUrlDoBanco(URL_REAL)).toBe(
      "mariadb://usuario:senha@host.proxy.rlwy.net:12345/railway?connectionLimit=3&compress=true",
    );
  });

  it("string vazia também não muda nada", () => {
    // Variável criada e deixada em branco na Vercel é um cenário real.
    expect(montarUrlDoBanco(URL_REAL, "")).toBe(montarUrlDoBanco(URL_REAL));
  });

  it("com a variável, os parâmetros entram no fim", () => {
    expect(montarUrlDoBanco(URL_REAL, "&minimumIdle=0&idleTimeout=30")).toBe(
      "mariadb://usuario:senha@host.proxy.rlwy.net:12345/railway" +
        "?connectionLimit=3&compress=true&minimumIdle=0&idleTimeout=30",
    );
  });

  it("URL que já tem query continua válida", () => {
    expect(montarUrlDoBanco(`${URL_REAL}?ssl-mode=REQUIRED`)).toBe(
      "mariadb://usuario:senha@host.proxy.rlwy.net:12345/railway" +
        "?ssl-mode=REQUIRED&connectionLimit=3&compress=true",
    );
  });

  /**
   * Senha de banco é gerada por máquina e pode conter "?" e "@". Uma versão anterior desta
   * montagem cortava a URL no primeiro "?", caía no meio da senha e transformava host e nome do
   * banco em lixo: foi o que derrubou o CRM. Aqui nada é fatiado, só concatenado, e este teste
   * existe pra que ninguém volte a fatiar.
   */
  it("não fatia a URL, então senha com ? e @ passa intacta", () => {
    const url = montarUrlDoBanco("mysql://root:p@ss?w0rd@host:3306/railway");
    expect(url.startsWith("mariadb://root:p@ss?w0rd@host:3306/railway")).toBe(true);
  });
});
