"use client";

import { useEquipe } from "@/lib/equipe-context";
import type { AgendarConsultaData } from "@/lib/automation-flow/types";
import { SeletorDeData } from "@/components/seletor-de-data";

/** Ação "Agendar consulta" — data, horário, profissional e tipo de serviço da consulta. */
export function AgendarConsultaForm({ data, onChange }: { data: AgendarConsultaData; onChange: (novo: AgendarConsultaData) => void }) {
  const { membros: equipe } = useEquipe();
  return (
    <div className="flow-form">
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

      <div className="field">
        <label>Profissional</label>
        <select className="input" value={data.profissional ?? ""} onChange={(e) => onChange({ ...data, profissional: e.target.value })}>
          <option value="">Selecione…</option>
          {equipe.map((m) => (
            <option key={m.id} value={m.nome}>
              {m.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Tipo de serviço</label>
        <input
          className="input"
          placeholder="Ex.: Consulta de retorno"
          value={data.tipoServico ?? ""}
          onChange={(e) => onChange({ ...data, tipoServico: e.target.value })}
        />
      </div>

      <div className="field">
        <label>Observação</label>
        <textarea
          className="input"
          style={{ width: "100%", minHeight: 50, resize: "vertical" }}
          value={data.observacao ?? ""}
          onChange={(e) => onChange({ ...data, observacao: e.target.value })}
        />
      </div>
    </div>
  );
}
