import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reprocessarConversao, resumoDaFila } from "@/lib/rastreio/fila-de-conversoes";

/**
 * O HISTÓRICO DA FILA DE CONVERSÕES, do workspace de quem está logado.
 *
 * Só do próprio workspace, sempre: quais campanhas rendem venda é informação comercial sensível,
 * e vazar isso entre clientes do CRM seria entregar a estratégia de um pro outro.
 *
 * Nenhum identificador sai daqui — nem e-mail, nem telefone, nem código de clique. O que a tela
 * precisa é o que aconteceu com cada conversão, e isso cabe no resumo que a fila já grava.
 */
export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const url = new URL(request.url);
  const contatoId = url.searchParams.get("contatoId");
  const status = url.searchParams.get("status");

  const linhas = await prisma.eventoDeConversao.findMany({
    where: {
      workspaceId,
      ...(contatoId ? { contatoId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { criadoEm: "desc" },
    take: 100,
    select: {
      id: true,
      contatoId: true,
      plataforma: true,
      evento: true,
      eventoEm: true,
      valor: true,
      moeda: true,
      status: true,
      tentativas: true,
      proximaEm: true,
      motivo: true,
      resumoPedido: true,
      resumoResposta: true,
      enviadoEm: true,
      criadoEm: true,
    },
  });

  return NextResponse.json({
    eventos: linhas.map((l) => ({ ...l, valor: l.valor ? Number(l.valor) : null })),
    // Só quando a tela pede o painel inteiro: contar por status num pedido de ficha de lead seria
    // uma consulta a mais em cada contato aberto.
    resumo: contatoId ? null : await resumoDaFila(prisma, workspaceId),
  });
}

/** Põe uma linha de volta na fila. Reprocessar o que JÁ FOI enviado é recusado, não ignorado. */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = (await request.json()) as { id?: string };
  if (!id) return NextResponse.json({ erro: "id é obrigatório" }, { status: 400 });

  const feito = await reprocessarConversao(prisma, sessao.user.workspaceId, id);
  if (!feito) {
    return NextResponse.json(
      {
        erro:
          "Essa conversão não pode ser reprocessada. Só falha e 'não enviado' voltam pra fila — reenviar o que já chegou produziria a venda em dobro no relatório da plataforma.",
      },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
