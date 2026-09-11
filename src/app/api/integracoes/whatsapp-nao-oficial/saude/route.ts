import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { conferirCanalQrCode } from "@/lib/integracoes/saude-qrcode";
import { corrigirDonosDivergentes } from "@/lib/conversas/dono-divergente";

export const dynamic = "force-dynamic";

/**
 * "Chega mensagem no meu celular e não chega no CRM": esta rota responde por quê, e conserta o que
 * dá pra consertar sozinha (ver `saude-qrcode.ts`). A mesma conferência roda pelo relógio de hora
 * em hora, pra ninguém precisar abrir nada.
 */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  // Mensagem marcada com a conexão errada some da tela quando a outra é desconectada, mesmo com o
  // número que a recebeu ainda conectado. Devolve cada uma pra conexão que de fato a carregou.
  const donos = await corrigirDonosDivergentes(sessao.user.workspaceId).catch(() => null);
  const saude = await conferirCanalQrCode(sessao.user.workspaceId, { reparar: true });
  return NextResponse.json({ ...saude, donos }, { headers: { "cache-control": "no-store" } });
}
