import { prisma } from "@/lib/prisma";

/**
 * O status da assinatura, com memória curta.
 *
 * O paywall passou a valer também em `/api`, que era a metade que faltava pra ele existir de
 * verdade. Só que isso trocou "uma consulta por navegação de página" por "uma consulta por
 * requisição", e o CRM faz muitas: cada tela busca vários endereços ao abrir e reconsulta de
 * poucos em poucos segundos. O efeito foi imediato e visível: o produto inteiro ficou lento.
 *
 * A saída não é abrir mão do bloqueio, é parar de perguntar a mesma coisa dezenas de vezes por
 * minuto. O status de uma assinatura muda raríssimas vezes na vida de um workspace; guardar a
 * resposta por alguns segundos derruba a conta de consultas quase a zero sem afrouxar a regra.
 *
 * O QUE ISSO CUSTA, e é pouco: quem acabou de pagar pode levar até a validade do cache pra ver o
 * CRM destravar. Por isso a janela é curta, e quem muda o status invalida na hora (ver
 * `esquecerStatus`). No sentido contrário, que é o que importa pra proteção, o atraso é o mesmo e
 * igualmente curto: ninguém usa o produto de graça por mais que alguns segundos.
 *
 * A memória é do processo. Em ambiente com várias instâncias cada uma tem a sua, o que só torna o
 * cache mais conservador ainda: nenhuma delas serve resposta velha de outra.
 */

const VALIDADE_MS = 30_000;

type Entrada = { status: string | null; expiraEm: number };

const cache = new Map<string, Entrada>();

/** Evita o mapa crescer pra sempre num processo de vida longa. */
function limpar(agora: number) {
  if (cache.size < 2000) return;
  for (const [chave, entrada] of cache) {
    if (entrada.expiraEm <= agora) cache.delete(chave);
  }
}

export async function statusDaAssinatura(workspaceId: string): Promise<string | null> {
  const agora = Date.now();
  const guardado = cache.get(workspaceId);
  if (guardado && guardado.expiraEm > agora) return guardado.status;

  limpar(agora);
  const assinatura = await prisma.assinatura.findUnique({
    where: { workspaceId },
    select: { status: true },
  });
  const status = assinatura?.status ?? null;
  cache.set(workspaceId, { status, expiraEm: agora + VALIDADE_MS });
  return status;
}

/**
 * Esquece o que estava guardado pra este workspace.
 *
 * Chamado por quem MUDA o status: o pagamento confirmado, o webhook da Asaas, a sobrescrita
 * manual do super-admin. Sem isso, alguém que acabou de pagar continuaria vendo a tela de
 * pagamento até o cache vencer, o que é a pior hora possível pra parecer que não funcionou.
 */
export function esquecerStatus(workspaceId: string): void {
  cache.delete(workspaceId);
}
