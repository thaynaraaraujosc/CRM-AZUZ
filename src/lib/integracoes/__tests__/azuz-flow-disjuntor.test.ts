import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O disjuntor existe contra a INSISTÊNCIA, não contra a falha.
 *
 * Um número bloqueado ou uma instância caída fazem todo envio falhar. Sem disjuntor, a fila bateria
 * na porta fechada de minuto em minuto, por horas — e é assim que uma conta que estava só instável
 * vira uma conta banida. Então o que está provado aqui é: ele pausa UMA vez, avisa UMA vez, e só
 * volta por decisão de gente.
 */

let guardado: Record<string, unknown> | null = null;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    preferencia: {
      findUnique: async () => (guardado ? { dados: guardado } : null),
      upsert: async ({ create, update }: { create: { dados: Record<string, unknown> }; update: { dados: Record<string, unknown> } }) => {
        guardado = update.dados ?? create.dados;
        return { dados: guardado };
      },
    },
    membro: {
      findMany: async () => [{ email: "admin@agencia.com.br", nome: "Thaynara" }],
    },
  },
}));

const emails: { to: string; subject: string }[] = [];
vi.mock("@/lib/email", () => ({
  enviarEmail: async (p: { to: string; subject: string }) => {
    emails.push(p);
    return { ok: true };
  },
}));

const { lerDisjuntor, registrarFalha, registrarSucesso, religarDisjuntor } = await import("../azuz-flow-disjuntor");

async function falhar(motivo = "a conexão do WhatsApp está desconectada") {
  return registrarFalha({ workspaceId: "w1", motivo, falhasParaPausar: 3 });
}

beforeEach(() => {
  guardado = null;
  emails.length = 0;
});

describe("contagem", () => {
  it("falha isolada não pausa nada", async () => {
    expect(await falhar()).toBe(false);

    const estado = await lerDisjuntor("w1");
    expect(estado.falhasSeguidas).toBe(1);
    expect(estado.pausadoEm).toBeNull();
    expect(emails).toHaveLength(0);
  });

  it("um envio bom no meio zera a contagem", async () => {
    // Somar falhas ao longo de dias pausaria o canal por acaso, num dia em que ele está bom.
    await falhar();
    await falhar();
    await registrarSucesso("w1");

    expect((await lerDisjuntor("w1")).falhasSeguidas).toBe(0);

    expect(await falhar()).toBe(false);
    expect((await lerDisjuntor("w1")).pausadoEm).toBeNull();
  });
});

describe("a transição", () => {
  it("pausa na enésima falha, e só ela devolve true", async () => {
    expect(await falhar()).toBe(false);
    expect(await falhar()).toBe(false);
    expect(await falhar()).toBe(true);

    const estado = await lerDisjuntor("w1");
    expect(estado.pausadoEm).not.toBeNull();
    expect(estado.ultimoMotivo).toBe("a conexão do WhatsApp está desconectada");
  });

  it("o e-mail sai uma vez, não a cada falha depois da pausa", async () => {
    await falhar();
    await falhar();
    await falhar();
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe("admin@agencia.com.br");

    // Já pausado: as falhas seguintes não mexem em nada nem mandam e-mail. Um disjuntor que manda
    // e-mail em laço é a própria insistência que ele existe pra impedir.
    expect(await falhar()).toBe(false);
    expect(await falhar()).toBe(false);
    expect(emails).toHaveLength(1);
  });
});

describe("voltar", () => {
  it("só por decisão de gente, e volta zerado", async () => {
    await falhar();
    await falhar();
    await falhar();
    expect((await lerDisjuntor("w1")).pausadoEm).not.toBeNull();

    await religarDisjuntor("w1");

    const estado = await lerDisjuntor("w1");
    expect(estado).toEqual({ falhasSeguidas: 0, pausadoEm: null, ultimoMotivo: null });
  });

  it("depois de religar, a contagem começa de novo do zero", async () => {
    await falhar();
    await falhar();
    await falhar();
    await religarDisjuntor("w1");

    expect(await falhar()).toBe(false);
    expect((await lerDisjuntor("w1")).falhasSeguidas).toBe(1);
  });
});
