import { NextResponse } from "next/server";

import { exigirSuperAdmin } from "@/lib/admin/guard";
import { gerarTokenImpersonar } from "@/lib/admin/impersonar";

/** POST emite o token de curta duração pra "entrar como" esse membro — o front chama isso e, com
 * a resposta, chama `signIn("impersonar", { membroId, token })` (ver `src/lib/auth.ts`). Não troca
 * a sessão sozinho: só autoriza o próximo passo. */
export async function POST(_request: Request, ctx: RouteContext<"/api/admin/membros/[id]/impersonar">) {
  const guarda = await exigirSuperAdmin();
  if (!guarda.ok) return guarda.resposta;

  const { id: membroId } = await ctx.params;
  const token = gerarTokenImpersonar(membroId, guarda.sessao.user.id);

  return NextResponse.json({ membroId, token });
}
