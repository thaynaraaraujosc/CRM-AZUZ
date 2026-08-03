import {
  conversaoPorResponsavel,
  contatos,
  faturamentoPorResponsavel,
  funilJulho,
  funis,
  motivosPerda,
  oportunidadesPerdidas,
  serieDashboardRelatorios,
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
import { calcularResumoJornada, gerarLinhaDoTempo, EVENTO_CATEGORIA, EVENTO_LABELS } from "@/lib/timeline";
import { dataParaDocumento } from "@/lib/pdf-generator";
import type { SecaoRelatorio } from "@/lib/pdf-generator";

export type TipoRelatorio = "executivo" | "vendas" | "trafego" | "atividades" | "cliente" | "personalizado";
export type NivelDetalhe = "resumido" | "detalhado";

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
    descricao: "Dados, resumo, jornada, negociações e compras de um contato específico",
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
  nivelDetalhe?: NivelDetalhe;
};

export type DefinicaoSecao = {
  id: string;
  titulo: string;
  gerar: (ctx: ContextoRelatorio) => SecaoRelatorio;
};

function limiteLinhas(ctx: ContextoRelatorio): number {
  return ctx.nivelDetalhe === "detalhado" ? 60 : 10;
}

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

const META_PADRAO = 45000;

function secaoMetas(): SecaoRelatorio {
  const receita = calcularValorVendido();
  const percentual = Math.round((receita.valor / META_PADRAO) * 100);
  return {
    titulo: "Metas",
    linhas: [
      { label: "Meta de receita do período", value: formatarMoeda(META_PADRAO) },
      { label: "Realizado", value: receita.label },
      { label: "Percentual atingido", value: `${percentual}%` },
    ],
  };
}

function secaoTendencias(): SecaoRelatorio {
  const metade = Math.floor(serieDashboardRelatorios.length / 2);
  const primeira = serieDashboardRelatorios.slice(0, metade);
  const segunda = serieDashboardRelatorios.slice(metade);
  const somaVendas = (arr: typeof serieDashboardRelatorios) => arr.reduce((s, d) => s + d.vendas, 0);
  const somaReceita = (arr: typeof serieDashboardRelatorios) => arr.reduce((s, d) => s + d.valorVendas, 0);
  const vendas1 = somaVendas(primeira);
  const vendas2 = somaVendas(segunda);
  const receita1 = somaReceita(primeira);
  const receita2 = somaReceita(segunda);
  const variacaoVendas = vendas1 > 0 ? Math.round(((vendas2 - vendas1) / vendas1) * 100) : null;
  const variacaoReceita = receita1 > 0 ? Math.round(((receita2 - receita1) / receita1) * 100) : null;
  return {
    titulo: "Tendências",
    linhas: [
      { label: "Vendas · primeira metade do período", value: String(vendas1) },
      { label: "Vendas · segunda metade do período", value: String(vendas2) },
      { label: "Variação de vendas", value: variacaoVendas !== null ? `${variacaoVendas > 0 ? "+" : ""}${variacaoVendas}%` : "Não disponível" },
      { label: "Variação de receita", value: variacaoReceita !== null ? `${variacaoReceita > 0 ? "+" : ""}${variacaoReceita}%` : "Não disponível" },
    ],
  };
}

