import { prisma } from "@/lib/prisma";
import {
  EVENTOS_WEBHOOK,
  aplicarAjustesDaInstancia,
  buscarNumeroConectado,
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
  /** A última mensagem que chegou e FOI gravada, e em qual conversa. */
  ultimaMensagem: RegistroDeWebhook["ultimaMensagem"] | null;
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

/**
 * Confere o elo entre a Evolution e este CRM. CONSERTA apenas com `reparar: true`.
 *
 * Sem `reparar` nada é escrito: nem o webhook é reconfigurado, nem os ajustes da instância são
 * reaplicados, nem o status gravado é corrigido. Isso é o contrato, não um detalhe. Quem só quer
 * OLHAR o diagnóstico (a tela de Configurações, aberta dezenas de vezes por dia) não pode acionar
 * conserto nenhum de carona: "abri uma tela e o CRM mudou de comportamento" é exatamente o que
 * faz alguém parar de confiar no que vê e evitar olhar.
 *
 * O conserto vive no relógio (`conferirCanalQrCodeDeTodosOsWorkspaces`, de hora em hora), que é
 * onde ele sempre devia estar: acontece sem ninguém pedir e sem depender de alguém abrir nada.
 */
export async function conferirCanalQrCode(
  workspaceId: string,
  opcoes: { reparar?: boolean; slot?: number } = {},
): Promise<SaudeQrCode> {
  // Cada número tem a saúde dele: uma instância pode estar mudinha enquanto a outra recebe
  // normalmente, e é justamente essa diferença que se quer ver.
  const slot = opcoes.slot ?? 1;
  const integracao = await prisma.integracao.findUnique({
    where: { workspaceId_provedor_slot: { workspaceId, provedor: "whatsapp_nao_oficial", slot } },
    select: { status: true, metadados: true },
  });
  const metadados = (integracao?.metadados as Record<string, unknown> | null) ?? {};
  const registro = (metadados.webhook as RegistroDeWebhook | undefined) ?? {};
  const esperado = urlDeWebhookEsperada();

  const [estado, webhook] = await Promise.all([
    estadoDaInstancia(workspaceId, slot).catch(() => null),
    buscarWebhookRegistrado(workspaceId, slot).catch(() => null),
  ]);

  /*
   * Compara só o caminho, sem a query string: o token é derivado da chave da Evolution e não deve
   * sair daqui em nenhuma resposta nem em nenhum log.
   *
   * E COMPARA A LISTA DE EVENTOS, não só o endereço. Uma instância registrada antes de um evento
   * novo existir fica com a lista velha pra sempre: o endereço está certo, então nada aqui achava
   * que havia o que consertar, e a Evolution simplesmente nunca chamava aquele evento. Foi o que
   * aconteceu com `MESSAGES_UPDATE` (os tiquinhos de entregue e lido).
   */
  const eventosRegistrados = (webhook?.eventos ?? []).map((e) => e.toUpperCase());
  const faltamEventos = EVENTOS_WEBHOOK.some((e) => !eventosRegistrados.includes(e));
  const certo = webhook?.ativo === true && semToken(webhook.url) === semToken(esperado) && !faltamEventos;

  let reparado = false;
  if (!certo && opcoes.reparar && integracao?.status === "conectado") {
    await reconfigurarWebhook(workspaceId, slot).catch(() => {});
    const conferido = await buscarWebhookRegistrado(workspaceId, slot).catch(() => null);
    const eventosDepois = (conferido?.eventos ?? []).map((e) => e.toUpperCase());
    reparado =
      conferido?.ativo === true &&
      semToken(conferido.url) === semToken(esperado) &&
      EVENTOS_WEBHOOK.every((e) => eventosDepois.includes(e));
  }

  /*
   * Os ajustes da instância são reaplicados junto, sempre que a conexão está de pé.
   *
   * O que está em jogo aqui é `groupsIgnore`. Com ele ligado, a Evolution não entrega mensagem de
   * grupo — e não entrega em silêncio: não há erro, não há descarte, não há nada no CRM que denuncie
   * a falta. O grupo simplesmente não existe deste lado, e a conclusão de quem usa é que o CRM não
   * suporta grupo.
   *
   * O ajuste já era feito na conexão, mas só nela: uma instância que ficou com o valor errado
   * precisava de um QR Code novo pra voltar ao normal. Reaplicar aqui é barato (uma chamada) e
   * torna o conserto automático.
   */
  if (opcoes.reparar && integracao?.status === "conectado") {
    await aplicarAjustesDaInstancia(workspaceId, slot).catch(() => {});
  }

  /*
   * O status gravado passa a seguir a verdade do outro lado.
   *
   * A tela dizia "conectado" com a sessão já derrubada: o CRM só atualiza esse campo quando a
   * Evolution AVISA que caiu, e esse aviso se perde (instância recriada, servidor reiniciado,
   * webhook fora do ar). Aí fica um "conectado" que não recebe mensagem nenhuma, e a pessoa passa
   * a desconfiar de tudo que a tela mostra, com razão.
   *
   * Quem manda é o estado da Evolution, porque é lá que a sessão realmente vive. Só corrige quando
   * ela respondeu: servidor fora do ar devolve `null`, e nesse caso mexer no status seria trocar
   * uma informação velha por uma inventada.
   */
  /*
   * ESTA GRAVAÇÃO NÃO É CONSERTO, e por isso ela acontece mesmo sem `reparar`.
   *
   * Eu tinha trancado ela junto com as outras duas, e isso foi um erro com consequência grave: o
   * status gravado é o que decide quais conversas APARECEM (`contasCanalVisiveis` só considera
   * integração "conectado"; sem nenhuma, o filtro não casa nada e a caixa de entrada fica
   * inteiramente vazia). Com o status defasado em "desconectado", a mensagem continua sendo
   * gravada pelo webhook e simplesmente não aparece pra ninguém, até o cron passar.
   *
   * A diferença em relação ao que ficou trancado: reconfigurar o webhook e reaplicar os ajustes
   * MUDAM o outro lado; corrigir os donos REESCREVE mensagem já gravada. Isto aqui só anota o que
   * a Evolution acabou de responder. É cache de uma observação, não alteração de comportamento.
   */
  if (estado && integracao) {
    const deveriaSer = estado === "open" ? "conectado" : "desconectado";
    if (integracao.status !== deveriaSer) {
      await prisma.integracao
        .update({
          where: { workspaceId_provedor_slot: { workspaceId, provedor: "whatsapp_nao_oficial", slot } },
          data: { status: deveriaSer },
        })
        .catch(() => {});
      integracao.status = deveriaSer;
    }
  }

  /*
   * O NÚMERO DA CONEXÃO, quando ele se perdeu.
   *
   * Ele só é aprendido uma vez, no evento `connection.update` da Evolution. Se esse evento não
   * chegou (instância recriada, webhook fora do ar naquele instante, servidor restaurado), a
   * conexão fica de pé e o CRM nunca mais descobre o número — porque não há um segundo momento em
   * que ele pergunte.
   *
   * O que isso custava: toda conversa nova nascia sem dono, e o lead do AZUZ Flow entrava sem
   * conversa nenhuma (hoje já não entra, ver `azuz-flow-canal.ts`, mas a marca continua faltando).
   *
   * Aqui é o segundo momento. Uma chamada, só quando o número falta e a conexão está de pé.
   */
  if (integracao?.status === "conectado" && !metadados.numero) {
    const numero = await buscarNumeroConectado(workspaceId, slot).catch(() => null);
    if (numero) {
      await prisma.integracao
        .update({
          where: { workspaceId_provedor_slot: { workspaceId, provedor: "whatsapp_nao_oficial", slot } },
          data: { metadados: { ...metadados, numero } },
        })
        .catch(() => {});
      metadados.numero = numero;
    }
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
    ultimaMensagem: registro.ultimaMensagem ?? null,
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
 * sozinho, não na próxima vez que alguém reclamar.
 */
export async function conferirCanalQrCodeDeTodosOsWorkspaces(): Promise<{
  conferidos: number;
  reparados: string[];
}> {
  const conectadas = await prisma.integracao.findMany({
    where: { provedor: "whatsapp_nao_oficial", status: "conectado" },
    select: { workspaceId: true, slot: true },
  });
  const reparados: string[] = [];
  for (const { workspaceId, slot } of conectadas) {
    const saude = await conferirCanalQrCode(workspaceId, { reparar: true, slot }).catch(() => null);
    if (saude?.reparado) reparados.push(workspaceId);
  }
  return { conferidos: conectadas.length, reparados };
}

/**
 * QUANTO SILÊNCIO JÁ É SUSPEITO.
 *
 * Uma conexão viva fala com o CRM o tempo todo: mensagem, tiquinho de entregue, atualização de
 * presença. Quinze minutos sem um único evento, com a conexão marcada como conectada, não é
 * "dia parado" — é o aviso tendo se perdido do outro lado.
 */
export const SILENCIO_SUSPEITO_MS = 15 * 60 * 1000;

/**
 * Esta conexão parou de falar com o CRM?
 *
 * Separada e exportada porque é a DECISÃO: ela define quem a passada do minuto vai conferir
 * contra a Evolution. Errar pra um lado deixa a cliente sem mensagem; errar pro outro transforma
 * o conserto em sessenta chamadas por hora contra a Evolution, por workspace. Decisão assim tem
 * teste, e o teste não precisa de banco nem de rede.
 *
 * Na dúvida — nunca houve evento, ou a data gravada não dá pra ler — responde SIM: o custo de
 * conferir é uma chamada; o custo de não conferir é alguém respondendo pelo celular e não vendo
 * nada aparecer aqui.
 */
export function estaEmSilencio(registro: RegistroDeWebhook | undefined, agora: number): boolean {
  if (!registro?.ultimoEventoEm) return true;
  const quando = Date.parse(registro.ultimoEventoEm);
  return !Number.isFinite(quando) || agora - quando > SILENCIO_SUSPEITO_MS;
}

/**
 * CONSERTA QUEM EMUDECEU, sem esperar a varredura da hora cheia.
 *
 * A varredura de hora em hora já existia, e é ela que garante que nada fica quebrado pra sempre.
 * Mas uma hora é muito tempo pra quem está conversando: a pessoa responde pelo celular, não vê a
 * mensagem no CRM, responde de novo, e a essa altura já concluiu que o produto não funciona.
 *
 * Esta passada olha só uma coluna — quando foi o último evento que a Evolution mandou — e só
 * mexe em quem está em silêncio. Com todo mundo recebendo normalmente, ela custa uma consulta e
 * mais nada, e pode rodar a cada minuto.
 */
export async function reconectarQuemEmudeceu(agora = Date.now()): Promise<{
  silenciosos: number;
  reparados: string[];
}> {
  const conectadas = await prisma.integracao.findMany({
    where: { provedor: "whatsapp_nao_oficial", status: "conectado" },
    select: { workspaceId: true, slot: true, metadados: true },
  });

  const silenciosos = conectadas.filter(({ metadados }) =>
    estaEmSilencio((metadados as Record<string, unknown> | null)?.webhook as RegistroDeWebhook | undefined, agora),
  );

  const reparados: string[] = [];
  for (const { workspaceId, slot } of silenciosos) {
    const saude = await conferirCanalQrCode(workspaceId, { reparar: true, slot }).catch(() => null);
    if (saude?.reparado) reparados.push(workspaceId);
  }
  return { silenciosos: silenciosos.length, reparados };
}
