import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Quais canais de envio este workspace tem de verdade, agora.
 *
 * É o que Templates e Disparo em massa usam pra só oferecer o que funciona. Nada aqui é
 * simulado: WhatsApp oficial e QR Code vêm da tabela de integrações do workspace; e-mail vem da
 * configuração do servidor (o provedor é um só pra todos os clientes).
 */
export type CanalDisponivel = {
  canal: "whatsapp_oficial" | "whatsapp_nao_oficial" | "email" | "instagram";
  label: string;
  conectado: boolean;
  /** Número/identificação, quando conectado. */
  detalhe?: string | null;
  /** Por que não está disponível, quando não está. */
  motivo?: string;
  /**
   * O canal não é oferecido pra CAMPANHA, mesmo que a infraestrutura exista.
   *
   * É o caso do e-mail: o envio funciona (Resend, usado em redefinir senha, convite de equipe e no
   * bloco "Enviar e-mail" das automações), mas campanha por e-mail não faz parte do produto hoje.
   * Não tem descadastro, não tem domínio verificado por cliente, não tem tratamento de retorno.
   * Oferecer o canal assim seria oferecer um jeito rápido de a conta ser marcada como spam.
   *
   * Marcado, e não escondido: a pergunta "cadê o e-mail?" merece resposta na tela.
   */
  emBreve?: boolean;
};

export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const integracoes = await prisma.integracao.findMany({
    where: { workspaceId, provedor: { in: ["meta_whatsapp", "whatsapp_nao_oficial", "meta_instagram"] } },
    select: { provedor: true, status: true, metadados: true },
  });
  const oficial = integracoes.find((i) => i.provedor === "meta_whatsapp");
  const instagram = integracoes.find((i) => i.provedor === "meta_instagram");
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
      canal: "instagram",
      label: "Instagram (Direct)",
      conectado: instagram?.status === "conectado",
      detalhe: (instagram?.metadados as { username?: string } | null)?.username
        ? `@${(instagram?.metadados as { username?: string }).username}`
        : null,
      motivo:
        instagram?.status === "conectado"
          ? undefined
          : "Conecte a conta em Configurações → Outras integrações.",
    },
    {
      canal: "email",
      label: "E-mail",
      // `conectado: false` de propósito, mesmo com o Resend configurado: ver `emBreve` acima. O
      // envio transacional continua funcionando normalmente; o que não existe é CAMPANHA por
      // e-mail, e é isso que este cartão está dizendo.
      conectado: false,
      emBreve: true,
      motivo: "Disparo por e-mail ainda não faz parte do produto.",
    },
  ];
  return NextResponse.json(canais, { headers: { "cache-control": "private, no-store" } });
}
