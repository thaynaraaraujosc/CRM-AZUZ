import { afterAll, describe, expect, it } from "vitest";
import mariadb from "mariadb";
import type { Pool } from "mariadb";

import { urlDeConexao } from "../url-de-conexao";

/**
 * O teste que faltou, e cuja falta derrubou o CRM em producao.
 *
 * Havia teste do `urlDeConexao`, e ele passava: provava que a funcao MONTA a string certa. Mas
 * "monta a string certa" e uma opiniao do autor do teste. Quem decide se a string presta e o
 * driver, e depois dele o servidor MySQL. Entre a string bonita e a conexao aberta cabia um bug,
 * e foi exatamente ali que ele estava: com "?" dentro da senha, a URL era partida no meio e host,
 * porta e nome do banco viravam lixo. Nenhum teste de string via isso, porque nenhum teste de
 * string tenta conectar.
 *
 * Entao este aqui ABRE A CONEXAO. Sobe consulta, conta conexao viva, confere o que o servidor
 * enxerga. E o unico tipo de teste que poderia ter impedido a queda.
 *
 * Pula sozinho quando nao ha banco (CI, maquina de quem so quer rodar `vitest`), porque teste que
 * exige infraestrutura pra existir vira teste que alguem desliga.
 */

const HOST = process.env.TESTE_BANCO_HOST ?? "127.0.0.1";
const PORTA = process.env.TESTE_BANCO_PORTA ?? "3306";
const BANCO = process.env.TESTE_BANCO_NOME ?? "azuz_pool";

/** Senha com "?" e "@" dentro: exatamente o formato que quebrou. */
const URL_SENHA_DIFICIL = `mysql://azuzt:p@ss?w0rd@${HOST}:${PORTA}/${BANCO}`;
const URL_SENHA_SIMPLES = `mysql://azuzs:simples123@${HOST}:${PORTA}/${BANCO}`;

async function bancoDisponivel(): Promise<boolean> {
  try {
    const conexao = await mariadb.createConnection({
      host: HOST,
      port: Number(PORTA),
      user: "azuzs",
      password: "simples123",
      database: BANCO,
      connectTimeout: 2000,
    });
    await conexao.end();
    return true;
  } catch {
    return false;
  }
}

const temBanco = await bancoDisponivel();
const conditional = temBanco ? describe : describe.skip;

const poolsAbertos: Pool[] = [];

function abrirPool(databaseUrl: string): Pool {
  const pool = mariadb.createPool(urlDeConexao(databaseUrl));
  poolsAbertos.push(pool);
  return pool;
}

afterAll(async () => {
  await Promise.all(poolsAbertos.map((p) => p.end().catch(() => {})));
});

conditional("conexao real com o banco", () => {
  // O teste que teria pego o bug que derrubou o CRM.
  it("conecta com senha que tem ? e @ dentro", async () => {
    const pool = abrirPool(URL_SENHA_DIFICIL);
    const linhas = await pool.query("SELECT 1 AS ok");
    expect(linhas[0].ok).toBe(1);
  });

  it("conecta com senha comum", async () => {
    const pool = abrirPool(URL_SENHA_SIMPLES);
    const linhas = await pool.query("SELECT 1 AS ok");
    expect(linhas[0].ok).toBe(1);
  });

  it("chega no banco certo", async () => {
    const pool = abrirPool(URL_SENHA_DIFICIL);
    const linhas = await pool.query("SELECT DATABASE() AS db");
    expect(linhas[0].db).toBe(BANCO);
  });

  /**
   * O conserto em si, medido no servidor e nao na configuracao.
   *
   * Conferir que a string diz `minimumIdle=0` provaria so que o texto esta escrito. O que importa
   * e o servidor deixar de ver conexao pendurada depois que a consulta acabou: e isso que libera
   * vaga pro webhook gravar a mensagem de WhatsApp que chega.
   */
  it("nao deixa conexao pendurada depois da consulta", async () => {
    const pool = abrirPool(URL_SENHA_SIMPLES);
    await Promise.all([pool.query("SELECT 1"), pool.query("SELECT 1"), pool.query("SELECT 1")]);

    // `idleTimeout` e em segundos; o menor valor util pra um teste e esperar um pouco mais que ele.
    await new Promise((r) => setTimeout(r, 1200));
    expect(pool.activeConnections()).toBe(0);
    // `minimumIdle=0` significa que o pool nao tem obrigacao de manter nenhuma viva.
    expect(pool.totalConnections()).toBeLessThanOrEqual(3);
  });

  it("respeita o teto de conexoes por processo", async () => {
    const pool = abrirPool(URL_SENHA_SIMPLES);
    // Dez consultas ao mesmo tempo com teto de 3: o pool enfileira em vez de abrir dez conexoes.
    await Promise.all(Array.from({ length: 10 }, () => pool.query("SELECT SLEEP(0.05)")));
    expect(pool.totalConnections()).toBeLessThanOrEqual(3);
  });

  it("a compressao nao impede a conexao", async () => {
    // `compress=true` e a linha que derrubou a conta de egresso. Se o servidor nao falasse esse
    // protocolo, o CRM inteiro cairia, entao vale confirmar contra um servidor de verdade.
    const pool = abrirPool(URL_SENHA_SIMPLES);
    const linhas = await pool.query("SELECT REPEAT('a', 10000) AS grande");
    expect(linhas[0].grande).toHaveLength(10000);
  });
});
