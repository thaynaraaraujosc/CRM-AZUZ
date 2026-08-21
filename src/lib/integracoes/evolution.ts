import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Cliente da Evolution API (servidor próprio, fora da Vercel, que fala com o WhatsApp via Baileys
 * por trás de uma API REST) — substitui o whatsapp-service customizado deste repo como forma de
 * conectar o WhatsApp "não oficial" (QR Code). Uma instância da Evolution = um número de WhatsApp;
 * este CRM cria uma instância por workspace, nomeada `crm-<workspaceId>`, então um servidor
 * Evolution só atende vários workspaces ao mesmo tempo sem misturar conexões.
 */

function baseUrl(): string {
  const valor = process.env.EVOLUTION_API_URL;
  if (!valor) throw new Error("EVOLUTION_API_URL não configurado.");
  return valor.replace(/\/+$/, "");
}

function apiKey(): string {
  const valor = process.env.EVOLUTION_API_KEY;
  if (!valor) throw new Error("EVOLUTION_API_KEY não configurado.");
  return valor;
}

export function nomeInstancia(workspaceId: string): string {
  return `crm-${workspaceId}`;
}

/** Extrai o workspaceId de volta do nome da instância que a Evolution manda nos eventos de
 * webhook — `null` se não bater com o padrão que este CRM usa (evento de instância de outro uso
 * do mesmo servidor, por exemplo). */
export function workspaceIdDaInstancia(instancia: string): string | null {
  return instancia.startsWith("crm-") ? instancia.slice(4) : null;
}

