"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import type { Funil, NegocioCard } from "@/lib/data";

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
  const [funis, setFunis] = useState<Funil[]>([]);
  const [funilAtivoId, setFunilAtivoId] = useState("");
  const carregadoRef = useRef(false);

  useEffect(() => {
    fetch("/api/funis")
      .then((r) => r.json())
      .then((dados: Funil[]) => {
        setFunis(dados);
        setFunilAtivoId((atual) => atual || dados[0]?.id || "");
        carregadoRef.current = true;
      })
      .catch((erro) => console.error("Falha ao carregar funis da API:", erro));
  }, []);

  // Não existem mutadores dedicados pra Funil (~13 pontos em funil/page.tsx/FunisSecao.tsx mexem
  // direto em setFunis) — por isso sincroniza o estado inteiro com o banco a cada mudança, em vez de
  // granular por operação (mesmo espírito do antigo useEffect que gravava tudo no localStorage).
  // Debounça 500ms pra não disparar um PUT a cada pixel de um drag de card/coluna.
  useEffect(() => {
    if (!carregadoRef.current) return;
    const temporizador = setTimeout(() => {
      fetch("/api/funis", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(funis),
      }).catch((erro) => console.error("Falha ao sincronizar funis na API:", erro));
    }, 500);
    return () => clearTimeout(temporizador);
  }, [funis]);

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
