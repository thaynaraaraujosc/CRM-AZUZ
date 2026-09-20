import type { PrismaClient } from "@/generated/prisma/client";
import {
  enviarConversoes,
  estornarConversoes,
  garantirAcaoDeConversao,
  type ConversaoParaEnviar,
} from "@/lib/integracoes/google-ads";
import { identificadoresDoContato } from "@/lib/rastreio/identificadores";
import { enviarConversoesMeta, resolverDataset } from "@/lib/integracoes/meta-conversoes";
import { decriptar } from "@/lib/integracoes/crypto";
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

  // Só quem tem a plataforma ligada. A consulta começa pela integração, e não pelos leads, porque
  // sem conexão não há pra onde mandar: varrer leads de workspace desconectado é trabalho jogado
  // fora a cada minuto.
  const conectados = await prisma.integracao.findMany({
    where: { provedor: { in: ["google_ads", "meta_ads"] }, status: "conectado" },
    select: { workspaceId: true, provedor: true },
  });

  for (const { workspaceId, provedor } of conectados) {
    try {
      const enviou =
        provedor === "google_ads"
          ? await devolverDeUmWorkspace(prisma, workspaceId)
          : await devolverParaMeta(prisma, workspaceId);
      resultado.workspaces += 1;
      resultado.enviadas += enviou.enviadas;
      resultado.falhas += enviou.falhas;
    } catch (erro) {
      // Um workspace com problema não pode parar a fila dos outros.
      console.error(`[conversao] falha no workspace ${workspaceId} (${provedor}):`, erro);
    }
  }

  return resultado;
}

/**
 * O mesmo circuito, do lado da Meta.
 *
 * Separado do Google e não unificado porque as duas plataformas recebem coisas diferentes: o
 * Google recebe conversão por clique e aceita ajuste (estorno); a Meta recebe EVENTO num dataset e
 * não tem estorno equivalente — lá a correção é mandar um evento de reembolso, que é outra
 * conversa. Forçar as duas no mesmo caminho esconderia essa diferença e produziria um dos dois
 * comportamentos errado.
 *
 * ENQUANTO A REVISÃO DA META NÃO PASSAR, isto falha pra todo cliente que não tenha cargo no app —
 * e o erro fica gravado na linha e aparece na tela, em vez de sumir.
 */
