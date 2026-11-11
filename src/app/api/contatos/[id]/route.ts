import { NextResponse } from "next/server";

import type { Contato } from "@/lib/data";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aoAtualizarContato } from "@/lib/automacoes/gatilhos-crm";
import { somenteCamposDeContato } from "@/lib/contatos/campos-editaveis";
import { aoQualificarLead } from "@/lib/rastreio/devolver-qualificacao";

function paraContato(linha: { etiquetas: unknown; [k: string]: unknown }): Contato {
  return {
    ...linha,
    etiquetas: Array.isArray(linha.etiquetas) ? (linha.etiquetas as string[]) : undefined,
  } as Contato;
}

/** Atualização direta por id: usada por `adicionarEtiqueta`/`removerEtiqueta`/`alternarFavorito`,
 * que hoje calculam o próximo valor no cliente e mandam o campo já pronto pra gravar. Só mexe em
 * contato do mesmo workspace de quem está logado. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/contatos/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const dados = (await request.json()) as Partial<Contato> & Record<string, unknown>;

  // Foto do "antes" pra saber O QUE mudou. É disso que os gatilhos de etiqueta, responsável e
  // campo alterado dependem. Sem a comparação eles não teriam como existir.
  const antes = await prisma.contato.findFirst({ where: { id, workspaceId: sessao.user.workspaceId } });

  const { count } = await prisma.contato.updateMany({
    where: { id, workspaceId: sessao.user.workspaceId },
    // Lista fechada de campos: espalhar o corpo direto deixava o navegador gravar `workspaceId`
    // (mover o contato pra outra empresa), `id` e `criadoEm`. Ver `campos-editaveis.ts`.
    data: {
      ...somenteCamposDeContato(dados),
      /**
       * EDITAR É SALVAR. Quem abriu um número que chegou sozinho, escreveu o nome da pessoa e
       * gravou, guardou aquele contato de propósito — e é isso que o põe na tela de Contatos.
       *
       * A data não é sobrescrita: ela diz quando a pessoa entrou pra agenda, e corrigir um
       * telefone meses depois não muda isso.
       */
      salvoEm: antes?.salvoEm ?? new Date(),
    },
  });
  if (count === 0) return NextResponse.json({ erro: "Contato não encontrado" }, { status: 404 });

  const linha = await prisma.contato.findFirstOrThrow({ where: { id, workspaceId: sessao.user.workspaceId } });
  aoAtualizarContato({ workspaceId: sessao.user.workspaceId, contatoNome: linha.nome, antes, depois: linha });

  /*
   * MARCAR O LEAD COMO "BOM" VOLTA PRO ANÚNCIO.
   *
   * Aqui, e não num relógio: a qualificação acontece no mesmo dia da conversa, e é esse o ganho
   * dela sobre a venda ganha — que demora semanas. Ver `aoQualificarLead`, que decide se vale
   * mandar e pra quais plataformas (Meta e Google).
   *
   * `await` e não disparo solto: é uma escrita no próprio banco (a linha da fila), rápida, e sem
   * esperar por ela a resposta podia chegar antes da gravação num ambiente serverless que encerra
   * o processo ao responder. Nenhuma chamada de rede acontece aqui — quem conversa com a Meta e com
   * o Google é a rodada da fila.
   */
  await aoQualificarLead({
    workspaceId: sessao.user.workspaceId,
    contatoId: linha.id,
    antes: antes?.qualificacao ?? null,
    depois: linha.qualificacao ?? null,
  });

  return NextResponse.json(paraContato(linha));
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/contatos/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const { count } = await prisma.contato.deleteMany({
    where: { id, workspaceId: sessao.user.workspaceId },
  });
  if (count === 0) return NextResponse.json({ erro: "Contato não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
