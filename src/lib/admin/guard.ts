import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

/**
 * Toda rota `/api/admin/*` chama isso primeiro — o proxy já bloqueia quem não é super-admin antes
 * de chegar aqui, mas a rota confere de novo (defesa em profundidade: se algum dia o matcher do
 * proxy mudar e passar a ignorar esse caminho por engano, a rota continua fechada sozinha).
 */
export async function exigirSuperAdmin() {
  const sessao = await auth();
  if (!sessao?.user.superAdmin) {
    return { ok: false as const, resposta: NextResponse.json({ erro: "Não autorizado" }, { status: 403 }) };
  }
  return { ok: true as const, sessao };
}
