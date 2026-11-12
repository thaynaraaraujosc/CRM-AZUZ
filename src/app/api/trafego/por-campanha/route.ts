import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { medianaDeMinutos } from "@/lib/trafego/tempo-de-resposta";

/**
 * Quantos leads e quanta venda cada CAMPANHA trouxe, segundo o CRM.
 *
 * O número que faltava. A tela de Tráfego mostrava, por campanha, o que a própria plataforma
 * informa — e a plataforma só conhece o que acontece dentro dela: clique, conversa iniciada,
 * formulário nativo. Ela não sabe se o lead virou cliente, porque a venda acontece aqui.
 *
 * O CRM já guardava campanha, conjunto, anúncio e palavra-chave de cada lead em `OrigemDoLead`
 * desde que o rastreamento entrou. O que não existia era alguém LENDO isso em agregado: o dado
 * ficava no painel de um contato por vez. Esta rota é essa leitura.
 *
 * A ligação entre lead e venda passa pelo nome, que é como `NegocioCard` referencia o contato
 * hoje. Não é o ideal (nome muda, nome repete), mas é a chave que existe: inventar uma coluna de
 * relacionamento agora exigiria uma migração e um backfill de dados de cliente em produção, e o
 * ganho seria zero pros negócios que já estão gravados.
 *
 * Só leitura, e só do workspace de quem está logado: de qual campanha vem o cliente de uma empresa
 * é informação comercial, e vazar entre inquilinos entregaria a estratégia de um pro outro.
 */
export const dynamic = "force-dynamic";

type LinhaPorCampanha = {
  plataforma: "google" | "meta";
  campanhaId: string | null;
  campanhaNome: string;
  leads: number;
  vendas: number;
  receita: number;
  /**
   * Vendas em que esta campanha ENCOSTOU sem levar o crédito.
   *
   * O caso que o primeiro toque esconde: a pessoa vê o anúncio da Meta, não compra, depois
   * pesquisa no Google e fecha. A Meta aparece com zero venda e parece inútil — e desligá-la
   * derrubaria a campanha do Google junto, porque era ela que estava alimentando.
   */
  vendasAssistidas: number;
  /**
   * Quanto um lead desta campanha NORMALMENTE espera até alguém responder, em minutos. Mediana,
   * nunca média — ver `tempo-de-resposta.ts`. `null` quando nenhum lead dela foi respondido.
   */
  esperaMediana: number | null;
  /** Quantos leads dela ainda não receberam nenhuma resposta. Anda junto da mediana, sempre. */
  semResposta: number;
};

