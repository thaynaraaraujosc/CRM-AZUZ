/**
 * Camada única de cálculo de indicadores do CRM.
 *
 * Antes desse arquivo, cada tela (Início, Performance de venda, Tráfego,
 * CRM Live...) tinha seu próprio número hardcoded pra métricas com o mesmo
 * nome ("taxa de conversão", "ROAS", "valor vendido"...), sincronizados só
 * manualmente em `data.ts` (havia até comentários tipo "bate com X"). Isso
 * quebra na primeira mudança de dado real.
 *
 * Toda métrica tem UMA função aqui, que deriva o valor de dado real do
 * workspace (`NegocioCard.statusFechamento`/`motivoPerda` reais, `Conversa`
 * real, campanhas reais do Meta Ads) — nenhuma tem default fictício; quem
 * chama sempre passa o dado real explícito. Cada função também devolve os
 * registros que formaram o resultado, pra alimentar indicadores clicáveis.
 */

import type { Campanha, Funil, NegocioCard } from "@/lib/data";

export type Metrica<T> = {
  valor: number;
  label: string;
  /** Mostrado no tooltip ao passar o mouse — a fórmula exata usada. */
  formula: string;
  /** Registros granulares que compõem o resultado — base dos indicadores clicáveis. */
  registros: T[];
};

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarPercentual(valor: number, casas = 1): string {
  return `${valor.toFixed(casas).replace(".", ",")}%`;
}

export function formatarMinutos(min: number): string {
  if (min < 60) return `${Math.round(min)}min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}h${m}min` : `${h}h`;
}

/** Achata todos os `NegocioCard` de todos os funis/etapas num array só — ponto de entrada comum
 * pras métricas de negócio (a maioria não se importa de qual funil/etapa o card está, só do
 * desfecho). */
export function todosOsCards(funis: Funil[]): NegocioCard[] {
  return funis.flatMap((f) => f.colunas.flatMap((c) => c.cards));
}

