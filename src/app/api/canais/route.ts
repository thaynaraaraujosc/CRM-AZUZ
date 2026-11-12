import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CANAL_NAO_OFICIAL, CANAL_OFICIAL } from "@/lib/integracoes/conta-canal";
import { numerosDeWhatsApp } from "@/lib/integracoes/numeros-de-whatsapp";
import {
  canalTemNumero,
  numerosDeEnvio,
  porQueOCanalNaoServe,
  type NumeroDeEnvio,
} from "@/lib/campanhas/canais-de-envio";

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
  /**
   * OS NÚMEROS DESTE CANAL, um por conexão de pé.
   *
   * Campo novo, e aditivo de propósito: Templates continua perguntando "quais CANAIS existem?" —
   * um template pertence a um canal, não a um telefone — enquanto o Disparo pergunta "por qual
   * NÚMERO isto sai?". São duas perguntas diferentes sobre o mesmo mundo, e a segunda não cabia
   * na resposta antiga. Ver `canais-de-envio.ts`.
   */
  numeros?: NumeroDeEnvio[];
};

export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  /*
   * OS WHATSAPP VÊM DA LISTA DE NÚMEROS, e não de um `.find()` por provedor.
   *
   * O `.find()` pegava o PRIMEIRO registro do provedor, sem olhar status. Quem conecta um número,
   * desconecta e conecta outro fica com a linha velha na frente — e a tela dizia "Escaneie o QR
   * Code", com o cartão desabilitado, sobre um WhatsApp que estava de pé recebendo mensagem.
   *
   * `numerosDeWhatsApp` já responde isto direito (inclusive tirando a linha fantasma), e é a mesma
   * lista que as abas da caixa de entrada usam. Duas respostas pra mesma pergunta é como as duas
   * telas passam a discordar — e foi o que aconteceu.
   */
  const [integracoes, numerosWhats] = await Promise.all([
    prisma.integracao.findMany({
      where: { workspaceId, provedor: { in: ["meta_instagram"] } },
      select: { provedor: true, status: true, metadados: true },
    }),
    numerosDeWhatsApp(workspaceId),
  ]);
  const instagram = integracoes.find((i) => i.provedor === "meta_instagram");
  const numerosParaEnvio = numerosDeEnvio(numerosWhats);
  const doOficial = numerosParaEnvio.filter((n) => n.canal === "whatsapp_oficial");
  const doQr = numerosParaEnvio.filter((n) => n.canal === "whatsapp_nao_oficial");

  const canais: CanalDisponivel[] = [
    {
      canal: "whatsapp_oficial",
      label: "WhatsApp API Oficial",
      conectado: canalTemNumero(numerosParaEnvio, "whatsapp_oficial"),
      detalhe: doOficial[0]?.numeroLegivel || doOficial[0]?.nome || null,
      motivo: doOficial.length ? undefined : porQueOCanalNaoServe(numerosWhats, CANAL_OFICIAL),
      numeros: doOficial,
    },
    {
      canal: "whatsapp_nao_oficial",
      label: "WhatsApp (QR Code)",
      conectado: canalTemNumero(numerosParaEnvio, "whatsapp_nao_oficial"),
      detalhe: doQr[0]?.numeroLegivel || doQr[0]?.nome || null,
      motivo: doQr.length ? undefined : porQueOCanalNaoServe(numerosWhats, CANAL_NAO_OFICIAL),
      numeros: doQr,
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
