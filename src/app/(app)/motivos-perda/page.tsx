"use client";

import { useState } from "react";
import Link from "next/link";

import {
  contatos,
  equipe,
  motivosPerda,
  oportunidadesPerdidas,
  serieDashboardRelatorios,
} from "@/lib/data";
import { FilterBar, KpiCard, PERIODO_PADRAO, type FiltroDef, type PeriodoValor } from "@/components/ui";
import { BarList, ChartCard, LineChart } from "@/components/charts";
import { calcularMotivoPrincipalPerda, calcularValorPerdido } from "@/lib/metrics";
import { slugId } from "@/lib/ids";

const CORES_MOTIVO: Record<string, string> = {
  "Achou caro / sem orçamento": "#d64545",
  "Escolheu outra clínica": "#e0a83c",
  "Sumiu, parou de responder": "#8a3ffc",
  "Não é o momento": "#2e6bff",
};

function origemDoCliente(nome: string): string {
  return contatos.find((c) => c.nome === nome)?.origem ?? "Não identificada";
}

/**
 * Única página com a análise completa de motivos de perda — Performance
 * mostra só um resumo com link pra cá (ver seção 6/8 do escopo). Uma linha
 * combinada por motivo (barra + quantidade + percentual + valor) substitui
 * os antigos 4 botões de volume/porcentagem/lista/gráfico.
 */
