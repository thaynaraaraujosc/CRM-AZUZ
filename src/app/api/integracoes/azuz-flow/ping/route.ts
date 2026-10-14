import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { autenticarChaveDoFlow } from "@/lib/integracoes/azuz-flow-chave";
import { destinoDoLead } from "@/lib/integracoes/azuz-flow-destino";
import { contaConectada } from "@/lib/integracoes/whatsapp-oficial";
import { contarChamada, ipDeQuemChamou } from "@/lib/seguranca/limite-de-uso";

/** O "Testar conexão" do Flow. Responde o que a agência precisa conferir antes de publicar o
 *  formulário: a chave vale, é a empresa certa, e o lead vai cair em algum lugar. */
export async function GET(request: Request) {
  const ip = await ipDeQuemChamou();
  const limite = contarChamada(`flow-ping:ip:${ip}`, { maximo: 60, janelaSegundos: 60 });
  if (!limite.permitido) {
    return NextResponse.json(
      { ok: false, erro: "Muitas chamadas. Tente de novo em instantes." },
      { status: 429, headers: { "retry-after": String(limite.esperarSegundos), "cache-control": "no-store" } },
    );
  }

  const autenticado = await autenticarChaveDoFlow(request.headers.get("authorization"));
  if (!autenticado) {
    return NextResponse.json(
      { ok: false, erro: "Chave de integração inválida." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const [workspace, conta, destino] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: autenticado.workspaceId }, select: { nome: true } }),
    contaConectada(autenticado.workspaceId),
    destinoDoLead(autenticado.workspaceId),
  ]);

  return NextResponse.json(
    {
      ok: true,
      empresa: workspace?.nome ?? "",
      whatsappOficialConectado: Boolean(conta),
      destino,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
