import { prisma } from "@/lib/prisma";
import {
  buscarWebhookRegistrado,
  estadoDaInstancia,
  reconfigurarWebhook,
  urlDeWebhookEsperada,
} from "@/lib/integracoes/evolution";
import type { RegistroDeWebhook } from "@/lib/integracoes/sinal-de-vida";

/**
 * "Está chegando mensagem no meu celular e não está chegando no CRM."
 *
 * O WhatsApp por QR Code depende de um elo que o CRM não controla: a Evolution precisa CHAMAR o
 * endereço de webhook deste CRM a cada mensagem. Esse registro vive no servidor da Evolution, não
 * aqui, e some ou envelhece sozinho: instância recriada, servidor restaurado de backup, endereço
 * do CRM mudado. Quando isso acontece o WhatsApp segue perfeito no celular, a conexão segue
 * marcada como "conectado" nas duas pontas, e nenhuma mensagem chega. Não havia como ver isso.
 *
 * Aqui o CRM pergunta pro outro lado o que ele tem registrado, compara com o que deveria estar, e
 * conserta sozinho quando diverge. Ninguém que compra um CRM deve precisar saber o que é um
 * webhook pra receber as próprias mensagens.
 */
export type SaudeQrCode = {
  /** O que o CRM guarda no banco. */
  statusNoCrm: string | null;
  /** O que a Evolution diz agora ("open", "close", "connecting"). */
  estadoNaEvolution: string | null;
  webhookEsperado: string | null;
  webhookRegistrado: string | null;
  webhookAtivo: boolean | null;
  webhookCerto: boolean;
  reparado: boolean;
  ultimoEventoEm: string | null;
  minutosDesdeOUltimoEvento: number | null;
  ultimoDescarte: RegistroDeWebhook["ultimoDescarte"] | null;
  diagnostico: string;
};

/**
 * A frase que explica o quadro, em português, pra quem não é técnico. Pura de propósito: é a parte
 * que decide o que a pessoa lê, e é ela que precisa de teste.
 */
export function explicarSaude(dados: {
  statusNoCrm: string | null;
  estadoNaEvolution: string | null;
  webhookCerto: boolean;
  webhookAtivo: boolean | null;
  reparado: boolean;
  minutosDesdeOUltimoEvento: number | null;
}): string {
  if (dados.statusNoCrm !== "conectado" && dados.estadoNaEvolution !== "open") {
    return "O WhatsApp por QR Code não está conectado. Leia o QR Code de novo em Configurações → WhatsApp.";
  }
  if (dados.estadoNaEvolution && dados.estadoNaEvolution !== "open") {
    return "O CRM acha que está conectado, mas o WhatsApp caiu do lado do celular. Leia o QR Code de novo.";
  }
  if (dados.reparado) {
    return "O aviso de mensagem nova estava apontando pro lugar errado e acabou de ser corrigido. As próximas mensagens chegam normalmente.";
  }
  if (!dados.webhookCerto || dados.webhookAtivo === false) {
    return "O aviso de mensagem nova não está registrado do lado do WhatsApp, e não deu pra corrigir agora. Tente reconectar em Configurações → WhatsApp.";
  }
  if (dados.minutosDesdeOUltimoEvento === null) {
    return "Está tudo apontando pro lugar certo, mas nenhuma mensagem chegou por aqui ainda. Mande uma mensagem de teste pro número conectado.";
  }
  if (dados.minutosDesdeOUltimoEvento > 60) {
    return `Está tudo apontando pro lugar certo, mas a última vez que o WhatsApp falou com o CRM foi há ${Math.round(dados.minutosDesdeOUltimoEvento / 60)} hora(s). Mande uma mensagem de teste pro número conectado.`;
  }
  return "Conexão saudável: o WhatsApp está avisando o CRM normalmente.";
}

/** Confere (e conserta, quando `reparar`) o elo entre a Evolution e este CRM. */
export async function conferirCanalQrCode(
  workspaceId: string,
  opcoes: { reparar?: boolean } = {},
): Promise<SaudeQrCode> {
  const integracao = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId, provedor: "whatsapp_nao_oficial" } },
    select: { status: true, metadados: true },
  });
  const metadados = (integracao?.metadados as Record<string, unknown> | null) ?? {};
  const registro = (metadados.webhook as RegistroDeWebhook | undefined) ?? {};
  const esperado = urlDeWebhookEsperada();

  const [estado, webhook] = await Promise.all([
    estadoDaInstancia(workspaceId).catch(() => null),
    buscarWebhookRegistrado(workspaceId).catch(() => null),
  ]);

  // Compara só o caminho, sem a query string: o token é derivado da chave da Evolution e não deve
  // sair daqui em nenhuma resposta nem em nenhum log.
  const certo = webhook?.ativo === true && semToken(webhook.url) === semToken(esperado);

  let reparado = false;
  if (!certo && opcoes.reparar && integracao?.status === "conectado") {
    await reconfigurarWebhook(workspaceId).catch(() => {});
    const conferido = await buscarWebhookRegistrado(workspaceId).catch(() => null);
    reparado = conferido?.ativo === true && semToken(conferido.url) === semToken(esperado);
  }

  const ultimoEventoEm = registro.ultimoEventoEm ?? null;
  const minutos = ultimoEventoEm
    ? Math.round(((Date.now() - Date.parse(ultimoEventoEm)) / 60_000) * 10) / 10
    : null;

  return {
    statusNoCrm: integracao?.status ?? null,
    estadoNaEvolution: estado,
    webhookEsperado: semToken(esperado),
    webhookRegistrado: semToken(webhook?.url ?? null),
    webhookAtivo: webhook ? webhook.ativo : null,
    webhookCerto: certo || reparado,
    reparado,
    ultimoEventoEm,
    minutosDesdeOUltimoEvento: minutos,
    ultimoDescarte: registro.ultimoDescarte ?? null,
    diagnostico: explicarSaude({
      statusNoCrm: integracao?.status ?? null,
      estadoNaEvolution: estado,
      webhookCerto: certo || reparado,
      webhookAtivo: webhook ? webhook.ativo : null,
      reparado,
      minutosDesdeOUltimoEvento: minutos,
    }),
  };
}

/** Tira o `?token=` de qualquer endereço antes de mostrar ou comparar. O token autentica a
 * Evolution contra este CRM: não pode aparecer em tela, log nem resposta de API. */
export function semToken(url: string | null): string | null {
  if (!url) return null;
  return url.split("?")[0];
}

/**
 * Passada do relógio: conserta o elo de todo workspace com QR Code conectado, sem ninguém pedir.
 * É o que faz a promessa valer sem botão: se o registro do lado da Evolution se perder, ele volta
 * sozinho na próxima hora, não na próxima vez que alguém reclamar.
 */
export async function conferirCanalQrCodeDeTodosOsWorkspaces(): Promise<{
  conferidos: number;
  reparados: string[];
}> {
  const conectadas = await prisma.integracao.findMany({
    where: { provedor: "whatsapp_nao_oficial", status: "conectado" },
    select: { workspaceId: true },
  });
  const reparados: string[] = [];
  for (const { workspaceId } of conectadas) {
    const saude = await conferirCanalQrCode(workspaceId, { reparar: true }).catch(() => null);
    if (saude?.reparado) reparados.push(workspaceId);
  }
  return { conferidos: conectadas.length, reparados };
}
