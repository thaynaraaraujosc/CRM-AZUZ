import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET lista o histórico de relatórios já gerados do workspace, mais recentes primeiro — antes só
 * vivia no localStorage do navegador (perdia ao trocar de dispositivo) e conta nova começava com
 * 3 relatórios de exemplo fictícios; agora é sempre o histórico real, vazio até o primeiro
 * relatório de verdade ser gerado. */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const linhas = await prisma.relatorioGerado.findMany({
    where: { workspaceId: sessao.user.workspaceId },
    orderBy: { criadoEm: "desc" },
  });

  return NextResponse.json(
    linhas.map((r) => ({
      id: r.id,
      nome: r.nome,
      tipo: r.tipo,
      contato: r.contato ?? undefined,
      periodo: r.periodo,
      filtros: r.filtros,
      autor: r.autor,
      data: r.criadoEm.toLocaleDateString("pt-BR"),
      paginas: r.paginas,
      formato: r.formato,
      configuracao: r.configuracao,
    })),
  );
}

type CorpoCriarRelatorio = {
  id: string;
  nome: string;
  tipo: string;
  contato?: string;
  periodo: string;
  filtros: string;
  autor: string;
  paginas: number;
  formato: string;
  configuracao: unknown;
};

/** POST registra um relatório recém-gerado — histórico é sempre apêndice (nunca editado ou
 * reordenado depois de criado), então não precisa de PUT de estado inteiro como Funil/Tarefas. */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const corpo = (await request.json()) as CorpoCriarRelatorio;
  if (!corpo.nome || !corpo.tipo || !corpo.periodo || !corpo.autor || !corpo.formato) {
    return NextResponse.json({ erro: "Dados incompletos." }, { status: 400 });
  }

  const relatorio = await prisma.relatorioGerado.create({
    data: {
      id: corpo.id || `relatorio-${sessao.user.workspaceId}-${Date.now()}`,
      workspaceId: sessao.user.workspaceId,
      nome: corpo.nome,
      tipo: corpo.tipo,
      contato: corpo.contato,
      periodo: corpo.periodo,
      filtros: corpo.filtros,
      autor: corpo.autor,
      paginas: corpo.paginas,
      formato: corpo.formato,
      configuracao: corpo.configuracao ?? {},
    },
  });

  return NextResponse.json(relatorio, { status: 201 });
}