function secaoConclusoes(): SecaoRelatorio {
  const taxa = calcularTaxaConversao();
  const receita = calcularValorVendido();
  const principal = calcularMotivoPrincipalPerda();
  const percentualMeta = Math.round((receita.valor / META_PADRAO) * 100);
  const texto =
    `A operação fechou o período com ${receita.label} em receita (${percentualMeta}% da meta de ${formatarMoeda(META_PADRAO)}) ` +
    `e taxa de conversão de ${taxa.label}. O principal motivo de perda foi "${principal.motivo}", responsável por ${principal.valor}% ` +
    `das negociações perdidas — vale priorizar ação sobre esse ponto no próximo período.`;
  return { titulo: "Conclusões", observacao: texto };
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

function secaoCampanhas(ctx: ContextoRelatorio): SecaoRelatorio {
  return {
    titulo: "Campanhas",
    tabela: {
      colunas: ["Plataforma", "Campanha", "Investimento", "Leads", "ROAS"],
      linhas: campanhas.slice(0, limiteLinhas(ctx)).map((c) => {
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

function secaoProdutos(): SecaoRelatorio {
  return {
    titulo: "Produtos ou serviços",
    observacao:
      "Dados não conectados — cadastre produtos/serviços nas negociações pra ver a receita por item aqui.",
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
      { label: "Empresa", value: contato.empresa ?? "—" },
      { label: "Origem", value: contato.origem },
      { label: "Etapa atual", value: contato.etapa },
      { label: "Responsável", value: contato.responsavel },
      { label: "E-mail", value: contato.email ?? "—" },
      { label: "WhatsApp", value: contato.whatsapp ?? "—" },
    ],
  };
}

function secaoResumoJornadaCliente(ctx: ContextoRelatorio): SecaoRelatorio {
  const contato = contatos.find((c) => c.id === ctx.contatoId);
  if (!contato) return { titulo: "Resumo da jornada", observacao: "Nenhum contato selecionado." };
  const eventos = gerarLinhaDoTempo(contato.id);
  const resumo = calcularResumoJornada(contato, eventos);
  return {
    titulo: "Resumo da jornada",
    linhas: [
      { label: "Primeira entrada", value: resumo.primeiraEntrada ? dataParaDocumento(resumo.primeiraEntrada) : "Não disponível" },
      { label: "Canal inicial", value: resumo.canalInicial ?? "Não disponível" },
      { label: "Tempo até 1ª resposta", value: resumo.tempoAtePrimeiraResposta ?? "Não disponível" },
      { label: "Negociações", value: String(resumo.quantidadeNegociacoes) },
      { label: "Compras", value: String(resumo.quantidadeCompras) },
      { label: "Receita acumulada", value: resumo.receitaAcumulada ?? "Ainda não ocorreu" },
      { label: "Ticket médio", value: resumo.ticketMedio ?? "Ainda não ocorreu" },
      { label: "Última compra", value: resumo.ultimaCompra ? dataParaDocumento(resumo.ultimaCompra) : "Ainda não ocorreu" },
      { label: "Última interação", value: dataParaDocumento(resumo.ultimaInteracao) },
      { label: "Próxima ação", value: resumo.proximaAcao ?? "Nenhuma pendente" },
    ],
  };
}

function secaoJornadaCliente(ctx: ContextoRelatorio): SecaoRelatorio {
  if (!ctx.contatoId) return { titulo: "Linha do tempo", observacao: "Nenhum contato selecionado." };
  const eventos = gerarLinhaDoTempo(ctx.contatoId);
  return {
    titulo: "Linha do tempo",
    tabela: {
      colunas: ["Quando", "Categoria", "Evento", "Descrição"],
      linhas: eventos
        .slice(0, limiteLinhas(ctx))
        .map((e) => [dataParaDocumento(e.quando), EVENTO_CATEGORIA[e.tipo], EVENTO_LABELS[e.tipo], e.descricao ?? e.titulo]),
    },
  };
}

function secaoNegociacoesCliente(ctx: ContextoRelatorio): SecaoRelatorio {
  const contato = contatos.find((c) => c.id === ctx.contatoId);
  if (!contato) return { titulo: "Negociações", observacao: "Nenhum contato selecionado." };
  const cards = funis.flatMap((f) =>
    f.colunas.flatMap((c) => c.cards.filter((card) => card.nome === contato.nome).map((card) => ({ card, coluna: c, funil: f }))),
  );
  if (cards.length === 0) return { titulo: "Negociações", observacao: "Nenhuma negociação registrada ainda." };
  return {
    titulo: "Negociações",
    tabela: {
      colunas: ["Funil", "Etapa", "Origem", "Valor", "Entrada"],
      linhas: cards.map(({ card, coluna, funil }) => [funil.nome, coluna.titulo, card.origem, card.valor, dataParaDocumento(card.data || card.dias)]),
    },
  };
}

function secaoComprasCliente(ctx: ContextoRelatorio): SecaoRelatorio {
  const contato = contatos.find((c) => c.id === ctx.contatoId);
  if (!contato) return { titulo: "Compras", observacao: "Nenhum contato selecionado." };
  const compras = funis.flatMap((f) =>
    f.colunas
      .filter((c) => c.titulo.startsWith("Fechado"))
      .flatMap((c) => c.cards.filter((card) => card.nome === contato.nome)),
  );
  if (compras.length === 0) return { titulo: "Compras", observacao: "Ainda não ocorreu nenhuma compra." };
  return {
    titulo: "Compras",
    tabela: {
      colunas: ["Data", "Valor", "Origem"],
      linhas: compras.map((c) => [dataParaDocumento(c.data || c.dias), c.valor, c.origem]),
    },
  };
}

function secaoAtividadesCliente(ctx: ContextoRelatorio): SecaoRelatorio {
  const contato = contatos.find((c) => c.id === ctx.contatoId);
  if (!contato) return { titulo: "Atividades", observacao: "Nenhum contato selecionado." };
  const doContato = tarefas.flatMap((c) => c.cards).filter((t) => t.contato === contato.nome);
  if (doContato.length === 0) return { titulo: "Atividades", observacao: "Nenhuma tarefa registrada pra esse contato." };
  return {
    titulo: "Atividades",
    tabela: {
      colunas: ["Tarefa", "Responsável", "Data", "Situação"],
      linhas: doContato
        .slice(0, limiteLinhas(ctx))
        .map((t) => [t.titulo, t.responsavel.nome, dataParaDocumento(t.data), t.concluida ? "Concluída" : t.atrasada ? "Atrasada" : "Pendente"]),
    },
  };
}

export const SECOES_POR_TIPO: Record<TipoRelatorio, DefinicaoSecao[]> = {
  executivo: [
    { id: "resumo", titulo: "Resumo geral", gerar: secaoResumoGeral },
    { id: "metas", titulo: "Metas", gerar: secaoMetas },
    { id: "tendencias", titulo: "Tendências", gerar: secaoTendencias },
    { id: "trafego", titulo: "Tráfego", gerar: secaoTrafego },
    { id: "performance", titulo: "Performance", gerar: secaoPerformance },
    { id: "perdas", titulo: "Perdas", gerar: secaoPerdasResumo },
    { id: "alertas", titulo: "Alertas", gerar: secaoAlertas },
    { id: "conclusoes", titulo: "Conclusões", gerar: secaoConclusoes },
  ],
  vendas: [
    { id: "resumo-vendas", titulo: "Resumo de vendas", gerar: secaoVendasResumo },
    { id: "funil", titulo: "Funil", gerar: secaoFunilTrafego },
    { id: "performance", titulo: "Performance por responsável", gerar: secaoPerformance },
    { id: "produtos", titulo: "Produtos ou serviços", gerar: secaoProdutos },
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
    { id: "resumo-jornada", titulo: "Resumo da jornada", gerar: secaoResumoJornadaCliente },
    { id: "jornada-cliente", titulo: "Linha do tempo", gerar: secaoJornadaCliente },
    { id: "negociacoes-cliente", titulo: "Negociações", gerar: secaoNegociacoesCliente },
    { id: "compras-cliente", titulo: "Compras", gerar: secaoComprasCliente },
    { id: "atividades-cliente", titulo: "Atividades", gerar: secaoAtividadesCliente },
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
