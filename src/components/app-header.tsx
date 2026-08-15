"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { createPortal } from "react-dom";

import { useCentralDia } from "@/lib/central-dia-context";
import { useContatos } from "@/lib/contatos-context";
import { useEquipe } from "@/lib/equipe-context";
import { useNotificacoes } from "@/lib/notificacoes-context";
import { useTarefas } from "@/lib/tarefas-context";
import { useFloatingPosition, type AnchorRect } from "@/lib/use-floating-position";
import { IconBell, IconSearch } from "@/components/icons";
import { navEntries } from "@/components/sidebar";

type SearchResult = { label: string; sub: string; href: string };

function normaliza(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function useSearchIndex(): SearchResult[] {
  const { contatos } = useContatos();
  const { colunas: tarefas } = useTarefas();
  const { membros: equipe } = useEquipe();
  return useMemo(() => {
    const results: SearchResult[] = [];
    navEntries.forEach((n) =>
      results.push({ label: n.label, sub: "Funcionalidade", href: n.href }),
    );
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
    equipe.forEach((m) =>
      results.push({ label: m.nome, sub: `Equipe · ${m.papel}`, href: "/equipe" }),
    );
    return results;
  }, [contatos, tarefas, equipe]);
}

function GlobalSearch() {
  const index = useSearchIndex();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null);
  const { ref: popRef, posicao } = useFloatingPosition(anchorRect, open && !!query.trim(), 8, () => setOpen(false));

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
          onFocus={(e) => {
            setAnchorRect(e.currentTarget.getBoundingClientRect());
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </label>
      {open && query.trim() && posicao && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popRef}
              className="dropdown-pop"
              style={{ position: "fixed", top: posicao.top, left: posicao.left, zIndex: 200 }}
            >
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
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function CriarMenu() {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null);
  const { ref: popRef, posicao } = useFloatingPosition(anchorRect, open, 8, () => setOpen(false));

  return (
    <div className="dropdown-anchor">
      <button
        type="button"
        className="btn primary"
        onClick={(e) => {
          if (open) {
            setOpen(false);
          } else {
            setAnchorRect(e.currentTarget.getBoundingClientRect());
            setOpen(true);
          }
        }}
      >
        + Criar
      </button>
      {open && posicao && typeof document !== "undefined"
        ? createPortal(
            <>
              <div
                onClick={() => setOpen(false)}
                style={{ position: "fixed", inset: 0, zIndex: 190 }}
              />
              <div
                ref={popRef}
                className="dropdown-pop"
                style={{ position: "fixed", top: posicao.top, left: posicao.left, zIndex: 200 }}
              >
            <Link
              href="/funil?criarNegocio=1"
              className="dropdown-item"
              onClick={() => setOpen(false)}
            >
              <span className="n">Criar negociação</span>
              <span className="r">Entra na 1ª etapa do funil ativo</span>
            </Link>
            <Link
              href="/configuracoes#workspace"
              className="dropdown-item"
              onClick={() => setOpen(false)}
            >
              <span className="n">Criar empresa</span>
              <span className="r">Cadastra o workspace/clínica</span>
            </Link>
            <Link
              href="/contatos?novoContato=1"
              className="dropdown-item"
              onClick={() => setOpen(false)}
            >
              <span className="n">Criar contato</span>
              <span className="r">Abre o formulário em Contatos</span>
            </Link>
            <Link
              href="/tarefas?nova=1"
              className="dropdown-item"
              onClick={() => setOpen(false)}
            >
              <span className="n">Criar tarefa</span>
              <span className="r">Abre o formulário em Tarefas</span>
            </Link>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null);
  const { ref: popRef, posicao } = useFloatingPosition(anchorRect, open, 8, () => setOpen(false));
  const { itens, naoLidas, marcarTodasLidas } = useNotificacoes();

  return (
    <div className="dropdown-anchor">
      <button
        type="button"
        className="icon-btn"
        aria-label={`Notificações${naoLidas > 0 ? ` · ${naoLidas} não lidas` : ""}`}
        onClick={(e) => {
          const abrindo = !open;
          if (abrindo) setAnchorRect(e.currentTarget.getBoundingClientRect());
          setOpen(abrindo);
          if (abrindo) marcarTodasLidas();
        }}
      >
        {naoLidas > 0 ? <span className="dot" /> : null}
        <IconBell />
      </button>
      {open && posicao && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popRef}
              className="dropdown-pop"
              style={{ position: "fixed", top: posicao.top, left: posicao.left, zIndex: 200 }}
            >
              <div className="panel-h">
                <h4>Notificações</h4>
              </div>
          {itens.map((n, i) => (
            <div
              className="activity-row"
              key={`${n.titulo}-${i}`}
              style={{ opacity: n.lida ? 0.6 : 1 }}
            >
              <div className="body">
                <p className="name">{n.titulo}</p>
                <p className="meta">{n.meta}</p>
              </div>
              {!n.lida ? <span className="dot" /> : null}
            </div>
          ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/** Menu horizontal fixo no topo do CRM — busca global e notificações. */
export function AppHeader() {
  const { toasts } = useNotificacoes();
  const { toasts: toastsCentralDia } = useCentralDia();

  return (
    <header className="app-header">
      <GlobalSearch />
      <div className="app-header-right">
        <CriarMenu />
        <NotificationsBell />
      </div>

      {toasts.length > 0 || toastsCentralDia.length > 0 ? (
        <div className="toast-stack toast-stack-top">
          {toasts.map((toast) => (
            <div className="toast" key={toast.id}>
              <IconBell width={14} height={14} />
              {toast.texto}
            </div>
          ))}
          {toastsCentralDia.map((toast) => (
            <div className="toast" key={`cd-${toast.id}`}>
              {toast.texto}
            </div>
          ))}
        </div>
      ) : null}
    </header>
  );
}
