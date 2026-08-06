import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { statusSessaoBaileys } from "@/lib/integracoes/baileys";

/** GET consulta o worker em tempo real (o QR expira em segundos, não dá pra confiar só no que
 * está salvo no banco) e reflete o status atual na linha `Integracao` — a UI faz polling aqui
 * enquanto o QR não é escaneado. */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const workspaceId = sessao.user.workspaceId;

  try {
    const statusWorker = await statusSessaoBaileys(workspaceId);

    await prisma.integracao.upsert({
      where: { workspaceId_provedor: { workspaceId, provedor: "whatsapp_baileys" } },
      create: {
        id: `${workspaceId}-whatsapp_baileys`,
        workspaceId,
        provedor: "whatsapp_baileys",
        status: statusWorker.status,
        metadados: statusWorker.numero ? { numero: statusWorker.numero } : undefined,
      },
      update: {
        status: statusWorker.status,
        metadados: statusWorker.numero ? { numero: statusWorker.numero } : undefined,
      },
    });

    return NextResponse.json(statusWorker);
  } catch (erro) {
    const mensagemErro = erro instanceof Error ? erro.message : "Falha ao consultar status.";
    return NextResponse.json({ erro: mensagemErro }, { status: 502 });
  }
}
