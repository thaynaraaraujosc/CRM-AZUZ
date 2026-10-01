import { afterEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { encriptar } from "@/lib/integracoes/crypto";
import { renovarTokensDoInstagram } from "@/lib/integracoes/renovar-tokens";

process.env.INTEGRACAO_ENCRYPTION_KEY ??= "chave-so-de-teste-nao-usada-em-producao";

/**
 * O que se testa aqui é a DECISÃO, não a API da Meta: quem entra na rodada, o que fica gravado
 * quando dá certo, e o que fica gravado quando a Meta recusa.
 *
 * Essa última parte é a que importa de verdade. Token do Instagram que vence não avisa: a conta
 * continua marcada como conectada, as mensagens continuam chegando, e só o que depende da Meta
 * para de funcionar — miniatura de story, prévia de reel, anexo, foto de perfil. Quem usa conclui
 * que "o Instagram quebrou". Se a renovação falhar e isso não ficar escrito na integração, o CRM
 * volta a ficar sem ter como dizer que a reconexão é necessária.
 *
 * Banco e rede são dublados: o primeiro porque a suíte precisa rodar em qualquer máquina, a
 * segunda porque chamar a Meta num teste tornaria o resultado dependente da internet.
 */

type Integracao = {
  id: string;
  workspaceId: string;
  accessTokenCriptografado: string | null;
  expiraEm: Date | null;
};

function bancoFalso(linhas: Integracao[]) {
  const atualizacoes: { id: string; data: Record<string, unknown> }[] = [];
  const consultas: Record<string, unknown>[] = [];
  const cliente = {
    integracao: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        consultas.push(args.where);
        return linhas;
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        atualizacoes.push({ id: args.where.id, data: args.data });
        return {};
      },
    },
  } as unknown as PrismaClient;
  return { cliente, atualizacoes, consultas };
}

const original = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = original;
  vi.restoreAllMocks();
});

describe("renovação do token do Instagram", () => {
  it("só procura integrações conectadas que estão perto de vencer", async () => {
    const { cliente, consultas } = bancoFalso([]);
    await renovarTokensDoInstagram(cliente);

    expect(consultas).toHaveLength(1);
    const where = consultas[0] as { provedor: string; status: string; expiraEm: { lte: Date } };
    expect(where.provedor).toBe("meta_instagram");
    expect(where.status).toBe("conectado");

    // A folga precisa ser pra FRENTE: a Meta não renova token já vencido, só token válido. Uma
    // folga pro passado faria a rodada acordar sempre tarde demais.
    const daquiA = where.expiraEm.lte.getTime() - Date.now();
    expect(daquiA).toBeGreaterThan(0);
  });

  it("grava o token novo e limpa o erro quando a Meta renova", async () => {
    const { cliente, atualizacoes } = bancoFalso([
      {
        id: "i1",
        workspaceId: "ws",
        accessTokenCriptografado: encriptar("token-velho"),
        expiraEm: new Date(),
      },
    ]);
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ access_token: "token-novo", expires_in: 5_184_000 }), { status: 200 }),
    ) as unknown as typeof fetch;

    const resultado = await renovarTokensDoInstagram(cliente);

    expect(resultado).toEqual({ renovados: 1, falharam: 0 });
    expect(atualizacoes).toHaveLength(1);
    const dados = atualizacoes[0].data as { expiraEm: Date; erroMensagem: null; accessTokenCriptografado: string };
    expect(dados.erroMensagem).toBeNull();
    expect(dados.expiraEm.getTime()).toBeGreaterThan(Date.now());
    // O token vai cifrado pro banco, nunca em texto puro.
    expect(dados.accessTokenCriptografado).not.toContain("token-novo");
  });

  it("deixa escrito na integração quando a Meta recusa, em vez de falhar calada", async () => {
    const { cliente, atualizacoes } = bancoFalso([
      {
        id: "i1",
        workspaceId: "ws",
        accessTokenCriptografado: encriptar("token-morto"),
        expiraEm: new Date(),
      },
    ]);
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: "Session has expired" } }), { status: 400 }),
    ) as unknown as typeof fetch;
    vi.spyOn(console, "error").mockImplementation(() => {});

    const resultado = await renovarTokensDoInstagram(cliente);

    expect(resultado).toEqual({ renovados: 0, falharam: 1 });
    const dados = atualizacoes[0].data as { erroMensagem: string };
    expect(dados.erroMensagem).toContain("Reconecte");
    // E o token velho continua onde estava: substituí-lo por nada deixaria a conta sem credencial
    // nenhuma, o que é pior do que uma credencial vencida.
    expect(dados).not.toHaveProperty("accessTokenCriptografado");
  });
});