async function devolverParaMeta(
  prisma: PrismaClient,
  workspaceId: string,
): Promise<{ enviadas: number; falhas: number }> {
  const pendentes = await prisma.origemDoLead.findMany({
    where: { workspaceId, plataforma: "meta", conversaoEnviadaEm: null },
    select: { id: true, contatoId: true, cliqueId: true },
    take: POR_RODADA * 4,
  });
  if (pendentes.length === 0) return { enviadas: 0, falhas: 0 };

  const contatos = await prisma.contato.findMany({
    where: { workspaceId, id: { in: pendentes.map((p) => p.contatoId) } },
    select: { id: true, nome: true, email: true, whatsapp: true },
  });
  const porId = new Map(contatos.map((c) => [c.id, c]));

  const ganhos =
    contatos.length === 0
      ? []
      : await prisma.negocioCard.findMany({
          where: { workspaceId, statusFechamento: "ganho", nome: { in: contatos.map((c) => c.nome) } },
          select: { id: true, nome: true, valor: true, dataFechamento: true },
        });
  const vendaPorNome = new Map<string, { valor: number; quando: Date; idDoNegocio: string }>();
  for (const card of ganhos) {
    const anterior = vendaPorNome.get(card.nome);
    const valor = valorEmNumero(card.valor);
    if (!anterior || valor > anterior.valor) {
      vendaPorNome.set(card.nome, { valor, quando: card.dataFechamento ?? new Date(), idDoNegocio: card.id });
    }
  }

  const aEnviar: { id: string; conversao: Parameters<typeof enviarConversoesMeta>[0]["conversoes"][number] }[] = [];
  for (const pendente of pendentes) {
    const contato = porId.get(pendente.contatoId);
    const venda = contato ? vendaPorNome.get(contato.nome) : undefined;
    if (!venda || !contato) continue;
    // Sem nenhum jeito de a Meta reconhecer a pessoa não há o que mandar.
    if (!pendente.cliqueId && !contato.email && !contato.whatsapp) continue;
    aEnviar.push({
      id: pendente.id,
      conversao: {
        ctwaClid: pendente.cliqueId,
        email: contato.email,
        telefone: contato.whatsapp,
        quando: venda.quando,
        valor: venda.valor,
        idDoNegocio: venda.idDoNegocio,
      },
    });
    if (aEnviar.length >= POR_RODADA) break;
  }
  if (aEnviar.length === 0) return { enviadas: 0, falhas: 0 };

  const integracao = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId, provedor: "meta_ads" } },
    select: { accessTokenCriptografado: true, metadados: true },
  });
  const adAccountId = (integracao?.metadados as { adAccountId?: string } | null)?.adAccountId;
  if (!integracao?.accessTokenCriptografado || !adAccountId) return { enviadas: 0, falhas: 0 };
  const accessToken = decriptar(integracao.accessTokenCriptografado);

  const dataset = await resolverDataset({ accessToken, adAccountId });
  if (!dataset.ok) {
    console.error(`[conversao] ${workspaceId}: sem dataset na Meta — ${dataset.erro}`);
    await prisma.origemDoLead.updateMany({
      where: { id: { in: aEnviar.map((a) => a.id) } },
      data: { conversaoErro: dataset.erro.slice(0, 1000) },
    });
    return { enviadas: 0, falhas: aEnviar.length };
  }

  const envio = await enviarConversoesMeta({
    accessToken,
    datasetId: dataset.dataset.id,
    conversoes: aEnviar.map((a) => a.conversao),
  });
  if (!envio.ok) {
    console.error(`[conversao] ${workspaceId}: Meta recusou — ${envio.erro}`);
    await prisma.origemDoLead.updateMany({
      where: { id: { in: aEnviar.map((a) => a.id) } },
      data: { conversaoErro: envio.erro.slice(0, 1000) },
    });
    return { enviadas: 0, falhas: aEnviar.length };
  }

  const agora = new Date();
  await Promise.all(
    aEnviar.map((a) =>
      prisma.origemDoLead.update({
        where: { id: a.id },
        data: {
          conversaoEnviadaEm: agora,
          conversaoNegocioId: a.conversao.idDoNegocio,
          conversaoErro: null,
        },
      }),
    ),
  );
  return { enviadas: aEnviar.length, falhas: 0 };
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
      conversaoEnviadaEm: null,
    },
    select: { id: true, contatoId: true, cliqueId: true, tipoDoClique: true, consentimento: true },
    take: POR_RODADA * 4,
  });

  const contatos = pendentes.length === 0 ? [] : await prisma.contato.findMany({
    where: { workspaceId, id: { in: pendentes.map((p) => p.contatoId) } },
    // E-mail e telefone entram aqui pra virar identificador embaralhado: é o que permite o Google
    // reencontrar a pessoa quando o código do clique não chegou.
    select: { id: true, nome: true, email: true, whatsapp: true },
  });
  const nomePorContato = new Map(contatos.map((c) => [c.id, c.nome]));
  const dadosPorContato = new Map(contatos.map((c) => [c.id, c]));

  // Só negócio GANHO vira conversão. Lead que ainda não fechou continua pendente e será tentado de
  // novo quando fechar — é justamente pra isso que a marca de enviado fica vazia até lá.
  const ganhos = nomePorContato.size === 0 ? [] : await prisma.negocioCard.findMany({
    where: {
      workspaceId,
      statusFechamento: "ganho",
      nome: { in: [...nomePorContato.values()] },
    },
    select: { id: true, nome: true, valor: true, dataFechamento: true },
  });
  const vendaPorNome = new Map<string, { valor: number; quando: Date; idDoNegocio: string }>();
  for (const card of ganhos) {
    const anterior = vendaPorNome.get(card.nome);
    const valor = valorEmNumero(card.valor);
    // Mesmo cliente com mais de um negócio ganho: vale o de maior valor. Somar os dois atribuiria
    // ao anúncio uma receita que ele não produziu sozinho.
    if (!anterior || valor > anterior.valor) {
      vendaPorNome.set(card.nome, {
        valor,
        quando: card.dataFechamento ?? new Date(),
        idDoNegocio: card.id,
      });
    }
  }

  const aEnviar: { id: string; conversao: ConversaoParaEnviar }[] = [];
  for (const pendente of pendentes) {
    const venda = vendaPorNome.get(nomePorContato.get(pendente.contatoId) ?? "");
    if (!venda) continue;

    const contato = dadosPorContato.get(pendente.contatoId);
    const identificadores = contato ? identificadoresDoContato(contato) : [];

    /*
     * Precisa de PELO MENOS um jeito de o Google reconhecer a pessoa: o código do clique ou um
     * identificador embaralhado. Sem nenhum dos dois não há o que mandar, e insistir só gastaria
     * chamada pra receber recusa.
     *
     * Antes daqui o lead sem código era descartado. Agora ele passa quando o contato tem e-mail ou
     * telefone — que é justamente o caso do lead de iPhone, de bloqueador, ou de link
     * compartilhado, em que o código nunca chegou mas a pessoa comprou do mesmo jeito.
     */
    if (!pendente.cliqueId && identificadores.length === 0) continue;

    aEnviar.push({
      id: pendente.id,
      conversao: {
        cliqueId: pendente.cliqueId,
        tipoDoClique: pendente.tipoDoClique,
        quando: venda.quando,
        valor: venda.valor,
        identificadores: identificadores.length ? identificadores : undefined,
        idDoNegocio: venda.idDoNegocio,
        consentimento:
          pendente.consentimento === "concedido" || pendente.consentimento === "negado"
            ? pendente.consentimento
            : null,
      },
    });
    if (aEnviar.length >= POR_RODADA) break;
  }
  /*
   * Há estorno pendente mesmo sem venda nova pra mandar?
   *
   * Esta pergunta precisa vir ANTES de desistir da rodada. Na primeira versão o estorno só rodava
   * depois de um envio bem-sucedido — então um negócio revertido num mês em que não entrou venda
   * nenhuma nova ficava contando pro Google indefinidamente, que é exatamente o estrago que o
   * estorno existe pra evitar.
   */
  const temEstorno =
    (await prisma.origemDoLead.count({
      where: {
        workspaceId,
        conversaoEnviadaEm: { not: null },
        conversaoEstornadaEm: null,
        conversaoNegocioId: { not: null },
      },
    })) > 0;

  if (aEnviar.length === 0 && !temEstorno) return { enviadas: 0, falhas: 0 };

  const conta = await contaDoWorkspace(workspaceId, prisma);
  if (!conta) return { enviadas: 0, falhas: 0 };

  const acao = await garantirAcaoDeConversao({
    accessToken: conta.accessToken,
    customerId: conta.customerId,
  });
  if (!acao.ok) {
    console.error(`[conversao] ${workspaceId}: sem ação de conversão — ${acao.erro}`);
    if (aEnviar.length > 0) {
      await prisma.origemDoLead.updateMany({
        where: { id: { in: aEnviar.map((a) => a.id) } },
        data: { conversaoErro: acao.erro.slice(0, 1000) },
      });
    }
    return { enviadas: 0, falhas: aEnviar.length };
  }

  if (aEnviar.length === 0) {
    const sos = await estornarOQueDeixouDeSerGanho(prisma, workspaceId, conta, acao.resourceName);
    return { enviadas: sos, falhas: 0 };
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
  const agora = new Date();
  // Uma atualização por linha, e não um `updateMany`, porque cada uma guarda QUAL negócio foi
  // enviado — é essa chave que permite desfazer depois.
  await Promise.all(
    aEnviar.map((a) =>
      prisma.origemDoLead.update({
        where: { id: a.id },
        data: {
          conversaoEnviadaEm: agora,
          conversaoNegocioId: a.conversao.idDoNegocio ?? null,
          conversaoErro: erro ? erro.slice(0, 1000) : null,
        },
      }),
    ),
  );

  const estornadas = await estornarOQueDeixouDeSerGanho(prisma, workspaceId, conta, acao.resourceName);
  return { enviadas: aEnviar.length + estornadas, falhas: erro ? 1 : 0 };
}

