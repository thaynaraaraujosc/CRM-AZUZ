import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { perguntarClaude } from "@/lib/azuz-ia/claude";
import { montarContextoWorkspace } from "@/lib/azuz-ia/contexto";
import type { AzuzIaConfig } from "@/lib/configuracoes-context";

const AZUZ_IA_PADRAO: AzuzIaConfig = {
  tom: "consultivo",
  detalhamento: "equilibrado",
  sugestoesProativas: true,
  dadosPermitidos: ["contatos", "conversas", "funis", "tarefas"],
  sugestoesTipos: ["follow-ups", "tarefas", "mudanças de etapa"],
  comportamentoPersonalizado: "",
};

const LABEL_TOM: Record<AzuzIaConfig["tom"], string> = {
  direto: "direto e objetivo",
  consultivo: "consultivo",
  amigavel: "amigável e próximo",
  formal: "formal",
  personalizado: "no tom descrito nas instruções abaixo",
};
const LABEL_DETALHAMENTO: Record<AzuzIaConfig["detalhamento"], string> = {
  resumido: "resumidas e diretas",
  equilibrado: "com detalhe equilibrado",
  detalhado: "detalhadas",
};

type CorpoRequisicao = {
  mensagem?: string;
  historico?: { tipo: "in" | "out"; texto: string }[];
};

/** POST recebe uma pergunta do chat da Azuz IA e responde usando o Claude, com o contexto real do
 * workspace (limitado às categorias marcadas em "Dados permitidos"). */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { mensagem, historico }: CorpoRequisicao = await request.json();
  if (!mensagem?.trim()) {
    return NextResponse.json({ erro: "Mensagem vazia" }, { status: 400 });
  }

  const preferencias = await prisma.preferencia.findUnique({
    where: { workspaceId_chave: { workspaceId: sessao.user.workspaceId, chave: "configuracoes" } },
  });
  const dados = preferencias?.dados as { azuzIa?: Partial<AzuzIaConfig> } | null;
  const azuzIa: AzuzIaConfig = { ...AZUZ_IA_PADRAO, ...dados?.azuzIa };

  try {
    const contexto = await montarContextoWorkspace(sessao.user.workspaceId, azuzIa.dadosPermitidos);

    const systemPrompt = [
      `Você é a Azuz IA, assistente dentro do CRM do workspace "${sessao.user.workspaceNome}". Responda sempre em português do Brasil, em respostas ${LABEL_DETALHAMENTO[azuzIa.detalhamento]}, com tom ${LABEL_TOM[azuzIa.tom]}.`,
      azuzIa.comportamentoPersonalizado ? `Instruções adicionais definidas por esse workspace: ${azuzIa.comportamentoPersonalizado}` : null,
      contexto
        ? `Os dados abaixo são reais do workspace, use-os pra responder perguntas sobre o negócio. Se a pergunta não tiver relação com eles, responda normalmente sem forçar os dados.\n\n${contexto}`
        : "Nenhuma categoria de dado do workspace está liberada em Configurações → Azuz IA → Dados permitidos — responda só com conhecimento geral, sem inventar dado nenhum do workspace.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const mensagensClaude = [
      ...(historico ?? []).slice(-10).map((m) => ({ role: m.tipo === "out" ? ("user" as const) : ("assistant" as const), content: m.texto })),
      { role: "user" as const, content: mensagem },
    ];

    const resposta = await perguntarClaude({ systemPrompt, mensagens: mensagensClaude });
    return NextResponse.json({ resposta });
  } catch (erro) {
    const mensagemErro = erro instanceof Error ? erro.message : "Falha desconhecida ao responder.";
    return NextResponse.json({ erro: mensagemErro }, { status: 500 });
  }
}
