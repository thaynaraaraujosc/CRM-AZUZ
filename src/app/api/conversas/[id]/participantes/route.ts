import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buscarInfoGrupo } from "@/lib/integracoes/evolution";

/**
 * Busca AGORA a lista de participantes de um grupo, na Evolution, e guarda.
 *
 * Existe porque o conserto anterior tinha um buraco: ele preenchia a lista quando chegava mensagem
 * NOVA naquele grupo. Grupo parado — que é a maioria, a qualquer momento — continuava mostrando
 * "0 participantes" indefinidamente, sem nada que a pessoa pudesse fazer além de esperar alguém
 * escrever. Abrir o grupo é o momento natural de perguntar, e é o que esta rota atende.
 *
 * POST, e não GET, porque ela ESCREVE: guarda o que achou, pra não repetir a consulta a cada
 * abertura. Só busca quando a lista está vazia; grupo que já tem lista devolve a que tem sem sair
 * daqui.
 *
 * O NOME DO GRUPO NÃO É TOCADO: ele identifica a thread (`[workspaceId, nome]`), e trocá-lo
 * partiria a conversa em duas.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/conversas/[id]/participantes">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const conversa = await prisma.conversa.findFirst({
    // `workspaceId` da SESSÃO, nunca do cliente: sem isso, um id adivinhado leria o grupo de outra
    // empresa.
    where: { id, workspaceId: sessao.user.workspaceId },
    select: { contato: true, ehGrupo: true, participantesGrupo: true },
  });
  if (!conversa) return NextResponse.json({ erro: "Conversa não encontrada" }, { status: 404 });
  if (!conversa.ehGrupo || !conversa.contato) {
    return NextResponse.json({ erro: "Essa conversa não é um grupo" }, { status: 400 });
  }

  const jaTem = Array.isArray(conversa.participantesGrupo) && conversa.participantesGrupo.length > 0;
  if (jaTem) return NextResponse.json({ participantesGrupo: conversa.participantesGrupo });

  const info = await buscarInfoGrupo(sessao.user.workspaceId, conversa.contato).catch(() => null);
  if (!info?.participantes.length) {
    // Resposta honesta em vez de lista vazia calada: é o que permite a tela dizer "não consegui"
    // em vez de insistir que o grupo tem zero pessoas.
    return NextResponse.json(
      { participantesGrupo: [], erro: "A Evolution não devolveu os participantes deste grupo." },
      { status: 200 },
    );
  }

  await prisma.conversa.update({
    where: { id },
    data: {
      participantesGrupo: info.participantes,
      ...(info.descricao ? { descricaoGrupo: info.descricao } : {}),
      ...(info.criacao ? { criacaoGrupo: info.criacao } : {}),
    },
  });
  return NextResponse.json({ participantesGrupo: info.participantes });
}
