"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { automacoes, contatos, equipe, notificacoes, tarefas } from "@/lib/data";
import { IconBell, IconSearch } from "@/components/icons";

/** Topbar de cada tela: título, subtítulo, ações da tela e a busca/sino globais. */
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
      <div className="top-actions">
        {actions}
        <GlobalSearch />
        <NotificationsBell />
      </div>
    </div>
  );
}

type SearchResult = { label: string; sub: string; href: string };

function normaliza(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function useSearchIndex(): SearchResult[] {
  return useMemo(() => {
    const results: SearchResult[] = [];
    contatos.forEach((c) =>
      results.push({ label: c.nome, sub: `Contato · ${c.origem}`, href: "/contatos" }),
    );
    tarefas.forEach((coluna) =>
      coluna.cards.forEach((t) =>
        results.push({
          label: t.titulo,
          sub: `Tarefa · ${t.contato}`,
          href: "/tarefas",
        }),
      ),
    );
    automacoes.forEach((a) =>
      results.push({ label: a.titulo, sub: "Automação", href: "/automacoes" }),
    );
    equipe.forEach((m) =>
      results.push({ label: m.nome, sub: `Equipe · ${m.papel}`, href: "/equipe" }),
    );
    return results;
  }, []);
}

/** Busca global — pesquisa contatos, tarefas, automações e equipe. */
function GlobalSearch() {
  const index = useSearchIndex();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const resultados =
    query.trim().length === 0
      ? []
      : index
          .filter((r) => normaliza(r.label).includes(normaliza(query)))
          .slice(0, 6);

  return (
    <div className="dropdown-anchor">
      <label className="search">
        <IconSearch />
        <input
          placeholder="Pesquisar no CRM…"
          aria-label="Pesquisar no CRM"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </label>
      {open && query.trim() ? (
        <div className="dropdown-pop">
          {resultados.length === 0 ? (
            <p className="hint" style={{ padding: "12px 14px" }}>
              Nada encontrado pra &quot;{query}&quot;
            </p>
          ) : (
            resultados.map((r) => (
              <Link
                key={`${r.href}-${r.label}`}
                href={r.href}
                className="dropdown-item"
              >
                <span className="n">{r.label}</span>
                <span className="r">{r.sub}</span>
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Sino de notificações — central com as últimas atividades do CRM. */
function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  return (
    <div className="dropdown-anchor">
      <button
        type="button"
        className="icon-btn"
        aria-label={`Notificações${naoLidas > 0 ? ` · ${naoLidas} não lidas` : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        {naoLidas > 0 ? <span className="dot" /> : null}
        <IconBell />
      </button>
      {open ? (
        <div className="dropdown-pop dropdown-pop-right">
          <div className="panel-h">
            <h4>Notificações</h4>
          </div>
          {notificacoes.map((n) => (
            <div
              className="activity-row"
              key={n.titulo}
              style={{ opacity: n.lida ? 0.6 : 1 }}
            >
              <div className="body">
                <p className="name">{n.titulo}</p>
                <p className="meta">{n.meta}</p>
              </div>
              {!n.lida ? <span className="dot" /> : null}
            </div>
          ))}
        </div>
      ) : null}
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
