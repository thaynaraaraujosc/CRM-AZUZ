"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { equipe as equipeInicial, type Membro } from "@/lib/data";
import { slugId } from "@/lib/ids";

export const EQUIPE_STORAGE_KEY = "azuz-crm-equipe";

type NovoMembro = {
  nome: string;
  email: string;
  papel: string;
  papelTipo: Membro["papelTipo"];
  papelNota?: string;
  enxerga: string;
  permissoes: string[];
};

function iniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

type EquipeContextValue = {
  membros: Membro[];
  /** Cria o convite: entra na lista já como `convitePendente`, sem senha e inativo até aceitar. */
  convidarMembro: (dados: NovoMembro) => Membro;
  editarMembro: (id: string, dados: Partial<Membro>) => void;
  alternarAtivo: (id: string) => void;
  removerMembro: (id: string) => void;
};

const EquipeContext = createContext<EquipeContextValue | null>(null);

/**
 * Equipe/usuários vivem num contexto no topo do app pelo mesmo motivo de Funis e Contatos: convidar
 * ou editar alguém em /equipe precisa aparecer nos seletores de responsável em Tarefas, Agenda e nos
 * formulários de automação, sem cada tela ficar com uma cópia estática e dessincronizada de `equipe`.
 */
export function EquipeProvider({ children }: { children: ReactNode }) {
  const [membros, setMembros] = useState<Membro[]>(() => {
    if (typeof window === "undefined") return [...equipeInicial];
    try {
      const salvos = window.localStorage.getItem(EQUIPE_STORAGE_KEY);
      if (!salvos) return [...equipeInicial];
      return JSON.parse(salvos) as Membro[];
    } catch {
      return [...equipeInicial];
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(EQUIPE_STORAGE_KEY, JSON.stringify(membros));
    } catch {
      // localStorage indisponível (modo privado, por exemplo) — segue só em memória.
    }
  }, [membros]);

  function convidarMembro(dados: NovoMembro): Membro {
    const idNovo = slugId(dados.nome);
    const existente = membros.find((m) => m.id === idNovo);
    if (existente) return existente;
    const novo: Membro = {
      id: idNovo,
      initials: iniciais(dados.nome),
      nome: dados.nome,
      email: dados.email,
      senha: null,
      papel: dados.papel,
      papelTipo: dados.papelTipo,
      papelNota: dados.papelNota,
      leads: "—",
      enxerga: dados.enxerga,
      permissoes: dados.permissoes,
      ativo: false,
      convitePendente: true,
    };
    setMembros((prev) => [...prev, novo]);
    return novo;
  }

  function editarMembro(id: string, dados: Partial<Membro>) {
    setMembros((prev) => prev.map((m) => (m.id === id ? { ...m, ...dados } : m)));
  }

  function alternarAtivo(id: string) {
    setMembros((prev) => prev.map((m) => (m.id === id ? { ...m, ativo: !m.ativo } : m)));
  }

  function removerMembro(id: string) {
    setMembros((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <EquipeContext.Provider value={{ membros, convidarMembro, editarMembro, alternarAtivo, removerMembro }}>
      {children}
    </EquipeContext.Provider>
  );
}

export function useEquipe() {
  const ctx = useContext(EquipeContext);
  if (!ctx) throw new Error("useEquipe precisa estar dentro de EquipeProvider");
  return ctx;
}
