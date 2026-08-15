import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { gerarTokenImpersonar } from "@/lib/admin/impersonar";

/**
 * POST — quem está "vendo como" outro membro pede pra voltar a ser o super-admin. Não fica sob
 * `/api/admin/*` de propósito: nesse momento a sessão atual é a do membro impersonado (não-super-
 * admin), então o gate de super-admin do proxy bloquearia essa chamada se ela estivesse lá.
 * `impersonadoPorId` só existe na sessão de quem chegou aqui via impersonação (ver `auth.ts`) —
 * confiável porque vem do JWT assinado pelo servidor, não de nada que o cliente possa forjar.
 */
export async function POST() {
  const sessao = await auth();
  if (!sessao?.user.impersonadoPorId) {
    return NextResponse.json({ erro: "Não está impersonando ninguém." }, { status: 400 });
  }

  const token = gerarTokenImpersonar(sessao.user.impersonadoPorId);
  return NextResponse.json({ membroId: sessao.user.impersonadoPorId, token });
}
