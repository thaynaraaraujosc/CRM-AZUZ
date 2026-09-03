import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET traz uma campanha com os destinatários — é a tela de acompanhamento, contato por contato. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const { id } = await params;

  // Filtra pelo workspace da SESSÃO, nunca só pelo id da URL: id de campanha é adivinhável, e sem
  // este filtro qualquer cliente leria a lista de contatos de outro.
  const campanha = await prisma.campanha.findFirst({
    where: { id, workspaceId: sessao.user.workspaceId },
    include: { destinatarios: { orderBy: { criadoEm: "asc" }, take: 1000 } },
  });
  if (!campanha) return NextResponse.json({ erro: "Campanha não encontrada." }, { status: 404 });

  return NextResponse.json(campanha);
}

/**
 * PATCH controla a campanha: pausar, retomar ou cancelar.
 *
 * Nenhuma das três mexe em quem já foi enviado — mensagem que saiu não volta. Elas só mudam o que
 * o worker vai fazer com o que ainda está pendente.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  const { acao } = (await request.json()) as { acao?: "pausar" | "retomar" | "cancelar" };

  const campanha = await prisma.campanha.findFirst({
    where: { id, workspaceId: sessao.user.workspaceId },
  });
  if (!campanha) return NextResponse.json({ erro: "Campanha não encontrada." }, { status: 404 });

  if (acao === "pausar") {
    if (!["agendada", "enviando"].includes(campanha.status)) {
      return NextResponse.json({ erro: "Só dá pra pausar campanha agendada ou enviando." }, { status: 409 });
    }
    await prisma.campanha.update({ where: { id }, data: { status: "pausada" } });
    return NextResponse.json({ ok: true, status: "pausada" });
  }

  if (acao === "retomar") {
    if (campanha.status !== "pausada") {
      return NextResponse.json({ erro: "Só dá pra retomar campanha pausada." }, { status: 409 });
    }
    await prisma.campanha.update({ where: { id }, data: { status: "enviando" } });
    return NextResponse.json({ ok: true, status: "enviando" });
  }

  if (acao === "cancelar") {
    if (["concluida", "concluida_com_erros", "cancelada"].includes(campanha.status)) {
      return NextResponse.json({ erro: "Campanha já terminou." }, { status: 409 });
    }
    // Só o que ainda não saiu vira "cancelado". Quem já recebeu continua registrado como enviado —
    // o histórico tem que contar o que realmente aconteceu.
    await prisma.$transaction([
      prisma.campanhaDestinatario.updateMany({
        where: { campanhaId: id, status: "pendente" },
        data: { status: "cancelado" },
      }),
      prisma.campanha.update({
        where: { id },
        data: { status: "cancelada", concluidaEm: new Date() },
      }),
    ]);
    return NextResponse.json({ ok: true, status: "cancelada" });
  }

  return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });
}
