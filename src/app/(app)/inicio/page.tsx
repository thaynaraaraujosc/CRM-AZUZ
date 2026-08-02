"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { atividadeRecente, conversas, equipe, funilJulho, leadsPorDia, tarefas, today } from "@/lib/data";
import { useFunis } from "@/lib/funis-context";
import { FilterBar, KpiCard, PERIODO_PADRAO, type FiltroDef, type PeriodoValor } from "@/components/ui";
import {
  calcularFunilResumo,
  calcularLeadsAguardando,
  calcularTempoMedioPrimeiroContato,
  calcularTicketMedio,
  calcularValorPerdido,
  calcularValorVendido,
  formatarMoeda,
} from "@/lib/metrics";
import { conversaoPorResponsavel, faturamentoPorResponsavel, tempoPrimeiroContatoPorResponsavel } from "@/lib/data";

const CHAVE_CONFIG = "azuz-inicio-config-v1";

type ConfigInicio = {
  ocultos: string[];
  ordem: string[];
  meta: number;
};

const CONFIG_PADRAO: ConfigInicio = {
  ocultos: ["vendasQtd", "ticketMedio", "valorPerdido"],
  meta: 45000,
  ordem: [
    "novosLeads",
    "leadsAguardando",
    "tempoResposta",
    "negociacoesAbertas",
    "receita",
    "metaPeriodo",
    "tarefasPendentes",
    "tarefasAtrasadas",
    "vendasQtd",
    "ticketMedio",
    "valorPerdido",
  ],
};

/**
 * A Visão geral que antes vivia em /inteligencia-comercial agora mora aqui —
 * não faz sentido ter duas "visões gerais" em áreas diferentes do CRM. Todo
 * cartão é opcional (o usuário decide o que ver) e a ordem/visibilidade fica
 * salva no navegador; quando o back-end existir, isso vira preferência de
 * usuário de verdade, sem mudar o contrato dos componentes.
 */