async function chamarEvolution(caminho: string, method: "GET" | "POST" | "DELETE", corpo?: Record<string, unknown>) {
  const resposta = await fetch(`${baseUrl()}${caminho}`, {
    method,
    headers: { "content-type": "application/json", apikey: apiKey() },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const mensagem = (dados && (dados.message ?? dados.error ?? dados.response?.message)) || resposta.statusText;
    throw new Error(`Evolution API respondeu ${resposta.status} em ${caminho}: ${JSON.stringify(mensagem)}`);
  }
  return dados;
}

function webhookUrl(): string {
  const appUrl = (process.env.APP_URL ?? "").replace(/\/+$/, "");
  if (!appUrl) throw new Error("APP_URL não configurado.");
  return `${appUrl}/api/webhooks/evolution?token=${assinarWebhook()}`;
}

/** Token fixo que autentica as chamadas da Evolution pro nosso webhook — deriva da própria
 * EVOLUTION_API_KEY (HMAC), sem precisar de mais uma variável de ambiente só pra isso. Não
 * autoriza um workspace específico (isso vem do nome da instância no payload, conferido contra o
 * banco); só garante que a chamada veio de quem conhece a chave da nossa Evolution. */
function assinarWebhook(): string {
  return createHmac("sha256", apiKey()).update("evolution-webhook").digest("hex");
}

export function validarTokenWebhook(tokenRecebido: string | null): boolean {
  if (!tokenRecebido) return false;
  const bufRecebido = Buffer.from(tokenRecebido);
  const bufEsperado = Buffer.from(assinarWebhook());
  if (bufRecebido.length !== bufEsperado.length) return false;
  return timingSafeEqual(bufRecebido, bufEsperado);
}

type RespostaQrCode = { qrDataUrl: string | null };

const EVENTOS_WEBHOOK = ["QRCODE_UPDATED", "CONNECTION_UPDATE", "MESSAGES_UPSERT"];

/** Registra (ou atualiza) o webhook da instância numa chamada própria, separada da criação —
 * várias versões/instalações da Evolution ignoram silenciosamente o campo `webhook` passado dentro
 * de `POST /instance/create`, então confiar só nisso deixa instância sem nenhum evento chegando no
 * CRM. Chamado sempre que a pessoa clica em "Conectar", idempotente (não tem problema registrar de
 * novo numa instância que já tinha webhook certo). */
async function configurarWebhook(instancia: string): Promise<void> {
  await chamarEvolution(`/webhook/set/${instancia}`, "POST", {
    webhook: {
      enabled: true,
      url: webhookUrl(),
      byEvents: false,
      // `false`: o CRM não usa mídia recebida pelo webhook (só lê o texto da mensagem em
      // `processarMensagemRecebida`, qualquer mensagem sem texto é descartada) — pedir a Evolution
      // pra embutir o arquivo inteiro em base64 dentro do JSON do webhook incha o payload em vários
      // MB pra cada foto/áudio/vídeo, o suficiente pra derrubar o processo do Node ao tentar
      // parsear (bug real: crashava o servidor inteiro toda vez que chegava mídia numa conta ativa).
      base64: false,
      events: EVENTOS_WEBHOOK,
    },
  }).catch((erro) => {
    console.error(`Falha ao configurar webhook da instância ${instancia}:`, erro);
  });
}

/** Desliga a sincronização do histórico inteiro do celular ao conectar — sem isso, a primeira
 * conexão (ou reconexão) traz TODAS as mensagens que já existiam no WhatsApp de quem escaneou o QR
 * (no caso real que motivou isso, mais de 41 mil mensagens de uma vez), o que trava o CRM tentando
 * importar tudo. Chamado numa etapa própria, separada da criação, pelo mesmo motivo do webhook
 * acima: o campo inline em `/instance/create` não é confiável em toda versão/instalação. */
async function desativarSincronizacaoDeHistorico(instancia: string): Promise<void> {
  await chamarEvolution(`/settings/set/${instancia}`, "POST", {
    rejectCall: false,
    groupsIgnore: false,
    alwaysOnline: false,
    readMessages: false,
    readStatus: false,
    syncFullHistory: false,
  }).catch((erro) => {
    console.error(`Falha ao desativar sincronização de histórico da instância ${instancia}:`, erro);
  });
}

/** Garante que a instância do workspace existe na Evolution (cria na primeira vez) e devolve o QR
 * Code atual pra escanear. Instância que já existe e já está conectada não tem QR novo — o status
 * `conectado` é o que importa nesse caso, não o QR. */
export async function conectarWhatsAppNaoOficial(workspaceId: string): Promise<RespostaQrCode> {
  const instancia = nomeInstancia(workspaceId);

  const estadoAtual = await chamarEvolution(`/instance/connectionState/${instancia}`, "GET").catch(() => null);

  if (!estadoAtual) {
    // Instância ainda não existe nesse servidor Evolution — cria já tentando configurar o webhook
    // e desligar a sincronização de histórico inline (funciona em algumas versões) e confirma com
    // chamadas separadas logo depois.
    const criada = await chamarEvolution("/instance/create", "POST", {
      instanceName: instancia,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
      syncFullHistory: false,
      webhook: {
        url: webhookUrl(),
        byEvents: false,
        base64: false, // ver comentário em configurarWebhook() sobre por que não
        events: EVENTOS_WEBHOOK,
      },
    });
    await Promise.all([configurarWebhook(instancia), desativarSincronizacaoDeHistorico(instancia)]);
    const base64 = criada?.qrcode?.base64 ?? null;
    return { qrDataUrl: base64 };
  }

  await Promise.all([configurarWebhook(instancia), desativarSincronizacaoDeHistorico(instancia)]);

  if (estadoAtual?.instance?.state === "open") {
    return { qrDataUrl: null };
  }

  // Instância existe mas não está conectada — pede um QR novo (também reabre a conexão se tiver
  // caído).
  const conexao = await chamarEvolution(`/instance/connect/${instancia}`, "GET");
  const base64 = conexao?.base64 ?? conexao?.qrcode?.base64 ?? null;
  return { qrDataUrl: base64 };
}

/** Pede pra Evolution encerrar a sessão desse workspace (equivalente a "sair" no WhatsApp Web) —
 * a instância continua existindo, só desconectada; conectar de novo gera um QR novo. */
export function desconectarWhatsAppNaoOficial(workspaceId: string) {
  return chamarEvolution(`/instance/logout/${nomeInstancia(workspaceId)}`, "DELETE");
}

/** Manda uma mensagem de texto pelo número conectado desse workspace — usado quando o atendente
 * responde pela tela de Conversas num contato que chegou pelo WhatsApp não oficial. */
export function enviarMensagemWhatsAppNaoOficial(workspaceId: string, numero: string, texto: string) {
  return chamarEvolution(`/message/sendText/${nomeInstancia(workspaceId)}`, "POST", { number: numero, text: texto });
}

/** Manda um áudio (nota de voz) gravado no CRM pelo número conectado — `audioBase64` é só o
 * conteúdo (sem o prefixo `data:audio/...;base64,` do blob gravado no navegador, tirado antes de
 * chegar aqui). Endpoint ainda não validado contra a instância de produção (mesmo aviso de
 * `buscarFotoPerfil`) — o `.catch` de quem chama loga o erro real se o nome/formato estiver errado. */
export function enviarAudioWhatsAppNaoOficial(workspaceId: string, numero: string, audioBase64: string) {
  return chamarEvolution(`/message/sendWhatsAppAudio/${nomeInstancia(workspaceId)}`, "POST", {
    number: numero,
    audio: audioBase64,
  });
}

export type InfoGrupo = {
  nome: string;
  descricao: string | null;
  criacao: Date | null;
  participantes: { nome: string; telefone: string }[];
};

/** Busca nome, descrição, data de criação e participantes de um grupo de WhatsApp (JID terminado
 * em `@g.us`) — chamado pelo webhook na primeira mensagem vista de um grupo ainda não cadastrado
 * como `Conversa`, pra exibir os dados de verdade do grupo em vez de só o JID numérico. Falha em
 * silêncio (`null`): um grupo sem esse detalhe ainda funciona (mensagens continuam chegando na
 * thread certa), só mostra o JID como nome até a próxima tentativa.
 *
 * `pushName`/`name` do participante geralmente NÃO vem preenchido pra quem nunca trocou mensagem
 * direta com esse número antes — é limitação da própria API do WhatsApp/Baileys, não do CRM; nesse
 * caso o telefone aparece no lugar do nome (igual mostraria "número desconhecido" no WhatsApp Web
 * pra alguém fora da sua agenda). */
export async function buscarInfoGrupo(workspaceId: string, groupJid: string): Promise<InfoGrupo | null> {
  const instancia = nomeInstancia(workspaceId);
  const dados = await chamarEvolution(
    `/group/findGroupInfos/${instancia}?groupJid=${encodeURIComponent(groupJid)}`,
    "GET",
  ).catch(() => null);
  if (!dados) return null;

  const nome: string | undefined = dados.subject ?? dados.name;
  const descricao: string | null = dados.desc ?? dados.description ?? null;
  const criacaoSegundos: number | undefined = dados.creation ?? dados.subjectTime;
  const criacao = criacaoSegundos ? new Date(criacaoSegundos * 1000) : null;
  const participantesBrutos: unknown[] = Array.isArray(dados.participants) ? dados.participants : [];
  const participantes = participantesBrutos
    .map((p) => {
      const item = p as { id?: string; jid?: string; pushName?: string; name?: string };
      const jid = item.id ?? item.jid;
      const telefone = jid?.split("@")[0];
      if (!telefone) return null;
      return { nome: item.pushName ?? item.name ?? telefone, telefone };
    })
    .filter((p): p is { nome: string; telefone: string } => p !== null);

  if (!nome && !participantes.length) return null;
  return { nome: nome ?? groupJid.split("@")[0], descricao, criacao, participantes };
}

/** Busca a URL da foto de perfil (grupo OU pessoa) de um JID/número — chamado uma vez, quando a
 * conversa é vista pela primeira vez (webhook grava em `Conversa.fotoUrl`). Falha em silêncio
 * (`null`): sem foto (perfil sem uma definida) é o caso normal, não um erro real. */
export async function buscarFotoPerfil(workspaceId: string, jidOuNumero: string): Promise<string | null> {
  const instancia = nomeInstancia(workspaceId);
  const dados = await chamarEvolution(`/chat/fetchProfilePictureUrl/${instancia}`, "POST", {
    number: jidOuNumero,
  }).catch((erro) => {
    // Log de verdade (não só `null` em silêncio) — esse endpoint específico ainda não foi validado
    // contra a versão real da Evolution em produção; se o nome/formato dele estiver errado, é
    // aqui que vai aparecer nos logs da Vercel/Railway pra corrigir.
    console.error(`[evolution] Falha ao buscar foto de perfil de ${jidOuNumero}:`, erro);
    return null;
  });
  return dados?.profilePictureUrl ?? null;
}

/** Busca o número (JID) do WhatsApp conectado numa instância — a Evolution não manda isso direto
 * no evento `connection.update`, só no cadastro da instância em si. Chamado pelo webhook assim que
 * o estado vira `open`, pra guardar o número junto do status `conectado`. */
export async function buscarNumeroConectado(workspaceId: string): Promise<string | null> {
  const instancia = nomeInstancia(workspaceId);
  const dados = await chamarEvolution(`/instance/fetchInstances?instanceName=${instancia}`, "GET").catch(() => null);
  const item = Array.isArray(dados) ? dados[0] : dados;
  const owner: string | undefined = item?.instance?.owner ?? item?.ownerJid ?? item?.owner;
  if (!owner) return null;
  return owner.split("@")[0] ?? null;
}
