import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET devolve o status da integração de WhatsApp não oficial (Baileys) do workspace de quem está
 * logado — inclui o QR code (`metadados.qrDataUrl`) enquanto aguarda leitura. */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const linha = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId: sessao.user.workspaceId, provedor: "whatsapp_nao_oficial" } },
    select: { status: true, metadados: true, erroMensagem: true, atualizadoEm: true },
  });

  return NextResponse.json(
    linha ?? { status: "desconectado", metadados: null, erroMensagem: null, atualizadoEm: null },
  );
}
