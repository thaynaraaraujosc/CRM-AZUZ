import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { destinoDoLeadSocial, salvarDestinoDoLeadSocial, type DestinoLeadSocial } from "@/lib/social/destino-lead";

/** Onde caem os leads que chegam pelo Instagram. Ver `src/lib/social/destino-lead.ts`. */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const destino = await destinoDoLeadSocial(sessao.user.workspaceId);
  return NextResponse.json(destino, { headers: { "cache-control": "private, no-store" } });
}

export async function PUT(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  // O workspace vem da SESSÃO, nunca do corpo: é o que impede uma conta de escrever preferência
  // na conta de outra pessoa mandando um id qualquer.
  const corpo = (await request.json()) as DestinoLeadSocial;
  const salvo = await salvarDestinoDoLeadSocial(sessao.user.workspaceId, corpo);
  return NextResponse.json(salvo);
}