export default function InicioPage() {
  const { funis } = useFunis();
  const [periodo, setPeriodo] = useState<PeriodoValor>(PERIODO_PADRAO);
  const [funilFiltro, setFuncilFiltro] = useState("Todos");
  const [responsavelFiltro, setResponsavelFiltro] = useState("Todos");
  const [config, setConfig] = useState<ConfigInicio>(() => {
    if (typeof window === "undefined") return CONFIG_PADRAO;
    try {
      const salvo = localStorage.getItem(CHAVE_CONFIG);
      return salvo ? (JSON.parse(salvo) as ConfigInicio) : CONFIG_PADRAO;
    } catch {
      return CONFIG_PADRAO;
    }
  });
  const [personalizarAberto, setPersonalizarAberto] = useState(false);
  const [metaInput, setMetaInput] = useState(String(config.meta || 45000));

  function salvarConfig(next: ConfigInicio) {
    setConfig(next);
    if (typeof window !== "undefined") localStorage.setItem(CHAVE_CONFIG, JSON.stringify(next));
  }

  function alternarCard(chave: string) {
    const ocultos = config.ocultos.includes(chave)
      ? config.ocultos.filter((c) => c !== chave)
      : [...config.ocultos, chave];
    salvarConfig({ ...config, ocultos });
  }

  function moverCard(chave: string, direcao: -1 | 1) {
    const visiveis = config.ordem.filter((c) => !config.ocultos.includes(c));
    const i = visiveis.indexOf(chave);
    const j = i + direcao;
    if (i < 0 || j < 0 || j >= visiveis.length) return;
    [visiveis[i], visiveis[j]] = [visiveis[j], visiveis[i]];
    const ordem = [...visiveis, ...config.ordem.filter((c) => config.ocultos.includes(c))];
    salvarConfig({ ...config, ordem });
  }

  // Filtros funcionais: aplicam sobre os dados granulares por responsável
  // antes de calcular qualquer métrica — mesma fonte usada em Performance e
  // Atividades, então os números batem entre as telas.
  const conversaoFiltrada =
    responsavelFiltro === "Todos"
      ? conversaoPorResponsavel
      : conversaoPorResponsavel.filter((r) => r.nome === responsavelFiltro);
  const tempoContatoFiltrado =
    responsavelFiltro === "Todos"
      ? tempoPrimeiroContatoPorResponsavel
      : tempoPrimeiroContatoPorResponsavel.filter((r) => r.nome === responsavelFiltro);
  const faturamentoFiltrado =
    responsavelFiltro === "Todos"
      ? faturamentoPorResponsavel
      : faturamentoPorResponsavel.filter((r) => r.nome === responsavelFiltro);

  const funisFiltrados = funilFiltro === "Todos" ? funis : funis.filter((f) => f.nome === funilFiltro);
  const tarefasFiltradas = tarefas.map((coluna) => ({
    ...coluna,
    cards:
      responsavelFiltro === "Todos"
        ? coluna.cards
        : coluna.cards.filter((c) => c.responsavel.nome === responsavelFiltro),
  }));

  const leadsAguardando = calcularLeadsAguardando(conversas);
  const tempoResposta = calcularTempoMedioPrimeiroContato(tempoContatoFiltrado);
  const receita = calcularValorVendido(faturamentoFiltrado);
  const ticketMedio = calcularTicketMedio(faturamentoFiltrado, conversaoFiltrada);
  const valorPerdido = calcularValorPerdido();
  const vendasQtd = conversaoFiltrada.reduce((s, r) => s + r.vendidas, 0);
  const funilResumo = calcularFunilResumo();

  const colunaAtrasadas = tarefasFiltradas.find((c) => c.titulo === "Atrasadas");
  const tarefasAtrasadas = colunaAtrasadas?.cards ?? [];
  const tarefasPendentes = tarefasFiltradas
    .filter((c) => c.titulo !== "Concluídas")
    .flatMap((c) => c.cards);

  const negociacoesAbertas = funisFiltrados.flatMap((f) =>
    f.colunas.filter((c) => !c.titulo.startsWith("Fechado")).flatMap((c) => c.cards),
  );
  const negociacoesParadas = negociacoesAbertas.filter((card) => {
    const m = card.dias.match(/(\d+)\s*dias?/i);
    return m ? Number(m[1]) >= 3 : false;
  });

  const meta = config.meta || 45000;
  const percentualMeta = meta > 0 ? Math.min(999, Math.round((receita.valor / meta) * 100)) : 0;

  const CARDS: Record<
    string,
    { label: string; value: string; sub?: string; formula?: string; href: string }
  > = {
    novosLeads: {
      label: "Novos leads",
      value: funilResumo.label,
      sub: 'Etapa "Novo" do funil',
      formula: funilResumo.formula,
      href: "/funil",
    },
    leadsAguardando: {
      label: "Leads aguardando atendimento",
      value: leadsAguardando.label,
      formula: leadsAguardando.formula,
      href: "/conversas",
    },
    tempoResposta: {
      label: "Tempo médio da primeira resposta",
      value: tempoResposta.label,
      formula: tempoResposta.formula,
      href: "/atividades-vendas",
    },
    negociacoesAbertas: {
      label: "Negociações abertas",
      value: String(negociacoesAbertas.length),
      formula: "Contagem de negociações em qualquer etapa que não seja a de fechamento",
      href: "/funil",
    },
    receita: {
      label: "Receita no período",
      value: receita.label,
      formula: receita.formula,
      href: "/performance-vendas",
    },
    metaPeriodo: {
      label: "Meta do período",
      value: `${percentualMeta}%`,
      sub: `${receita.label} de ${formatarMoeda(meta)}`,
      formula: "Receita do período ÷ meta definida pelo usuário",
      href: "/performance-vendas",
    },
    tarefasPendentes: {
      label: "Tarefas pendentes",
      value: String(tarefasPendentes.length),
      formula: 'Contagem de tarefas em qualquer coluna que não seja "Concluídas"',
      href: "/tarefas",
    },
    tarefasAtrasadas: {
      label: "Tarefas atrasadas",
      value: String(tarefasAtrasadas.length),
      formula: 'Contagem de tarefas na coluna "Atrasadas"',
      href: "/tarefas",
    },
    vendasQtd: {
      label: "Vendas no período",
      value: String(vendasQtd),
      formula: "Contagem de negociações vendidas no período",
      href: "/performance-vendas",
    },
    ticketMedio: {
      label: "Ticket médio",
      value: ticketMedio.label,
      formula: ticketMedio.formula,
      href: "/relatorios",
    },
    valorPerdido: {
      label: "Valor perdido",
      value: valorPerdido.label,
      formula: valorPerdido.formula,
      href: "/motivos-perda",
    },
  };

  const ordemVisivel = useMemo(
    () => config.ordem.filter((c) => !config.ocultos.includes(c) && CARDS[c]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, receita.valor, tempoResposta.valor, negociacoesAbertas.length],
  );

  const filtrosMais: FiltroDef[] = [
    {
      chave: "equipe",
      label: "Equipe / responsável",
      valor: responsavelFiltro,
      opcoes: [
        { valor: "Todos", label: "Toda a equipe" },
        ...equipe.map((m) => ({ valor: m.nome, label: m.nome })),
      ],
    },
  ];

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title-row">
            <h2>Início</h2>
          </div>
          <p className="sub">{today}</p>
        </div>
        <div className="top-actions">
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setPersonalizarAberto((v) => !v)}
            >
              Personalizar
            </button>
            {personalizarAberto ? (
              <div
                className="dropdown-pop"
                style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 300, zIndex: 60 }}
              >
                <div style={{ padding: "10px 12px 4px" }}>
                  <p className="hint">Escolha e reordene os cartões visíveis</p>
                </div>
                {config.ordem
                  .filter((c) => CARDS[c])
                  .sort((a, b) => {
                    const av = !config.ocultos.includes(a);
                    const bv = !config.ocultos.includes(b);
                    if (av === bv) return 0;
                    return av ? -1 : 1;
                  })
                  .map((chave) => {
                    const visivel = !config.ocultos.includes(chave);
                    const i = ordemVisivel.indexOf(chave);
                    return (
                      <div className="kpi-personalizar-item" key={chave}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={visivel}
                            onChange={() => alternarCard(chave)}
                          />
                          <span className="n">{CARDS[chave].label}</span>
                        </label>
                        {visivel ? (
                          <div className="kpi-personalizar-ordem">
                            <button
                              type="button"
                              disabled={i <= 0}
                              onClick={() => moverCard(chave, -1)}
                              aria-label="Mover pra cima"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={i < 0 || i >= ordemVisivel.length - 1}
                              onClick={() => moverCard(chave, 1)}
                              aria-label="Mover pra baixo"
                            >
                              ↓
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                <div className="field">
                  <label>Meta do período (R$)</label>
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    type="number"
                    value={metaInput}
                    onChange={(e) => setMetaInput(e.target.value)}
                    onBlur={() => salvarConfig({ ...config, meta: Number(metaInput) || 0 })}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="content">
        <FilterBar
          periodo={periodo}
          onPeriodoChange={setPeriodo}
          principalLabel="Funil"
          principalValor={funilFiltro}
          principalOpcoes={["Todos", ...funis.map((f) => f.nome)]}
          onPrincipalChange={setFuncilFiltro}
          filtros={filtrosMais}
          onFiltroChange={(chave, valor) => {
            if (chave === "equipe") setResponsavelFiltro(valor);
          }}
          onLimpar={() => {
            setPeriodo(PERIODO_PADRAO);
            setFuncilFiltro("Todos");
            setResponsavelFiltro("Todos");
          }}
          viewKey="inicio"
        />

        <div className="grid kpi4">
          {ordemVisivel.map((chave) => (
            <KpiCard key={chave} {...CARDS[chave]} />
          ))}
        </div>

        {tarefasAtrasadas.length > 0 || negociacoesParadas.length > 0 ? (
          <div className="card mt14">
            <div className="panel-h">
              <h4>Alertas</h4>
              <p className="hint">Gerados a partir de tarefas e negociações reais — clique pra agir</p>
            </div>
            <div style={{ padding: 17 }}>
              {tarefasAtrasadas.map((t) => (
                <Link key={t.id} href="/tarefas" className="camp-row" style={{ textDecoration: "none" }}>
                  <div className="camp-body">
                    <p className="camp-name">⏰ Tarefa atrasada: {t.titulo}</p>
                    <p className="hint" style={{ margin: 0 }}>
                      {t.contato} · responsável: {t.responsavel.nome}
                    </p>
                  </div>
                  <span className="camp-num">Ver tarefa</span>
                </Link>
              ))}
              {negociacoesParadas.map((card) => (
                <Link key={card.id} href="/funil" className="camp-row" style={{ textDecoration: "none" }}>
                  <div className="camp-body">
                    <p className="camp-name">⚠ Negociação parada há {card.dias}: {card.nome}</p>
                    <p className="hint" style={{ margin: 0 }}>Origem: {card.origem}</p>
                  </div>
                  <span className="camp-num">Ver no funil</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid split2 mt14">
          <Link className="card card-link" href="/trafego">
            <div className="panel-h">
              <h4>Leads por dia · últimos 14 dias</h4>
              <span className="link">Ver tráfego</span>
            </div>
            <div className="bars">
              {leadsPorDia.map(({ dia, altura, hoje }) => (
                <div className="bar-col" key={dia}>
                  <div className={`bar${hoje ? " hi" : ""}`} style={{ height: `${altura}%` }} />
                  <span className="lbl">{dia}</span>
                </div>
              ))}
            </div>
          </Link>

          <Link className="card card-link" href="/funil">
            <div className="panel-h">
              <h4>Funil · período</h4>
              <span className="link">Ver funil</span>
            </div>
            <div className="funnel-mini">
              {funilJulho.map(({ etapa, total, largura }) => (
                <div className="funnel-row" key={etapa}>
                  <span className="fl">{etapa}</span>
                  <div className="funnel-track">
                    <div className="funnel-fill" style={{ width: `${largura}%` }} />
                  </div>
                  <span className="fn">{total}</span>
                </div>
              ))}
            </div>
          </Link>
        </div>

        <div className="card mt14">
          <div className="panel-h">
            <h4>Atividade recente</h4>
            <Link className="link" href="/contatos">
              Ver tudo
            </Link>
          </div>
          {atividadeRecente.map((item) => (
            <Link
              className="activity-row activity-row-link"
              href={`/conversas?contato=${encodeURIComponent(item.nome)}`}
              key={item.nome}
            >
              <div className="avatar">{item.initials}</div>
              <div className="body">
                <p className="name">{item.nome}</p>
                <p className="meta">{item.meta}</p>
              </div>
              <span className={`pill${item.destaque ? " on" : ""}`}>{item.pill}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
