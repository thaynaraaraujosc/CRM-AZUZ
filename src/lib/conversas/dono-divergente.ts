import { prisma } from "@/lib/prisma";
import {
  CANAL_INSTAGRAM,
  CANAL_NAO_OFICIAL,
  CANAL_OFICIAL,
  contaCanalDaConexao,
  provedorDoCanal,
} from "@/lib/integracoes/conta-canal";

/**
 * Mensagem que chegou por uma conexão e ficou marcada como sendo de outra.
 *
 * `canal` é escrito por quem recebeu e não mente: quem grava `whatsapp_nao_oficial` é o webhook do
 * QR Code. Já `contaCanal` (a conexão dona, que decide o que aparece na tela) é copiado de um lado
 * pro outro em vários caminhos, e num deles se descolava da verdade: a adoção de mensagens órfãs
 * copiava o dono da CONVERSA pra dentro das mensagens sem olhar por onde cada uma tinha entrado.
 * Uma conversa que um dia pertenceu à API oficial carimbava como oficial mensagem que tinha
 * chegado pelo QR Code.
 *
 * Enquanto as duas conexões estavam ligadas, ninguém via diferença. No instante em que a oficial
 * foi desconectada, essas mensagens sumiram da tela, embora o número que as recebeu continuasse
 * conectado. E a conversa inteira some junto, quando é ELA que está com o dono errado: é o
 * "recebo no celular e não aparece no CRM".
 *
 * Este reparo devolve cada uma pra conexão que de fato a carregou. Não apaga nada, não inventa
 * dono: só age quando o canal da própria linha diz, com todas as letras, de quem ela é.
 */

/** Os nomes de `canal` que pertencem a cada provedor. `whatsapp_baileys` é o nome antigo do QR
 * Code e ainda está gravado em mensagem de saída. */
const CANAIS_POR_PROVEDOR: Record<string, string[]> = {
  [CANAL_NAO_OFICIAL]: [CANAL_NAO_OFICIAL, "whatsapp_baileys"],
  [CANAL_OFICIAL]: [CANAL_OFICIAL],
  [CANAL_INSTAGRAM]: [CANAL_INSTAGRAM],
};

/** O identificador de conexão de cada provedor deste workspace, conectado ou não. Desconectado
 * continua sendo o dono legítimo do que é dele: o reparo corrige quem está errado, não muda de
 * dono quem está certo. */
async function donosDoWorkspace(workspaceId: string): Promise<Map<string, string>> {
  const integracoes = await prisma.integracao.findMany({
    where: { workspaceId, provedor: { in: [CANAL_NAO_OFICIAL, CANAL_OFICIAL, CANAL_INSTAGRAM] } },
    select: { provedor: true, metadados: true },
  });
  const donos = new Map<string, string>();
  for (const i of integracoes) {
    const m = (i.metadados as Record<string, unknown> | null) ?? {};
    const identificador =
      i.provedor === CANAL_NAO_OFICIAL
        ? (m.numero as string | undefined)
        : i.provedor === CANAL_INSTAGRAM
          ? (m.instagramContaId as string | undefined)
          : (m.phoneNumberId as string | undefined);
    const conta = contaCanalDaConexao(i.provedor, identificador);
    if (conta) donos.set(i.provedor, conta);
  }
  return donos;
}

export async function corrigirDonosDivergentes(workspaceId: string): Promise<{
  mensagensCorrigidas: number;
  conversasCorrigidas: number;
}> {
  const donos = await donosDoWorkspace(workspaceId);

  // 1. As MENSAGENS. Uma consulta por provedor, e no estado normal nenhuma delas escreve nada.
  let mensagensCorrigidas = 0;
  for (const [provedor, conta] of donos) {
    const { count } = await prisma.mensagemExtra.updateMany({
      where: {
        workspaceId,
        canal: { in: CANAIS_POR_PROVEDOR[provedor] ?? [provedor] },
        contaCanal: { not: null },
        NOT: { contaCanal: { startsWith: `${provedor}:` } },
      },
      data: { contaCanal: conta },
    });
    mensagensCorrigidas += count;
  }

  // 2. As CONVERSAS. Uma conversa pertence à conexão que de fato carrega as mensagens dela. Um
  // `groupBy` só, sem ler texto de mensagem nenhuma: por contato, quais canais ele já usou.
  const porContato = await prisma.mensagemExtra.groupBy({
    by: ["contato", "canal"],
    where: { workspaceId, canal: { not: null } },
    _max: { criadoEm: true },
  });

  /** O provedor da mensagem MAIS RECENTE de cada contato. É o critério certo porque a conversa
   * muda de dono quando a pessoa troca de conexão, e quem manda é a última. */
  const maisRecente = new Map<string, { quando: Date; provedor: string }>();
  for (const linha of porContato) {
    const provedor = provedorDoCanal(linha.canal);
    const quando = linha._max.criadoEm;
    if (!provedor || !quando) continue;
    const atual = maisRecente.get(linha.contato);
    if (!atual || quando > atual.quando) maisRecente.set(linha.contato, { quando, provedor });
  }

  const conversas = await prisma.conversa.findMany({
    where: { workspaceId, contaCanal: { not: null } },
    select: { id: true, nome: true, contaCanal: true },
  });

  let conversasCorrigidas = 0;
  for (const conversa of conversas) {
    const verdade = maisRecente.get(conversa.nome);
    if (!verdade) continue;
    if (conversa.contaCanal?.startsWith(`${verdade.provedor}:`)) continue;
    const dono = donos.get(verdade.provedor);
    // Sem saber o identificador daquela conexão não dá pra reatribuir. Deixa como está: um dono
    // errado ainda é melhor que um dono inventado, e o caso se resolve quando a conexão gravar o
    // número dela.
    if (!dono) continue;
    await prisma.conversa.update({ where: { id: conversa.id }, data: { contaCanal: dono } });
    conversasCorrigidas += 1;
  }

  return { mensagensCorrigidas, conversasCorrigidas };
}

/** A mesma correção em todo workspace, pelo relógio. No estado normal lê e não escreve nada. */
export async function corrigirDonosDeTodosOsWorkspaces(): Promise<{
  workspaces: number;
  mensagensCorrigidas: number;
  conversasCorrigidas: number;
}> {
  const workspaces = await prisma.workspace.findMany({ select: { id: true } });
  let mensagensCorrigidas = 0;
  let conversasCorrigidas = 0;
  for (const { id } of workspaces) {
    const r = await corrigirDonosDivergentes(id).catch((erro) => {
      console.error(`[dono divergente] falha no workspace ${id}:`, erro);
      return { mensagensCorrigidas: 0, conversasCorrigidas: 0 };
    });
    mensagensCorrigidas += r.mensagensCorrigidas;
    conversasCorrigidas += r.conversasCorrigidas;
  }
  return { workspaces: workspaces.length, mensagensCorrigidas, conversasCorrigidas };
}
