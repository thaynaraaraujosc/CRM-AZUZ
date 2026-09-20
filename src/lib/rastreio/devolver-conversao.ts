import type { PrismaClient } from "@/generated/prisma/client";
import {
  enviarConversoes,
  garantirAcaoDeConversao,
  type ConversaoParaEnviar,
} from "@/lib/integracoes/google-ads";
import { contaDoWorkspace } from "@/lib/integracoes/google-ads-conta";

/**
 * A rodada que devolve as vendas pro Google.
 *
 * POR QUE NO CRON E NÃO NO CLIQUE DE "GANHO". Marcar um negócio como ganho é uma ação da pessoa,
 * no meio do trabalho dela: pendurar nela uma chamada de rede pra API do Google faria o botão
 * demorar, e faria a venda deixar de ser devolvida sempre que o Google estivesse fora do ar ou o
 * token precisasse renovar. Aqui a rodada tenta de novo na próxima batida, sozinha, e ninguém
 * espera por ela.
 *
 * MANDAR DUAS VEZES É PIOR QUE NÃO MANDAR. Cada upload vira uma conversão nova no relatório do
 * Google: o mesmo negócio enviado duas vezes faz a campanha parecer render o dobro, e o algoritmo
 * passa a investir em cima de um número inventado. Por isso `conversaoEnviadaEm` é gravado logo
 * depois do envio, e a consulta só procura quem ainda tem esse campo vazio.
 */

/** Teto por rodada. A batida do cron é a cada minuto e divide o tempo com campanhas e automações:
 *  um lote grande aqui atrasaria o que é urgente. Sobrando, a próxima rodada continua. */
const POR_RODADA = 50;

export type ResultadoDaDevolucao = {
  workspaces: number;
  enviadas: number;
  falhas: number;
};

