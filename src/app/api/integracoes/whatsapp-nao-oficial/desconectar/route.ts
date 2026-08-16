import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { desconectarWhatsAppNaoOficial } from "@/lib/integracoes/evolution";

/** POST pede pra Evolution API encerrar a sessão do workspace de quem está logado — atualiza o
 * status no banco na hora (não espera o webhook de `connection.update` confirmar, pra tela reagir
 * imediato ao clique). */
export async function POST() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const workspaceId = sessao.user.workspaceId;

  try {
    await desconectarWhatsAppNaoOficial(workspaceId);
  } catch (erro) {
    return NextResponse.json(
      { erro: erro instanceof Error ? erro.message : "Falha ao desconectar" },
      { status: 502 },
    );
  }

  await prisma.integracao.updateMany({
    where: { workspaceId, provedor: "whatsapp_nao_oficial" },
    data: { status: "desconectado", metadados: { qrDataUrl: null, numero: null } },
  });

  return NextResponse.json({ ok: true });
}
