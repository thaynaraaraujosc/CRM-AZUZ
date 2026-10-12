import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/seguranca/auditoria";
import { WORKSPACE_DEMO } from "@/lib/demo/dados-demo";
import { limparConteudoDaDemo } from "@/lib/demo/limpar";

/**
 * Tira o cenário fictício da conta de demonstração, deixando o que chegou de verdade.
 *
 * Serve pra gravar vídeo: com um número real conectado na demonstração, a tela mistura funil
 * montado com conversa de gente de verdade. Remontar não resolve (apaga tudo e recria o cenário);
 * isso aqui apaga só o cenário.
 *
 * AS TRAVAS, que são o que importa numa rota que apaga:
 *
 *   1. o workspace alvo NUNCA vem do cliente: é a constante `WORKSPACE_DEMO`;
 *   2. só apaga linha com id prefixado por `demo-`, que só `semearDemo` gera;
 *   3. a constante é conferida contra uma lista de nomes perigosos antes de qualquer escrita;
 *   4. quem chama precisa ser super-admin OU admin dentro da própria demonstração.
 *
 * Mesmo que as quatro falhassem juntas, o alcance máximo seria o conteúdo semeado de um workspace
 * de demonstração. Nenhum caminho leva a dado de cliente pagante.
 */
export const dynamic = "force-dynamic";

/** Cinto e suspensório, igual à rota de remontar: se um dia trocarem a constante, isto barra. */
const IDS_PROIBIDOS = new Set(["", "principal", "azuz", "producao", "production", "main"]);

export async function POST() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const ehDonoDaDemo =
    sessao.user.workspaceId === WORKSPACE_DEMO && sessao.user.papelTipo === "admin";
  if (!sessao.user.superAdmin && !ehDonoDaDemo) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 403 });
  }

  if (WORKSPACE_DEMO !== "demonstracao" || IDS_PROIBIDOS.has(WORKSPACE_DEMO)) {
    return NextResponse.json({ erro: "Alvo da demonstração inválido. Operação recusada." }, { status: 500 });
  }

  const resumo = await limparConteudoDaDemo(prisma);

  await auditar({
    workspaceId: sessao.user.workspaceId,
    membroId: sessao.user.id,
    email: sessao.user.email,
    acao: "demo.conteudo_limpo",
    recurso: WORKSPACE_DEMO,
    detalhe: `${resumo.contatos} contatos, ${resumo.conversas} conversas, ${resumo.mensagens} mensagens, ${resumo.cards} cards, ${resumo.tarefas} tarefas`,
  });

  return NextResponse.json({ ok: true, resumo });
}
