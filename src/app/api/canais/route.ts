import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emailConfigurado } from "@/lib/email";

/**
 * Quais canais de envio este workspace tem de verdade, agora.
 *
 * É o que Templates e Disparo em massa usam pra só oferecer o que funciona. Nada aqui é
 * simulado: WhatsApp oficial e QR Code vêm da tabela de integrações do workspace; e-mail vem da
 * configuração do servidor (o provedor é um só pra todos os clientes).
 */
export type CanalDisponivel = {
  canal: "whatsapp_oficial" | "whatsapp_nao_oficial" | "email";
  label: string;
  conectado: boolean;
  /** Número/identificação, quando conectado. */
  detalhe?: string | null;
  /** Por que não está disponível, quando não está. */
  motivo?: string;
};

export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const integracoes = await prisma.integracao.findMany({
    where: { workspaceId, provedor: { in: ["meta_whatsapp", "whatsapp_nao_oficial"] } },
    select: { provedor: true, status: true, metadados: true },
  });
  const oficial = integracoes.find((i) => i.provedor === "meta_whatsapp");
  const qr = integracoes.find((i) => i.provedor === "whatsapp_nao_oficial");
  const numeroOficial = (oficial?.metadados as { displayPhoneNumber?: string; phoneNumber?: string } | null)?.displayPhoneNumber;
  const numeroQr = (qr?.metadados as { numero?: string } | null)?.numero;

  const canais: CanalDisponivel[] = [
    {
      canal: "whatsapp_oficial",
      label: "WhatsApp API Oficial",
      conectado: oficial?.status === "conectado",
      detalhe: numeroOficial ?? null,
      motivo: oficial?.status === "conectado" ? undefined : "Conecte em Configurações → Outras integrações.",
    },
    {
      canal: "whatsapp_nao_oficial",
      label: "WhatsApp (QR Code)",
      conectado: qr?.status === "conectado",
      detalhe: numeroQr ?? null,
      motivo: qr?.status === "conectado" ? undefined : "Escaneie o QR Code em Configurações → Outras integrações.",
    },
    {
      canal: "email",
      label: "E-mail",
      conectado: emailConfigurado(),
      motivo: emailConfigurado() ? undefined : "O envio de e-mail não está configurado no servidor.",
    },
  ];
  return NextResponse.json(canais, { headers: { "cache-control": "private, no-store" } });
}
