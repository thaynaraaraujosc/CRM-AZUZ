import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      } satisfies LinhaPorCampanha);

    linha.leads += 1;
    const venda = vendaPorNome.get(nomePorContato.get(origem.contatoId) ?? "");
    if (venda) {
      linha.vendas += venda.vendas;
      linha.receita += venda.receita;
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
      });
    }
  }

  const linhas = [...porCampanha.values()].sort((a, b) => b.leads - a.leads);
  return NextResponse.json({ linhas, leadsSemCampanha }, { headers: { "cache-control": "no-store" } });
}
