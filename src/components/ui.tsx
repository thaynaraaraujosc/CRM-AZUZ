"use client";

import { useState, type ReactNode } from "react";

/** Topbar de cada tela: título, subtítulo e ações à direita. */
export function Topbar({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="topbar">
      <div>
        <h2>{title}</h2>
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
}: {
  defaultOn?: boolean;
  label: string;
}) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`toggle${on ? " on" : ""}`}
      onClick={() => setOn((v) => !v)}
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
}: {
  options: { nome: string; descricao?: string; boxed?: boolean }[];
  initial?: string;
  bare?: boolean;
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
            onClick={() => setSelected(option.nome)}
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
}: {
  options: { label: string; icon: ReactNode }[];
  initial?: number;
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
          onClick={() => setSelected(i)}
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
