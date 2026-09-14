import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { googleAdsConfigurado } from "@/lib/integracoes/google-ads";

/**
 * O que a tela de Tráfego precisa saber sobre o Google Ads antes de desenhar qualquer coisa.
 *
 * `disponivel` é a resposta pra uma pergunta que só o servidor sabe: se esta instalação tem as
 * quatro variáveis do Google. Com `false`, a tela não mostra botão, filtro nem aviso: o canal
 * simplesmente não existe ali. É a mesma regra que fez o "Google Ads" falso sair da tela — opção
 * que não funciona faz quem clica concluir que não houve investimento, e não que o canal não está
 * ligado.
 *
 * Nunca devolve token: só status, conta e o erro que a pessoa precisa ler.
 */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const disponivel = googleAdsConfigurado();
  if (!disponivel) {
    return NextResponse.json({ disponivel: false, status: "desconectado", contaId: null, erroMensagem: null });
  }

  const linha = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId: sessao.user.workspaceId, provedor: "google_ads" } },
    select: { status: true, metadados: true, erroMensagem: true },
  });

  const { contaId } = (linha?.metadados as { contaId?: string } | null) ?? {};
  return NextResponse.json({
    disponivel: true,
    status: linha?.status ?? "desconectado",
    contaId: contaId ?? null,
    erroMensagem: linha?.erroMensagem ?? null,
  });
}
