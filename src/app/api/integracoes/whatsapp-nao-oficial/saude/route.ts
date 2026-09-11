import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { conferirCanalQrCode } from "@/lib/integracoes/saude-qrcode";

export const dynamic = "force-dynamic";

/**
 * "Chega mensagem no meu celular e não chega no CRM": esta rota responde por quê, e conserta o que
 * dá pra consertar sozinha (ver `saude-qrcode.ts`). A mesma conferência roda pelo relógio de hora
 * em hora, pra ninguém precisar abrir nada.
 */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const saude = await conferirCanalQrCode(sessao.user.workspaceId, { reparar: true });
  return NextResponse.json(saude, { headers: { "cache-control": "no-store" } });
}
