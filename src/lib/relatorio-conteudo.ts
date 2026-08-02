import {
  conversaoPorResponsavel,
  contatos,
  faturamentoPorResponsavel,
  funilJulho,
  motivosPerda,
  oportunidadesPerdidas,
  tarefas,
  campanhas,
  ligacoesPorResponsavel,
  conversas,
} from "@/lib/data";
import {
  calcularInvestimentoTrafego,
  calcularLeadsAguardando,
  calcularLeadsTrafego,
  calcularMotivoPrincipalPerda,
  calcularRoasMedio,
  calcularTaxaConversao,
  calcularTempoMedioPrimeiroContato,
  calcularTicketMedio,
  calcularValorPerdido,
  calcularValorVendido,
  formatarMoeda,
  parseSubCampanha,
} from "@/lib/metrics";
import { gerarLinhaDoTempo, EVENTO_LABELS } from "@/lib/timeline";
import type { SecaoRelatorio } from "@/lib/pdf-generator";

export type TipoRelatorio = "executivo" | "vendas" | "trafego" | "atividades" | "cliente" | "personalizado";

export const TIPOS_RELATORIO: { tipo: TipoRelatorio; nome: string; descricao: string; icone: string }[] = [
  {
    tipo: "executivo",
    nome: "Relatório executivo",
    descricao: "Panorama completo da operação num só documento",
    icone: "📊",
  },
  {
    tipo: "vendas",
    nome: "Relatório de vendas",
    descricao: "Negociações, conversão, ciclo de venda e performance por responsável",
    icone: "💰",
  },
  {
    tipo: "trafego",
    nome: "Relatório de tráfego",
    descricao: "Investimento, campanhas, aquisição e receita atribuída",
    icone: "📣",
  },
  {
    tipo: "atividades",
    nome: "Relatório de atividades",
    descricao: "Atendimento, tarefas e interações da equipe",
    icone: "✅",
  },
  {
    tipo: "cliente",
    nome: "Relatório do cliente",
    descricao: "Jornada completa de um contato ou empresa específico",
    icone: "🧭",
  },
  {
    tipo: "personalizado",
    nome: "Relatório personalizado",
    descricao: "Escolha livremente métricas, seções e período",
    icone: "🛠️",
  },
];

export type ContextoRelatorio = {
  periodoLabel: string;
  contatoId?: string;
};

export type DefinicaoSecao = {
  id: string;
  titulo: string;
  gerar: (ctx: ContextoRelatorio) => SecaoRelatorio;
};

function secaoResumoGeral(): SecaoRelatorio {
  const taxa = calcularTaxaConversao();
  const receita = calcularValorVendido();
  const ticket = calcularTicketMedio();
  return {
    titulo: "Resumo geral",
    linhas: [
      { label: "Leads no período", value: String(funilJulho[0]?.total ?? 0) },
      { label: "Taxa de conversão", value: taxa.label },
      { label: "Receita", value: receita.label },
      { label: "Ticket médio", value: ticket.label },
    ],
  };
}

function secaoTrafego(): SecaoRelatorio {
  const investido = calcularInvestimentoTrafego();
  const leads = calcularLeadsTrafego();
  const roas = calcularRoasMedio();
  return {
    titulo: "Tráfego",
    linhas: [
      { label: "Investido", value: investido.label },
      { label: "Leads gerados", value: leads.label },
      { label: "ROAS", value: roas.label },
    ],
  };
}

function secaoFunilTrafego(): SecaoRelatorio {
  return {
    titulo: "Funil de tráfego",
    barras: funilJulho.map((e, i) => ({
      label: e.etapa,
      meta: `${e.total} negociações`,
      percentual: i === 0 ? 100 : Math.round((e.total / funilJulho[0].total) * 100),
    })),
  };
}

