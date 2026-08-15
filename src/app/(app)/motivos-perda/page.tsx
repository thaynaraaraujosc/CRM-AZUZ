"use client";

import { useState } from "react";
import Link from "next/link";

import { useEquipe } from "@/lib/equipe-context";
import { useFunis } from "@/lib/funis-context";
import { FilterBar, KpiCard, PERIODO_PADRAO, type FiltroDef, type PeriodoValor } from "@/components/ui";
import { BarList, ChartCard, LineChart } from "@/components/charts";
import {
  calcularDistribuicaoMotivosPerda,
  calcularMotivoPrincipalPerda,
  calcularSerieDiaria,
  calcularValorPerdido,
  todosOsCards,
} from "@/lib/metrics";
import { slugId } from "@/lib/ids";
import type { NegocioCard } from "@/lib/data";

const CORES_MOTIVO: Record<string, string> = {
  "Achou caro": "#d64545",
  "Fechou com concorrente": "#e0a83c",
  "Sem retorno": "#8a3ffc",
  "Não era o momento": "#2e6bff",
};

type PerdaComEtapa = NegocioCard & { etapa: string; funil: string };

/**
 * Única página com a análise completa de motivos de perda — Performance mostra só um resumo com
 * link pra cá. Tudo derivado de `NegocioCard.statusFechamento === "perdido"` real (marcado no
 * Funil) — sem dado fictício, workspace sem nenhuma perda registrada mostra vazio.
 */
export default function MotivosPerdaPage() {
  const { funis } = useFunis();
  const { membros: equipe } = useEquipe();
  const [periodo, setPeriodo] = useState<PeriodoValor>(PERIODO_PADRAO);
  const [responsavelFiltro, setResponsavelFiltro] = useState("Todos");
  const [etapaFiltro, setEtapaFiltro] = useState("Todos");
  const [motivoSelecionado, setMotivoSelecionado] = useState<string | null>(null);

  const cardsComEtapa: PerdaComEtapa[] = funis.flatMap((f) =>
    f.colunas.flatMap((c) => c.cards.map((card) => ({ ...card, etapa: c.titulo, funil: f.nome }))),
  );
  const todasAsPerdas = cardsComEtapa.filter((c) => c.statusFechamento === "perdido");

  const perdasFiltradas = todasAsPerdas.filter((o) => {
    if (responsavelFiltro !== "Todos" && o.responsavel !== responsavelFiltro) return false;
    if (etapaFiltro !== "Todos" && o.etapa !== etapaFiltro) return false;
    if (motivoSelecionado && o.motivoPerda !== motivoSelecionado) return false;
    return true;
  });

  const valorPerdido = calcularValorPerdido(perdasFiltradas);
  const motivoPrincipal = calcularMotivoPrincipalPerda(todasAsPerdas);
  const distribuicaoMotivos = calcularDistribuicaoMotivosPerda(todasAsPerdas);
  const serieDiaria = calcularSerieDiaria(todosOsCards(funis));

  const etapas = Array.from(new Set(todasAsPerdas.map((o) => o.etapa)));
  const etapaMaisAfetada = etapas
    .map((e) => ({ etapa: e, total: todasAsPerdas.filter((o) => o.etapa === e).length }))
    .sort((a, b) => b.total - a.total)[0];

  function agrupar(chaveFn: (o: PerdaComEtapa) => string | undefined) {
    const chaves = Array.from(new Set(todasAsPerdas.map(chaveFn).filter((v): v is string => Boolean(v))));
    return chaves.map((chave) => ({ chave, total: todasAsPerdas.filter((o) => chaveFn(o) === chave).length }));
  }

  const porEtapa = agrupar((o) => o.etapa);
  const porResponsavel = agrupar((o) => o.responsavel);
  const porOrigem = agrupar((o) => o.origem);

  const totalPerdas = todasAsPerdas.length;

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

        {totalPerdas === 0 ? (
          <div className="card mb14">
            <div className="dados-nao-conectados" style={{ padding: 17 }}>
              Você ainda não possui dados suficientes para gerar este indicador — marque negócios
              como &quot;perdido&quot; no Funil (com motivo) pra ver a análise aqui.
            </div>
          </div>
        ) : null}

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
            sub={totalPerdas > 0 ? `${motivoPrincipal.valor.toFixed(0)}% das perdas` : undefined}
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
          {distribuicaoMotivos.length === 0 ? (
            <p className="hint" style={{ padding: 17 }}>Nenhum motivo de perda registrado ainda.</p>
          ) : (
            <BarList
              items={distribuicaoMotivos.map((m) => ({
                chave: m.motivo,
                label: m.motivo,
                meta: `${m.quantidade} ${m.quantidade === 1 ? "perda" : "perdas"} · ${m.percentual.toFixed(0)}%`,
                percentual: m.percentual,
                cor: CORES_MOTIVO[m.motivo] ?? "#d64545",
                onClick: () => setMotivoSelecionado((atual) => (atual === m.motivo ? null : m.motivo)),
              }))}
            />
          )}
        </ChartCard>

        <ChartCard title="Evolução das perdas no período">
          {serieDiaria.length === 0 ? (
            <p className="hint" style={{ padding: 17 }}>Ainda sem movimento suficiente pra traçar uma evolução.</p>
          ) : (
            <LineChart
              series={[
                {
                  chave: "perdidas",
                  cor: "#d64545",
                  label: "Negociações perdidas",
                  pontos: serieDiaria.map((p) => ({ x: p.dia, y: p.perdas })),
                },
              ]}
            />
          )}
        </ChartCard>

        <div className="grid split2">
          <ChartCard title="Motivos por etapa">
            {porEtapa.length === 0 ? (
              <p className="hint" style={{ padding: 17 }}>Sem dado ainda.</p>
            ) : (
              <BarList items={porEtapa.map((g) => ({ chave: g.chave, label: g.chave, quantidade: g.total }))} />
            )}
          </ChartCard>
          <ChartCard title="Motivos por responsável">
            {porResponsavel.length === 0 ? (
              <p className="hint" style={{ padding: 17 }}>Sem dado ainda.</p>
            ) : (
              <BarList items={porResponsavel.map((g) => ({ chave: g.chave, label: g.chave, quantidade: g.total }))} />
            )}
          </ChartCard>
        </div>

        <div className="grid split2">
          <ChartCard title="Motivos por origem">
            {porOrigem.length === 0 ? (
              <p className="hint" style={{ padding: 17 }}>Sem dado ainda.</p>
            ) : (
              <BarList items={porOrigem.map((g) => ({ chave: g.chave, label: g.chave, quantidade: g.total }))} />
            )}
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
          <div className="table-wrap">
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
              {perdasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <p className="hint" style={{ padding: 17 }}>Nenhuma negociação perdida com esse filtro.</p>
                  </td>
                </tr>
              ) : null}
              {perdasFiltradas.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/jornada-cliente?contato=${slugId(o.nome)}`} className="link">
                      {o.nome}
                    </Link>
                  </td>
                  <td>{o.responsavel ?? "—"}</td>
                  <td>{o.motivoPerda ?? "—"}</td>
                  <td>{o.etapa}</td>
                  <td>{o.origem}</td>
                  <td>{o.valor}</td>
                  <td>{o.dataFechamento ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </>
  );
}
