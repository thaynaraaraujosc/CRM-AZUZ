import { NextResponse } from "next/server";

import type { RespostaFormulario } from "@/lib/formularios-context";
import { prisma } from "@/lib/prisma";
import { dispararAutomacoesDoCrm } from "@/lib/automation-flow/disparar-no-servidor";

/**
 * POST registra uma resposta pra esse formulário — usado por `registrarResposta` no Context e
 * pela página pública `/formulario-preview` (sem sessão, sem Provider, chama a API direto). Sem
 * `auth()` de propósito: quem responde é um lead externo. O `workspaceId` da resposta nunca vem do
 * corpo da requisição — é copiado do Formulario pai, resolvido aqui pelo `formularioId` da URL.
 */
/**
 * Quem respondeu, pra automação saber com quem falar.
 *
 * O formulário é montado pela pessoa, então não existe campo obrigatório chamado "nome" — a busca
 * é pelo rótulo mais provável, e sem nenhum deles a resposta ainda vale (o fluxo roda identificado
 * pelo id da resposta em vez de morrer sem disparar).
 */
function nomeDeQuemRespondeu(valores: Record<string, string>): string | null {
  const chave = Object.keys(valores).find((k) => /nome|name/i.test(k));
  const valor = chave ? valores[chave]?.trim() : "";
  return valor || null;
}

export async function POST(request: Request, ctx: RouteContext<"/api/formularios/[id]/respostas">) {
  const { id } = await ctx.params;
  const formulario = await prisma.formulario.findUnique({ where: { id }, select: { workspaceId: true } });
  if (!formulario) return NextResponse.json({ erro: "Formulário não encontrado" }, { status: 404 });

  const { valores, contatoNome } = (await request.json()) as {
    valores: Record<string, string>;
    /** Nome já resolvido pelo formulário (campo mapeado pro CRM). Melhor que adivinhar aqui: as
     * chaves de `valores` são ids de pergunta, não rótulos. */
    contatoNome?: string;
  };

  const linha = await prisma.respostaFormulario.create({
    data: {
      id: `resposta-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      workspaceId: formulario.workspaceId,
      formularioId: id,
      valores,
    },
  });

  // O gatilho "formulário preenchido" acontece aqui, no servidor. Antes ele só existia na tela de
  // pré-visualização do formulário: uma resposta de verdade, vinda do link público, não disparava
  // automação nenhuma.
  await dispararAutomacoesDoCrm({
    workspaceId: formulario.workspaceId,
    tipoGatilho: "formulario_preenchido",
    contatoNome: contatoNome?.trim() || nomeDeQuemRespondeu(valores) || `Resposta ${linha.id}`,
    chaveEvento: `formulario:${linha.id}`,
  }).catch((erro) => console.error("[formularios] falha ao disparar automações:", erro));

  const resposta: RespostaFormulario = {
    id: linha.id,
    formularioId: linha.formularioId,
    criadoEm: linha.criadoEm.toISOString(),
    valores: linha.valores as Record<string, string>,
  };
  return NextResponse.json(resposta, { status: 201 });
}