function secaoCampanhas(): SecaoRelatorio {
  return {
    titulo: "Campanhas",
    tabela: {
      colunas: ["Plataforma", "Campanha", "Investimento", "Leads", "ROAS"],
      linhas: campanhas.map((c) => {
        const { leads, investido } = parseSubCampanha(c.sub);
        return [c.plataforma === "M" ? "Meta Ads" : "Google Ads", c.nome, formatarMoeda(investido), String(leads), c.roas];
      }),
    },
  };
}

function secaoPerformance(): SecaoRelatorio {
  return {
    titulo: "Performance por responsável",
    barras: conversaoPorResponsavel.map((r) => {
      const total = r.vendidas + r.perdidas;
      const taxa = total > 0 ? Math.round((r.vendidas / total) * 100) : 0;
      const fat = faturamentoPorResponsavel.find((f) => f.nome === r.nome);
      return {
        label: r.nome,
        meta: `${r.vendidas} vendas · ${r.perdidas} perdas · ${fat ? formatarMoeda(fat.valor) : "—"}`,
        percentual: taxa,
      };
    }),
  };
}

function secaoVendasResumo(): SecaoRelatorio {
  const taxa = calcularTaxaConversao();
  const receita = calcularValorVendido();
  const ticket = calcularTicketMedio();
  const total = conversaoPorResponsavel.reduce((s, r) => s + r.vendidas + r.perdidas, 0);
  const vendidas = conversaoPorResponsavel.reduce((s, r) => s + r.vendidas, 0);
  return {
    titulo: "Resumo de vendas",
    linhas: [
      { label: "Total de negociações", value: String(total) },
      { label: "Vendas", value: String(vendidas) },
      { label: "Receita", value: receita.label },
      { label: "Taxa de conversão", value: taxa.label },
      { label: "Ticket médio", value: ticket.label },
    ],
  };
}

function secaoPerdasResumo(): SecaoRelatorio {
  const valorPerdido = calcularValorPerdido();
  const principal = calcularMotivoPrincipalPerda();
  return {
    titulo: "Perdas (resumo)",
    linhas: [
      { label: "Valor perdido", value: valorPerdido.label },
      { label: "Quantidade perdida", value: String(oportunidadesPerdidas.length) },
      { label: "Principal motivo", value: `${principal.motivo} (${principal.valor}%)` },
    ],
  };
}

function secaoMotivosDetalhado(): SecaoRelatorio {
  return {
    titulo: "Motivos de perda",
    barras: motivosPerda.map((m) => ({
      label: m.motivo,
      meta: `${m.quantidade} perdas · ${m.valor}`,
      percentual: m.percentual,
    })),
  };
}

function secaoAtendimento(): SecaoRelatorio {
  const tempo = calcularTempoMedioPrimeiroContato();
  const aguardando = calcularLeadsAguardando();
  return {
    titulo: "Atendimento",
    linhas: [
      { label: "Leads recebidos", value: String(conversas.length) },
      { label: "Leads aguardando atendimento", value: aguardando.label },
      { label: "Tempo médio de primeira resposta", value: tempo.label },
    ],
  };
}

function secaoTarefas(): SecaoRelatorio {
  const todas = tarefas.flatMap((c) => c.cards);
  return {
    titulo: "Tarefas",
    linhas: [
      { label: "Criadas", value: String(todas.length) },
      { label: "Concluídas", value: String(todas.filter((t) => t.concluida).length) },
      { label: "Atrasadas", value: String(todas.filter((t) => t.atrasada).length) },
    ],
  };
}

function secaoInteracoes(): SecaoRelatorio {
  const enviadas = conversas.reduce((s, c) => s + c.mensagens.filter((m) => m.tipo === "out").length, 0);
  const recebidas = conversas.reduce((s, c) => s + c.mensagens.filter((m) => m.tipo === "in").length, 0);
  const ligacoes = ligacoesPorResponsavel.reduce((s, r) => s + r.quantidade, 0);
  return {
    titulo: "Interações",
    linhas: [
      { label: "Mensagens enviadas", value: String(enviadas) },
      { label: "Mensagens recebidas", value: String(recebidas) },
      { label: "Ligações", value: String(ligacoes) },
    ],
  };
}

