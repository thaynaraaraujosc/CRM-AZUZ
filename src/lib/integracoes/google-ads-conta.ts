import { prisma } from "@/lib/prisma";
import { decriptar, encriptar } from "@/lib/integracoes/crypto";
import { renovarAccessToken } from "@/lib/integracoes/google-ads";

/**
 * O token válido da conta do Google Ads de um workspace.
 *
 * Isto existe porque o Google é diferente da Meta neste ponto: o token de acesso dura UMA HORA. A
 * integração da Meta guarda um token de longa duração e usa ele direto; aqui, guardar e usar não
 * basta. Sem renovação a conexão funciona na tarde em que foi feita e aparece "conectada e sem
 * campanha" no dia seguinte, que é o pior formato de defeito: a tela diz que está tudo certo.
 *
 * O refresh token é o que não expira, e é ele que fica na coluna própria (nunca em `metadados`,
 * que a tela lê inteiro).
 */

/**
 * Um minuto de folga.
 *
 * Renovar só depois de vencer deixa uma janela em que o token vence entre a checagem e a chegada
 * da chamada no Google, e o erro que volta é 401 sem nada que aponte pra causa.
 */
const FOLGA_MS = 60_000;

export function precisaRenovar(expiraEm: Date | null, agora: Date = new Date()): boolean {
  if (!expiraEm) return true;
  return expiraEm.getTime() - agora.getTime() <= FOLGA_MS;
}

export type ContaGoogleAds = { accessToken: string; customerId: string };

/**
 * Devolve `null` quando não há conexão utilizável, em vez de lançar: quem chama é rota de tela, e
 * "não conectado" é resposta normal, não falha.
 */
export async function contaDoWorkspace(workspaceId: string): Promise<ContaGoogleAds | null> {
  const integracao = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId, provedor: "google_ads" } },
  });
  if (!integracao || integracao.status !== "conectado") return null;

  const { contaId } = (integracao.metadados as { contaId?: string } | null) ?? {};
  if (!contaId) return null;

  if (!precisaRenovar(integracao.expiraEm) && integracao.accessTokenCriptografado) {
    return { accessToken: decriptar(integracao.accessTokenCriptografado), customerId: contaId };
  }

  if (!integracao.refreshTokenCriptografado) return null;

  const tokens = await renovarAccessToken(decriptar(integracao.refreshTokenCriptografado));
  await prisma.integracao.update({
    where: { workspaceId_provedor: { workspaceId, provedor: "google_ads" } },
    data: {
      accessTokenCriptografado: encriptar(tokens.accessToken),
      expiraEm: tokens.expiraEm,
      erroMensagem: null,
    },
  });
  return { accessToken: tokens.accessToken, customerId: contaId };
}

/**
 * Marca a conexão como quebrada, com o motivo à vista na tela.
 *
 * Quando o cliente remove o acesso do CRM na conta Google dele, o refresh token morre e não há
 * conserto automático possível. Deixar a integração marcada como "conectado" faria a tela mostrar
 * campanha nenhuma sem dizer por quê, e a pessoa concluiria que não investiu.
 */
export async function marcarErro(workspaceId: string, mensagem: string): Promise<void> {
  await prisma.integracao.updateMany({
    where: { workspaceId, provedor: "google_ads" },
    data: { status: "erro", erroMensagem: mensagem.slice(0, 500) },
  });
}
