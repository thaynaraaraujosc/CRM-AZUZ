import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { iniciarFluxoComEstado } from "@/lib/automacoes/iniciar";

/**
 * Roda um fluxo agora, para um contato, porque alguém pediu — o botão "rodar automação" dentro da
 * conversa.
 *
 * Antes isso rodava no navegador e as mensagens do fluxo eram SIMULADAS: apareciam na conversa
 * como se tivessem sido enviadas, sem terem saído. Aqui é o motor de verdade, com as ações de
 * verdade.
 *
 * Como é um pedido explícito, não avalia gatilho nem se o fluxo está pausado — mas exige uma
 * versão publicada, porque rodar o rascunho de alguém em cima de um cliente real seria pior.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/automacoes-fluxos/[id]/rodar">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const { id } = await ctx.params;
  const { contatoNome } = (await request.json()) as { contatoNome?: string };
  if (!contatoNome) return NextResponse.json({ erro: "contatoNome é obrigatório" }, { status: 400 });

  const fluxo = await prisma.fluxoAutomacao.findFirst({ where: { id, workspaceId } });
  if (!fluxo) return NextResponse.json({ erro: "Fluxo não encontrado" }, { status: 404 });

  const contato = await prisma.contato.findUnique({ where: { workspaceId_nome: { workspaceId, nome: contatoNome } } });

  const fim = await iniciarFluxoComEstado({
    workspaceId,
    fluxoId: id,
    gatilho: "manual",
    // Rodar à mão é uma decisão de quem está atendendo: as regras de "uma vez por contato" não se
    // aplicam, senão o botão simplesmente não faria nada e ninguém entenderia por quê.
    configuracoes: {},
    contatoNome,
    contatoId: contato?.id ?? null,
    contato: {
      ...(contato ?? {}),
      nome: contatoNome,
      etiquetas: Array.isArray(contato?.etiquetas) ? (contato.etiquetas as string[]) : [],
    },
  });

  if (!fim) {
    return NextResponse.json(
      { erro: "Esse fluxo ainda não foi publicado — publique antes de rodar num contato de verdade." },
      { status: 400 },
    );
  }

  await prisma.fluxoAutomacao.update({ where: { id }, data: { execucoes: { increment: 1 } } }).catch(() => {});
  return NextResponse.json({ ok: true, ...fim });
}
