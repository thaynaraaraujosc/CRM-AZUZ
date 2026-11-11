import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * A ORDEM DOS FUNIS, gravada na hora em que alguém solta o que arrastou.
 *
 * "Conseguindo arrastar no menu lateral o funil — eu quero que o funil azul seja o primeiro.
 * Porque eu quero que lá no chat também ele seja as primeiras respostas."
 *
 * Rota própria, e não o PUT do quadro inteiro: a ordem é uma escrita pequena e imediata, e
 * pendurá-la na reconciliação do funil inteiro traria de volta exatamente o problema que aquela
 * rota já custou caro pra resolver — a transação grande que estoura o prazo e devolve "o banco
 * demorou demais pra responder".
 *
 * A LISTA PRECISA SER COMPLETA. Gravar só o que mudou de lugar deixaria buracos na numeração e,
 * com dois funis na mesma `ordem`, a lista voltaria a embaralhar sozinha. Então quem chama manda
 * todos, na ordem final, e aqui cada um recebe a posição dele.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const { ids } = (await request.json().catch(() => ({}))) as { ids?: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ erro: "ids é obrigatório" }, { status: 400 });
  }

  /*
   * SÓ OS FUNIS DESTA EMPRESA, conferido antes de escrever.
   *
   * Id de funil é adivinhável, e sem esta conferência um id de outro cliente entraria no
   * `updateMany` — que filtra por workspace e não gravaria nada, mas a resposta diria "ok" e a
   * tela mostraria uma ordem que não existe no banco.
   */
  const daEmpresa = await prisma.funil.findMany({
    where: { workspaceId, id: { in: ids } },
    select: { id: true },
  });
  const validos = ids.filter((id) => daEmpresa.some((f) => f.id === id));
  if (!validos.length) return NextResponse.json({ erro: "Nenhum funil desta conta." }, { status: 400 });

  // Uma instrução por funil, sem transação: são escritas de uma coluna só, e a ordem ficar pela
  // metade por um segundo é melhor do que a transação inteira estourar o prazo. A próxima arrastada
  // regrava tudo de qualquer jeito.
  for (const [posicao, id] of validos.entries()) {
    await prisma.funil.updateMany({ where: { workspaceId, id }, data: { ordem: posicao } });
  }

  return NextResponse.json({ ok: true, ordenados: validos.length });
}
