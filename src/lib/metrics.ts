/**
 * Camada única de cálculo de indicadores do CRM.
 *
 * Antes desse arquivo, cada tela (Início, Performance de venda, Tráfego,
 * CRM Live...) tinha seu próprio número hardcoded pra métricas com o mesmo
 * nome ("taxa de conversão", "ROAS", "valor vendido"...), sincronizados só
 * manualmente em `data.ts` (havia até comentários tipo "bate com X"). Isso
 * quebra na primeira mudança de dado real.
 *
 * A partir daqui, toda métrica tem UMA função aqui, que deriva o valor dos
 * dados granulares (por responsável, por campanha, por oportunidade) — nunca
 * de uma string pré-formatada. Cada função também devolve os registros que
 * formaram o resultado, pra alimentar indicadores clicáveis (ver seção 14 do
 * pedido: todo número tem que abrir a lista que o formou).
 */

import {
  campanhas as campanhasPadrao,
  conversas as conversasPadrao,
  conversaoPorResponsavel as conversaoPadrao,
  faturamentoPorResponsavel as faturamentoPadrao,
  funilJulho as funilJulhoPadrao,
  motivosPerda as motivosPerdaPadrao,
  oportunidadesPerdidas as oportunidadesPerdidasPadrao,
  tempoPrimeiroContatoPorResponsavel as tempoPrimeiroContatoPadrao,
  type Conversa,
} from "@/lib/data";

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

/**
 * Taxa de conversão = negociações ganhas ÷ negociações encerradas (ganhas + perdidas) no período.
 * Fonte granular: `conversaoPorResponsavel` (contagem real de vendidas/perdidas por responsável).
 */
export function calcularTaxaConversao(
  base = conversaoPadrao,
): Metrica<(typeof conversaoPadrao)[number]> {
  const vendidas = base.reduce((s, r) => s + r.vendidas, 0);
  const perdidas = base.reduce((s, r) => s + r.perdidas, 0);
  const encerradas = vendidas + perdidas;
  const valor = encerradas > 0 ? (vendidas / encerradas) * 100 : 0;
  return {
    valor,
    label: formatarPercentual(valor),
    formula: "Negociações ganhas ÷ negociações encerradas (ganhas + perdidas) no período",
    registros: base,
  };
}

/** Valor total vendido = soma do faturamento realizado por responsável no período. */
export function calcularValorVendido(
  base = faturamentoPadrao,
): Metrica<(typeof faturamentoPadrao)[number]> {
  const valor = base.reduce((s, r) => s + r.valor, 0);
  return {
    valor,
    label: formatarMoeda(valor),
    formula: "Soma do valor de todas as negociações fechadas no período, por responsável",
    registros: base,
  };
}

/**
 * Tempo médio de primeiro contato = média ponderada do tempo até o primeiro
 * atendimento, ponderada pela quantidade de oportunidades de cada responsável.
 */
export function calcularTempoMedioPrimeiroContato(
  base = tempoPrimeiroContatoPadrao,
): Metrica<(typeof tempoPrimeiroContatoPadrao)[number]> {
  const totalOportunidades = base.reduce((s, r) => s + r.oportunidades, 0);
  const somaMinutos = base.reduce((s, r) => s + r.minutos * r.oportunidades, 0);
  const valor = totalOportunidades > 0 ? somaMinutos / totalOportunidades : 0;
  return {
    valor,
    label: formatarMinutos(valor),
    formula: "Média do tempo entre a entrada do lead e o primeiro atendimento, ponderada por responsável",
    registros: base,
  };
}

type Campanha = (typeof campanhasPadrao)[number];

export function parseSubCampanha(sub: string): { leads: number; investido: number } {
  const leadsMatch = sub.match(/(\d+)\s*leads?/i);
  const investidoMatch = sub.match(/R\$\s*([\d.,]+)\s*investidos?/i);
  const leads = leadsMatch ? Number(leadsMatch[1]) : 0;
  const investido = investidoMatch
    ? Number(investidoMatch[1].replace(/\./g, "").replace(",", "."))
    : 0;
  return { leads, investido };
}

/** Investimento total em tráfego pago = soma do investido em todas as campanhas ativas no período. */
export function calcularInvestimentoTrafego(base = campanhasPadrao): Metrica<Campanha> {
  const valor = base.reduce((s, c) => s + parseSubCampanha(c.sub).investido, 0);
  return {
    valor,
    label: formatarMoeda(valor),
    formula: "Soma do investimento em todas as campanhas de tráfego pago no período",
    registros: base,
  };
}

