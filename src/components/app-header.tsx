"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { automacoes, contatos, equipe, notificacoes, tarefas } from "@/lib/data";
import { IconBell, IconSearch } from "@/components/icons";

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

/** Menu horizontal fixo no topo do CRM — busca global e notificações. */
export function AppHeader() {
  return (
    <header className="app-header">
      <GlobalSearch />
      <NotificationsBell />
    </header>
  );
}
