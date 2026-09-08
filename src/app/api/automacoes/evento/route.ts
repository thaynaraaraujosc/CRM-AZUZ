import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { dispararAutomacoesDoCrm } from "@/lib/automation-flow/disparar-no-servidor";

/**
 * Avisa o servidor que um evento do CRM aconteceu, pra ele disparar as automações.
 *
 * Existe porque nem toda mudança passa por um endpoint próprio: mudar a etapa de um lead pela tela
 * de Conversas, por exemplo, grava por outro caminho. Antes, esses casos rodavam o motor no
 * NAVEGADOR: o que significa que a automação só acontecia pra quem estava com a tela aberta, e as
 * mensagens não saíam de verdade.
 *
 * O workspace vem SEMPRE da sessão, nunca do corpo: senão qualquer pessoa logada conseguiria
 * disparar automação na empresa de outra.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { tipoGatilho, contatoNome, funilId, etapaId, etapaTitulo, chaveEvento } = (await request.json()) as {
    tipoGatilho?: string;
    contatoNome?: string;
    funilId?: string;
    etapaId?: string;
    etapaTitulo?: string;
    chaveEvento?: string;
  };

  if (!tipoGatilho || !contatoNome) {
    return NextResponse.json({ erro: "tipoGatilho e contatoNome são obrigatórios" }, { status: 400 });
  }

  await dispararAutomacoesDoCrm({
    workspaceId: sessao.user.workspaceId,
    tipoGatilho,
    contatoNome,
    funilId,
    etapaId,
    etapaTitulo,
    chaveEvento,
  }).catch((erro) => console.error("[automacoes] falha ao disparar evento do CRM:", erro));

  return NextResponse.json({ ok: true });
}