/** Leads vindos de tráfego pago = soma de leads reportados por todas as campanhas no período. */
export function calcularLeadsTrafego(base = campanhasPadrao): Metrica<Campanha> {
  const valor = base.reduce((s, c) => s + parseSubCampanha(c.sub).leads, 0);
  return {
    valor,
    label: String(valor),
    formula: "Soma de leads gerados por todas as campanhas de tráfego pago no período",
    registros: base,
  };
}

/**
 * ROAS médio ponderado = receita total gerada por tráfego pago ÷ investimento total.
 * Deriva de `campanha.roas` (receita/investimento por campanha) ponderado pelo investido —
 * evita ter um "ROAS médio" solto e desconectado do ROAS por campanha.
 */
export function calcularRoasMedio(base = campanhasPadrao): Metrica<Campanha> {
  let receitaTotal = 0;
  let investidoTotal = 0;
  for (const c of base) {
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
    registros: base,
  };
}

type EtapaFunil = (typeof funilJulhoPadrao)[number];

/** Leads no funil, por etapa — fonte única para "novos leads", "qualificados" e "fechados". */
export function calcularFunilResumo(base = funilJulhoPadrao): Metrica<EtapaFunil> {
  const total = base[0]?.total ?? 0;
  return {
    valor: total,
    label: String(total),
    formula: "Contagem de negociações na etapa \"Novo\" do funil, no período",
    registros: base,
  };
}

type Perda = (typeof oportunidadesPerdidasPadrao)[number];

/** Valor total perdido = soma do valor de todas as negociações marcadas como perdidas no período. */
export function calcularValorPerdido(base = oportunidadesPerdidasPadrao): Metrica<Perda> {
  const valor = base.reduce((s, o) => {
    const n = Number(o.valor.replace(/[^\d,]/g, "").replace(",", "."));
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);
  return {
    valor,
    label: formatarMoeda(valor),
    formula: "Soma do valor de todas as negociações perdidas no período",
    registros: base,
  };
}

type MotivoPerda = (typeof motivosPerdaPadrao)[number];

/** Leads aguardando atendimento = conversas cujo status ainda não teve resposta da equipe. */
export function calcularLeadsAguardando(base: Conversa[] = conversasPadrao): Metrica<Conversa> {
  const registros = base.filter((c) => c.status === "Não respondido");
  return {
    valor: registros.length,
    label: String(registros.length),
    formula: "Contagem de conversas com status \"Não respondido\"",
    registros,
  };
}

/** Oportunidades contatadas = soma de oportunidades atendidas por todos os responsáveis no período. */
export function calcularOportunidadesContatadas(
  base = tempoPrimeiroContatoPadrao,
): Metrica<(typeof tempoPrimeiroContatoPadrao)[number]> {
  const valor = base.reduce((s, r) => s + r.oportunidades, 0);
  return {
    valor,
    label: String(valor),
    formula: "Soma de oportunidades com pelo menos um atendimento registrado, por responsável, no período",
    registros: base,
  };
}

/** Ticket médio = valor total vendido ÷ quantidade de negociações vendidas no período. */
export function calcularTicketMedio(
  baseValor = faturamentoPadrao,
  baseQtd = conversaoPadrao,
): Metrica<(typeof faturamentoPadrao)[number]> {
  const valorTotal = baseValor.reduce((s, r) => s + r.valor, 0);
  const qtd = baseQtd.reduce((s, r) => s + r.vendidas, 0);
  const valor = qtd > 0 ? valorTotal / qtd : 0;
  return {
    valor,
    label: formatarMoeda(valor),
    formula: "Valor total vendido ÷ quantidade de negociações vendidas no período",
    registros: baseValor,
  };
}

/** Principal motivo de perda = motivo com maior quantidade de negociações perdidas no período. */
export function calcularMotivoPrincipalPerda(
  base = motivosPerdaPadrao,
): Metrica<MotivoPerda> & { motivo: string } {
  const principal = [...base].sort((a, b) => b.quantidade - a.quantidade)[0];
  return {
    valor: principal?.percentual ?? 0,
    label: principal?.motivo ?? "—",
    motivo: principal?.motivo ?? "—",
    formula: "Motivo de perda com maior quantidade de negociações perdidas no período",
    registros: base,
  };
}
