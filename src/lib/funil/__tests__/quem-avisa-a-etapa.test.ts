import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CATEGORIAS_GATILHO,
  EXPLICACAO_DO_QUANDO,
  QUANDO_ROTULO,
  QUANDOS_DE_ENTRADA,
  type QuandoGatilho,
} from "../gatilhos-etapa-tipos";

/**
 * A REGRA QUE O DEFEITO DE HOJE ENSINOU: quem cria card avisa a etapa.
 *
 * "Quando criado nesta etapa" aparecia no menu, salvava, e nunca disparava pro lead que entra
 * direto. A tabela de tipos estava certa — `criado` está em `QUANDOS_DE_ENTRADA`, e o teste que
 * cobra "todo gatilho tem quem o acione" passava feliz. O que faltava era do outro lado: dos
 * CINCO lugares que criam card no CRM, só um avisava a etapa, e era justamente o da tela do
 * funil, o único lead que a pessoa vê chegar.
 *
 * Um teste de tabela nunca ia pegar isso. Este pega: ele varre o código atrás de quem cria
 * `negocioCard` e cobra que o arquivo passe pela porta única (`entrou-na-etapa.ts`).
 *
 * É um teste que lê o fonte, e isso tem um custo: ele reclama quando alguém reorganiza arquivo.
 * Vale, porque o defeito que ele evita não aparece em lugar nenhum — nem erro, nem log, nem tela.
 * Só o cliente esperando uma mensagem que nunca saiu.
 */

const RAIZ = join(process.cwd(), "src");

/**
 * Onde criar card NÃO significa lead entrando num funil de verdade. Cada um com a razão escrita:
 * a lista é curta de propósito, e crescer nela é o sinal de que a regra está sendo contornada.
 */
const DISPENSADOS: Record<string, string> = {
  "lib/demo/semear.ts": "Semeia a conta de demonstração. Disparar automação aqui mandaria mensagem de teste pra número de verdade.",
};

function arquivosTs(pasta: string): string[] {
  const achados: string[] = [];
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) {
      // `generated` é o cliente do Prisma, escrito por máquina: ele "menciona" negocioCard.create
      // na documentação de cada método, e não cria card nenhum.
      if (nome === "generated" || nome === "node_modules" || nome === "__tests__") continue;
      achados.push(...arquivosTs(caminho));
      continue;
    }
    if (nome.endsWith(".ts") || nome.endsWith(".tsx")) achados.push(caminho);
  }
  return achados;
}

describe("quem cria card avisa a etapa", () => {
  it("todo arquivo que cria negocioCard passa pela porta única", () => {
    const faltando: string[] = [];

    for (const caminho of arquivosTs(RAIZ)) {
      const fonte = readFileSync(caminho, "utf8");
      if (!/negocioCard\.create(Many)?\(/.test(fonte)) continue;

      const relativo = caminho.slice(RAIZ.length + 1).replaceAll("\\", "/");
      if (DISPENSADOS[relativo]) continue;
      if (fonte.includes("entrou-na-etapa")) continue;

      faltando.push(relativo);
    }

    expect(
      faltando,
      `Estes arquivos criam card e não avisam a etapa — o gatilho "Quando criado nesta etapa" não vai disparar pra esse lead:\n  ${faltando.join("\n  ")}`,
    ).toEqual([]);
  });

  it("a lista de dispensados não cresceu sem explicação", () => {
    for (const [arquivo, razao] of Object.entries(DISPENSADOS)) {
      expect(razao.length, `${arquivo} precisa de uma razão escrita`).toBeGreaterThan(40);
    }
    expect(Object.keys(DISPENSADOS)).toHaveLength(1);
  });
});

describe("o menu de gatilhos continua legível", () => {
  it("entrar na etapa é a primeira opção do pipeline", () => {
    // "Tem que ter a opção de quando entrar nesta etapa." É a escolha certa pra quase todo caso,
    // e primeira é onde ela precisa estar: quem desce a lista escolhe a primeira que serve.
    const pipeline = CATEGORIAS_GATILHO.find((c) => c.titulo === "Gatilhos do pipeline");
    expect(pipeline?.quandos[0]).toBe("movido_ou_criado");
    expect(pipeline?.quandos.slice(0, 3)).toEqual(["movido_ou_criado", "movido", "criado"]);
  });

  it("os três jeitos de entrar na etapa dizem na tela o que pegam", () => {
    /*
     * Sem a explicação, a diferença entre "movido" e "criado" só aparece quando a automação não
     * dispara — ou dispara pra quem não devia. Os três são os que a pessoa confunde.
     */
    for (const q of QUANDOS_DE_ENTRADA) {
      expect(EXPLICACAO_DO_QUANDO[q], `${q} precisa explicar o que pega`).toBeTruthy();
    }
  });

  it("nenhuma explicação sobra pra um gatilho que não existe", () => {
    const todos = new Set(Object.keys(QUANDO_ROTULO) as QuandoGatilho[]);
    for (const q of Object.keys(EXPLICACAO_DO_QUANDO) as QuandoGatilho[]) {
      expect(todos.has(q), `${q} tem explicação e não está em QUANDO_ROTULO`).toBe(true);
    }
  });

  it("o rótulo do combinado fala de entrar, não de mecanismo", () => {
    expect(QUANDO_ROTULO.movido_ou_criado).toContain("entrar nesta etapa");
  });
});
