import { describe, expect, it } from "vitest";

import { BLOCOS_DISPONIVEIS } from "@/lib/automation-flow/blocos";
import { CANAIS_DA_AREA } from "@/lib/canais/capacidades";
import { CATEGORIAS, MODELOS_DE_ROBO } from "@/lib/automacoes/modelos-de-robo";

const TIPOS_REAIS = new Set(BLOCOS_DISPONIVEIS.map((b) => b.tipo));
const CANAIS_REAIS = new Set([...CANAIS_DA_AREA.comercial, ...CANAIS_DA_AREA.social]);

describe("catálogo de modelos", () => {
  it("tem id único e nome em todos", () => {
    const ids = MODELOS_DE_ROBO.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of MODELOS_DE_ROBO) {
      expect(m.nome.trim().length, m.id).toBeGreaterThan(0);
      expect(m.objetivo.trim().length, m.id).toBeGreaterThan(0);
    }
  });

  it("toda categoria declarada existe na lista de abas", () => {
    const validas = new Set(CATEGORIAS.map((c) => c.valor));
    for (const m of MODELOS_DE_ROBO) {
      expect(m.categorias.length, m.id).toBeGreaterThan(0);
      for (const c of m.categorias) expect(validas.has(c), `${m.id}: ${c}`).toBe(true);
    }
  });

  /*
   * A REGRA QUE SEGURA A GALERIA INTEIRA.
   *
   * A referência tem modelos de TikTok, Telegram, Messenger e chat ao vivo — canais que este CRM
   * não tem. Um modelo oferecido num canal que não existe é um botão que não liga em lugar
   * nenhum: a pessoa monta a automação, publica, e fica esperando.
   */
  it("todo canal declarado é um canal que este CRM tem de verdade", () => {
    for (const m of MODELOS_DE_ROBO) {
      expect(m.canais.length, `${m.id} sem canal`).toBeGreaterThan(0);
      for (const c of m.canais) expect(CANAIS_REAIS.has(c), `${m.id}: ${c}`).toBe(true);
    }
  });
});

describe("cada modelo monta um fluxo que o motor executa", () => {
  /*
   * NADA AQUI É ILUSTRAÇÃO. Um modelo que usa um tipo de bloco que a biblioteca não conhece
   * desenha um cartão vazio no editor e não roda — e o erro só apareceria quando alguém abrisse
   * aquele modelo específico.
   */
  it("todo bloco usado existe na biblioteca", () => {
    for (const m of MODELOS_DE_ROBO) {
      const { nodes } = m.construir();
      expect(nodes.length, `${m.id} sem blocos`).toBeGreaterThan(0);
      for (const n of nodes) {
        expect(TIPOS_REAIS.has(n.type), `${m.id}: bloco "${n.type}" não existe`).toBe(true);
      }
    }
  });

  it("toda aresta liga dois blocos que existem no modelo", () => {
    for (const m of MODELOS_DE_ROBO) {
      const { nodes, edges } = m.construir();
      const ids = new Set(nodes.map((n) => n.id));
      for (const e of edges) {
        expect(ids.has(e.source), `${m.id}: aresta sai de "${e.source}", que não existe`).toBe(true);
        expect(ids.has(e.target), `${m.id}: aresta vai pra "${e.target}", que não existe`).toBe(true);
      }
    }
  });

  /*
   * UM COMEÇO SÓ. O motor acha o início pelo único nó em que ninguém entra
   * (`primeiroNoDepoisDoGatilho`): com dois candidatos ele não escolhe, desiste, e o robô não roda
   * — sem dizer nada. Um modelo com dois pontos de partida seria um robô que nasce quebrado.
   */
  it("cada modelo tem exatamente um ponto de partida", () => {
    for (const m of MODELOS_DE_ROBO) {
      const { nodes, edges } = m.construir();
      const comEntrada = new Set(edges.map((e) => e.target));
      const raizes = nodes.filter((n) => !comEntrada.has(n.id));
      expect(raizes.map((r) => r.id), `${m.id} tem ${raizes.length} começos`).toHaveLength(1);
    }
  });

  it("nenhum bloco fica solto: todos são alcançáveis a partir do começo", () => {
    for (const m of MODELOS_DE_ROBO) {
      const { nodes, edges } = m.construir();
      const comEntrada = new Set(edges.map((e) => e.target));
      const inicio = nodes.find((n) => !comEntrada.has(n.id))!;
      const vistos = new Set<string>([inicio.id]);
      const fila = [inicio.id];
      while (fila.length) {
        const atual = fila.shift()!;
        for (const e of edges.filter((x) => x.source === atual)) {
          if (!vistos.has(e.target)) {
            vistos.add(e.target);
            fila.push(e.target);
          }
        }
      }
      const soltos = nodes.filter((n) => !vistos.has(n.id)).map((n) => n.id);
      expect(soltos, `${m.id}: blocos que ninguém alcança`).toEqual([]);
    }
  });

  /* Todo caminho termina: um ramo que acaba no nada deixa a conversa pendurada. */
  it("todo modelo termina em pelo menos um bloco de fim", () => {
    for (const m of MODELOS_DE_ROBO) {
      const { nodes } = m.construir();
      expect(nodes.some((n) => n.type === "encerrar_fluxo"), `${m.id} sem fim`).toBe(true);
    }
  });

  it("os blocos nascem com posição: o layout automático roda na montagem", () => {
    for (const m of MODELOS_DE_ROBO) {
      const { nodes } = m.construir();
      // Com todos em (0,0) o quadro abre com os blocos empilhados no mesmo ponto.
      const distintas = new Set(nodes.map((n) => `${n.position.x},${n.position.y}`));
      expect(distintas.size, `${m.id}: blocos sobrepostos`).toBe(nodes.length);
    }
  });

  it("o fluxo nasce com as configurações seguras: não reinicia em cima de quem já está nele", () => {
    for (const m of MODELOS_DE_ROBO) {
      expect(m.construir().configuracoes.naoIniciarSeJaNoFluxo, m.id).toBe(true);
    }
  });

  it("toda saída de botão tem uma aresta: botão que não leva a lugar nenhum é beco sem saída", () => {
    for (const m of MODELOS_DE_ROBO) {
      const { nodes, edges } = m.construir();
      for (const n of nodes) {
        if (n.type !== "mensagem_botoes") continue;
        const opcoes = ((n.data ?? {}) as { opcoes?: { id: string }[] }).opcoes ?? [];
        for (const o of opcoes) {
          const temSaida = edges.some((e) => e.source === n.id && e.sourceHandle === o.id);
          expect(temSaida, `${m.id}: o botão "${o.id}" de ${n.id} não leva a nada`).toBe(true);
        }
      }
    }
  });
});
