import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { desconectarWhatsAppNaoOficial } from "@/lib/integracoes/evolution";

/** POST pede pra Evolution API encerrar a sessão do workspace de quem está logado — atualiza o
 * status no banco na hora (não espera o webhook de `connection.update` confirmar, pra tela reagir
 * imediato ao clique). O logout remoto é best-effort: se a sessão já caiu do lado do celular (ou
 * a Evolution já não reconhece mais a instância como conectada), a chamada de logout pode falhar
 * mesmo o objetivo final ("desconectado") já sendo verdade — não deixa isso travar o usuário com
 * "Conectado" pra sempre no CRM sem conseguir desconectar. */
export async function POST() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const workspaceId = sessao.user.workspaceId;

  await desconectarWhatsAppNaoOficial(workspaceId).catch((erro) => {
    console.error("Falha ao encerrar sessão na Evolution API (seguindo para desconectar localmente):", erro);
  });

  await prisma.integracao.updateMany({
    where: { workspaceId, provedor: "whatsapp_nao_oficial" },
    data: { status: "desconectado", metadados: { qrDataUrl: null, numero: null } },
  });

  return NextResponse.json({ ok: true });
}
