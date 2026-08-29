/**
 * Mídia de mensagem: guardada embutida no banco (data URL), servida por link.
 *
 * O histórico inteiro do workspace é carregado de uma vez em `GET /api/mensagens-extra` (e de novo
 * a cada 5s pelo polling). Enquanto o anexo ia embutido dentro desse JSON, uma única foto ou áudio
 * podia somar megabytes ao payload — e o navegador tinha que baixar e parsear TUDO antes de
 * desenhar a primeira bolha. Era isso que fazia as mensagens antigas demorarem a aparecer ao
 * atualizar a página.
 *
 * A troca: no lugar da data URL vai um link pra `GET /api/mensagens-extra/midia`. O JSON volta a
 * ser pequeno, e cada arquivo é baixado pelo próprio `<img>`/`<audio>` — sob demanda, em paralelo,
 * e com cache do navegador (o conteúdo de uma mensagem nunca muda, então vale `immutable`).
 *
 * O formato guardado no banco NÃO muda: continua data URL. A troca acontece só na saída.
 */
export const ROTA_MIDIA = "/api/mensagens-extra/midia";

/** Um valor que já é um link nosso (e não o conteúdo de verdade). */
export function ehLinkDeMidia(valor: unknown): valor is string {
  return typeof valor === "string" && valor.startsWith(`${ROTA_MIDIA}?`);
}

function ehDataUrl(valor: unknown): valor is string {
  return typeof valor === "string" && valor.startsWith("data:");
}

/**
 * Percorre `extras` em profundidade e chama `visitar` em cada data URL encontrada, com o caminho
 * até ela (`imagens.0.url`, `video.url`, …). Genérico de propósito: enumerar os campos à mão
 * significaria que todo tipo de anexo novo nasceria pesando no payload de novo, sem ninguém notar.
 */
function percorrer(
  valor: unknown,
  caminho: string[],
  visitar: (caminho: string, dataUrl: string) => string | undefined,
): unknown {
  if (ehDataUrl(valor)) return visitar(caminho.join("."), valor) ?? valor;
  if (Array.isArray(valor)) return valor.map((item, i) => percorrer(item, [...caminho, String(i)], visitar));
  if (valor && typeof valor === "object") {
    const saida: Record<string, unknown> = {};
    for (const [chave, item] of Object.entries(valor as Record<string, unknown>)) {
      saida[chave] = percorrer(item, [...caminho, chave], visitar);
    }
    return saida;
  }
  return valor;
}

/** Troca toda data URL de `extras` pelo link que serve aquele arquivo. */
export function trocarMidiaPorLink(extras: unknown, mensagemId: string): Record<string, unknown> {
  return percorrer(extras, [], (caminho) =>
    `${ROTA_MIDIA}?id=${encodeURIComponent(mensagemId)}&campo=${encodeURIComponent(caminho)}`,
  ) as Record<string, unknown>;
}

/** Lê a data URL que está num caminho (`imagens.0.url`) dentro de `extras`. */
export function lerMidiaNoCaminho(extras: unknown, caminho: string): string | null {
  let atual: unknown = extras;
  for (const parte of caminho.split(".")) {
    if (atual == null || typeof atual !== "object") return null;
    atual = (atual as Record<string, unknown>)[parte];
  }
  return ehDataUrl(atual) ? atual : null;
}

/**
 * Devolve o conteúdo de verdade nos campos em que o cliente mandou de volta só o nosso link.
 *
 * Sem isto, o primeiro `PUT` depois de um `GET` gravaria o link por cima da data URL — o arquivo
 * seria perdido e o link passaria a apontar pra si mesmo. Vale a regra geral: o cliente nunca
 * recebeu o conteúdo, então não pode ser fonte de verdade sobre ele.
 */
export function preservarMidiaGuardada(
  extrasRecebidos: Record<string, unknown>,
  extrasGuardados: unknown,
): Record<string, unknown> {
  if (!extrasGuardados || typeof extrasGuardados !== "object") return extrasRecebidos;
  const restaurar = (valor: unknown, caminho: string[]): unknown => {
    if (ehLinkDeMidia(valor)) return lerMidiaNoCaminho(extrasGuardados, caminho.join(".")) ?? valor;
    if (Array.isArray(valor)) return valor.map((item, i) => restaurar(item, [...caminho, String(i)]));
    if (valor && typeof valor === "object") {
      const saida: Record<string, unknown> = {};
      for (const [chave, item] of Object.entries(valor as Record<string, unknown>)) {
        saida[chave] = restaurar(item, [...caminho, chave]);
      }
      return saida;
    }
    return valor;
  };
  return restaurar(extrasRecebidos, []) as Record<string, unknown>;
}
