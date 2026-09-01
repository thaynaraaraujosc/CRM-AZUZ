import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Criar e apagar funil/etapa — gravado na hora, e não pelo PUT de estado inteiro.
 *
 * Criar era a operação mais frágil do módulo: dependia de um PUT debouçado que reconciliava o funil
 * inteiro dentro de uma transação única. Qualquer falha em qualquer parte descartava tudo — e como
 * o cliente não olhava a resposta, o funil novo simplesmente não existia depois do F5, sem erro,
 * sem aviso, sem pista.
 *
 * A exclusão vive aqui pelo motivo oposto: ela precisa PODER RECUSAR. `FunilEtapa` e `NegocioCard`
 * têm `onDelete: Cascade` no banco, então apagar uma etapa levava junto todos os negócios dela,
 * silenciosamente e sem volta. Aqui a exclusão só acontece quando não há negócio pendurado, ou
 * quando quem chama diz explicitamente para onde mover os que existem.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const corpo = (await request.json()) as {
    tipo?: "funil" | "etapa";
    id?: string;
    nome?: string;
    responsavel?: string | null;
    funilId?: string;
    etapas?: { id: string; titulo: string }[];
  };

  if (corpo.tipo === "funil") {
    if (!corpo.id || !corpo.nome) {
      return NextResponse.json({ erro: "id e nome são obrigatórios" }, { status: 400 });
    }
    await prisma.funil.create({
      data: {
        id: corpo.id,
        workspaceId,
        nome: corpo.nome,
        responsavel: corpo.responsavel ?? null,
        etapas: {
          create: (corpo.etapas ?? []).map((etapa, ordem) => ({
            id: etapa.id,
            workspaceId,
            titulo: etapa.titulo,
            ordem,
          })),
        },
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (corpo.tipo === "etapa") {
    if (!corpo.id || !corpo.nome || !corpo.funilId) {
      return NextResponse.json({ erro: "id, nome e funilId são obrigatórios" }, { status: 400 });
    }
    // O funil precisa ser desta empresa — id de outro workspace não vira etapa aqui.
    const funil = await prisma.funil.findFirst({ where: { id: corpo.funilId, workspaceId }, select: { id: true } });
    if (!funil) return NextResponse.json({ erro: "Funil não encontrado." }, { status: 404 });

    const ultima = await prisma.funilEtapa.findFirst({
      where: { funilId: corpo.funilId },
      orderBy: { ordem: "desc" },
      select: { ordem: true },
    });
    await prisma.funilEtapa.create({
      data: {
        id: corpo.id,
        workspaceId,
        funilId: corpo.funilId,
        titulo: corpo.nome,
        ordem: (ultima?.ordem ?? -1) + 1,
      },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ erro: "tipo inválido" }, { status: 400 });
}

/**
 * Apaga uma etapa ou um funil — recusando quando há negócio dentro.
 *
 * `?destinoEtapaId=` move os negócios antes de apagar. Sem ele, e havendo negócios, a resposta é
 * 409 com a contagem: quem chama decide o que fazer, em vez de descobrir depois que os leads
 * sumiram junto.
 */
export async function DELETE(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const url = new URL(request.url);
  const tipo = url.searchParams.get("tipo");
  const id = url.searchParams.get("id");
  const destinoEtapaId = url.searchParams.get("destinoEtapaId");
  if (!id || (tipo !== "funil" && tipo !== "etapa")) {
    return NextResponse.json({ erro: "tipo e id são obrigatórios" }, { status: 400 });
  }

  const onde = tipo === "etapa" ? { workspaceId, etapaId: id } : { workspaceId, etapa: { funilId: id } };

  const negocios = await prisma.negocioCard.count({ where: onde });

  if (negocios > 0) {
    if (!destinoEtapaId) {
      return NextResponse.json(
        {
          erro:
            `Existem ${negocios} negócios aqui dentro. Escolha para onde movê-los antes de apagar — ` +
            "apagar levaria o histórico deles junto.",
          negocios,
          precisaDestino: true,
        },
        { status: 409 },
      );
    }
    const destino = await prisma.funilEtapa.findFirst({
      where: { id: destinoEtapaId, workspaceId },
      select: { id: true },
    });
    if (!destino) return NextResponse.json({ erro: "Etapa de destino não encontrada." }, { status: 400 });

    await prisma.negocioCard.updateMany({ where: onde, data: { etapaId: destinoEtapaId } });
  }

  if (tipo === "etapa") {
    await prisma.funilEtapa.deleteMany({ where: { id, workspaceId } });
  } else {
    await prisma.funil.deleteMany({ where: { id, workspaceId } });
  }

  return NextResponse.json({ ok: true, movidos: negocios });
}
