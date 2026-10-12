"use client";

import type { AtualizarStatusData, StatusNegocio } from "@/lib/automation-flow/types";
import { useIdioma } from "@/lib/idioma-context";

const STATUS: { valor: StatusNegocio; label: string }[] = [
  { valor: "em_andamento", label: "Em andamento" },
  { valor: "ganho", label: "Ganho" },
  { valor: "perdido", label: "Perdido" },
];

/** Ação "Atualizar status": status do negócio, com motivo obrigatório quando marcado como perdido. */
export function AtualizarStatusForm({ data, onChange }: { data: AtualizarStatusData; onChange: (novo: AtualizarStatusData) => void }) {
  const { t: traduzir } = useIdioma();
  return (
    <div className="flow-form">
      <div className="field">
        <label>{traduzir("Novo status")}</label>
        <select className="input" value={data.status} onChange={(e) => onChange({ ...data, status: e.target.value })}>
          <option value="">{traduzir("Selecione…")}</option>
          {STATUS.map((s) => (
            <option key={s.valor} value={s.valor}>
              {traduzir(s.label)}
            </option>
          ))}
        </select>
      </div>

      {data.status === "perdido" ? (
        <div className="field">
          <label>{traduzir("Motivo da perda")}</label>
          <textarea
            className="input"
            style={{ width: "100%", minHeight: 60, resize: "vertical" }}
            placeholder={traduzir("Ex.: Sem retorno do lead")}
            value={data.motivoPerda ?? ""}
            onChange={(e) => onChange({ ...data, motivoPerda: e.target.value })}
          />
        </div>
      ) : null}
    </div>
  );
}
