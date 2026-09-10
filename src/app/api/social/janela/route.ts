import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { JANELA_HORAS, pessoasNaJanela } from "@/lib/social/janela-direct";

/**
 * Quem está dentro da janela de 24 horas do Direct, agora.
 *
 * É o único público possível de um disparo por Instagram, e a tela mostra a lista ANTES de a
 * pessoa escrever a mensagem: assim ela vê que são 12 pessoas, não 4.000, e decide se vale a pena.
 * Prometer "disparo em massa" e entregar 12 seria a decepção; dizer 12 desde o começo é o produto.
 */
export type JanelaDirect = {
  janelaHoras: number;
  /** Quantos estão elegíveis AGORA: dentro da janela. É quem vai receber. */
  total: number;
  /** Quantos contatos de Instagram existem no total. O denominador da conta. */
  totalContatos: number;
  /** @ da conta conectada, quando conectada. */
  conta: string | null;
  conectado: boolean;
  pessoas: { contatoNome: string; ultimaMensagemEm: string; fechaEm: string }[];
};

export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const workspaceId = sessao.user.workspaceId;
  const [pessoas, totalContatos, integracao] = await Promise.all([
    pessoasNaJanela(workspaceId),
    // Todo mundo que tem conversa de Instagram. É o denominador honesto: dizer "37 elegíveis" sem
    // dizer "de 1.248" esconde o tamanho real da diferença, que é o ponto da tela.
    prisma.conversa.count({ where: { workspaceId, canal: "Instagram" } }),
    prisma.integracao.findUnique({
      where: { workspaceId_provedor: { workspaceId, provedor: "meta_instagram" } },
      select: { status: true, metadados: true },
    }),
  ]);

  const username = (integracao?.metadados as { username?: string } | null)?.username ?? null;
  const resposta: JanelaDirect = {
    janelaHoras: JANELA_HORAS,
    total: pessoas.length,
    totalContatos,
    conta: username ? `@${username.replace(/^@/, "")}` : null,
    conectado: integracao?.status === "conectado",
    // Teto na listagem: a contagem é a informação que decide, e mandar milhares de nomes pra tela
    // só pra ela mostrar os primeiros seria pagar banda por nada.
    pessoas: pessoas.slice(0, 50).map((p) => ({
      contatoNome: p.contatoNome,
      ultimaMensagemEm: p.ultimaMensagemEm.toISOString(),
      fechaEm: p.fechaEm.toISOString(),
    })),
  };
  return NextResponse.json(resposta, { headers: { "cache-control": "private, no-store" } });
}
