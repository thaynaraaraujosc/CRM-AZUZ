import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/prisma";

/**
 * Link público, assinado e temporário pra um arquivo — a ponte que faz o envio de anexo funcionar.
 *
 * Por que existe: mandar anexo pelo Direct do Instagram não aceita o arquivo no corpo da chamada.
 * A API da Meta recebe um ENDEREÇO e vai buscar o conteúdo ela mesma, de fora, sem sessão nenhuma.
 * Como toda rota de mídia do CRM exige login, a Meta batia numa porta fechada — e era por isso que
 * documento e imagem nunca saíam.
 *
 * Como o risco fica contido:
 * - o id é aleatório (16 bytes), não sequencial: não dá pra varrer;
 * - o link só responde com uma assinatura HMAC do próprio id — id vazado sozinho não abre nada;
 * - expira (padrão 1 hora). A Meta busca o arquivo em segundos; o resto da janela é folga.
 *
 * Continua sendo uma exposição real enquanto vale, e por isso guarda só o que está sendo enviado
 * naquele momento — nunca o histórico.
 */
const VALIDADE_PADRAO_MS = 60 * 60 * 1000;

function chave(): string {
  const segredo = process.env.INTEGRACAO_ENCRYPTION_KEY;
  if (!segredo) {
    throw new Error("INTEGRACAO_ENCRYPTION_KEY não configurada — necessária pra assinar links de anexo.");
  }
  return segredo;
}

function assinar(id: string): string {
  return createHmac("sha256", chave()).update(`anexo-publico:${id}`).digest("hex");
}

/** Comparação em tempo constante — comparar com `===` vaza, pelo tempo de resposta, quantos
 * caracteres do começo bateram, o que permite descobrir a assinatura tentativa a tentativa. */
export function assinaturaConfere(id: string, assinatura: string | null): boolean {
  if (!assinatura) return false;
  const esperada = Buffer.from(assinar(id));
  const recebida = Buffer.from(assinatura);
  return esperada.length === recebida.length && timingSafeEqual(esperada, recebida);
}

/**
 * Guarda o arquivo e devolve o endereço absoluto pra Meta buscar.
 *
 * `APP_URL` precisa apontar pro domínio público do CRM — a Meta busca de fora, então um endereço
 * interno ou `localhost` faz o envio falhar sem explicação clara do lado dela.
 */
export async function publicarAnexoTemporario(params: {
  workspaceId: string;
  nome: string;
  dataUrl: string;
  validadeMs?: number;
}): Promise<{ url: string; id: string }> {
  const { workspaceId, nome, dataUrl, validadeMs = VALIDADE_PADRAO_MS } = params;

  const appUrl = (process.env.APP_URL ?? "").replace(/\/+$/, "");
  if (!appUrl) throw new Error("APP_URL não configurado — sem ele a Meta não tem de onde buscar o arquivo.");

  const separador = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || separador < 0) throw new Error("Arquivo em formato inesperado.");
  const mimeType = dataUrl.slice(5, separador).split(";")[0] || "application/octet-stream";
  const conteudo = dataUrl.slice(separador + 1);

  const id = randomBytes(16).toString("hex");
  await prisma.anexoPublico.create({
    data: {
      id,
      workspaceId,
      nome,
      mimeType,
      conteudo,
      expiraEm: new Date(Date.now() + validadeMs),
    },
  });

  return { id, url: `${appUrl}/api/anexos/publico/${id}?a=${assinar(id)}` };
}

/** Remove os que já venceram. Chamado a cada publicação nova: sem isso a tabela viraria um depósito
 * de tudo que já foi enviado, com cada arquivo continuando acessível muito depois de precisar. */
export async function limparAnexosVencidos(): Promise<void> {
  await prisma.anexoPublico
    .deleteMany({ where: { expiraEm: { lt: new Date() } } })
    .catch((erro) => console.error("[anexo-publico] Falha ao limpar anexos vencidos:", erro));
}
