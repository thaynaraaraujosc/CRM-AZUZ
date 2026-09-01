import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Linha do tempo de um lead — o que aconteceu com ele, em ordem, em qualquer canal.
 *
 * Diferente do histórico de mensagens: aqui entram também os acontecimentos que não são mensagem
 * (comentou numa publicação, a automação disparou, o CRM respondeu, entrou no funil). É esse
 * encadeamento que responde "por que essa pessoa está falando com a gente?", e é o formato que a
 * Inteligência Comercial e a IA vão consumir depois.
 */
export const dynamic = "force-dynamic";

const LIMITE = 100;

export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const contato = new URL(request.url).searchParams.get("contato");
  if (!contato) return NextResponse.json({ erro: "contato é obrigatório" }, { status: 400 });

  const eventos = await prisma.eventoDoLead.findMany({
    where: { workspaceId: sessao.user.workspaceId, contatoNome: contato },
    orderBy: { criadoEm: "desc" },
    take: LIMITE,
  });

  return NextResponse.json(
    {
      eventos: eventos.map((e) => ({
        id: e.id,
        tipo: e.tipo,
        canal: e.canal,
        descricao: e.descricao,
        criadoEm: e.criadoEm.toISOString(),
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