function secaoAlertas(): SecaoRelatorio {
  const atrasadas = tarefas.find((c) => c.titulo === "Atrasadas")?.cards.length ?? 0;
  return {
    titulo: "Alertas",
    observacao: `${atrasadas} tarefa(s) atrasada(s) no período. Consulte a Inteligência comercial para ação imediata.`,
  };
}

function secaoDadosCliente(ctx: ContextoRelatorio): SecaoRelatorio {
  const contato = contatos.find((c) => c.id === ctx.contatoId);
  if (!contato) return { titulo: "Dados do contato", observacao: "Nenhum contato selecionado." };
  return {
    titulo: "Dados do contato",
    linhas: [
      { label: "Nome", value: contato.nome },
      { label: "Origem", value: contato.origem },
      { label: "Etapa atual", value: contato.etapa },
      { label: "Responsável", value: contato.responsavel },
      { label: "E-mail", value: contato.email ?? "—" },
      { label: "WhatsApp", value: contato.whatsapp ?? "—" },
    ],
  };
}

function secaoJornadaCliente(ctx: ContextoRelatorio): SecaoRelatorio {
  if (!ctx.contatoId) return { titulo: "Jornada", observacao: "Nenhum contato selecionado." };
  const eventos = gerarLinhaDoTempo(ctx.contatoId);
  return {
    titulo: "Jornada",
    tabela: {
      colunas: ["Quando", "Evento", "Descrição"],
      linhas: eventos.slice(0, 30).map((e) => [e.quando, EVENTO_LABELS[e.tipo], e.descricao ?? e.titulo]),
    },
  };
}

export const SECOES_POR_TIPO: Record<TipoRelatorio, DefinicaoSecao[]> = {
  executivo: [
    { id: "resumo", titulo: "Resumo geral", gerar: secaoResumoGeral },
    { id: "trafego", titulo: "Tráfego", gerar: secaoTrafego },
    { id: "performance", titulo: "Performance", gerar: secaoPerformance },
    { id: "perdas", titulo: "Perdas", gerar: secaoPerdasResumo },
    { id: "alertas", titulo: "Alertas", gerar: secaoAlertas },
  ],
  vendas: [
    { id: "resumo-vendas", titulo: "Resumo de vendas", gerar: secaoVendasResumo },
    { id: "funil", titulo: "Funil", gerar: secaoFunilTrafego },
    { id: "performance", titulo: "Performance por responsável", gerar: secaoPerformance },
    { id: "perdas", titulo: "Perdas (resumo)", gerar: secaoPerdasResumo },
  ],
  trafego: [
    { id: "trafego", titulo: "Investimento e aquisição", gerar: secaoTrafego },
    { id: "funil-trafego", titulo: "Funil de tráfego", gerar: secaoFunilTrafego },
    { id: "campanhas", titulo: "Campanhas", gerar: secaoCampanhas },
  ],
  atividades: [
    { id: "atendimento", titulo: "Atendimento", gerar: secaoAtendimento },
    { id: "tarefas", titulo: "Tarefas", gerar: secaoTarefas },
    { id: "interacoes", titulo: "Interações", gerar: secaoInteracoes },
  ],
  cliente: [
    { id: "dados-cliente", titulo: "Dados do contato", gerar: secaoDadosCliente },
    { id: "jornada-cliente", titulo: "Jornada", gerar: secaoJornadaCliente },
  ],
  personalizado: [],
};

SECOES_POR_TIPO.personalizado = Array.from(
  new Map(
    Object.values(SECOES_POR_TIPO)
      .flat()
      .map((s) => [s.id, s]),
  ).values(),
);

export function nomeArquivoRelatorio(nomeRelatorio: string, periodoLabel: string): string {
  return `${nomeRelatorio} — ${periodoLabel}.pdf`;
}

export { secaoMotivosDetalhado };
