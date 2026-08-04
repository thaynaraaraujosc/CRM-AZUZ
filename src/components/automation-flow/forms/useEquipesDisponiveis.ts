"use client";

import { useConfiguracoes } from "@/lib/configuracoes-context";

export const EQUIPES_PADRAO = ["Comercial", "Atendimento", "Financeiro", "Marketing", "Gestão"];

/** Equipes padrão do CRM + equipes personalizadas criadas em Configurações, sem duplicatas. */
export function useEquipesDisponiveis(): string[] {
  const { estado } = useConfiguracoes();
  return Array.from(new Set([...EQUIPES_PADRAO, ...estado.equipesPersonalizadas.map((e) => e.nome)]));
}