export default function MotivosPerdaPage() {
  const [periodo, setPeriodo] = useState<PeriodoValor>(PERIODO_PADRAO);
  const [responsavelFiltro, setResponsavelFiltro] = useState("Todos");
  const [etapaFiltro, setEtapaFiltro] = useState("Todos");
  const [motivoSelecionado, setMotivoSelecionado] = useState<string | null>(null);

  const perdasFiltradas = oportunidadesPerdidas.filter((o) => {
    if (responsavelFiltro !== "Todos" && o.responsavel !== responsavelFiltro) return false;
    if (etapaFiltro !== "Todos" && o.etapa !== etapaFiltro) return false;
    if (motivoSelecionado && o.motivo !== motivoSelecionado) return false;
    return true;
  });

  const valorPerdido = calcularValorPerdido(
    responsavelFiltro === "Todos" && etapaFiltro === "Todos" && !motivoSelecionado
      ? oportunidadesPerdidas
      : perdasFiltradas,
  );
  const motivoPrincipal = calcularMotivoPrincipalPerda();

  const etapas = Array.from(new Set(oportunidadesPerdidas.map((o) => o.etapa)));
  const etapaMaisAfetada = etapas
    .map((e) => ({ etapa: e, total: oportunidadesPerdidas.filter((o) => o.etapa === e).length }))
    .sort((a, b) => b.total - a.total)[0];

  function agrupar(chaveFn: (o: (typeof oportunidadesPerdidas)[number]) => string) {
    const chaves = Array.from(new Set(oportunidadesPerdidas.map(chaveFn)));
    return chaves.map((chave) => {
      const doGrupo = oportunidadesPerdidas.filter((o) => chaveFn(o) === chave);
      return { chave, total: doGrupo.length };
    });
  }

  const porEtapa = agrupar((o) => o.etapa);
  const porResponsavel = agrupar((o) => o.responsavel);
  const porOrigem = agrupar((o) => origemDoCliente(o.cliente));

  const totalPerdas = oportunidadesPerdidas.length;

  const filtros: FiltroDef[] = [
    {
      chave: "responsavel",
      label: "Responsável",
      valor: responsavelFiltro,
      opcoes: [{ valor: "Todos", label: "Todos" }, ...equipe.map((m) => ({ valor: m.nome, label: m.nome }))],
    },
    {
      chave: "etapa",
      label: "Etapa",
      valor: etapaFiltro,
      opcoes: [{ valor: "Todos", label: "Todas" }, ...etapas.map((e) => ({ valor: e, label: e }))],
    },
  ];

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title-row">
            <h2>Motivos de perda</h2>
          </div>
          <p className="sub">Análise completa — a única página com o detalhamento inteiro de perdas</p>
        </div>
      </div>

      <div className="content">
        <FilterBar
          periodo={periodo}
          onPeriodoChange={setPeriodo}
          filtros={filtros}
          onFiltroChange={(chave, valor) => {
            if (chave === "responsavel") setResponsavelFiltro(valor);
            if (chave === "etapa") setEtapaFiltro(valor);
          }}
          onLimpar={() => {
            setPeriodo(PERIODO_PADRAO);
            setResponsavelFiltro("Todos");
            setEtapaFiltro("Todos");
            setMotivoSelecionado(null);
          }}
          onExportar={() => window.print()}
          viewKey="motivos-perda"
        />

        <div className="grid kpi4">
          <KpiCard
            label="Valor perdido"
            value={valorPerdido.label}
            sub={`${perdasFiltradas.length} de ${totalPerdas} negociações`}
            formula={valorPerdido.formula}
          />
          <KpiCard label="Quantidade perdida" value={String(perdasFiltradas.length)} />
          <KpiCard
            label="Principal motivo"
            value={motivoPrincipal.motivo}
            sub={`${motivoPrincipal.valor}% das perdas`}
            formula={motivoPrincipal.formula}
          />
          <KpiCard
            label="Etapa mais afetada"
            value={etapaMaisAfetada?.etapa ?? "—"}
            sub={etapaMaisAfetada ? `${etapaMaisAfetada.total} perdas` : undefined}
            href="/funil"
          />
        </div>

        <ChartCard title="Motivos de perda no período">
          <BarList
            items={motivosPerda.map((m) => ({
              chave: m.motivo,
              label: m.motivo,
              meta: `${m.quantidade} ${m.quantidade === 1 ? "perda" : "perdas"} · ${m.percentual}% · ${m.valor}`,
              percentual: m.percentual,
              cor: CORES_MOTIVO[m.motivo] ?? "#d64545",
              onClick: () => setMotivoSelecionado((atual) => (atual === m.motivo ? null : m.motivo)),
            }))}
          />
        </ChartCard>

        <ChartCard title="Evolução das perdas no período">
          <LineChart
            series={[
              {
                chave: "perdidas",
                cor: "#d64545",
                label: "Negociações perdidas",
                pontos: serieDashboardRelatorios.map((p) => ({ x: p.dia, y: p.perdidas })),
              },
            ]}
          />
        </ChartCard>

        <div className="grid split2">
          <ChartCard title="Motivos por etapa">
            <BarList
              items={porEtapa.map((g) => ({ chave: g.chave, label: g.chave, quantidade: g.total }))}
            />
          </ChartCard>
          <ChartCard title="Motivos por responsável">
            <BarList
              items={porResponsavel.map((g) => ({ chave: g.chave, label: g.chave, quantidade: g.total }))}
            />
          </ChartCard>
        </div>

        <div className="grid split2">
          <ChartCard title="Motivos por origem">
            <BarList
              items={porOrigem.map((g) => ({ chave: g.chave, label: g.chave, quantidade: g.total }))}
            />
          </ChartCard>
          <ChartCard title="Produtos ou serviços mais afetados">
            <div className="dados-nao-conectados">
              Dados não conectados — cadastre produtos/serviços nas negociações pra ver essa análise aqui.
            </div>
          </ChartCard>
        </div>

        <div className="card">
          <div className="panel-h">
            <h4>Negociações perdidas</h4>
            {motivoSelecionado ? (
              <button type="button" className="link" onClick={() => setMotivoSelecionado(null)}>
                Limpar filtro: {motivoSelecionado} ✕
              </button>
            ) : null}
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Negociação</th>
                <th>Responsável</th>
                <th>Motivo</th>
                <th>Etapa</th>
                <th>Origem</th>
                <th>Valor</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {perdasFiltradas.map((o) => (
                <tr key={o.cliente}>
                  <td>
                    <Link href={`/jornada-cliente?contato=${slugId(o.cliente)}`} className="link">
                      {o.cliente}
                    </Link>
                  </td>
                  <td>{o.responsavel}</td>
                  <td>{o.motivo}</td>
                  <td>{o.etapa}</td>
                  <td>{origemDoCliente(o.cliente)}</td>
                  <td>{o.valor}</td>
                  <td>{o.data}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
