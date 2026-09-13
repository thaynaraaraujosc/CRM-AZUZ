import { describe, expect, it } from "vitest";

import { urlDeConexao } from "../url-de-conexao";

/**
 * O que estes testes prendem: a configuração de pool que fazia mensagem de WhatsApp sumir.
 *
 * Em produção o banco registrou 73 conexões abertas (teto 151) e 4.753 recusadas de 13.875, com
 * ZERO cliente usando o produto. A causa era o padrão do driver `mariadb`, que mantém
 * `connectionLimit` conexões vivas para sempre mesmo sem consulta nenhuma.
 */
const BASE = "mysql://usuario:senha@host:3306/banco";

function parametros(url: string): URLSearchParams {
  return new URLSearchParams(url.split("?")[1] ?? "");
}

describe("urlDeConexao", () => {
  it("troca mysql:// por mariadb://, que é o único que o driver aceita", () => {
    expect(urlDeConexao(BASE).startsWith("mariadb://usuario:senha@host:3306/banco?")).toBe(true);
  });

  // O conserto principal. Com o padrão do driver (minimumIdle = connectionLimit = 3), cada
  // instância serverless segurava 3 conexões para sempre, e a Vercel cria instâncias sem parar.
  it("não deixa nenhuma conexão viva com o pool parado", () => {
    expect(parametros(urlDeConexao(BASE)).get("minimumIdle")).toBe("0");
  });

  // O padrão do driver é 1800 segundos: meia hora de conexão pendurada por instância congelada.
  it("devolve conexão parada em segundos, não em meia hora", () => {
    const ocioso = Number(parametros(urlDeConexao(BASE)).get("idleTimeout"));
    expect(ocioso).toBeGreaterThan(0);
    expect(ocioso).toBeLessThanOrEqual(60);
  });

  it("mantém o teto por processo e a compressão", () => {
    const p = parametros(urlDeConexao(BASE));
    expect(p.get("connectionLimit")).toBe("3");
    // `compress` é a linha que derrubou a fatura de egresso: sem ela o JSON viaja cru.
    expect(p.get("compress")).toBe("true");
  });

  it("respeita parâmetro já escrito na variável de ambiente", () => {
    // Ajuste de emergência em produção não pode depender de deploy.
    const p = parametros(urlDeConexao(`${BASE}?connectionLimit=1`));
    expect(p.get("connectionLimit")).toBe("1");
    expect(p.get("minimumIdle")).toBe("0");
  });

  // Senha de banco e gerada por maquina e pode conter "?" e "@" literais. Cortar no primeiro "?"
  // partia a URL no meio da senha: host e nome do banco viravam lixo codificado e a conexao caia
  // inteira, sem mensagem que ligasse o sintoma a causa.
  it("não se perde quando a senha tem ? e @ dentro", () => {
    const url = urlDeConexao("mysql://root:p@ss?word@host.proxy.rlwy.net:12345/railway");
    expect(url.startsWith("mariadb://root:p@ss?word@host.proxy.rlwy.net:12345/railway?")).toBe(true);
    expect(parametros(url.slice(url.lastIndexOf("/railway?"))).get("minimumIdle")).toBe("0");
  });

  it("preserva o que já vinha na URL e não duplica parâmetro", () => {
    const url = urlDeConexao(`${BASE}?ssl=true`);
    expect(parametros(url).get("ssl")).toBe("true");
    expect(url.match(/compress=/g)).toHaveLength(1);
  });
});
