"use client";

import type { AtualizarValorData, ModoAtualizarValor } from "@/lib/automation-flow/types";
import { useIdioma } from "@/lib/idioma-context";

/** Ação "Atualizar valor do negócio". Definir um valor novo, ou somar/subtrair do valor atual. */
export function AtualizarValorForm({ data, onChange }: { data: AtualizarValorData; onChange: (novo: AtualizarValorData) => void }) {
  const { t: traduzir } = useIdioma();
  return (
    <div className="flow-form">
      <div className="field">
        <label>{traduzir("Como atualizar")}</label>
        <select
          className="input"
          value={data.modo ?? "definir"}
          onChange={(e) => onChange({ ...data, modo: e.target.value as ModoAtualizarValor })}
        >
          <option value="definir">{traduzir("Definir novo valor")}</option>
          <option value="somar">Somar ao valor atual</option>
          <option value="subtrair">Subtrair do valor atual</option>
        </select>
      </div>

      <div className="field">
        <label>Valor (R$)</label>
        <input
          className="input"
          type="number"
          min={0}
          step="0.01"
          placeholder="0,00"
          value={data.valor}
          onChange={(e) => onChange({ ...data, valor: e.target.value })}
        />
      </div>
    </div>
  );
}
