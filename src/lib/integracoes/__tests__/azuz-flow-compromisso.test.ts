import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReuniaoDoFlow } from "../azuz-flow-payload";

type LinhaCriada = {
  id: string;
  contato: string;
  contatoId: string | null;
  dataIso: string;
  hora: string;
  horaFim: string | null;
  local: string | null;
  tipo: string;
  status: string;
  origem: string;
};

const criadas = new Map<string, LinhaCriada>();

function duplicada() {
  return Object.assign(new Error("Unique constraint failed on the constraint: PRIMARY"), { code: "P2002" });
}

/**
 * O banco de mentira impõe a CHAVE PRIMÁRIA, que é o ponto do teste.
 *
 * A idempotência do compromisso não vem de um `if (já existe)` no código: vem de o id ser derivado
 * da entrega. Quem garante isso é a chave primária do banco, então o dublê precisa recusar o id
 * repetido — senão o teste passaria mesmo se a idempotência não existisse.
 */
vi.mock("@/lib/prisma", () => ({
  prisma: {
    compromisso: {
      create: async ({ data }: { data: LinhaCriada }) => {
        if (criadas.has(data.id)) throw duplicada();
        criadas.set(data.id, data);
        return data;
      },
    },
  },
}));

const { dependenciasReais } = await import("../azuz-flow-lead");

const reuniao: ReuniaoDoFlow = {
  inicio: new Date("2026-10-20T17:00:00Z"),
  fim: new Date("2026-10-20T17:30:00Z"),
  link: "https://meet.google.com/abc-defg-hij",
};

function gravar(chaveDaEntrega: string, dados: ReuniaoDoFlow = reuniao) {
  return dependenciasReais("w1").garantirCompromisso({
    chaveDaEntrega,
    contatoId: "w1-ana-souza",
    contatoNome: "Ana Souza",
    formularioNome: "Diagnóstico",
    reuniao: dados,
  });
}

beforeEach(() => criadas.clear());

describe("a reunião do Flow virando compromisso", () => {
  it("grava dia e hora no fuso de Brasília, não em UTC", async () => {
    await gravar("resp-1");
    const linha = [...criadas.values()][0];
    expect(linha.dataIso).toBe("2026-10-20");
    expect(linha.hora).toBe("14:00");
    expect(linha.horaFim).toBe("14:30");
  });

  it("na virada de dia, guarda o dia de Brasília", async () => {
    // 23h30 de Brasília é 02h30 do dia SEGUINTE em UTC. Guardar o dia de UTC faria o CRM dizer ao
    // cliente "sua reunião é dia 21 às 02:30".
    await gravar("resp-virada", { inicio: new Date("2026-10-21T02:30:00Z"), fim: null, link: null });
    const linha = [...criadas.values()][0];
    expect(linha.dataIso).toBe("2026-10-20");
    expect(linha.hora).toBe("23:30");
  });

  it("guarda o link como local, com tipo e origem do Flow", async () => {
    await gravar("resp-1");
    expect([...criadas.values()][0]).toMatchObject({
      local: "https://meet.google.com/abc-defg-hij",
      tipo: "Reunião",
      status: "agendado",
      origem: "azuz-flow",
      contatoId: "w1-ana-souza",
      contato: "Ana Souza",
    });
  });

  it("a MESMA entrega repetida não cria um segundo compromisso", async () => {
    await gravar("resp-1");
    await gravar("resp-1");
    await gravar("resp-1");
    expect(criadas.size).toBe(1);
  });

  it("duas chamadas simultâneas com a mesma entrega também criam uma só", async () => {
    await Promise.all([gravar("resp-1"), gravar("resp-1"), gravar("resp-1")]);
    expect(criadas.size).toBe(1);
  });

  it("entregas diferentes criam compromissos diferentes", async () => {
    await Promise.all([gravar("resp-1"), gravar("resp-2")]);
    expect(criadas.size).toBe(2);
  });

  it("erro que não é chave repetida continua subindo", async () => {
    // Senão um defeito de verdade (coluna errada, banco fora do ar) viraria "gravou" em silêncio.
    criadas.set("qualquer", {} as LinhaCriada);
    const prisma = (await import("@/lib/prisma")).prisma as unknown as {
      compromisso: { create: (a: unknown) => Promise<unknown> };
    };
    const original = prisma.compromisso.create;
    prisma.compromisso.create = async () => {
      throw new Error("banco fora do ar");
    };
    await expect(gravar("resp-9")).rejects.toThrow("banco fora do ar");
    prisma.compromisso.create = original;
  });
});
