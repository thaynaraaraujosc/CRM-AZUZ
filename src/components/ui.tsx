"use client";

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

/**
 * Popover flutuante montado via portal em document.body, posicionado com
 * `position: fixed` a partir do retângulo do botão que o abriu — assim ele
 * nunca fica cortado pelo `overflow: auto` de `.content`, e vira de baixo
 * pra cima sozinho quando não cabe espaço abaixo do botão.
 */
export function FloatingDropdown({
  anchorRect,
  align = "left",
  onClose,
  width = 280,
  maxHeight = 360,
  className = "",
  style,
  children,
}: {
  anchorRect: DOMRect | null;
  align?: "left" | "right";
  onClose: () => void;
  width?: number;
  maxHeight?: number;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  if (!anchorRect || typeof document === "undefined") return null;

  const margem = 16;
  const alturaMax = Math.min(maxHeight, window.innerHeight - margem * 2);
  const espacoAbaixo = window.innerHeight - anchorRect.bottom;
  const abrirPraCima =
    espacoAbaixo < alturaMax + margem && anchorRect.top > alturaMax + margem;

  // Largura real nunca maior que a viewport, e a posição horizontal é sempre
  // grampeada (clamp) dentro da tela — o alinhamento (left/right) só decide
  // de que lado o dropdown nasce, não permite que ele saia da viewport.
  const larguraReal = Math.min(width, window.innerWidth - margem * 2);
  const maxLeft = Math.max(margem, window.innerWidth - larguraReal - margem);
  const leftDesejado =
    align === "left" ? anchorRect.left : anchorRect.right - larguraReal;
  const left = Math.min(Math.max(leftDesejado, margem), maxLeft);

  const posicao: React.CSSProperties = {
    position: "fixed",
    width: larguraReal,
    maxHeight: alturaMax,
    top: abrirPraCima ? "auto" : anchorRect.bottom + 8,
    bottom: abrirPraCima ? window.innerHeight - anchorRect.top + 8 : "auto",
    left,
  };

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 190 }}
      />
      <div
        className={`dropdown-pop dropdown-pop-floating ${className}`}
        style={{ ...posicao, ...style }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

export type PeriodoValor =
  | { tipo: "predefinido"; label: string }
  | { tipo: "personalizado"; de: string; ate: string };

export const PERIODO_PADRAO: PeriodoValor = {
  tipo: "predefinido",
  label: "Qualquer período",
};

const PERIODOS_RAPIDOS = [
  "Qualquer período",
  "Últimos 7 dias",
  "Últimos 15 dias",
  "Este mês",
  "Mês passado",
];

export function periodoLabel(v: PeriodoValor): string {
  if (v.tipo === "predefinido") return v.label;
  if (!v.de || !v.ate) return "Personalizado";
  return `${v.de} até ${v.ate}`;
}

/** Botão de período com atalhos (semana, 15 dias, mês) + calendário pra escolher um intervalo personalizado. */
export function PeriodoPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: PeriodoValor;
  onChange: (v: PeriodoValor) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [de, setDe] = useState(value.tipo === "personalizado" ? value.de : "");
  const [ate, setAte] = useState(value.tipo === "personalizado" ? value.ate : "");
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        type="button"
        className="fsel"
        ref={btnRef}
        onClick={(e) => {
          setRect(e.currentTarget.getBoundingClientRect());
          setAberto((v) => !v);
        }}
      >
        {label}: {periodoLabel(value)} ▾
      </button>
      <FloatingDropdown
        anchorRect={aberto ? rect : null}
        onClose={() => setAberto(false)}
        width={260}
      >
        {PERIODOS_RAPIDOS.map((p) => (
          <button
            type="button"
            key={p}
            className="dropdown-item"
            style={{ width: "100%", textAlign: "left" }}
            onClick={() => {
              onChange({ tipo: "predefinido", label: p });
              setAberto(false);
            }}
          >
            <span className="n">{p}</span>
          </button>
        ))}
        <div style={{ padding: "8px 12px 12px", borderTop: "1px solid var(--line)" }}>
          <p className="hint" style={{ margin: "6px 0" }}>Ou personalize no calendário:</p>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="date"
              className="input"
              style={{ width: "100%" }}
              value={de}
              onChange={(e) => setDe(e.target.value)}
              aria-label="De"
            />
            <input
              type="date"
              className="input"
              style={{ width: "100%" }}
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              aria-label="Até"
            />
          </div>
          <button
            type="button"
            className="btn primary block mt14"
            disabled={!de || !ate}
            onClick={() => {
              onChange({ tipo: "personalizado", de, ate });
              setAberto(false);
            }}
          >
            Aplicar período
          </button>
        </div>
      </FloatingDropdown>
    </>
  );
}

