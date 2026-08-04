"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import { funis as funisIniciais, type Funil, type NegocioCard } from "@/lib/data";

/** Persistido pra que a resposta pública de um formulário (`/formulario-preview`, aba separada sem
 * Provider) consiga criar/mover um negócio de verdade quando o formulário está configurado pra
 * jogar a resposta num funil — mesmo padrão de `CONTATOS_STORAGE_KEY`. */
export const FUNIS_STORAGE_KEY = "azuz-crm-funis";

function cloneFunis(lista: Funil[]): Funil[] {
  return lista.map((f) => ({
    ...f,
    colunas: f.colunas.map((c) => ({ ...c, cards: [...c.cards] })),
  }));
}

type FunisContextValue = {
  funis: Funil[];
  setFunis: Dispatch<SetStateAction<Funil[]>>;
  funilAtivoId: string;
  setFunilAtivoId: (id: string) => void;
  /**
   * Move (ou cria) o card desse contato pra etapa escolhida, dentro do funil
   * escolhido — tira o card de onde ele estivesse antes, em qualquer funil,
   * pra nunca ficar duplicado.
   */
  atribuirContatoAoFunil: (
    funilId: string,
    etapaTitulo: string,
    contato: Omit<NegocioCard, "id"> & { id?: string },
  ) => void;
  /** Não deixa apagar o último funil que sobrou — sempre precisa ter pelo menos um. */
  excluirFunil: (funilId: string) => void;
};

const FunisContext = createContext<FunisContextValue | null>(null);

/**
 * Funis vivem num contexto no topo do app (não em cada página) porque uma
 * edição feita em /funil (renomear/criar/apagar etapa, criar funil novo)
 * precisa aparecer também em "Atribuir ao funil" no WhatsApp, sem as duas
 * telas ficarem com cópias dessincronizadas dos dados.
 */
export function FunisProvider({ children }: { children: ReactNode }) {
  const [funis, setFunis] = useState<Funil[]>(() => {
    if (typeof window === "undefined") return cloneFunis(funisIniciais);
    try {
      const salvos = window.localStorage.getItem(FUNIS_STORAGE_KEY);
      if (!salvos) return cloneFunis(funisIniciais);
      return JSON.parse(salvos) as Funil[];
    } catch {
      return cloneFunis(funisIniciais);
    }
  });
  const [funilAtivoId, setFunilAtivoId] = useState(funisIniciais[0]?.id ?? "");

  useEffect(() => {
    try {
      window.localStorage.setItem(FUNIS_STORAGE_KEY, JSON.stringify(funis));
    } catch {
      // localStorage indisponível — segue só em memória.
    }
  }, [funis]);

  // A resposta pública de um formulário (aba separada, sem esse Provider) grava direto no
  // localStorage quando move um contato pro funil — sem isso, a aba do CRM só veria o negócio novo
  // depois de recarregar a página.
  useEffect(() => {
    function aoMudarStorage(e: StorageEvent) {
      if (e.key !== FUNIS_STORAGE_KEY || !e.newValue) return;
      try {
        setFunis(JSON.parse(e.newValue) as Funil[]);
      } catch {
        // payload inválido — ignora.
      }
    }
    window.addEventListener("storage", aoMudarStorage);
    return () => window.removeEventListener("storage", aoMudarStorage);
  }, []);

  function atribuirContatoAoFunil(
    funilId: string,
    etapaTitulo: string,
    contato: Omit<NegocioCard, "id"> & { id?: string },
  ) {
    setFunis((prev) => {
      // tira o card desse contato de onde ele estiver, em qualquer funil
      const semDuplicata = prev.map((f) => ({
        ...f,
        colunas: f.colunas.map((c) => {
          const cards = c.cards.filter((card) => card.nome !== contato.nome);
          return cards.length === c.cards.length
            ? c
            : { ...c, cards, total: Math.max(0, c.total - 1) };
        }),
      }));

      const novoCard: NegocioCard = {
        id: contato.id ?? `negocio-${Date.now()}`,
        nome: contato.nome,
        valor: contato.valor,
        origem: contato.origem,
        dias: contato.dias,
        data: contato.data,
        responsavel: contato.responsavel,
      };

      return semDuplicata.map((f) => {
        if (f.id !== funilId) return f;
        let etapaEncontrada = false;
        const colunas = f.colunas.map((c) => {
          if (c.titulo !== etapaTitulo) return c;
          etapaEncontrada = true;
          return { ...c, cards: [...c.cards, novoCard], total: c.total + 1 };
        });
        if (!etapaEncontrada) return f;
        return { ...f, colunas };
      });
    });
  }

  function excluirFunil(funilId: string) {
    setFunis((prev) => {
      if (prev.length <= 1) return prev;
      const restante = prev.filter((f) => f.id !== funilId);
      if (funilId === funilAtivoId && restante[0]) {
        setFunilAtivoId(restante[0].id);
      }
      return restante;
    });
  }

  return (
    <FunisContext.Provider
      value={{
        funis,
        setFunis,
        funilAtivoId,
        setFunilAtivoId,
        atribuirContatoAoFunil,
        excluirFunil,
      }}
    >
      {children}
    </FunisContext.Provider>
  );
}

export function useFunis() {
  const ctx = useContext(FunisContext);
  if (!ctx) throw new Error("useFunis precisa estar dentro de FunisProvider");
  return ctx;
}
