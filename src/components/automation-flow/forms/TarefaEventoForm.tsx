"use client";

import { useEquipe } from "@/lib/equipe-context";
import { useFunis } from "@/lib/funis-context";
import type { FiltroTarefaModo, TarefaEventoData } from "@/lib/automation-flow/types";
import { useEquipesDisponiveis } from "./useEquipesDisponiveis";

export const CATEGORIAS_TAREFA = ["Follow-up", "Ligação", "Reunião", "Consulta", "Retorno", "Visita", "Outro"];

const MODOS: { valor: FiltroTarefaModo; label: string }[] = [
  { valor: "qualquer", label: "Qualquer tarefa" },
  { valor: "categoria", label: "Tarefa de determinada categoria" },
  { valor: "titulo", label: "Tarefa com determinado título" },
  { valor: "responsavel", label: "Tarefa criada para determinado responsável" },
  { valor: "equipe", label: "Tarefa criada para determinada equipe" },
  { valor: "funil", label: "Tarefa relacionada a determinado funil" },
];

/** Gatilhos "Tarefa criada"/"Tarefa concluída" (item 10/11) — nunca pede pro usuário criar uma
 * tarefa; pergunta qual tipo de tarefa (já existente em outro lugar do fluxo) deve iniciar essa
 * automação. */
export function TarefaEventoForm({ data, onChange }: { data: TarefaEventoData; onChange: (novo: TarefaEventoData) => void }) {
  const { funis } = useFunis();
  const { membros: equipe } = useEquipe();
  const equipes = useEquipesDisponiveis();

  return (
    <div className="flow-form">
      <div className="field">
        <label>Qual tarefa?</label>
        <select
          className="input"
          value={data.filtroModo}
          onChange={(e) => onChange({ ...data, filtroModo: e.target.value as FiltroTarefaModo })}
        >
          {MODOS.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {data.filtroModo === "categoria" ? (
        <div className="field">
          <label>Categoria</label>
          <select className="input" value={data.categoria ?? ""} onChange={(e) => onChange({ ...data, categoria: e.target.value })}>
            <option value="">Selecione…</option>
            {CATEGORIAS_TAREFA.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {data.filtroModo === "titulo" ? (
        <div className="field">
          <label>Título contém</label>
          <input
            className="input"
            placeholder="Ex.: Retornar proposta"
            value={data.tituloContem ?? ""}
            onChange={(e) => onChange({ ...data, tituloContem: e.target.value })}
          />
        </div>
      ) : null}

      {data.filtroModo === "responsavel" ? (
        <div className="field">
          <label>Responsável</label>
          <select className="input" value={data.responsavel ?? ""} onChange={(e) => onChange({ ...data, responsavel: e.target.value })}>
            <option value="">Selecione…</option>
            {equipe.map((m) => (
              <option key={m.id} value={m.nome}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {data.filtroModo === "equipe" ? (
        <div className="field">
          <label>Equipe</label>
          <select className="input" value={data.equipe ?? ""} onChange={(e) => onChange({ ...data, equipe: e.target.value })}>
            <option value="">Selecione…</option>
            {equipes.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {data.filtroModo === "funil" ? (
        <div className="field">
          <label>Funil</label>
          <select className="input" value={data.funilId ?? ""} onChange={(e) => onChange({ ...data, funilId: e.target.value })}>
            <option value="">Selecione…</option>
            {funis.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}
