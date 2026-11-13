import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * APAGA UM NEGÓCIO DO FUNIL. Numa chamada só, gravada na hora.
 *
 * "Eu apago o card, às vezes eu quero apagar o contato e aí ele volta."
 *
 * Voltava mesmo, e não era impressão. Apagar um card era só tirá-lo do estado do navegador: a
 * gravação vinha depois, pelo PUT de estado completo do quadro, que apaga do banco o que não veio
 * no payload. Esse caminho tem duas voltas:
 *
 * 1. PUT que falha relê o banco (`recarregar`), pra tela não seguir mostrando o que não foi
 *    gravado. Mas o card apagado AINDA ESTÁ no banco nessa hora — a releitura o traz de volta
 *    pra tela, e quem apagou vê o card reaparecer sozinho.
 * 2. "Não veio no payload" vale nos dois sentidos: o PUT também CRIA o que o navegador tem e o
 *    banco não. Apagar a conversa (que leva o card junto, no servidor) deixava o card na memória
 *    da tela do funil, e o PUT seguinte o recriava.
 *
 * Aqui é como arrastar um card (`/api/funis/mover`): uma operação, um registro, resposta na hora,
 * e erro que o front consegue ver. O estado da tela muda com `aplicarSemGravar`, sem chamar o PUT
 * do quadro inteiro — então não há releitura que desfaça nem payload que recrie.
 *
 * Só o card. O contato e a conversa continuam existindo: o negócio pode não existir (duplicado,
 * criado por engano) e a pessoa continuar sendo alguém com quem já se falou. Apagar o lead inteiro
 * é outro caminho (`DELETE /api/conversas/[id]`), e esse sim leva as três coisas.
 */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/funis/cards/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;

  // Posse pelo workspace da sessão, nunca por id vindo da requisição: `deleteMany` com os dois
  // filtros não tem como apagar card de outra empresa, mesmo recebendo um id válido de lá.
  const { count } = await prisma.negocioCard.deleteMany({
    where: { id, workspaceId: sessao.user.workspaceId },
  });

  // Zero não é erro. O card pode já ter saído por outro caminho (a conversa apagada leva o card),
  // e nesse caso o pedido está cumprido: o negócio não existe mais. Devolver 404 faria a tela
  // mostrar "falha ao apagar" e trazer de volta um card que o banco não tem.
  return NextResponse.json({ ok: true, apagados: count }, { headers: { "cache-control": "no-store" } });
}
