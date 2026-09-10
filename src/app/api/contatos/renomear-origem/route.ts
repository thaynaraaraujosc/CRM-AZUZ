import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ORIGEM_ANTIGA_MANUAL, ORIGEM_MANUAL } from "@/lib/contatos/ordenacao";

/**
 * Renomeia a origem "Indicação" para "Salvo manualmente" nos contatos deste workspace.
 *
 * GET conta quantos seriam renomeados, sem gravar: é o que o aviso da tela de Contatos lê pra
 * decidir se aparece. POST executa.
 *
 * O mesmo trabalho do `scripts/renomear-origem-indicacao.ts`, que roda em todos os workspaces de
 * uma vez pelo terminal. Este caminho existe pra não exigir terminal pra uma correção de uma
 * coluna só.
 *
 * ESCOPO ESTREITO, e é o ponto: só `Contato.origem`, e só o valor exato "Indicação".
 * `NegocioCard.origem` NÃO é tocado, porque lá "Indicação" é uma escolha feita à mão na tela do
 * funil: a palavra significa o que diz, e reescrevê-la apagaria informação de verdade.
 *
 * Só admin. Reescreve uma coluna de todos os contatos do workspace, e não é o tipo de coisa que um
 * atendente deva disparar por engano.
 */
async function comPermissao() {
  const sessao = await auth();
  if (!sessao) return { erro: NextResponse.json({ erro: "Não autenticado" }, { status: 401 }) };
  if (sessao.user.papelTipo !== "admin" && !sessao.user.superAdmin) {
    return { erro: NextResponse.json({ erro: "Só o administrador do workspace pode renomear." }, { status: 403 }) };
  }
  return { workspaceId: sessao.user.workspaceId };
}

export type ContagemRenomeacao = { quantos: number };

export async function GET() {
  const { erro, workspaceId } = await comPermissao();
  if (erro) return erro;

  const quantos = await prisma.contato.count({
    where: { workspaceId: workspaceId!, origem: ORIGEM_ANTIGA_MANUAL },
  });
  return NextResponse.json({ quantos } satisfies ContagemRenomeacao, { headers: { "cache-control": "no-store" } });
}

export async function POST() {
  const { erro, workspaceId } = await comPermissao();
  if (erro) return erro;

  const resultado = await prisma.contato.updateMany({
    where: { workspaceId: workspaceId!, origem: ORIGEM_ANTIGA_MANUAL },
    data: { origem: ORIGEM_MANUAL },
  });
  return NextResponse.json({ quantos: resultado.count } satisfies ContagemRenomeacao);
}
