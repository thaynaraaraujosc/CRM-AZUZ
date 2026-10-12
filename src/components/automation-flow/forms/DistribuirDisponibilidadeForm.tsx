"use client";

import type { DistribuirDisponibilidadeData, ModoDistribuicao } from "@/lib/automation-flow/types";
import { useEquipesDisponiveis } from "./useEquipesDisponiveis";
import { useIdioma } from "@/lib/idioma-context";

/** Ação "Distribuir por disponibilidade": como escolher entre os atendentes da equipe. */
export function DistribuirDisponibilidadeForm({
  data,
  onChange,
}: {
  data: DistribuirDisponibilidadeData;
  onChange: (novo: DistribuirDisponibilidadeData) => void;
}) {
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

      <div className="field">
        <label>{traduzir("Como distribuir")}</label>
        <select
          className="input"
          value={data.modo ?? "round_robin"}
          onChange={(e) => onChange({ ...data, modo: e.target.value as ModoDistribuicao })}
        >
          <option value="round_robin">{traduzir("Em revezamento (round-robin)")}</option>
          <option value="menos_ocupado">{traduzir("Pro atendente com menos leads no momento")}</option>
        </select>
      </div>
    </div>
  );
}
