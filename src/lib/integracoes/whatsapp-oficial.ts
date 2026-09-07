import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import {
  MENSAGEM_POR_CODIGO_META,
  chamarGraph,
  ehTokenInvalido,
  normalizarNumeroBrasileiro,
} from "@/lib/integracoes/meta";

/** Janela de atendimento da Cloud API: passadas 24h desde a última mensagem RECEBIDA daquela
 * pessoa, só dá pra falar com ela usando um modelo de mensagem aprovado. */
const JANELA_ATENDIMENTO_MS = 24 * 60 * 60 * 1000;

export type ContaWhatsappOficial = {
  integracaoId: string;
  workspaceId: string;
  phoneNumberId: string;
  wabaId: string | null;
  accessToken: string;
};

/** Carrega a conta conectada DAQUELE workspace com o token já descriptografado — sempre pelo
 * workspace da sessão, nunca por id vindo da requisição. */
export async function contaConectada(workspaceId: string): Promise<ContaWhatsappOficial | null> {
  const integracao = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId, provedor: "meta_whatsapp" } },
  });
  if (!integracao || integracao.status !== "conectado" || !integracao.accessTokenCriptografado) return null;

  const { phoneNumberId, wabaId } = (integracao.metadados as { phoneNumberId?: string; wabaId?: string }) ?? {};
  if (!phoneNumberId) return null;

  return {
    integracaoId: integracao.id,
    workspaceId,
    phoneNumberId,
    wabaId: wabaId ?? null,
    accessToken: decriptar(integracao.accessTokenCriptografado),
  };
}

/** `true` quando a pessoa mandou alguma mensagem nas últimas 24h — ou seja, dá pra responder com
 * mensagem livre. Fora disso, só modelo aprovado. */
export async function janelaDeAtendimentoAberta(workspaceId: string, contatoNome: string): Promise<boolean> {
  const ultimaRecebida = await prisma.mensagemExtra.findFirst({
    where: { workspaceId, contato: contatoNome, tipo: "in" },
    orderBy: { criadoEm: "desc" },
    select: { criadoEm: true },
  });
  if (!ultimaRecebida?.criadoEm) return false;
  return Date.now() - ultimaRecebida.criadoEm.getTime() < JANELA_ATENDIMENTO_MS;
}

/** Traduz o erro da Graph pra algo que faz sentido pra quem está atendendo, e marca a integração
 * como desconectada quando o token morreu (senão o CRM segue "verde" mandando erro em silêncio). */
export async function tratarErroEnvio(erro: unknown, integracaoId: string): Promise<string> {
  const codigoMeta = (erro as Error & { codigoMeta?: number }).codigoMeta;
  if (ehTokenInvalido(codigoMeta)) {
    await prisma.integracao
      .update({ where: { id: integracaoId }, data: { status: "desconectado", erroMensagem: MENSAGEM_POR_CODIGO_META[190] } })
      .catch(() => {});
  }
  if (codigoMeta && MENSAGEM_POR_CODIGO_META[codigoMeta]) return MENSAGEM_POR_CODIGO_META[codigoMeta];
  return erro instanceof Error ? erro.message : "Falha ao enviar mensagem.";
}

/**
 * Quantas PESSOAS DIFERENTES a conta pode iniciar conversa em 24h, lido da própria Meta.
 *
 * A Meta chama de `messaging_limit_tier` e o valor sobe sozinho com o histórico de qualidade
 * (250 → 1.000 → 10.000 → 100.000 → ilimitado). É o número que decide quantos dias um disparo
 * leva — chutar aqui seria segurar uma conta que já podia mais ou passar do que ela pode e ver a
 * Meta recusar. `null` = não deu pra ler (conta sem o campo, token sem permissão, Graph fora);
 * quem chama decide o que fazer sem o número.
 */
const CONVERSAS_POR_TIER: Record<string, number | null> = {
  TIER_50: 50,
  TIER_250: 250,
  TIER_1K: 1_000,
  TIER_10K: 10_000,
  TIER_100K: 100_000,
  TIER_UNLIMITED: null,
};

export async function limiteDiarioDaConta(conta: ContaWhatsappOficial): Promise<{ conhecido: boolean; porDia: number | null }> {
  try {
    const numero = await chamarGraph<{ messaging_limit_tier?: string }>(
      `/${conta.phoneNumberId}?fields=messaging_limit_tier`,
      conta.accessToken,
    );
    const tier = numero.messaging_limit_tier;
    if (!tier || !(tier in CONVERSAS_POR_TIER)) return { conhecido: false, porDia: null };
    // Guarda no metadados pra tela mostrar sem nova chamada — e pra sobreviver a uma Graph fora.
    await prisma.integracao
      .update({
        where: { id: conta.integracaoId },
        data: { metadados: { ...(await metadadosAtuais(conta.integracaoId)), limiteDiarioTier: tier } as never },
      })
      .catch(() => {});
    return { conhecido: true, porDia: CONVERSAS_POR_TIER[tier] };
  } catch {
    return { conhecido: false, porDia: null };
  }
}

async function metadadosAtuais(integracaoId: string): Promise<Record<string, unknown>> {
  const atual = await prisma.integracao.findUnique({ where: { id: integracaoId }, select: { metadados: true } });
  return (atual?.metadados as Record<string, unknown> | null) ?? {};
}

type RespostaEnvio = { messages?: { id?: string }[] };

/**
 * Manda uma mensagem pela Cloud API com o token DAQUELE workspace e devolve o `wamid` — o id que a
 * Meta gera, usado depois pra casar os webhooks de entrega/leitura com a mensagem certa.
 */
export async function enviarPelaCloudApi(
  conta: ContaWhatsappOficial,
  destinatario: string,
  corpo: Record<string, unknown>,
): Promise<string | null> {
  const numeroLimpo = normalizarNumeroBrasileiro(destinatario.replace(/\D/g, ""));
  const resposta = await chamarGraph<RespostaEnvio>(`/${conta.phoneNumberId}/messages`, conta.accessToken, {
    method: "POST",
    body: { messaging_product: "whatsapp", to: numeroLimpo, ...corpo },
  });
  return resposta.messages?.[0]?.id ?? null;
}
