import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { buscarFotoPerfil } from "@/lib/integracoes/evolution";

/**
 * GET busca a foto de perfil de UM número específico sob demanda — usada pelo painel de
 * participantes de grupo (`conversas/page.tsx`), que só busca a foto de quem a pessoa realmente
 * clicou pra ver. Buscar as fotos dos participantes todos de uma vez (um grupo grande tem
 * centenas) seria uma enxurrada de chamadas à Evolution desnecessária — a esmagadora maioria nunca
 * chega a ser clicada.
 */
export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const numero = new URL(request.url).searchParams.get("numero");
  if (!numero) return NextResponse.json({ erro: "numero é obrigatório" }, { status: 400 });

  const fotoUrl = await buscarFotoPerfil(sessao.user.workspaceId, numero.replace(/\D/g, ""));
  return NextResponse.json({ fotoUrl });
}