/** Topbar de cada tela: título, subtítulo e ações da tela. */
export function Topbar({
  title,
  titleActions,
  sub,
  actions,
}: {
  title: string;
  /** Botões/abas que ficam colados ao lado do título, não lá na ponta direita. */
  titleActions?: ReactNode;
  sub?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="topbar">
      <div>
        <div className="topbar-title-row">
          <h2>{title}</h2>
          {titleActions}
        </div>
        {sub ? <p className="sub">{sub}</p> : null}
      </div>
      {actions ? <div className="top-actions">{actions}</div> : null}
    </div>
  );
}

/** Toggle que realmente liga e desliga (estado local — protótipo sem backend). */
export function Toggle({
  defaultOn = false,
  label,
  onToggle,
}: {
  defaultOn?: boolean;
  label: string;
  onToggle?: (on: boolean) => void;
}) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`toggle${on ? " on" : ""}`}
      onClick={() => {
        setOn((v) => !v);
        onToggle?.(!on);
      }}
    >
      <span className="knob" />
    </button>
  );
}

/** Grupo de chips de filtro com seleção única. */
export function ChipFilters({
  options,
  initial = 0,
  onChange,
}: {
  options: string[];
  initial?: number;
  onChange?: (option: string, index: number) => void;
}) {
  const [selected, setSelected] = useState(initial);
  return (
    <div className="filters-row">
      {options.map((option, i) => (
        <button
          type="button"
          key={option}
          className={`fchip${i === selected ? " active" : ""}`}
          aria-pressed={i === selected}
          onClick={() => {
            setSelected(i);
            onChange?.(option, i);
          }}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

/** Chips de segmento com seleção múltipla (tela de Ações). */
export function SegmentChips({
  options,
  onChange,
}: {
  options: { label: string; ativo: boolean }[];
  onChange?: (selected: string[]) => void;
}) {
  const [selected, setSelected] = useState(
    () => new Set(options.filter((o) => o.ativo).map((o) => o.label)),
  );

  function toggle(label: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      onChange?.([...next]);
      return next;
    });
  }

  return (
    <div className="seg-picker">
      {options.map(({ label }) => (
        <button
          type="button"
          key={label}
          className={`seg-chip${selected.has(label) ? " on" : ""}`}
          aria-pressed={selected.has(label)}
          onClick={() => toggle(label)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Lista de rádios (atribuir atendente, escolher papel). */
export function RadioList({
  options,
  initial,
  bare = false,
  onChange,
}: {
  options: { nome: string; descricao?: string; boxed?: boolean }[];
  initial?: string;
  bare?: boolean;
  onChange?: (nome: string) => void;
}) {
  const [selected, setSelected] = useState(initial ?? options[0]?.nome);
  return (
    <>
      {options.map((option) => {
        const classes = [
          "vendor-row",
          bare && !option.boxed ? "bare" : "",
          option.boxed ? "boxed" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            type="button"
            key={option.nome}
            className={classes}
            aria-pressed={selected === option.nome}
            onClick={() => {
              setSelected(option.nome);
              onChange?.(option.nome);
            }}
          >
            <span className={`radio${selected === option.nome ? " sel" : ""}`} />
            <span className="body">
              <span className="n" style={{ display: "block" }}>
                {option.nome}
              </span>
              {option.descricao ? (
                <span className="r" style={{ display: "block" }}>
                  {option.descricao}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </>
  );
}

/** Seletor de mídia da tela de Ações. */
export function MediaPicker({
  options,
  initial = 0,
  onChange,
}: {
  options: { label: string; icon: ReactNode }[];
  initial?: number;
  onChange?: (label: string, index: number) => void;
}) {
  const [selected, setSelected] = useState(initial);
  return (
    <div className="media-picker">
      {options.map(({ label, icon }, i) => (
        <button
          type="button"
          key={label}
          className={`media-opt${i === selected ? " on" : ""}`}
          aria-pressed={i === selected}
          onClick={() => {
            setSelected(i);
            onChange?.(label, i);
          }}
        >
          {icon}
          <span className="l" style={{ display: "block" }}>
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * Cartão de indicador padronizado — usado em toda a área de Inteligência
 * comercial (Visão geral, Performance, Atividades, CRM Live) pra garantir
 * que todo indicador olhe/funcione igual: mostra a fórmula no hover (seção
 * 15 do escopo) e, quando tem `href`, é clicável e abre os registros reais
 * que formaram o número (seção 14).
 */
export function KpiCard({
  label,
  value,
  sub,
  delta,
  formula,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: string;
  /** Fórmula exibida no tooltip nativo (title) ao passar o mouse. */
  formula?: string;
  href?: string;
}) {
  const conteudo = (
    <>
      <p className="l">{label}</p>
      <p className="n">{value}</p>
      {sub ? <p className="hint">{sub}</p> : null}
      {delta ? <p className="delta">{delta}</p> : null}
    </>
  );

  const title = formula ? `Fórmula: ${formula}` : undefined;

  if (href) {
    return (
      <Link
        href={href}
        className="card kpi kpi-clickable"
        title={title}
        style={{ display: "block", textDecoration: "none", cursor: "pointer" }}
      >
        {conteudo}
      </Link>
    );
  }

  return (
    <div className="card kpi" title={title}>
      {conteudo}
    </div>
  );
}

export type FiltroOpcao = { valor: string; label: string };

/** Um filtro secundário dentro do painel "Mais filtros". "Todos" é sempre o valor neutro/inativo. */
export type FiltroDef = {
  chave: string;
  label: string;
  opcoes: FiltroOpcao[];
  valor: string;
};

export type VisaoSalva = { nome: string; padrao?: boolean };

/**
 * Barra de filtros única e compacta, reutilizada em todas as páginas da
 * Inteligência comercial (Tráfego, Atividades, Performance, Motivos de
 * perda...) — período + filtro principal na linha visível, o resto dentro
 * de "Mais filtros", chips do que está ativo, e limpar/exportar. Sem várias
 * linhas de seletores soltos.
 */
export function FilterBar({
  periodo,
  onPeriodoChange,
  principalLabel,
  principalValor,
  principalOpcoes,
  onPrincipalChange,
  filtros = [],
  onFiltroChange,
  compararAnterior,
  onCompararChange,
  onLimpar,
  onExportar,
  viewKey,
}: {
  periodo: PeriodoValor;
  onPeriodoChange: (v: PeriodoValor) => void;
  principalLabel?: string;
  principalValor?: string;
  principalOpcoes?: string[];
  onPrincipalChange?: (v: string) => void;
  filtros?: FiltroDef[];
  onFiltroChange?: (chave: string, valor: string) => void;
  compararAnterior?: boolean;
  onCompararChange?: (v: boolean) => void;
  onLimpar?: () => void;
  onExportar?: () => void;
  /** Chave usada só pra rotular a visão salva (front-end, sem persistência real ainda). */
  viewKey?: string;
}) {
  const [principalAberto, setPrincipalAberto] = useState(false);
  const [principalRect, setPrincipalRect] = useState<DOMRect | null>(null);

  const [maisAberto, setMaisAberto] = useState(false);
  const [maisRect, setMaisRect] = useState<DOMRect | null>(null);

  const [visoesSalvas, setVisoesSalvas] = useState<VisaoSalva[]>([]);
  const [nomeVisao, setNomeVisao] = useState("");
  const [visaoSalvaAgora, setVisaoSalvaAgora] = useState(false);

  const filtrosAtivos = filtros.filter((f) => f.valor !== "Todos");
  const periodoAtivo = periodo.tipo === "personalizado" || periodo.label !== "Qualquer período";

  function limparTudo() {
    onLimpar?.();
    setMaisAberto(false);
  }

  function salvarVisaoAtual(padrao: boolean) {
    const nome = nomeVisao.trim() || `Visão de ${viewKey ?? "filtros"}`;
    setVisoesSalvas((prev) => [
      ...prev.filter((v) => v.nome !== nome),
      { nome, padrao },
    ]);
    setNomeVisao("");
    setVisaoSalvaAgora(true);
    setTimeout(() => setVisaoSalvaAgora(false), 1800);
  }

  return (
    <div>
      <div className="filterbar">
        <PeriodoPicker label="Período" value={periodo} onChange={onPeriodoChange} />

        {principalOpcoes && principalOpcoes.length > 0 ? (
          <>
            <button
              type="button"
              className="fsel"
              ref={undefined}
              onClick={(e) => {
                setPrincipalRect(e.currentTarget.getBoundingClientRect());
                setPrincipalAberto((v) => !v);
              }}
            >
              {principalLabel ?? "Filtrar"}: {principalValor} ▾
            </button>
            <FloatingDropdown
              anchorRect={principalAberto ? principalRect : null}
              onClose={() => setPrincipalAberto(false)}
              width={220}
            >
              {principalOpcoes.map((op) => (
                <button
                  type="button"
                  key={op}
                  className="dropdown-item"
                  style={{ width: "100%", textAlign: "left" }}
                  onClick={() => {
                    onPrincipalChange?.(op);
                    setPrincipalAberto(false);
                  }}
                >
                  <span className="n">{op}</span>
                </button>
              ))}
            </FloatingDropdown>
          </>
        ) : null}

        {filtros.length > 0 ? (
          <>
            <button
              type="button"
              className="fsel"
              onClick={(e) => {
                setMaisRect(e.currentTarget.getBoundingClientRect());
                setMaisAberto((v) => !v);
              }}
            >
              Mais filtros{filtrosAtivos.length > 0 ? ` · ${filtrosAtivos.length}` : ""} ▾
            </button>
            <FloatingDropdown
              anchorRect={maisAberto ? maisRect : null}
              onClose={() => setMaisAberto(false)}
              width={300}
              maxHeight={480}
            >
              <div className="filterbar-panel">
                {filtros.map((f) => (
                  <div className="filterbar-field" key={f.chave}>
                    <label>{f.label}</label>
                    <select
                      className="input"
                      value={f.valor}
                      onChange={(e) => onFiltroChange?.(f.chave, e.target.value)}
                    >
                      {f.opcoes.map((o) => (
                        <option key={o.valor} value={o.valor}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                {onCompararChange ? (
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                      color: "var(--text-muted)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!compararAnterior}
                      onChange={(e) => onCompararChange(e.target.checked)}
                    />
                    Comparar com o período anterior
                  </label>
                ) : null}
                <div className="filterbar-foot">
                  <button type="button" className="link" onClick={limparTudo}>
                    Limpar tudo
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => setMaisAberto(false)}
                  >
                    Aplicar
                  </button>
                </div>
                <div className="filterbar-salvar">
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    placeholder="Nome da visão…"
                    value={nomeVisao}
                    onChange={(e) => setNomeVisao(e.target.value)}
                  />
                  <button type="button" className="btn ghost" onClick={() => salvarVisaoAtual(false)}>
                    Salvar
                  </button>
                  <button type="button" className="btn ghost" onClick={() => salvarVisaoAtual(true)}>
                    Definir padrão
                  </button>
                </div>
                {visaoSalvaAgora ? <p className="hint">✓ Visão salva</p> : null}
                {visoesSalvas.length > 0 ? (
                  <div>
                    <p className="hint" style={{ marginBottom: 4 }}>Visões salvas</p>
                    {visoesSalvas.map((v) => (
                      <p className="hint" key={v.nome}>
                        ⭐ {v.nome}
                        {v.padrao ? " · padrão" : ""}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            </FloatingDropdown>
          </>
        ) : null}

        {onExportar ? (
          <button type="button" className="btn ghost" onClick={onExportar}>
            Exportar
          </button>
        ) : null}
      </div>

      {filtrosAtivos.length > 0 || periodoAtivo ? (
        <div className="filterbar-chips">
          {periodoAtivo ? (
            <span className="filterbar-chip">{periodoLabel(periodo)}</span>
          ) : null}
          {filtrosAtivos.map((f) => (
            <span className="filterbar-chip" key={f.chave}>
              {f.label}: {f.opcoes.find((o) => o.valor === f.valor)?.label ?? f.valor}
              <button type="button" onClick={() => onFiltroChange?.(f.chave, "Todos")}>
                ✕
              </button>
            </span>
          ))}
          {(filtrosAtivos.length > 0 || periodoAtivo) && onLimpar ? (
            <button type="button" className="link" onClick={limparTudo} style={{ fontSize: 11 }}>
              Limpar
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
