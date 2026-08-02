"use client";

import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import { contatos as contatosIniciais, type Contato } from "@/lib/data";
import { slugId } from "@/lib/ids";

type DadosContato = Omit<Contato, "initials" | "nome" | "origem" | "etapa" | "responsavel">;

type ContatosContextValue = {
  contatos: Contato[];
  setContatos: Dispatch<SetStateAction<Contato[]>>;
  /**
   * Cria o contato se ainda não existir (ex.: alguém que só existe no WhatsApp), ou atualiza os dados dele.
   * Aceita qualquer campo extra (ex.: `etiquetas`, `camposPersonalizados`) além dos campos tipados de
   * `DadosContato` — é o que o motor de automação usa via `Ligacoes.salvarContato` pra gravar mudanças
   * de etiqueta/campo que não têm uma coluna dedicada em `Contato`.
   */
  salvarDadosContato: (nome: string, dados: Partial<DadosContato> & Record<string, unknown>) => void;
  /** Atribui o atendente responsável por esse contato (cria o contato se for a primeira vez que ele aparece). */
  atribuirAtendente: (nome: string, atendente: string) => void;
  criarContato: (dados: Partial<DadosContato> & { nome: string }) => Contato;
  adicionarEtiqueta: (nome: string, etiqueta: string) => void;
  removerEtiqueta: (nome: string, etiqueta: string) => void;
  alternarFavorito: (nome: string) => void;
};

const ContatosContext = createContext<ContatosContextValue | null>(null);

function iniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

/**
 * Contatos vivem num contexto no topo do app pelo mesmo motivo dos funis:
 * dados preenchidos em /contatos ou direto nos atributos de uma conversa do
 * WhatsApp precisam aparecer nos dois lugares, sem cópias dessincronizadas.
 */
export function ContatosProvider({ children }: { children: ReactNode }) {
  const [contatos, setContatos] = useState<Contato[]>(() => [
    ...contatosIniciais,
  ]);

  function salvarDadosContato(nome: string, dados: Partial<DadosContato> & Record<string, unknown>) {
    setContatos((prev) => {
      const existe = prev.some((c) => c.nome === nome);
      if (!existe) {
        return [
          ...prev,
          {
            id: slugId(nome),
            initials: iniciais(nome),
            nome,
            origem: "Indicação",
            etapa: "Novo",
            responsavel: "—",
            ultima: "Agora",
            valor: "—",
            ...dados,
          },
        ];
      }
      return prev.map((c) => (c.nome === nome ? { ...c, ...dados } : c));
    });
  }

  function atribuirAtendente(nome: string, atendente: string) {
    setContatos((prev) => {
      const existe = prev.some((c) => c.nome === nome);
      if (!existe) {
        return [
          ...prev,
          {
            id: slugId(nome),
            initials: iniciais(nome),
            nome,
            origem: "Indicação" as const,
            etapa: "Novo" as const,
            responsavel: atendente,
            ultima: "Agora",
            valor: "—",
          },
        ];
      }
      return prev.map((c) =>
        c.nome === nome ? { ...c, responsavel: atendente } : c,
      );
    });
  }

  function criarContato(dados: Partial<DadosContato> & { nome: string }) {
    const novo: Contato = {
      id: slugId(dados.nome),
      initials: iniciais(dados.nome),
      origem: "Indicação",
      etapa: "Novo",
      responsavel: "—",
      ultima: "Agora",
      valor: "—",
      ...dados,
    };
    setContatos((prev) => [...prev, novo]);
    return novo;
  }

  function adicionarEtiqueta(nome: string, etiqueta: string) {
    setContatos((prev) =>
      prev.map((c) =>
        c.nome === nome && !(c.etiquetas ?? []).includes(etiqueta)
          ? { ...c, etiquetas: [...(c.etiquetas ?? []), etiqueta] }
          : c,
      ),
    );
  }

  function removerEtiqueta(nome: string, etiqueta: string) {
    setContatos((prev) =>
      prev.map((c) =>
        c.nome === nome
          ? { ...c, etiquetas: (c.etiquetas ?? []).filter((e) => e !== etiqueta) }
          : c,
      ),
    );
  }

  function alternarFavorito(nome: string) {
    setContatos((prev) =>
      prev.map((c) => (c.nome === nome ? { ...c, favorito: !c.favorito } : c)),
    );
  }

  return (
    <ContatosContext.Provider
      value={{
        contatos,
        setContatos,
        salvarDadosContato,
        atribuirAtendente,
        criarContato,
        adicionarEtiqueta,
        removerEtiqueta,
        alternarFavorito,
      }}
    >
      {children}
    </ContatosContext.Provider>
  );
}

export function useContatos() {
  const ctx = useContext(ContatosContext);
  if (!ctx) throw new Error("useContatos precisa estar dentro de ContatosProvider");
  return ctx;
}
