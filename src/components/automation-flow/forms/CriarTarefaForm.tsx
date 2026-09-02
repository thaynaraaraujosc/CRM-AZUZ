"use client";

import { useEquipe } from "@/lib/equipe-context";
import type {
  CriarTarefaData,
  ModoPrazoTarefa,
  ModoResponsavelTarefa,
  PrioridadeTarefa,
  RelacionarTarefaA,
} from "@/lib/automation-flow/types";
import { CATEGORIAS_TAREFA } from "./TarefaEventoForm";
import { useEquipesDisponiveis } from "./useEquipesDisponiveis";
import { SeletorDeData } from "@/components/seletor-de-data";

const PRIORIDADES: { valor: PrioridadeTarefa; label: string }[] = [
  { valor: "baixa", label: "Baixa" },
  { valor: "normal", label: "Normal" },
  { valor: "alta", label: "Alta" },
  { valor: "urgente", label: "Urgente" },
];

/** Ação "Criar tarefa" (item 16) — tipo, título, descrição, responsável, prazo, prioridade e a que
 * relacionar, tudo configurável direto no bloco. */
export function CriarTarefaForm({ data, onChange }: { data: CriarTarefaData; onChange: (novo: CriarTarefaData) => void }) {
  const equipes = useEquipesDisponiveis();
  const { membros: equipe } = useEquipe();

  return (
    <div className="flow-form">
      <div className="field">
        <label>Tipo de tarefa</label>
        <select className="input" value={data.categoria ?? ""} onChange={(e) => onChange({ ...data, categoria: e.target.value })}>
          {CATEGORIAS_TAREFA.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Título</label>
        <input
          className="input"
          placeholder="Ex.: Retornar contato"
          value={data.titulo}
          onChange={(e) => onChange({ ...data, titulo: e.target.value })}
        />
      </div>

      <div className="field">
        <label>Descrição</label>
        <textarea
          className="input"
          style={{ width: "100%", minHeight: 60, resize: "vertical" }}
          value={data.descricao ?? ""}
          onChange={(e) => onChange({ ...data, descricao: e.target.value })}
        />
      </div>

      <div className="field">
        <label>Responsável</label>
        <select
          className="input"
          value={data.modoResponsavel ?? "atual"}
          onChange={(e) => onChange({ ...data, modoResponsavel: e.target.value as ModoResponsavelTarefa })}
        >
          <option value="atual">Responsável atual do lead</option>
          <option value="pessoa">Selecionar pessoa</option>
          <option value="equipe">Selecionar equipe</option>
        </select>
      </div>

      {data.modoResponsavel === "pessoa" ? (
        <div className="field">
          <label>Pessoa</label>
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

      {data.modoResponsavel === "equipe" ? (
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

      <div className="field">
        <label>Prazo</label>
        <select
          className="input"
          value={data.modoPrazo ?? "depois_de"}
          onChange={(e) => onChange({ ...data, modoPrazo: e.target.value as ModoPrazoTarefa })}
        >
          <option value="imediatamente">Imediatamente</option>
          <option value="depois_de">Depois de…</option>
          <option value="data_especifica">Data e horário específicos</option>
        </select>
      </div>

      {data.modoPrazo === "depois_de" ? (
        <div className="field">
          <label>Quanto tempo depois</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="input"
              type="number"
              min={1}
              style={{ flex: 1 }}
              value={data.prazoValor ?? ""}
              onChange={(e) => onChange({ ...data, prazoValor: e.target.value ? Number(e.target.value) : undefined })}
            />
            <select
              className="input"
              style={{ flex: 1 }}
              value={data.prazoUnidade ?? "horas"}
              onChange={(e) => onChange({ ...data, prazoUnidade: e.target.value })}
            >
              <option value="minutos">Minutos</option>
              <option value="horas">Horas</option>
              <option value="dias">Dias</option>
            </select>
          </div>
        </div>
      ) : null}

      {data.modoPrazo === "data_especifica" ? (
        <div className="field">
          <label>Data e horário</label>
          <div style={{ display: "flex", gap: 6 }}>
            <SeletorDeData
              valor={data.data ?? ""}
              onChange={(iso) => onChange({ ...data, data: iso })}
              curto
              className="seletor-data-flex"
            />
            <input
              className="input"
              type="time"
              style={{ flex: 1 }}
              value={data.horario ?? ""}
              onChange={(e) => onChange({ ...data, horario: e.target.value })}
            />
          </div>
        </div>
      ) : null}

      <div className="field">
        <label>Prioridade</label>
        <select
          className="input"
          value={data.prioridade ?? "normal"}
          onChange={(e) => onChange({ ...data, prioridade: e.target.value as PrioridadeTarefa })}
        >
          {PRIORIDADES.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Relacionar ao</label>
        <select
          className="input"
          value={data.relacionarA ?? "contato"}
          onChange={(e) => onChange({ ...data, relacionarA: e.target.value as RelacionarTarefaA })}
        >
          <option value="contato">Contato</option>
          <option value="negocio">Negócio</option>
          <option value="ambos">Ambos</option>
        </select>
      </div>
    </div>
  );
}
