import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { apagarDoR2, chaveDeArquivo, guardarNoR2, lerDoR2, r2Configurado } from "@/lib/armazenamento/r2";

/**
 * Onde o conteúdo de um anexo passa a morar.
 *
 * Até aqui o arquivo ia inteiro, em base64, dentro da coluna `extras` da mensagem. Agora ele vai
 * pro R2 e no lugar dele fica só uma REFERÊNCIA: a string `r2:<chave>`. A mensagem continua sendo
 * a dona do anexo — o que muda é que ela guarda o endereço em vez do conteúdo.
 *
 * Compatibilidade é o ponto central deste arquivo: tudo que já está gravado em base64 continua
 * gravado em base64 e continua sendo lido normalmente. Não existe "dia da virada" — mensagem
 * antiga e mensagem nova convivem, e a migração do que já existe pode acontecer depois, com calma.
 * Se o R2 não estiver configurado, o comportamento antigo segue valendo inteiro.
 */
const PREFIXO_R2 = "r2:";

/** Um valor que aponta pra um arquivo no R2 (em vez de carregar o conteúdo). */
export function ehReferenciaR2(valor: unknown): valor is string {
  return typeof valor === "string" && valor.startsWith(PREFIXO_R2);
}

/** Um valor que carrega o conteúdo embutido, do jeito antigo. */
export function ehDataUrl(valor: unknown): valor is string {
  return typeof valor === "string" && valor.startsWith("data:");
}

/** Qualquer arquivo guardado, dos dois formatos. */
export function ehMidiaGuardada(valor: unknown): valor is string {
  return ehDataUrl(valor) || ehReferenciaR2(valor);
}

function chaveDaReferencia(referencia: string): string {
  return referencia.slice(PREFIXO_R2.length);
}

/** Separa uma data URL em tipo e bytes. */
function partesDaDataUrl(dataUrl: string): { mimeType: string; conteudo: Buffer } | null {
  const separador = dataUrl.indexOf(",");
  if (separador < 0) return null;
  const mimeType = dataUrl.slice(5, separador).split(";")[0] || "application/octet-stream";
  return { mimeType, conteudo: Buffer.from(dataUrl.slice(separador + 1), "base64") };
}

const EXTENSAO_POR_TIPO: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "application/pdf": "pdf",
};

/**
 * Sobe um arquivo pro R2 e devolve a referência a ser guardada no lugar dele.
 *
 * Devolve a própria data URL de volta quando o R2 não está configurado, e também quando a subida
 * falha: perder a foto do cliente porque a nuvem piscou seria um estrago muito maior do que
 * continuar gravando no banco naquele momento. O erro vai pro log pra não passar despercebido.
 */
export async function guardarArquivo(params: {
  workspaceId: string;
  dataUrl: string;
  origem: "mensagem" | "envio";
}): Promise<string> {
  if (!r2Configurado()) return params.dataUrl;

  const partes = partesDaDataUrl(params.dataUrl);
  if (!partes) return params.dataUrl;

  const chave = chaveDeArquivo({
    workspaceId: params.workspaceId,
    id: randomBytes(16).toString("hex"),
    extensao: EXTENSAO_POR_TIPO[partes.mimeType],
  });

  try {
    await guardarNoR2({ chave, conteudo: partes.conteudo, mimeType: partes.mimeType });
    // O registro entra DEPOIS da gravação: registrar antes criaria linhas apontando pra arquivo
    // que não existe toda vez que a subida falhasse, e o cálculo de espaço passaria a cobrar do
    // cliente por arquivo nenhum.
    await prisma.arquivoArmazenado.create({
      data: {
        chave,
        workspaceId: params.workspaceId,
        bytes: partes.conteudo.length,
        mimeType: partes.mimeType,
        origem: params.origem,
      },
    });
    return `${PREFIXO_R2}${chave}`;
  } catch (erro) {
    console.error("[armazenamento] Falha ao subir arquivo pro R2, mantendo no banco:", erro);
    return params.dataUrl;
  }
}

/** Lê o conteúdo de um anexo, esteja ele no R2 ou embutido no banco. */
export async function lerArquivo(valor: string): Promise<{ conteudo: Buffer; mimeType: string } | null> {
  if (ehReferenciaR2(valor)) return lerDoR2(chaveDaReferencia(valor));
  if (ehDataUrl(valor)) return partesDaDataUrl(valor);
  return null;
}

/** Apaga o arquivo e o registro dele. Silencioso pra valores do formato antigo: não há o que apagar. */
export async function apagarArquivo(valor: string): Promise<void> {
  if (!ehReferenciaR2(valor)) return;
  const chave = chaveDaReferencia(valor);
  await apagarDoR2(chave);
  await prisma.arquivoArmazenado.deleteMany({ where: { chave } });
}

/**
 * Percorre `extras` e sobe pro R2 toda data URL encontrada, devolvendo a estrutura com as
 * referências no lugar.
 *
 * Genérico de propósito, como o `percorrer` de `midia-mensagem.ts`: enumerar os campos à mão faria
 * com que todo tipo de anexo novo nascesse gravando base64 no banco de novo, sem ninguém notar.
 */
export async function guardarMidiasDosExtras<T>(extras: T, workspaceId: string): Promise<T> {
  if (!r2Configurado()) return extras;

  const visitar = async (valor: unknown): Promise<unknown> => {
    if (ehDataUrl(valor)) return guardarArquivo({ workspaceId, dataUrl: valor, origem: "mensagem" });
    if (Array.isArray(valor)) return Promise.all(valor.map(visitar));
    if (valor && typeof valor === "object") {
      const entradas = await Promise.all(
        Object.entries(valor as Record<string, unknown>).map(async ([chave, item]) => [chave, await visitar(item)] as const),
      );
      return Object.fromEntries(entradas);
    }
    return valor;
  };

  return (await visitar(extras)) as T;
}

/** Soma quantos bytes um workspace ocupa hoje no R2. */
export async function espacoUsado(workspaceId: string): Promise<number> {
  const total = await prisma.arquivoArmazenado.aggregate({
    where: { workspaceId },
    _sum: { bytes: true },
  });
  return total._sum.bytes ?? 0;
}
