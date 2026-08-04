"use client";

import type { DistribuirDisponibilidadeData, ModoDistribuicao } from "@/lib/automation-flow/types";
import { useEquipesDisponiveis } from "./useEquipesDisponiveis";

/** Ação "Distribuir por disponibilidade" — como escolher entre os atendentes da equipe. */
export function DistribuirDisponibilidadeForm({
  data,
  onChange,
}: {
  data: DistribuirDisponibilidadeData;
  onChange: (novo: DistribuirDisponibilidadeData) => void;
}) {
  const equipes = useEquipesDisponiveis();

  return (
    <div className="flow-form">
      <div className="field">
        <label>Equipe</label>
        <select className="input" value={data.equipeNome ?? ""} onChange={(e) => onChange({ ...data, equipeNome: e.target.value })}>
          <option value="">Selecione uma equipe…</option>
          {equipes.map((nome) => (
            <option key={nome} value={nome}>
              {nome}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Como distribuir</label>
        <select
          className="input"
          value={data.modo ?? "round_robin"}
          onChange={(e) => onChange({ ...data, modo: e.target.value as ModoDistribuicao })}
        >
          <option value="round_robin">Em revezamento (round-robin)</option>
          <option value="menos_ocupado">Pro atendente com menos leads no momento</option>
        </select>
      </div>
    </div>
  );
}
