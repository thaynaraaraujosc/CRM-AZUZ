/**
 * O texto de uma mensagem do WhatsApp, seja qual for o embrulho que ela veio.
 *
 * O Baileys entrega a mensagem exatamente como o WhatsApp a manda, e o WhatsApp EMBRULHA o
 * conteúdo em vários casos corriqueiros: conversa com mensagens temporárias ligadas
 * (`ephemeralMessage`), foto/vídeo de ver uma vez (`viewOnceMessage`), documento com legenda,
 * mensagem editada. O conteúdo de verdade fica um nível (ou dois) mais fundo.
 *
 * O CRM lia só o nível de cima. Mensagem embrulhada não tinha texto nenhum aos olhos dele e era
 * descartada em silêncio: a pessoa mandava, chegava no celular, e não aparecia aqui. Como isso
 * depende de uma configuração de CADA conversa (mensagens temporárias é coisa que o contato liga
 * do lado dele), o sintoma era o pior possível: chega de uns e não chega de outros, sem padrão
 * visível.
 *
 * Função pura de propósito: é a regra que decide se uma mensagem existe ou não pro CRM, e é ela
 * que precisa de teste.
 */

type Mensagem = Record<string, unknown> | null | undefined;

/** Os embrulhos que guardam a mensagem de verdade lá dentro, num campo `message`. */
const EMBRULHOS = [
  "ephemeralMessage",
  "viewOnceMessage",
  "viewOnceMessageV2",
  "viewOnceMessageV2Extension",
  "documentWithCaptionMessage",
  "editedMessage",
] as const;

/**
 * Tira os embrulhos até chegar no conteúdo. Vários deles se aninham de verdade (uma foto de ver
 * uma vez dentro de uma conversa temporária), então desce em laço, com um teto pra nunca girar à
 * toa num payload estranho.
 */
export function desembrulharMensagem(message: Mensagem): Record<string, unknown> | null {
  let atual = message ?? null;
  for (let volta = 0; volta < 5 && atual; volta += 1) {
    // `protocolMessage.editedMessage` é o formato da edição em algumas versões: o texto novo mora
    // ali dentro, e sem isso uma mensagem editada chegava vazia.
    const protocolo = atual.protocolMessage as Record<string, unknown> | undefined;
    if (protocolo?.editedMessage) {
      atual = protocolo.editedMessage as Record<string, unknown>;
      continue;
    }
    const embrulho = EMBRULHOS.find((chave) => atual?.[chave]);
    if (!embrulho) return atual;
    const dentro = (atual[embrulho] as Record<string, unknown> | undefined)?.message;
    if (!dentro) return atual;
    atual = dentro as Record<string, unknown>;
  }
  return atual;
}

/**
 * O texto que vai aparecer na conversa. `null` quando a mensagem não tem nada pra mostrar (uma
 * confirmação de entrega, por exemplo, que não é mensagem de ninguém).
 *
 * Mídia sem legenda vira um aviso de que ela chegou: o arquivo em si não vem no webhook (embutir
 * mídia em base64 já derrubou o servidor inteiro, ver `configurarWebhook`), mas some sem deixar
 * rastro é pior do que aparecer como aviso.
 */
export function extrairTextoDaMensagem(message: Mensagem): string | null {
  const m = desembrulharMensagem(message);
  if (!m) return null;

  const texto = (campo: unknown) => (typeof campo === "string" && campo.trim() ? campo : null);
  const dentro = (chave: string) => m[chave] as Record<string, unknown> | undefined;

  const direto =
    texto(m.conversation) ??
    texto(dentro("extendedTextMessage")?.text) ??
    // Resposta a botão ou a lista: o que a pessoa escolheu é o que ela "disse".
    texto(dentro("buttonsResponseMessage")?.selectedDisplayText) ??
    texto(dentro("templateButtonReplyMessage")?.selectedDisplayText) ??
    texto((dentro("listResponseMessage")?.singleSelectReply as Record<string, unknown> | undefined)?.selectedRowId) ??
    texto(dentro("listResponseMessage")?.title);
  if (direto) return direto;

  if (dentro("audioMessage")) return "🎤 Mensagem de voz";
  if (dentro("imageMessage")) return texto(dentro("imageMessage")?.caption) ?? "📷 Foto (veja no celular conectado)";
  if (dentro("videoMessage")) return texto(dentro("videoMessage")?.caption) ?? "🎬 Vídeo (veja no celular conectado)";
  if (dentro("documentMessage")) {
    return (
      texto(dentro("documentMessage")?.caption) ??
      `📄 Documento: ${texto(dentro("documentMessage")?.fileName) ?? "arquivo"}`
    );
  }
  if (dentro("stickerMessage")) return "🩶 Figurinha (veja no celular conectado)";
  if (dentro("locationMessage") || dentro("liveLocationMessage")) return "📍 Localização (veja no celular conectado)";
  if (dentro("contactMessage") || dentro("contactsArrayMessage")) return "👤 Contato (veja no celular conectado)";
  if (dentro("pollCreationMessage") || dentro("pollCreationMessageV3")) {
    return `📊 Enquete: ${texto(dentro("pollCreationMessage")?.name) ?? texto(dentro("pollCreationMessageV3")?.name) ?? "sem título"}`;
  }

  return null;
}

/** O que veio, quando não deu pra achar texto. Vai pro registro de descarte, que é o que permite
 * descobrir um formato novo sem precisar adivinhar. */
export function chavesDaMensagem(message: Mensagem): string {
  const m = desembrulharMensagem(message);
  if (!m) return "sem conteúdo";
  return Object.keys(m).join(", ") || "sem conteúdo";
}