function parseValorMoeda(raw: string): number {
  const n = Number(raw.replace(/[^\d,]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Taxa de conversão = negociações ganhas ÷ negociações encerradas (ganhas + perdidas) no
 * workspace. Fonte: `NegocioCard.statusFechamento` real (marcado no Funil, ver
 * `src/app/(app)/funil/page.tsx`).
 */
export function calcularTaxaConversao(cards: NegocioCard[]): Metrica<NegocioCard> {
  const ganhas = cards.filter((c) => c.statusFechamento === "ganho");
  const perdidas = cards.filter((c) => c.statusFechamento === "perdido");
  const encerradas = ganhas.length + perdidas.length;
  const valor = encerradas > 0 ? (ganhas.length / encerradas) * 100 : 0;
  return {
    valor,
    label: formatarPercentual(valor),
    formula: "Negociações ganhas ÷ negociações encerradas (ganhas + perdidas)",
    registros: [...ganhas, ...perdidas],
  };
}

/** Valor total vendido = soma do valor dos negócios marcados como ganhos. */
export function calcularValorVendido(cards: NegocioCard[]): Metrica<NegocioCard> {
  const ganhas = cards.filter((c) => c.statusFechamento === "ganho");
  const valor = ganhas.reduce((s, c) => s + parseValorMoeda(c.valor), 0);
  return {
    valor,
    label: formatarMoeda(valor),
    formula: "Soma do valor de todos os negócios marcados como ganhos",
    registros: ganhas,
  };
}

/** Valor total perdido = soma do valor dos negócios marcados como perdidos. */
export function calcularValorPerdido(cards: NegocioCard[]): Metrica<NegocioCard> {
  const perdidas = cards.filter((c) => c.statusFechamento === "perdido");
  const valor = perdidas.reduce((s, c) => s + parseValorMoeda(c.valor), 0);
  return {
    valor,
    label: formatarMoeda(valor),
    formula: "Soma do valor de todos os negócios marcados como perdidos",
    registros: perdidas,
  };
}

/** Ticket médio = valor total vendido ÷ quantidade de negócios ganhos. */
export function calcularTicketMedio(cards: NegocioCard[]): Metrica<NegocioCard> {
  const ganhas = cards.filter((c) => c.statusFechamento === "ganho");
  const valorTotal = ganhas.reduce((s, c) => s + parseValorMoeda(c.valor), 0);
  const valor = ganhas.length > 0 ? valorTotal / ganhas.length : 0;
  return {
    valor,
    label: formatarMoeda(valor),
    formula: "Valor total vendido ÷ quantidade de negócios ganhos",
    registros: ganhas,
  };
}

/** Principal motivo de perda = motivo mais frequente entre os negócios marcados como perdidos. */
export function calcularMotivoPrincipalPerda(cards: NegocioCard[]): Metrica<NegocioCard> & { motivo: string } {
  const perdidas = cards.filter((c) => c.statusFechamento === "perdido" && c.motivoPerda);
  const contagem = new Map<string, number>();
  for (const c of perdidas) {
    const motivo = c.motivoPerda!;
    contagem.set(motivo, (contagem.get(motivo) ?? 0) + 1);
  }
  const [motivoPrincipal, qtd] = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  const percentual = perdidas.length > 0 && motivoPrincipal ? (qtd / perdidas.length) * 100 : 0;
  return {
    valor: percentual,
    label: motivoPrincipal ?? "—",
    motivo: motivoPrincipal ?? "—",
    formula: "Motivo com mais negócios perdidos, entre os que têm motivo registrado",
    registros: perdidas,
  };
}

/** Distribuição de motivos de perda (pra gráfico/ranking) — cada motivo com contagem e percentual
 * sobre o total de negócios perdidos com motivo registrado. */
export function calcularDistribuicaoMotivosPerda(
  cards: NegocioCard[],
): { motivo: string; quantidade: number; percentual: number }[] {
  const perdidas = cards.filter((c) => c.statusFechamento === "perdido" && c.motivoPerda);
  const contagem = new Map<string, number>();
  for (const c of perdidas) {
    contagem.set(c.motivoPerda!, (contagem.get(c.motivoPerda!) ?? 0) + 1);
  }
  return [...contagem.entries()]
    .map(([motivo, quantidade]) => ({
      motivo,
      quantidade,
      percentual: perdidas.length > 0 ? (quantidade / perdidas.length) * 100 : 0,
    }))
    .sort((a, b) => b.quantidade - a.quantidade);
}

/** Leads aguardando atendimento = conversas cujo status ainda não teve resposta da equipe. Tipo
 * estrutural mínimo (só `status`) — aceita tanto `Conversa` (mock) quanto `ConversaReal`
 * (`useConversas()`), sem acoplar essa métrica a um dos dois. */
export function calcularLeadsAguardando<T extends { status: string }>(conversas: T[]): Metrica<T> {
  const registros = conversas.filter((c) => c.status === "Não respondido");
  return {
    valor: registros.length,
    label: String(registros.length),
    formula: 'Contagem de conversas com status "Não respondido"',
    registros,
  };
}

/** Leads no funil, na etapa "Novo" (ou primeira etapa) — mesma fonte que o Kanban mostra. */
export function calcularFunilResumo(funis: Funil[]): Metrica<NegocioCard> {
  const primeiraEtapa = funis[0]?.colunas[0];
  const cards = primeiraEtapa?.cards ?? [];
  return {
    valor: cards.length,
    label: String(cards.length),
    formula: 'Contagem de negócios na primeira etapa do funil ativo',
    registros: cards,
  };
}

/** Desempenho agrupado por responsável — vendidas/perdidas/receita, derivado direto de
 * `NegocioCard.responsavel` + `statusFechamento`. Cards sem responsável ficam de fora (não dá pra
 * atribuir a ninguém). */
export function calcularPorResponsavel(
  cards: NegocioCard[],
): { nome: string; vendidas: number; perdidas: number; receita: number }[] {
  const porNome = new Map<string, { vendidas: number; perdidas: number; receita: number }>();
  for (const c of cards) {
    if (!c.responsavel) continue;
    const atual = porNome.get(c.responsavel) ?? { vendidas: 0, perdidas: 0, receita: 0 };
    if (c.statusFechamento === "ganho") {
      atual.vendidas += 1;
      atual.receita += parseValorMoeda(c.valor);
    } else if (c.statusFechamento === "perdido") {
      atual.perdidas += 1;
    }
    porNome.set(c.responsavel, atual);
  }
  return [...porNome.entries()].map(([nome, v]) => ({ nome, ...v }));
}

/** Série diária real (últimos N dias com movimento) — negócios criados (`data`) e
 * ganhos/perdidos/receita (`dataFechamento`), agrupados por dia. Substitui o antigo
 * `serieDashboardRelatorios` mockado; só existe ponto no gráfico pros dias em que algo realmente
 * aconteceu. */
export function calcularSerieDiaria(
  cards: NegocioCard[],
): { dia: string; criadas: number; vendas: number; perdas: number; valorVendas: number }[] {
  const porDia = new Map<string, { criadas: number; vendas: number; perdas: number; valorVendas: number }>();
  function linha(dia: string) {
    const atual = porDia.get(dia) ?? { criadas: 0, vendas: 0, perdas: 0, valorVendas: 0 };
    porDia.set(dia, atual);
    return atual;
  }
  for (const c of cards) {
    if (c.data) linha(c.data).criadas += 1;
    if (c.dataFechamento && c.statusFechamento === "ganho") {
      const l = linha(c.dataFechamento);
      l.vendas += 1;
      l.valorVendas += parseValorMoeda(c.valor);
    } else if (c.dataFechamento && c.statusFechamento === "perdido") {
      linha(c.dataFechamento).perdas += 1;
    }
  }
  return [...porDia.entries()].map(([dia, v]) => ({ dia, ...v })).sort((a, b) => a.dia.localeCompare(b.dia));
}

function parseSubCampanha(sub: string): { leads: number; investido: number } {
  const leadsMatch = sub.match(/(\d+)\s*leads?/i);
  const investidoMatch = sub.match(/R\$\s*([\d.,]+)\s*investidos?/i);
  const leads = leadsMatch ? Number(leadsMatch[1]) : 0;
  const investido = investidoMatch
    ? Number(investidoMatch[1].replace(/\./g, "").replace(",", "."))
    : 0;
  return { leads, investido };
}
export { parseSubCampanha };

/** Investimento total em tráfego pago = soma do investido em todas as campanhas ativas
 * (conectadas via Meta Ads — `GET /api/integracoes/meta/ads/campanhas`). */
export function calcularInvestimentoTrafego(campanhas: Campanha[]): Metrica<Campanha> {
  const valor = campanhas.reduce((s, c) => s + parseSubCampanha(c.sub).investido, 0);
  return {
    valor,
    label: formatarMoeda(valor),
    formula: "Soma do investimento em todas as campanhas de tráfego pago conectadas",
    registros: campanhas,
  };
}

/** Leads vindos de tráfego pago = soma de leads reportados por todas as campanhas conectadas. */
export function calcularLeadsTrafego(campanhas: Campanha[]): Metrica<Campanha> {
  const valor = campanhas.reduce((s, c) => s + parseSubCampanha(c.sub).leads, 0);
  return {
    valor,
    label: String(valor),
    formula: "Soma de leads gerados por todas as campanhas de tráfego pago conectadas",
    registros: campanhas,
  };
}

/**
 * ROAS médio ponderado = receita total gerada por tráfego pago ÷ investimento total, ponderado
 * pelo investido de cada campanha — evita ter um "ROAS médio" solto e desconectado do ROAS por
 * campanha.
 */
export function calcularRoasMedio(campanhas: Campanha[]): Metrica<Campanha> {
  let receitaTotal = 0;
  let investidoTotal = 0;
  for (const c of campanhas) {
    const { investido } = parseSubCampanha(c.sub);
    const roasNum = Number(c.roas.replace(",", ".").replace("x", "")) || 0;
    receitaTotal += investido * roasNum;
    investidoTotal += investido;
  }
  const valor = investidoTotal > 0 ? receitaTotal / investidoTotal : 0;
  return {
    valor,
    label: `${valor.toFixed(1).replace(".", ",")}x`,
    formula: "Receita atribuída ao tráfego pago ÷ investimento total, ponderado por campanha",
    registros: campanhas,
  };
}
