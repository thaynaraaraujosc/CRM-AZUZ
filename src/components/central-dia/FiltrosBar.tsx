"use client";

import { useRef, useState } from "react";

import { FloatingDropdown } from "@/components/ui";
import { FILTROS_PADRAO, useCentralDia } from "@/lib/central-dia-context";
import { useEquipe } from "@/lib/equipe-context";
import { useFunis } from "@/lib/funis-context";

const FILTROS_RAPIDOS = ["Todos", "Meus itens", "Minha equipe", "Urgentes", "Conversas", "Tarefas", "Agenda", "Leads", "Automações"];
const PERIODOS: { valor: "hoje" | "amanha" | "semana"; label: string }[] = [
  { valor: "hoje", label: "Hoje" },
  { valor: "amanha", label: "Amanhã" },
  { valor: "semana", label: "Esta semana" },
];

function contarFiltrosAtivos(filtros: typeof FILTROS_PADRAO): number {
  let n = 0;
  if (filtros.responsavel !== "Todos") n += 1;
  if (filtros.equipe !== "Todas") n += 1;
  if (filtros.funil !== "Todos") n += 1;
  if (filtros.prioridade !== "Todas") n += 1;
  if (filtros.status !== "Todos") n += 1;
  return n;
}

/** Barra de filtros da Central do Dia (item 2 do pedido) — chips rápidos + período (controlados,
 * pra dar pra "Limpar filtros" de fora) + painel "Mais filtros" com os campos adicionais. */
export function FiltrosBar() {
  const { filtros, setFiltros, limparFiltros } = useCentralDia();
  const { membros: equipe } = useEquipe();
  const { funis } = useFunis();
  const [aberto, setAberto] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const ativos = contarFiltrosAtivos(filtros);

  return (
    <div className="central-dia-filtros">
      <div className="filters-row">
        {FILTROS_RAPIDOS.map((f) => (
          <button
            type="button"
            key={f}
            className={`fchip${filtros.rapido === f ? " active" : ""}`}
            aria-pressed={filtros.rapido === f}
            onClick={() => setFiltros({ rapido: f })}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="central-dia-filtros-dir">
        <div className="seg-picker">
          {PERIODOS.map((p) => (
            <button
              type="button"
              key={p.valor}
              className={filtros.periodo === p.valor ? "on" : ""}
              onClick={() => setFiltros({ periodo: p.valor })}
            >
              {p.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn ghost"
          ref={btnRef}
          onClick={() => {
            setAnchorRect(btnRef.current?.getBoundingClientRect() ?? null);
            setAberto((v) => !v);
          }}
        >
          Filtros{ativos > 0 ? ` · ${ativos}` : ""}
        </button>
        {ativos > 0 || filtros.rapido !== "Todos" || filtros.periodo !== "hoje" ? (
          <button type="button" className="btn ghost" onClick={limparFiltros}>
            Limpar
          </button>
        ) : null}
      </div>

      {aberto ? (
        <FloatingDropdown anchorRect={anchorRect} align="right" onClose={() => setAberto(false)} width={280}>
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="field">
              <label>Responsável</label>
              <select className="input" value={filtros.responsavel} onChange={(e) => setFiltros({ responsavel: e.target.value })}>
                <option value="Todos">Todos</option>
                {equipe.map((m) => (
                  <option key={m.id} value={m.nome}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Funil</label>
              <select className="input" value={filtros.funil} onChange={(e) => setFiltros({ funil: e.target.value })}>
                <option value="Todos">Todos</option>
                {funis.map((f) => (
                  <option key={f.id} value={f.nome}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Prioridade</label>
              <select className="input" value={filtros.prioridade} onChange={(e) => setFiltros({ prioridade: e.target.value })}>
                <option value="Todas">Todas</option>
                <option value="urgente">Urgente</option>
                <option value="atencao">Precisa de atenção</option>
                <option value="oportunidade">Oportunidade</option>
              </select>
            </div>
          </div>
        </FloatingDropdown>
      ) : null}
    </div>
  );
}
