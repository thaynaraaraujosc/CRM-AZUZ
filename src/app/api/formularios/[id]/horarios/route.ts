import { NextResponse } from "next/server";

import { hojeEmBrasilia, somarDias } from "@/lib/agenda/fuso";
import { prisma } from "@/lib/prisma";
import type { Formulario } from "@/lib/formularios-context";
import { horariosLivres } from "@/lib/formularios/agendamento";
import { agendaDoFormulario, ocupadosDoWorkspace } from "@/lib/formularios/agendamento-servidor";

/**
 * OS DIAS E HORÁRIOS QUE O FORMULÁRIO AINDA TEM LIVRES.
 *
 * Pública, como o resto de `/api/formularios`: quem responde não tem sessão. O workspace sai do
 * id do formulário na URL, nunca de quem chamou — senão qualquer pessoa com um id em mãos leria a
 * agenda de outra empresa.
 *
 * DEVOLVE SÓ O QUE ESTÁ LIVRE, e nada do que ocupa. "Terça às 14h" não diz com quem é a reunião
 * que ocupa as 15h, e não deve dizer: a agenda da empresa não é pública, só as vagas dela são.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/formularios/[id]/horarios">) {
  const { id } = await ctx.params;

  const linha = await prisma.formulario.findUnique({
    where: { id },
    select: { workspaceId: true, status: true, paginas: true },
  });
  if (!linha) return NextResponse.json({ erro: "Formulário não encontrado" }, { status: 404 });

  // Rascunho não marca reunião. O formulário ainda está sendo montado, e um horário tomado agora
  // ocuparia a agenda de verdade por causa de um teste.
  if (linha.status !== "publicado") return NextResponse.json({ dias: [] });

  const formulario = { paginas: linha.paginas as Formulario["paginas"] };
  const config = agendaDoFormulario(formulario);
  if (!config) return NextResponse.json({ dias: [] });

  const agora = new Date();
  const hoje = hojeEmBrasilia(agora);
  const ocupados = await ocupadosDoWorkspace({
    workspaceId: linha.workspaceId,
    deDia: hoje,
    // Um dia a mais na busca: a reunião que começa no último dia da janela pode terminar no
    // seguinte, e ela ainda ocupa o fim daquele dia.
    ateDia: somarDias(hoje, config.janelaDias + 1),
    duracaoPadrao: config.duracao,
  });

  return NextResponse.json({ dias: horariosLivres({ config, ocupados, agora }) });
}
