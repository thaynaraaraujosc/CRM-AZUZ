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
 *
 * E quando a string MUDAR de propósito — como mudou em 15/10/2026, com o `connectTimeout` — este
 * teste quebra, e é esse o trabalho dele. Ele não existe pra impedir mudança; existe pra que
 * nenhuma aconteça sem alguém escrever aqui o que mudou e por quê. Nunca "ajusta o literal e
 * segue".
 */

const URL_REAL = "mysql://usuario:senha@host.proxy.rlwy.net:12345/railway";

describe("montarUrlDoBanco", () => {
  it("sem a variável, sai exatamente o que já rodava antes dela existir", () => {
    expect(montarUrlDoBanco(URL_REAL)).toBe(
      "mariadb://usuario:senha@host.proxy.rlwy.net:12345/railway?connectionLimit=3&compress=true&allowPublicKeyRetrieval=true&connectTimeout=8000",
    );
  });

  it("string vazia também não muda nada", () => {
    // Variável criada e deixada em branco na Vercel é um cenário real.
    expect(montarUrlDoBanco(URL_REAL, "")).toBe(montarUrlDoBanco(URL_REAL));
  });

  it("com a variável, os parâmetros entram no fim", () => {
    expect(montarUrlDoBanco(URL_REAL, "&minimumIdle=0&idleTimeout=30")).toBe(
      "mariadb://usuario:senha@host.proxy.rlwy.net:12345/railway" +
        "?connectionLimit=3&compress=true&allowPublicKeyRetrieval=true&connectTimeout=8000&minimumIdle=0&idleTimeout=30",
    );
  });

  it("URL que já tem query continua válida", () => {
    expect(montarUrlDoBanco(`${URL_REAL}?ssl-mode=REQUIRED`)).toBe(
      "mariadb://usuario:senha@host.proxy.rlwy.net:12345/railway" +
        "?ssl-mode=REQUIRED&connectionLimit=3&compress=true&allowPublicKeyRetrieval=true&connectTimeout=8000",
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

/**
 * O limite que ninguém tinha escolhido.
 *
 * Sem `connectTimeout` escrito, o driver usa 1000 ms (`connection-options.js`, linha 99). Um
 * segundo pra TCP mais o aperto de mão completo do MySQL, com a função rodando num continente e o
 * banco em outro. Nunca foi decisão de ninguém: era o que sobrava quando a opção não aparece.
 */
describe("tempo pra abrir a conexão", () => {
  it("escreve um limite explícito, em vez de herdar 1 segundo do driver", () => {
    expect(montarUrlDoBanco("mysql://u:s@host:3306/banco")).toContain("connectTimeout=8000");
  });

  it("fica abaixo do acquireTimeout padrão do pool", () => {
    /*
     * `pool-options.js` rebaixa o `connectTimeout` pro valor do `acquireTimeout` quando ele passa
     * disso. Com os dois iguais, uma tentativa que falha consome a espera inteira e o pool não
     * chega a tentar outra. Abaixo, sobra margem pra uma segunda tentativa.
     */
    const ACQUIRE_TIMEOUT_PADRAO_DO_DRIVER = 10_000;
    const escrito = Number(/connectTimeout=(\d+)/.exec(montarUrlDoBanco("mysql://u:s@h:3306/b"))?.[1]);
    expect(escrito).toBeLessThan(ACQUIRE_TIMEOUT_PADRAO_DO_DRIVER);
  });

  it("os parâmetros extras continuam podendo sobrescrever o limite", () => {
    // Mesma regra de tudo que entra nesta montagem: precisa ser ajustável sem passar por build.
    const url = montarUrlDoBanco("mysql://u:s@host:3306/banco", "&connectTimeout=20000");
    expect(url.indexOf("connectTimeout=20000")).toBeGreaterThan(url.indexOf("connectTimeout=8000"));
  });
});

/**
 * A opção que derrubou a produção por estar ausente.
 *
 * O MySQL 8.4 autentica com `caching_sha2_password`: funciona pelo caminho rápido enquanto o cache
 * do servidor está quente, e exige a chave pública RSA quando ele esfria. O driver se recusa a
 * pedir essa chave a menos que a opção esteja ligada — então, sem ela, o CRM fica de pé por semanas
 * e cai do nada, sem ninguém ter mexido em nada.
 */
describe("autenticação com cache frio", () => {
  it("sempre pede a chave pública, em qualquer formato de URL", () => {
    expect(montarUrlDoBanco("mysql://u:s@host:3306/banco")).toContain("allowPublicKeyRetrieval=true");
    expect(montarUrlDoBanco("mysql://u:s@host:3306/banco?ssl-mode=REQUIRED")).toContain(
      "allowPublicKeyRetrieval=true",
    );
  });

  it("os parâmetros extras continuam vindo depois, e podem sobrescrever", () => {
    // `DATABASE_POOL_PARAMS` existe pra ajustar sem deploy; ela precisa continuar tendo a última
    // palavra, inclusive pra desligar esta opção se um dia a conexão passar a usar TLS.
    const url = montarUrlDoBanco("mysql://u:s@host:3306/banco", "&allowPublicKeyRetrieval=false");
    expect(url.indexOf("allowPublicKeyRetrieval=false")).toBeGreaterThan(
      url.indexOf("allowPublicKeyRetrieval=true"),
    );
  });
});
