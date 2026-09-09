import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { JANELA_HORAS, pessoasNaJanela } from "@/lib/social/janela-direct";

/**
 * Quem está dentro da janela de 24 horas do Direct, agora.
 *
 * É o único público possível de um disparo por Instagram, e a tela mostra a lista ANTES de a
 * pessoa escrever a mensagem: assim ela vê que são 12 pessoas, não 4.000, e decide se vale a pena.
 * Prometer "disparo em massa" e entregar 12 seria a decepção; dizer 12 desde o começo é o produto.
 */
export type JanelaDirect = {
  janelaHoras: number;
  total: number;
  pessoas: { contatoNome: string; ultimaMensagemEm: string; fechaEm: string }[];
};

export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const pessoas = await pessoasNaJanela(sessao.user.workspaceId);
  const resposta: JanelaDirect = {
    janelaHoras: JANELA_HORAS,
    total: pessoas.length,
    // Teto na listagem: a contagem é a informação que decide, e mandar milhares de nomes pra tela
    // só pra ela mostrar os primeiros seria pagar banda por nada.
    pessoas: pessoas.slice(0, 50).map((p) => ({
      contatoNome: p.contatoNome,
      ultimaMensagemEm: p.ultimaMensagemEm.toISOString(),
      fechaEm: p.fechaEm.toISOString(),
    })),
  };
  return NextResponse.json(resposta, { headers: { "cache-control": "private, no-store" } });
}
