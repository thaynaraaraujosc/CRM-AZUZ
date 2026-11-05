import { prisma } from "@/lib/prisma";

/**
 * AS CONEXÕES DE CONVERSA DO WORKSPACE, com memória curta.
 *
 * Mesma história do `assinatura/status-cache.ts`, e vale repetir porque a causa é idêntica: o CRM
 * bate em `/api/conversas` e `/api/mensagens-extra` A CADA 5 SEGUNDOS, em TODA tela aberta — a
 * pessoa pode estar em Formulários, no Funil, em Relatórios, e as duas batidas acontecem do mesmo
 * jeito, porque o aviso de mensagem nova é global.
 *
 * As duas rotas respondem `304` barato quando nada mudou. Só que ANTES de chegar na pergunta
 * barata elas precisavam saber QUAIS conexões estão ligadas, e isso eram duas consultas à tabela
 * `Integracao` — a mesma consulta, duas vezes, com um segundo de diferença. Contando as duas
 * rotas, davam seis consultas por ciclo de cinco segundos, por aba aberta, contra um pool de três
 * conexões. Clique de pessoa disputa esse pool com a batida automática, e é assim que "clico num
 * botão e demora pra responder" acontece sem nenhuma tela estar pesada.
 *
 * Quais integrações estão conectadas muda quando alguém conecta ou desconecta um canal: algumas
 * vezes na vida de um workspace. Guardar a resposta por alguns segundos derruba a conta pela
 * metade sem mudar nenhuma regra.
 *
 * O QUE ISSO CUSTA: quem acabou de conectar um número pode levar até a validade do cache pra ver
 * a caixa de entrada encher. A janela é curta de propósito, e quem conecta ou desconecta
 * invalida na hora (`esquecerConexoes`). Se algum caminho de escrita esquecer de invalidar, o
 * pior que acontece são esses poucos segundos — nunca um dado errado permanente.
 *
 * A memória é do processo. Com várias instâncias, cada uma tem a sua, o que só torna o cache mais
 * conservador: nenhuma serve resposta velha de outra.
 */

const VALIDADE_MS = 15_000;

/** Os três canais de CONVERSA. Anúncios e outras integrações não entram: não é delas que a caixa
 *  de entrada depende, e trazê-las junto só engordaria a resposta. */
export const PROVEDORES_DE_CONVERSA = ["whatsapp_nao_oficial", "meta_whatsapp", "meta_instagram"];

export type ConexaoDeConversa = { provedor: string; metadados: unknown };

type Entrada = { conexoes: ConexaoDeConversa[]; expiraEm: number };

const cache = new Map<string, Entrada>();

/** Evita o mapa crescer pra sempre num processo de vida longa. */
function limpar(agora: number) {
  if (cache.size < 2000) return;
  for (const [chave, entrada] of cache) {
    if (entrada.expiraEm <= agora) cache.delete(chave);
  }
}

export async function conexoesDeConversa(workspaceId: string): Promise<ConexaoDeConversa[]> {
  const agora = Date.now();
  const guardado = cache.get(workspaceId);
  if (guardado && guardado.expiraEm > agora) return guardado.conexoes;

  limpar(agora);
  const conexoes = await prisma.integracao.findMany({
    where: { workspaceId, status: "conectado", provedor: { in: PROVEDORES_DE_CONVERSA } },
    select: { provedor: true, metadados: true },
  });
  cache.set(workspaceId, { conexoes, expiraEm: agora + VALIDADE_MS });
  return conexoes;
}

/** Conectou, desconectou ou mexeu nos metadados de um canal: a resposta guardada ficou velha. */
export function esquecerConexoes(workspaceId: string) {
  cache.delete(workspaceId);
}

/** Só pra teste: zera tudo entre um caso e outro. */
export function esquecerTodasAsConexoes() {
  cache.clear();
}
