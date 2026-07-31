"use client";

import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import { funis as funisIniciais, type Funil } from "@/lib/data";

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
};

const FunisContext = createContext<FunisContextValue | null>(null);

/**
 * Funis vivem num contexto no topo do app (não em cada página) porque uma
 * edição feita em /funil (renomear/criar/apagar etapa, criar funil novo)
 * precisa aparecer também em "Atribuir ao funil" no WhatsApp, sem as duas
 * telas ficarem com cópias dessincronizadas dos dados.
 */
export function FunisProvider({ children }: { children: ReactNode }) {
  const [funis, setFunis] = useState<Funil[]>(() => cloneFunis(funisIniciais));
  const [funilAtivoId, setFunilAtivoId] = useState(funisIniciais[0]?.id ?? "");

  return (
    <FunisContext.Provider
      value={{ funis, setFunis, funilAtivoId, setFunilAtivoId }}
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
