"use client";

import type { AtualizarStatusData, StatusNegocio } from "@/lib/automation-flow/types";

const STATUS: { valor: StatusNegocio; label: string }[] = [
  { valor: "em_andamento", label: "Em andamento" },
  { valor: "ganho", label: "Ganho" },
  { valor: "perdido", label: "Perdido" },
];

/** Ação "Atualizar status" — status do negócio, com motivo obrigatório quando marcado como perdido. */
export function AtualizarStatusForm({ data, onChange }: { data: AtualizarStatusData; onChange: (novo: AtualizarStatusData) => void }) {
  return (
    <div className="flow-form">
      <div className="field">
        <label>Novo status</label>
        <select className="input" value={data.status} onChange={(e) => onChange({ ...data, status: e.target.value })}>
          <option value="">Selecione…</option>
          {STATUS.map((s) => (
            <option key={s.valor} value={s.valor}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {data.status === "perdido" ? (
        <div className="field">
          <label>Motivo da perda</label>
          <textarea
            className="input"
            style={{ width: "100%", minHeight: 60, resize: "vertical" }}
            placeholder="Ex.: Sem retorno do lead"
            value={data.motivoPerda ?? ""}
            onChange={(e) => onChange({ ...data, motivoPerda: e.target.value })}
          />
        </div>
      ) : null}
    </div>
  );
}
