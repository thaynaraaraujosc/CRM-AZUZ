import { beforeEach, describe, expect, it, vi } from "vitest";

type Linha = { workspaceId: string; contato: string; dataIso: string; hora: string; local: string | null; status: string };

let agenda: Linha[] = [];

/**
 * Um Prisma de mentira que FILTRA de verdade.
 *
 * Devolver a lista inteira esconderia o que mais importa aqui: a consulta filtra por DIA e a hora
 * é conferida em memória. Um dublê que ignora o `where` passaria mesmo se a consulta estivesse
 * errada, que é o defeito que este teste existe pra pegar.
 */
vi.mock("@/lib/prisma", () => ({
  prisma: {
    compromisso: {
      findMany: async (args: {
        where: {
          workspaceId: string;
          contato: string | { in: string[] };
          status: { notIn: string[] };
          dataIso: { gte: string };
        };
        take?: number;
      }) => {
        const w = args.where;
        const nomes = typeof w.contato === "string" ? [w.contato] : w.contato.in;
        const filtradas = agenda
          .filter((l) => l.workspaceId === w.workspaceId)
          .filter((l) => nomes.includes(l.contato))
          .filter((l) => !w.status.notIn.includes(l.status))
          .filter((l) => l.dataIso >= w.dataIso.gte)
          .sort((a, b) => (a.dataIso === b.dataIso ? a.hora.localeCompare(b.hora) : a.dataIso.localeCompare(b.dataIso)));
        return args.take ? filtradas.slice(0, args.take) : filtradas;
      },
    },
  },
}));

const { proximaReuniaoDoContato, proximasReunioesPorContato } = await import("../proxima-reuniao");

function marcar(parcial: Partial<Linha> & { dataIso: string; hora: string }): Linha {
  return {
    workspaceId: "w1",
    contato: "Ana Souza",
    local: null,
    status: "agendado",
    ...parcial,
  };
}

/** 20/10/2026 às 10:00 em Brasília (13:00 UTC). */
const AGORA = new Date("2026-10-20T13:00:00Z");

beforeEach(() => {
  agenda = [];
});

describe("a próxima reunião do contato", () => {
  it("devolve null quando o contato não tem reunião nenhuma", async () => {
    expect(await proximaReuniaoDoContato("w1", "Ana Souza", AGORA)).toBeNull();
  });

  it("ignora reunião que já passou", async () => {
    agenda = [marcar({ dataIso: "2026-10-01", hora: "14:00" })];
    expect(await proximaReuniaoDoContato("w1", "Ana Souza", AGORA)).toBeNull();
  });

  it("ignora a reunião de HOJE cuja hora já passou", async () => {
    // Às 10h de Brasília, a das 9h já aconteceu e a das 15h não. Filtrar só por dia pegaria a
    // errada, e a mensagem sairia confirmando um horário que ficou atrás.
    agenda = [marcar({ dataIso: "2026-10-20", hora: "09:00" }), marcar({ dataIso: "2026-10-20", hora: "15:00" })];
    const r = await proximaReuniaoDoContato("w1", "Ana Souza", AGORA);
    expect(r?.hora).toBe("15:00");
  });

  it("com duas reuniões futuras, devolve a PRIMEIRA", async () => {
    agenda = [
      marcar({ dataIso: "2026-11-05", hora: "09:00" }),
      marcar({ dataIso: "2026-10-22", hora: "16:30" }),
    ];
    const r = await proximaReuniaoDoContato("w1", "Ana Souza", AGORA);
    expect(r).toMatchObject({ dataIso: "2026-10-22", hora: "16:30" });
  });

  it("no mesmo dia, devolve a de hora mais cedo", async () => {
    agenda = [marcar({ dataIso: "2026-10-22", hora: "18:00" }), marcar({ dataIso: "2026-10-22", hora: "11:00" })];
    expect((await proximaReuniaoDoContato("w1", "Ana Souza", AGORA))?.hora).toBe("11:00");
  });

  it("ignora reunião cancelada e cai na seguinte", async () => {
    agenda = [
      marcar({ dataIso: "2026-10-21", hora: "10:00", status: "cancelado" }),
      marcar({ dataIso: "2026-10-28", hora: "10:00" }),
    ];
    expect((await proximaReuniaoDoContato("w1", "Ana Souza", AGORA))?.dataIso).toBe("2026-10-28");
  });

  it("não enxerga a agenda de outro workspace", async () => {
    agenda = [marcar({ workspaceId: "w2", dataIso: "2026-10-22", hora: "10:00" })];
    expect(await proximaReuniaoDoContato("w1", "Ana Souza", AGORA)).toBeNull();
  });

  it("só trata o local como link quando é um endereço", async () => {
    agenda = [marcar({ dataIso: "2026-10-22", hora: "10:00", local: "Sala 2" })];
    expect((await proximaReuniaoDoContato("w1", "Ana Souza", AGORA))?.link).toBeNull();

    agenda = [marcar({ dataIso: "2026-10-22", hora: "10:00", local: "https://meet.google.com/abc" })];
    expect((await proximaReuniaoDoContato("w1", "Ana Souza", AGORA))?.link).toBe("https://meet.google.com/abc");
  });
});

describe("a próxima reunião de muitos contatos", () => {
  it("devolve a próxima de cada um, numa consulta só", async () => {
    agenda = [
      marcar({ contato: "Ana Souza", dataIso: "2026-11-01", hora: "09:00" }),
      marcar({ contato: "Ana Souza", dataIso: "2026-10-22", hora: "09:00" }),
      marcar({ contato: "Bruno Lima", dataIso: "2026-10-25", hora: "14:00" }),
      marcar({ contato: "Carla Dias", dataIso: "2026-10-02", hora: "14:00" }),
    ];
    const mapa = await proximasReunioesPorContato("w1", ["Ana Souza", "Bruno Lima", "Carla Dias"], AGORA);
    expect(mapa.get("Ana Souza")?.dataIso).toBe("2026-10-22");
    expect(mapa.get("Bruno Lima")?.dataIso).toBe("2026-10-25");
    // Carla só tem reunião no passado: fica de fora, e aí vale a reserva ou o envio não sai.
    expect(mapa.has("Carla Dias")).toBe(false);
  });

  it("lista vazia não vai ao banco", async () => {
    agenda = [marcar({ dataIso: "2026-10-22", hora: "10:00" })];
    expect((await proximasReunioesPorContato("w1", [], AGORA)).size).toBe(0);
  });
});
