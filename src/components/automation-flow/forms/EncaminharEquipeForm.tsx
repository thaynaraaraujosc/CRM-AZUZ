"use client";

import type { EncaminharEquipeData } from "@/lib/automation-flow/types";
import { useEquipesDisponiveis } from "./useEquipesDisponiveis";
import { useIdioma } from "@/lib/idioma-context";

/** Ação "Encaminhar pra equipe": qual equipe/fila recebe o atendimento. */
export function EncaminharEquipeForm({ data, onChange }: { data: EncaminharEquipeData; onChange: (novo: EncaminharEquipeData) => void }) {
  const { t: traduzir } = useIdioma();
  const equipes = useEquipesDisponiveis();

  return (
    <div className="flow-form">
      <div className="field">
        <label>{traduzir("Equipe")}</label>
        <select className="input" value={data.equipeNome ?? ""} onChange={(e) => onChange({ ...data, equipeNome: e.target.value })}>
          <option value="">{traduzir("Selecione uma equipe…")}</option>
          {equipes.map((nome) => (
            <option key={nome} value={nome}>
              {nome}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
