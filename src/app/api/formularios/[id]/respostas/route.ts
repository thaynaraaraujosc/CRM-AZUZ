import { NextResponse } from "next/server";

import type { RespostaFormulario } from "@/lib/formularios-context";
import { prisma } from "@/lib/prisma";
import {
  POLITICAS,
  TAMANHO_MAXIMO,
  contarChamada,
  corpoGrandeDemais,
  ipDeQuemChamou,
  respostaDeCorpoGrande,
  respostaDeLimiteExcedido,
} from "@/lib/seguranca/limite-de-uso";
import { dispararGatilhosDoLead } from "@/lib/funil/gatilhos-etapa";
import { dispararAutomacoesDoCrm } from "@/lib/automation-flow/disparar-no-servidor";

/**
 * POST registra uma resposta pra esse formulário. Usado por `registrarResposta` no Context e
 * pela página pública `/formulario-preview` (sem sessão, sem Provider, chama a API direto). Sem
 * `auth()` de propósito: quem responde é um lead externo. O `workspaceId` da resposta nunca vem do
 * corpo da requisição: é copiado do Formulario pai, resolvido aqui pelo `formularioId` da URL.
 */
/**
 * Quem respondeu, pra automação saber com quem falar.
 *
 * O formulário é montado pela pessoa, então não existe campo obrigatório chamado "nome". A busca
 * é pelo rótulo mais provável, e sem nenhum deles a resposta ainda vale (o fluxo roda identificado
 * pelo id da resposta em vez de morrer sem disparar).
 */
function nomeDeQuemRespondeu(valores: Record<string, string>): string | null {
  const chave = Object.keys(valores).find((k) => /nome|name/i.test(k));
  const valor = chave ? valores[chave]?.trim() : "";
  return valor || null;
}

export async function POST(request: Request, ctx: RouteContext<"/api/formularios/[id]/respostas">) {
  // Rota PÚBLICA (o lead que responde não tem login). Sem limite, ela vira um jeito grátis de
  // encher a base de um cliente de contato falso, e sem teto de tamanho um corpo gigante derruba o
  // processo inteiro, não só esta chamada.
  if (corpoGrandeDemais(request, TAMANHO_MAXIMO.formulario)) return respostaDeCorpoGrande();
  const ip = await ipDeQuemChamou();
  const limite = contarChamada(`formulario-publico:${ip}`, POLITICAS.formularioPublico);
  if (!limite.permitido) return respostaDeLimiteExcedido(limite.esperarSegundos);

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

  // E os gatilhos da etapa em que esse lead está: "quando alguém de Follow-up responder o
  // formulário, faça X". Sem isto o gatilho existiria na grade do funil e nunca aconteceria.
  await dispararGatilhosDoLead({
    workspaceId: formulario.workspaceId,
    contatoNome: contatoNome?.trim() || nomeDeQuemRespondeu(valores) || `Resposta ${linha.id}`,
    tipoGatilho: "formulario_preenchido",
  }).catch((erro) => console.error("[formularios] falha ao disparar gatilhos de etapa:", erro));

  const resposta: RespostaFormulario = {
    id: linha.id,
    formularioId: linha.formularioId,
    criadoEm: linha.criadoEm.toISOString(),
    valores: linha.valores as Record<string, string>,
  };
  return NextResponse.json(resposta, { status: 201 });
}