/**
 * Desfaz no Google as vendas que o funil desmarcou.
 *
 * Negócio marcado como ganho e depois revertido — cliente desistiu, pagamento não entrou, foi
 * clique errado — continuava contando pro Google PARA SEMPRE. Ele seguia achando que aquela
 * campanha vendeu, e investindo em cima de uma receita que não existiu. O erro não aparece em
 * lugar nenhum: o relatório fica bonito e o dinheiro vai embora.
 *
 * Roda junto do envio, na mesma rodada, porque depende da mesma conta e da mesma ação de conversão
 * já resolvidas — repetir esse trabalho numa rodada separada seria pagar duas vezes pelo mesmo.
 */
async function estornarOQueDeixouDeSerGanho(
  prisma: PrismaClient,
  workspaceId: string,
  conta: { accessToken: string; customerId: string },
  acaoDeConversao: string,
): Promise<number> {
  const enviadas = await prisma.origemDoLead.findMany({
    where: {
      workspaceId,
      conversaoEnviadaEm: { not: null },
      conversaoEstornadaEm: null,
      conversaoNegocioId: { not: null },
    },
    select: { id: true, conversaoNegocioId: true },
    take: POR_RODADA,
  });
  if (enviadas.length === 0) return 0;

  const ids = enviadas.map((e) => e.conversaoNegocioId!).filter(Boolean);
  const aindaGanhos = await prisma.negocioCard.findMany({
    where: { workspaceId, id: { in: ids }, statusFechamento: "ganho" },
    select: { id: true },
  });
  const continuaGanho = new Set(aindaGanhos.map((c) => c.id));

  // Deixou de ser ganho, ou o card sumiu de vez: nos dois casos a venda que foi enviada não vale
  // mais. Card apagado conta igual — o que importa pro Google é que aquela receita não existe.
  const paraEstornar = enviadas.filter((e) => !continuaGanho.has(e.conversaoNegocioId!));
  if (paraEstornar.length === 0) return 0;

  const agora = new Date();
  const resultado = await estornarConversoes({
    accessToken: conta.accessToken,
    customerId: conta.customerId,
    acaoDeConversao,
    estornos: paraEstornar.map((e) => ({ idDoNegocio: e.conversaoNegocioId!, quando: agora })),
  });

  if (!resultado.ok) {
    console.error(`[conversao] ${workspaceId}: estorno recusado — ${resultado.erro}`);
    return 0;
  }

  await prisma.origemDoLead.updateMany({
    where: { id: { in: paraEstornar.map((e) => e.id) } },
    data: { conversaoEstornadaEm: agora },
  });
  return paraEstornar.length;
}