/** "R$ 2.100,50" -> 2100.5. Mesma regra do resto do CRM. */
function valorEmNumero(bruto: string | null | undefined): number {
  const n = Number((bruto ?? "").replace(/[^\d,]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Recebe o cliente do banco por parâmetro, como `aplicar.ts` ao lado.
 *
 * Não é preciosismo: importar o cliente compartilhado aqui dentro amarraria este módulo à variável
 * de ambiente do banco no momento do import, e o teste que prende a garantia de não enviar duas
 * vezes deixaria de rodar junto com a suíte.
 */
export async function devolverConversoesDeTodosOsWorkspaces(
  prisma: PrismaClient,
): Promise<ResultadoDaDevolucao> {
  const resultado: ResultadoDaDevolucao = { workspaces: 0, enviadas: 0, falhas: 0 };

  // Só quem tem Google Ads ligado. A consulta começa pela integração, e não pelos leads, porque
  // sem conexão não há pra onde mandar: varrer leads de workspace desconectado é trabalho jogado
  // fora a cada minuto.
  const conectados = await prisma.integracao.findMany({
    where: { provedor: "google_ads", status: "conectado" },
    select: { workspaceId: true },
  });

  for (const { workspaceId } of conectados) {
    try {
      const enviou = await devolverDeUmWorkspace(prisma, workspaceId);
      resultado.workspaces += 1;
      resultado.enviadas += enviou.enviadas;
      resultado.falhas += enviou.falhas;
    } catch (erro) {
      // Um workspace com problema não pode parar a fila dos outros.
      console.error(`[conversao] falha no workspace ${workspaceId}:`, erro);
    }
  }

  return resultado;
}

async function devolverDeUmWorkspace(
  prisma: PrismaClient,
  workspaceId: string,
): Promise<{ enviadas: number; falhas: number }> {
  // Lead que veio do Google, tem código de clique e ainda não teve a venda devolvida.
  const pendentes = await prisma.origemDoLead.findMany({
    where: {
      workspaceId,
      plataforma: "google",
      cliqueId: { not: null },
      conversaoEnviadaEm: null,
    },
    select: { id: true, contatoId: true, cliqueId: true, tipoDoClique: true },
    take: POR_RODADA * 4,
  });
  if (pendentes.length === 0) return { enviadas: 0, falhas: 0 };

  const contatos = await prisma.contato.findMany({
    where: { workspaceId, id: { in: pendentes.map((p) => p.contatoId) } },
    select: { id: true, nome: true },
  });
  const nomePorContato = new Map(contatos.map((c) => [c.id, c.nome]));

  // Só negócio GANHO vira conversão. Lead que ainda não fechou continua pendente e será tentado de
  // novo quando fechar — é justamente pra isso que a marca de enviado fica vazia até lá.
  const ganhos = await prisma.negocioCard.findMany({
    where: {
      workspaceId,
      statusFechamento: "ganho",
      nome: { in: [...nomePorContato.values()] },
    },
    select: { nome: true, valor: true, dataFechamento: true },
  });
  const vendaPorNome = new Map<string, { valor: number; quando: Date }>();
  for (const card of ganhos) {
    const anterior = vendaPorNome.get(card.nome);
    const valor = valorEmNumero(card.valor);
    // Mesmo cliente com mais de um negócio ganho: vale o de maior valor. Somar os dois atribuiria
    // ao anúncio uma receita que ele não produziu sozinho.
    if (!anterior || valor > anterior.valor) {
      vendaPorNome.set(card.nome, { valor, quando: card.dataFechamento ?? new Date() });
    }
  }

  const aEnviar: { id: string; conversao: ConversaoParaEnviar }[] = [];
  for (const pendente of pendentes) {
    const venda = vendaPorNome.get(nomePorContato.get(pendente.contatoId) ?? "");
    if (!venda || !pendente.cliqueId) continue;
    aEnviar.push({
      id: pendente.id,
      conversao: {
        cliqueId: pendente.cliqueId,
        tipoDoClique: pendente.tipoDoClique,
        quando: venda.quando,
        valor: venda.valor,
      },
    });
    if (aEnviar.length >= POR_RODADA) break;
  }
  if (aEnviar.length === 0) return { enviadas: 0, falhas: 0 };

  const conta = await contaDoWorkspace(workspaceId);
  if (!conta) return { enviadas: 0, falhas: 0 };

  const acao = await garantirAcaoDeConversao({
    accessToken: conta.accessToken,
    customerId: conta.customerId,
  });
  if (!acao.ok) {
    console.error(`[conversao] ${workspaceId}: sem ação de conversão — ${acao.erro}`);
    await prisma.origemDoLead.updateMany({
      where: { id: { in: aEnviar.map((a) => a.id) } },
      data: { conversaoErro: acao.erro.slice(0, 1000) },
    });
    return { enviadas: 0, falhas: aEnviar.length };
  }

  const envio = await enviarConversoes({
    accessToken: conta.accessToken,
    customerId: conta.customerId,
    acaoDeConversao: acao.resourceName,
    conversoes: aEnviar.map((a) => a.conversao),
  });

  if (!envio.ok) {
    console.error(`[conversao] ${workspaceId}: envio recusado — ${envio.erro}`);
    await prisma.origemDoLead.updateMany({
      where: { id: { in: aEnviar.map((a) => a.id) } },
      data: { conversaoErro: envio.erro.slice(0, 1000) },
    });
    return { enviadas: 0, falhas: aEnviar.length };
  }

  /*
   * Marca como enviado MESMO com falha parcial, e isso é deliberado.
   *
   * O Google devolve o erro parcial como uma mensagem só, sem dizer qual linha caiu. Sem saber
   * quais falharam, reenviar o lote inteiro duplicaria as que deram certo — e conversão duplicada
   * é o estrago que não tem desfazer. O erro fica gravado na linha pra poder ser investigado.
   */
  const erro = envio.falhas[0]?.erro ?? null;
  await prisma.origemDoLead.updateMany({
    where: { id: { in: aEnviar.map((a) => a.id) } },
    data: { conversaoEnviadaEm: new Date(), conversaoErro: erro ? erro.slice(0, 1000) : null },
  });

  return { enviadas: aEnviar.length, falhas: erro ? 1 : 0 };
}
