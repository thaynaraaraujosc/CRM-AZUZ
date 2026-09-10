import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET traz uma campanha com os destinatários. É a tela de acompanhamento, contato por contato. */
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
 * Nenhuma das três mexe em quem já foi enviado. Mensagem que saiu não volta. Elas só mudam o que
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
    // Só o que ainda não saiu vira "cancelado". Quem já recebeu continua registrado como enviado.
    // O histórico tem que contar o que realmente aconteceu.
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

/**
 * DELETE apaga o disparo do histórico.
 *
 * Apaga a CAMPANHA e as linhas de destinatário dela (`onDelete: Cascade` no schema). Não apaga, e
 * não poderia apagar, as mensagens que já saíram: elas estão na conversa de cada pessoa, no CRM e
 * no aparelho de quem recebeu. Sumir com o registro do disparo não desfaz o envio, e a tela diz
 * isso antes de confirmar.
 *
 * Campanha VIVA não é apagada. Uma campanha "enviando" tem um worker rodando em cima dela: apagar
 * a linha no meio disso deixaria o worker escrevendo num id que não existe mais, e o pedaço já
 * enviado viraria mensagem sem registro nenhum. Quem quer parar uma campanha em andamento usa
 * "cancelar" no PATCH acima, que é a ação feita pra isso; depois de cancelada, ela pode ser
 * apagada normalmente.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const { id } = await params;

  // Pelo workspace da SESSÃO, nunca só pelo id da URL: id é adivinhável, e sem este filtro um
  // cliente apagaria o histórico de outro.
  const campanha = await prisma.campanha.findFirst({
    where: { id, workspaceId: sessao.user.workspaceId },
    select: { id: true, status: true },
  });
  if (!campanha) return NextResponse.json({ erro: "Disparo não encontrado." }, { status: 404 });

  if (["agendada", "enviando", "pausada"].includes(campanha.status)) {
    return NextResponse.json(
      {
        erro:
          "Este disparo ainda está ativo. Cancele ele primeiro; depois de cancelado dá pra apagar do histórico.",
      },
      { status: 409 },
    );
  }

  await prisma.campanha.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