/** "R$ 2.100,50" -> 2100.5. Mesma regra de `metrics.ts`, pra os dois números baterem na tela. */
function valorEmNumero(bruto: string | null | undefined): number {
  const n = Number((bruto ?? "").replace(/[^\d,]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const origens = await prisma.origemDoLead.findMany({
    where: { workspaceId },
    select: {
      contatoId: true,
      plataforma: true,
      campanhaId: true,
      campanhaNome: true,
      utmCampaign: true,
    },
  });

  if (origens.length === 0) {
    return NextResponse.json({ linhas: [], leadsSemCampanha: 0 }, { headers: { "cache-control": "no-store" } });
  }

  // O nome do contato, pra alcançar o card do funil. Uma consulta só, por id, em vez de uma por
  // lead: com algumas centenas de leads a versão ingênua vira centenas de idas ao banco.
  const contatos = await prisma.contato.findMany({
    where: { workspaceId, id: { in: origens.map((o) => o.contatoId) } },
    select: { id: true, nome: true },
  });
  const nomePorContato = new Map(contatos.map((c) => [c.id, c.nome]));

  // Só negócio GANHO conta como venda. Perdido e em aberto entram como lead e param por aí: contar
  // negócio aberto como receita transformaria a tela num relatório de esperança.
  const ganhos = await prisma.negocioCard.findMany({
    where: { workspaceId, statusFechamento: "ganho", nome: { in: [...nomePorContato.values()] } },
    select: { nome: true, valor: true },
  });
  const vendaPorNome = new Map<string, { vendas: number; receita: number }>();
  for (const card of ganhos) {
    const atual = vendaPorNome.get(card.nome) ?? { vendas: 0, receita: 0 };
    atual.vendas += 1;
    atual.receita += valorEmNumero(card.valor);
    vendaPorNome.set(card.nome, atual);
  }

  /*
   * Os toques que NÃO ganharam a atribuição, dos contatos que compraram.
   *
   * Consultado à parte porque é outra pergunta: `OrigemDoLead` responde "quem trouxe", e isto
   * responde "quem participou". Juntar as duas numa consulta só faria a segunda contaminar a
   * primeira, e o número de leads da campanha passaria a contar gente que ela não trouxe.
   */
  const nomesQueCompraram = new Set(
    [...vendaPorNome.keys()].filter((nome) => (vendaPorNome.get(nome)?.vendas ?? 0) > 0),
  );
  const contatosQueCompraram = contatos.filter((c) => nomesQueCompraram.has(c.nome)).map((c) => c.id);
  const assistencias =
    contatosQueCompraram.length === 0
      ? []
      : await prisma.toqueDeAnuncio.findMany({
          where: { workspaceId, contatoId: { in: contatosQueCompraram }, primeiro: false },
          select: { contatoId: true, plataforma: true, campanhaId: true, campanhaNome: true },
        });

  /*
   * ==========================================================================
   * QUANTO O LEAD ESPERA ATÉ ALGUÉM RESPONDER.
   *
   * "Campanha que traz lead bom e demora 40 minutos pra ser atendida perde venda por operação,
   * não por mídia."
   *
   * DUAS CONSULTAS AGREGADAS, e não o histórico de mensagens inteiro. A conta pede dois instantes
   * por contato — a primeira mensagem dele e a primeira resposta da empresa. Baixar todas as
   * mensagens de todos os leads pra achar dois carimbos seriam dezenas de milhares de linhas a
   * cada abertura da tela (esta rota é `force-dynamic`), pra usar duas. O banco já sabe responder
   * "o menor carimbo por contato": é um `groupBy` em cima do índice `[workspaceId, contato]`.
   *
   * QUAL CARIMBO. `gravadoEm` é o nosso relógio, nos dois sentidos, e é o que o schema manda usar
   * pra medir. `criadoEm` entra só como reserva, pras linhas anteriores àquela coluna: ali o
   * carimbo da mensagem recebida vem do aparelho de quem escreveu, então pode variar alguns
   * segundos. Numa mediana contada em minutos, segundos não mudam decisão nenhuma — e a
   * alternativa seria a coluna aparecer vazia pra toda conversa antiga.
   *
   * O CASO QUE ESTA CONTA NÃO PEGA: empresa que escreveu primeiro. `_min` devolve o primeiro
   * "out" da conversa, e não o primeiro depois da entrada do lead. Quando o primeiro "out" é
   * anterior à primeira mensagem do lead, a espera fica em `null` em vez de virar um número
   * errado — disparo ativo não é lead de anúncio esperando atendimento. Ver a mesma regra, com
   * teste, em `minutosAtePrimeiraResposta`.
   * ==========================================================================
   */
  const nomesDosLeads = [...nomePorContato.values()];
  const [entradas, saidas] = await Promise.all([
    prisma.mensagemExtra.groupBy({
      by: ["contato"],
      where: { workspaceId, contato: { in: nomesDosLeads }, tipo: "in" },
      _min: { gravadoEm: true, criadoEm: true },
    }),
    prisma.mensagemExtra.groupBy({
      by: ["contato"],
      where: { workspaceId, contato: { in: nomesDosLeads }, tipo: "out" },
      _min: { gravadoEm: true, criadoEm: true },
    }),
  ]);

  const quando = (linha: { _min: { gravadoEm: Date | null; criadoEm: Date | null } }): Date | null =>
    linha._min.gravadoEm ?? linha._min.criadoEm ?? null;
  const primeiraEntradaPorNome = new Map(entradas.map((e) => [e.contato, quando(e)]));
  const primeiraSaidaPorNome = new Map(saidas.map((e) => [e.contato, quando(e)]));

  /** A espera deste lead, em minutos. `null` = não dá pra medir (ver o bloco acima). */
  function esperaDoLead(nomeDoContato: string): number | null {
    const entrada = primeiraEntradaPorNome.get(nomeDoContato);
    const saida = primeiraSaidaPorNome.get(nomeDoContato);
    if (!entrada || !saida) return null;
    if (saida.getTime() <= entrada.getTime()) return null;
    return Math.round((saida.getTime() - entrada.getTime()) / 60_000);
  }

  /** As esperas de cada campanha, guardadas cruas pra a mediana ser tirada no fim. */
  const esperasPorChave = new Map<string, number[]>();

  const porCampanha = new Map<string, LinhaPorCampanha>();
  let leadsSemCampanha = 0;

  for (const origem of origens) {
    // Quando a campanha não veio com nome nem id, o lead tem origem (sabemos a plataforma) mas não
    // tem a qual campanha atribuir. Some da tabela e é contado à parte: jogar ele numa linha
    // "Sem nome" faria parecer que existe uma campanha com esse nome.
    const nome = origem.campanhaNome ?? origem.utmCampaign ?? null;
    if (!nome && !origem.campanhaId) {
      leadsSemCampanha += 1;
      continue;
    }

    const plataforma = origem.plataforma === "meta" ? "meta" : "google";
    const chave = `${plataforma}|${origem.campanhaId ?? nome}`;
    const linha =
      porCampanha.get(chave) ??
      ({
        plataforma,
        campanhaId: origem.campanhaId,
        campanhaNome: nome ?? `#${origem.campanhaId}`,
        leads: 0,
        vendas: 0,
        receita: 0,
        vendasAssistidas: 0,
        esperaMediana: null,
        semResposta: 0,
      } satisfies LinhaPorCampanha);

    linha.leads += 1;
    const nomeDoContato = nomePorContato.get(origem.contatoId) ?? "";
    const venda = vendaPorNome.get(nomeDoContato);
    if (venda) {
      linha.vendas += venda.vendas;
      linha.receita += venda.receita;
    }

    /*
     * O lead sem resposta não entra na mediana E é contado à parte.
     *
     * Jogá-lo como "espera infinita" distorceria o número; deixá-lo de fora em silêncio seria
     * pior: uma campanha com dez leads e nove ignorados mostraria a espera ótima do único que
     * alguém respondeu, e passaria por bem atendida. Os dois números só dizem a verdade juntos.
     */
    const espera = esperaDoLead(nomeDoContato);
    if (espera === null) {
      // Só conta como "sem resposta" quem de fato escreveu e não foi respondido. Lead que nunca
      // mandou mensagem (veio por formulário, por exemplo) não está esperando nada.
      if (primeiraEntradaPorNome.get(nomeDoContato)) linha.semResposta += 1;
    } else {
      const lista = esperasPorChave.get(chave) ?? [];
      lista.push(espera);
      esperasPorChave.set(chave, lista);
    }

    porCampanha.set(chave, linha);
  }

  /*
   * Uma assistência por campanha POR VENDA, não por toque.
   *
   * A pessoa pode ter clicado quatro vezes no mesmo anúncio antes de comprar. Contar cada clique
   * faria uma campanha parecer ter participado de quatro vendas quando participou de uma — o
   * mesmo erro de inflar que o resto deste arquivo evita em toda parte.
   */
  const jaContado = new Set<string>();
  for (const toque of assistencias) {
    const nome = toque.campanhaNome ?? null;
    if (!nome && !toque.campanhaId) continue;
    const plataforma = toque.plataforma === "meta" ? "meta" : "google";
    const chave = `${plataforma}|${toque.campanhaId ?? nome}`;
    const chaveDaVenda = `${chave}|${toque.contatoId}`;
    if (jaContado.has(chaveDaVenda)) continue;
    jaContado.add(chaveDaVenda);

    const linha = porCampanha.get(chave);
    // Campanha que só aparece como assistente (nunca trouxe lead nenhum) também entra na tabela:
    // esconder ela seria repetir, por outro caminho, o problema que esta coluna existe pra expor.
    if (linha) {
      linha.vendasAssistidas += 1;
    } else {
      porCampanha.set(chave, {
        plataforma,
        campanhaId: toque.campanhaId,
        campanhaNome: nome ?? `#${toque.campanhaId}`,
        leads: 0,
        vendas: 0,
        receita: 0,
        vendasAssistidas: 1,
        esperaMediana: null,
        semResposta: 0,
      });
    }
  }

  // A mediana só no fim, com todas as esperas da campanha na mão: tirar "a mediana até agora" a
  // cada lead daria um número que depende da ordem em que o banco devolveu as linhas.
  for (const [chave, esperas] of esperasPorChave) {
    const linha = porCampanha.get(chave);
    if (linha) linha.esperaMediana = medianaDeMinutos(esperas);
  }

  const linhas = [...porCampanha.values()].sort((a, b) => b.leads - a.leads);
  return NextResponse.json({ linhas, leadsSemCampanha }, { headers: { "cache-control": "no-store" } });
}
