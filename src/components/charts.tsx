"use client";

import { useState, type ReactNode } from "react";

/**
 * Primitivos de gráfico reutilizados em toda a Inteligência comercial —
 * criados pra substituir os vários gráficos de pizza/lista/barra
 * redundantes que cada tela desenhava do zero. Cada gráfico aqui responde
 * a uma pergunta clara (ranking → BarList, evolução → LineChart, etapas →
 * FunnelSteps) em vez de "preencher espaço".
 */

/** Uma linha de ranking com barra + quantidade + percentual + valor, tudo junto — nunca 4 botões pra ver a mesma coisa de jeitos diferentes. */
export type BarRowItem = {
  chave: string;
  label: string;
  /** Texto já formatado: "2 perdas · 40% · R$ 4.100". Se não vier, é montado a partir de quantidade/percentual/valor. */
  meta?: string;
  quantidade?: number;
  percentual?: number;
  valorLabel?: string;
  cor?: string;
  onClick?: () => void;
};

export function BarList({
  items,
  corPadrao = "#2e6bff",
}: {
  items: BarRowItem[];
  corPadrao?: string;
}) {
  const maior = Math.max(1, ...items.map((i) => i.percentual ?? i.quantidade ?? 0));
  return (
    <div>
      {items.map((item) => {
        const largura = Math.max(
          4,
          ((item.percentual ?? item.quantidade ?? 0) / maior) * 100,
        );
        const meta =
          item.meta ??
          [
            item.quantidade !== undefined
              ? `${item.quantidade} ${item.quantidade === 1 ? "registro" : "registros"}`
              : null,
            item.percentual !== undefined ? `${item.percentual}%` : null,
            item.valorLabel,
          ]
            .filter(Boolean)
            .join(" · ");
        const Wrapper = item.onClick ? "button" : "div";
        return (
          <Wrapper
            key={item.chave}
            type={item.onClick ? "button" : undefined}
            className="camp-row"
            style={
              item.onClick
                ? { width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }
                : undefined
            }
            onClick={item.onClick}
          >
            <div className="camp-body">
              <p className="camp-name">{item.label}</p>
              <p className="hint" style={{ margin: "1px 0 4px" }}>{meta}</p>
              <div className="camp-track">
                <div
                  className="camp-fill"
                  style={{ width: `${largura}%`, background: item.cor ?? corPadrao }}
                />
              </div>
            </div>
          </Wrapper>
        );
      })}
    </div>
  );
}

export type SerieLinha = { chave: string; cor: string; label: string; pontos: { x: string; y: number }[] };

/** Gráfico de linha/área com até algumas séries e tooltip ao passar o mouse — usado pra "evolução no período" em qualquer tela. */
export function LineChart({ series, altura = 200 }: { series: SerieLinha[]; altura?: number }) {
  const largura = 800;
  const n = series[0]?.pontos.length ?? 0;
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const maior = Math.max(1, ...series.flatMap((s) => s.pontos.map((p) => p.y)));
  const passo = n > 1 ? largura / (n - 1) : largura;

  function caminho(pontos: { x: string; y: number }[], area: boolean) {
    const linha = pontos
      .map((p, i) => {
        const x = i * passo;
        const y = altura - (p.y / maior) * (altura - 20) - 6;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    if (!area) return linha;
    return `${linha} L${largura},${altura} L0,${altura} Z`;
  }

  function aoMoverMouse(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRelativo = ((e.clientX - rect.left) / rect.width) * largura;
    const indice = Math.max(0, Math.min(n - 1, Math.round(xRelativo / passo)));
    setHoverIndex(indice);
  }

  if (n === 0) return <p className="hint">Sem dados suficientes no período.</p>;

  return (
    <div style={{ position: "relative" }}>
      {series.length > 1 ? (
        <p className="hint" style={{ marginBottom: 10, display: "flex", gap: 16, flexWrap: "wrap" }}>
          {series.map((s) => (
            <span key={s.chave}>
              <span style={{ color: s.cor }}>●</span> {s.label}
            </span>
          ))}
        </p>
      ) : null}
      <svg
        viewBox={`0 0 ${largura} ${altura}`}
        style={{ width: "100%", height: altura, overflow: "visible", cursor: "crosshair" }}
        onMouseMove={aoMoverMouse}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {series.map((s) => (
          <path key={s.chave} d={caminho(s.pontos, true)} fill={s.cor} opacity={0.14} />
        ))}
        {series.map((s) => (
          <path key={`${s.chave}-linha`} d={caminho(s.pontos, false)} fill="none" stroke={s.cor} strokeWidth={2} />
        ))}
        {hoverIndex !== null ? (
          <line x1={hoverIndex * passo} x2={hoverIndex * passo} y1={0} y2={altura} stroke="var(--line)" strokeDasharray="3 3" />
        ) : null}
      </svg>
      {hoverIndex !== null ? (
        <div
          className="chart-tooltip"
          style={{ left: `${Math.min(88, Math.max(2, (hoverIndex / Math.max(1, n - 1)) * 100))}%` }}
        >
          <b>{series[0]?.pontos[hoverIndex]?.x}</b>
          {series.map((s) => (
            <div key={s.chave}>
              <span style={{ color: s.cor }}>●</span> {s.label}: {s.pontos[hoverIndex]?.y}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export type EtapaFunilVisual = {
  chave: string;
  label: string;
  quantidade: number;
  valorLabel?: string;
  href?: string;
};

/** Funil vertical com quantidade, percentual em relação à etapa anterior e perda entre etapas. */
export function FunnelSteps({ etapas, onClickEtapa }: { etapas: EtapaFunilVisual[]; onClickEtapa?: (chave: string) => void }) {
  const maior = Math.max(1, ...etapas.map((e) => e.quantidade));
  return (
    <div className="funnel-steps">
      {etapas.map((e, i) => {
        const anterior = i > 0 ? etapas[i - 1].quantidade : e.quantidade;
        const percentualAnterior = anterior > 0 ? Math.round((e.quantidade / anterior) * 100) : 100;
        const perda = i > 0 ? Math.max(0, anterior - e.quantidade) : 0;
        const largura = Math.max(8, (e.quantidade / maior) * 100);
        const Wrapper: "button" | "div" = onClickEtapa ? "button" : "div";
        return (
          <div className="funnel-step" key={e.chave}>
            <Wrapper
              type={onClickEtapa ? "button" : undefined}
              className="funnel-step-bar-wrap"
              onClick={onClickEtapa ? () => onClickEtapa(e.chave) : undefined}
              style={onClickEtapa ? { cursor: "pointer" } : undefined}
            >
              <div className="funnel-step-top">
                <span className="funnel-step-label">{e.label}</span>
                <span className="funnel-step-qtd">
                  {e.quantidade}
                  {e.valorLabel ? ` · ${e.valorLabel}` : ""}
                </span>
              </div>
              <div className="funnel-step-track">
                <div className="funnel-step-fill" style={{ width: `${largura}%` }} />
              </div>
            </Wrapper>
            {i > 0 ? (
              <p className="funnel-step-perda">
                {percentualAnterior}% da etapa anterior
                {perda > 0 ? ` · perda de ${perda}` : ""}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function ChartCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="card mb14">
      <div className="panel-h">
        <h4>{title}</h4>
        {action}
      </div>
      <div style={{ padding: 17 }}>{children}</div>
    </div>
  );
}
