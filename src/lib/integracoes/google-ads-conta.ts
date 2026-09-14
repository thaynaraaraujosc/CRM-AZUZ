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

  /*
   * Renovação que falha é conexão MORTA, e precisa dizer isso na tela.
   *
   * O caso concreto, e ele tem data: enquanto a tela de permissão OAuth estiver em "Testes", o
   * Google mata todo refresh token em SETE DIAS. A conexão feita hoje para de funcionar na semana
   * que vem, e o que volta é um `invalid_grant` seco. Sem este tratamento a tela continuaria
   * dizendo "Google Ads conectado" e mostrando campanha nenhuma, e a leitura natural de quem olha
   * é "não investi nada", não "a autorização venceu".
   *
   * O mesmo vale quando o cliente remove o acesso do CRM na conta Google dele: não há conserto
   * automático possível, e o único caminho é reconectar. Então o que a tela precisa é DIZER isso.
   */
  let tokens;
  try {
    tokens = await renovarAccessToken(decriptar(integracao.refreshTokenCriptografado));
  } catch (erro) {
    const causa = erro instanceof Error ? erro.message : "";
    await marcarErro(workspaceId, mensagemDeAutorizacaoPerdida(causa));
    return null;
  }

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
 * Traduz a recusa do Google pra uma frase que diz o que fazer.
 *
 * `invalid_grant` é o que o Google devolve tanto pro token de sete dias que venceu quanto pro
 * acesso que o cliente revogou. São causas diferentes com o mesmo conserto — reconectar — e a
 * frase precisa dizer o conserto, porque "invalid_grant" na tela não ajuda ninguém.
 */
export function mensagemDeAutorizacaoPerdida(causa: string): string {
  if (/invalid_grant|expired|revoked/i.test(causa)) {
    return "A autorização do Google venceu ou foi removida. Clique em Conectar Google Ads para autorizar de novo.";
  }
  return `Não foi possível renovar a autorização do Google: ${causa || "motivo não informado"}.`;
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
