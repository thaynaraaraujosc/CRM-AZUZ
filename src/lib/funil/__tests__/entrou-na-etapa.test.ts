import { describe, expect, it } from "vitest";

import { avisarQueEntrouNaEtapa, chaveDeEntrada } from "../entrou-na-etapa";
import type { QuandoGatilho } from "../gatilhos-etapa-tipos";

/**
 * A porta por onde todo mundo avisa que o lead chegou na etapa.
 *
 * O que estes testes protegem é o que não dá pra ver na tela: que o lead que entra DIRETO aciona
 * o gatilho, e que uma etapa mandando o lead pra outra e de volta não gira pra sempre.
 */

/** Um par (trava, disparador) de mentira, que grava o que foi chamado. */
function bancada() {
  const usadas = new Set<string>();
  const disparos: { etapaId: string; evento: QuandoGatilho }[] = [];
  return {
    disparos,
    deps: {
      async primeiraVez({ chaveEvento }: { chaveEvento: string }) {
        if (usadas.has(chaveEvento)) return false;
        usadas.add(chaveEvento);
        return true;
      },
      async disparar({ etapaId, evento }: { etapaId: string; evento: QuandoGatilho }) {
        disparos.push({ etapaId, evento });
      },
    },
  };
}

const AGORA = new Date("2026-11-14T10:30:00");

describe("avisarQueEntrouNaEtapa", () => {
  it("dispara o gatilho do lead que entrou direto na etapa", async () => {
    const b = bancada();
    const foi = await avisarQueEntrouNaEtapa({
      workspaceId: "w1",
      etapaId: "et-novos",
      contatoNome: "Cássia",
      evento: "criado",
      agora: AGORA,
      deps: b.deps,
    });

    expect(foi).toBe(true);
    expect(b.disparos).toEqual([{ etapaId: "et-novos", evento: "criado" }]);
  });

  it("segura a repetição do mesmo evento no mesmo minuto", async () => {
    const b = bancada();
    const comum = {
      workspaceId: "w1",
      etapaId: "et-novos",
      contatoNome: "Cássia",
      evento: "criado" as const,
      agora: AGORA,
      deps: b.deps,
    };

    expect(await avisarQueEntrouNaEtapa(comum)).toBe(true);
    // O reenvio do webhook da Meta e o clique repetido chegam assim: juntos.
    expect(await avisarQueEntrouNaEtapa(comum)).toBe(false);
    expect(b.disparos).toHaveLength(1);
  });

  it("deixa entrar de novo no minuto seguinte", async () => {
    const b = bancada();
    const comum = {
      workspaceId: "w1",
      etapaId: "et-follow",
      contatoNome: "Cássia",
      evento: "movido" as const,
      deps: b.deps,
    };

    expect(await avisarQueEntrouNaEtapa({ ...comum, agora: AGORA })).toBe(true);
    // Sair da etapa e voltar depois é uma entrada NOVA, e tem que disparar outra vez.
    expect(
      await avisarQueEntrouNaEtapa({ ...comum, agora: new Date("2026-11-14T10:31:00") }),
    ).toBe(true);
    expect(b.disparos).toHaveLength(2);
  });

  it("separa movido de criado na mesma etapa e no mesmo minuto", async () => {
    const b = bancada();
    const comum = { workspaceId: "w1", etapaId: "et-novos", contatoNome: "Cássia", agora: AGORA, deps: b.deps };

    expect(await avisarQueEntrouNaEtapa({ ...comum, evento: "criado" })).toBe(true);
    expect(await avisarQueEntrouNaEtapa({ ...comum, evento: "movido" })).toBe(true);
    expect(b.disparos.map((d) => d.evento)).toEqual(["criado", "movido"]);
  });

  it("não gira pra sempre quando uma etapa manda o lead pra outra e ela devolve", async () => {
    const b = bancada();
    /*
     * O ciclo que a trava existe pra matar: a etapa A move o lead pra B, e B tem um gatilho que o
     * move de volta pra A. Sem trava, isso manda mensagem pra sempre.
     */
    const voltas: string[] = [];
    const pingue = async (etapaId: string, profundidade: number): Promise<void> => {
      if (profundidade > 50) throw new Error("girou demais: a trava não segurou");
      const foi = await avisarQueEntrouNaEtapa({
        workspaceId: "w1",
        etapaId,
        contatoNome: "Cássia",
        evento: "movido",
        agora: AGORA,
        deps: {
          ...b.deps,
          async disparar(p) {
            await b.deps.disparar(p);
            voltas.push(p.etapaId);
            await pingue(etapaId === "A" ? "B" : "A", profundidade + 1);
          },
        },
      });
      expect(typeof foi).toBe("boolean");
    };

    await pingue("A", 0);
    expect(voltas).toEqual(["A", "B"]);
  });

  it("não dispara sem etapa, sem contato ou sem workspace", async () => {
    const b = bancada();
    const base = { etapaId: "et", contatoNome: "Cássia", workspaceId: "w1", evento: "criado" as const, deps: b.deps };

    expect(await avisarQueEntrouNaEtapa({ ...base, etapaId: "" })).toBe(false);
    expect(await avisarQueEntrouNaEtapa({ ...base, contatoNome: "" })).toBe(false);
    expect(await avisarQueEntrouNaEtapa({ ...base, workspaceId: "" })).toBe(false);
    expect(b.disparos).toHaveLength(0);
  });

  it("não derruba quem chamou quando o disparo falha", async () => {
    const b = bancada();
    const foi = await avisarQueEntrouNaEtapa({
      workspaceId: "w1",
      etapaId: "et",
      contatoNome: "Cássia",
      evento: "criado",
      agora: AGORA,
      deps: {
        ...b.deps,
        async disparar() {
          throw new Error("o robô explodiu");
        },
      },
    });

    // Uma automação com problema não pode impedir a mensagem de ser gravada.
    expect(foi).toBe(false);
  });
});

describe("chaveDeEntrada", () => {
  it("é a mesma chave pro mesmo minuto e outra no minuto seguinte", () => {
    const a = chaveDeEntrada("et", "Cássia", "criado", new Date("2026-11-14T10:30:10"));
    const b = chaveDeEntrada("et", "Cássia", "criado", new Date("2026-11-14T10:30:59"));
    const c = chaveDeEntrada("et", "Cássia", "criado", new Date("2026-11-14T10:31:00"));

    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
