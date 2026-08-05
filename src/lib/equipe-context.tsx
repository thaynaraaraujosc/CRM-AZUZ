"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import type { Membro } from "@/lib/data";
import { slugId } from "@/lib/ids";

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
 * Núcleo comercial (2ª leva de migração pro banco real, ver `src/app/api/equipe/`) — mesmo padrão
 * do piloto de Contatos: contrato público do Provider não muda, só o motor por dentro troca
 * `localStorage` por `fetch` na API real, com atualização otimista local. Falha de rede só loga no
 * console, sem toast de erro (mesma limitação assumida no piloto).
 */
export function EquipeProvider({ children }: { children: ReactNode }) {
  const [membros, setMembros] = useState<Membro[]>([]);

  useEffect(() => {
    fetch("/api/equipe")
      .then((r) => r.json())
      .then((dados: Membro[]) => setMembros(dados))
      .catch((erro) => console.error("Falha ao carregar equipe da API:", erro));
  }, []);

  function atualizarRemoto(id: string, dados: Partial<Membro> & Record<string, unknown>) {
    fetch(`/api/equipe/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    }).catch((erro) => console.error("Falha ao atualizar membro na API:", erro));
  }

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
    fetch("/api/equipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    }).catch((erro) => console.error("Falha ao convidar membro na API:", erro));
    return novo;
  }

  function editarMembro(id: string, dados: Partial<Membro>) {
    setMembros((prev) => prev.map((m) => (m.id === id ? { ...m, ...dados } : m)));
    atualizarRemoto(id, dados);
  }

  function alternarAtivo(id: string) {
    let ativoFinal = false;
    setMembros((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        ativoFinal = !m.ativo;
        return { ...m, ativo: ativoFinal };
      }),
    );
    atualizarRemoto(id, { ativo: ativoFinal });
  }

  function removerMembro(id: string) {
    setMembros((prev) => prev.filter((m) => m.id !== id));
    fetch(`/api/equipe/${id}`, { method: "DELETE" }).catch((erro) =>
      console.error("Falha ao remover membro na API:", erro),
    );
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
