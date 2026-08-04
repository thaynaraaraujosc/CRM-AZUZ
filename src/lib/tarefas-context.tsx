"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { tarefas as tarefasIniciais, type ColunaTarefas, type TaskCard, type Urgencia } from "@/lib/data";

export const TAREFAS_STORAGE_KEY = "azuz-crm-tarefas";

function cloneColunas(colunas: ColunaTarefas[]): ColunaTarefas[] {
  return colunas.map((c) => ({ ...c, cards: c.cards.map((card) => ({ ...card })) }));
}

type NovaTarefa = {
  titulo: string;
  contato?: string;
  contatoId?: string;
  data: string;
  responsavel: { nome: string; initials: string };
  urgencia: Urgencia;
  descricao: string;
  anexo?: { arquivo: string; detalhe: string } | null;
  modelo?: string;
  /** Título da coluna destino — "Hoje" por padrão, igual ao comportamento anterior. */
  coluna?: string;
};

type TarefasContextValue = {
  colunas: ColunaTarefas[];
  setColunas: React.Dispatch<React.SetStateAction<ColunaTarefas[]>>;
  criarTarefa: (dados: NovaTarefa) => TaskCard;
  editarTarefa: (id: string, dados: Partial<Omit<TaskCard, "id">>) => void;
  excluirTarefa: (id: string) => void;
  concluirTarefa: (id: string) => void;
  moverTarefaPara: (colOrigem: number, indiceOrigem: number, colDestino: number, indiceDestino?: number) => void;
  renomearEtapa: (colIndex: number, titulo: string) => void;
  reordenarEtapa: (origem: number, destino: number) => void;
  criarEtapa: (titulo: string) => void;
  excluirEtapa: (colIndex: number) => void;
};

const TarefasContext = createContext<TarefasContextValue | null>(null);

/**
 * Tarefas vivem num contexto no topo do app pelo mesmo motivo de Funis e Contatos: criar/editar/mover
 * uma tarefa em /tarefas precisa aparecer em Agenda, Central do Dia, no contato relacionado e na
 * página de Equipe, sem cada tela ficar com uma cópia local dessincronizada do kanban.
 */
export function TarefasProvider({ children }: { children: ReactNode }) {
  const [colunas, setColunas] = useState<ColunaTarefas[]>(() => {
    if (typeof window === "undefined") return cloneColunas(tarefasIniciais);
    try {
      const salvas = window.localStorage.getItem(TAREFAS_STORAGE_KEY);
      if (!salvas) return cloneColunas(tarefasIniciais);
      return JSON.parse(salvas) as ColunaTarefas[];
    } catch {
      return cloneColunas(tarefasIniciais);
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(TAREFAS_STORAGE_KEY, JSON.stringify(colunas));
    } catch {
      // localStorage indisponível (modo privado, por exemplo) — segue só em memória.
    }
  }, [colunas]);

  function criarTarefa(dados: NovaTarefa): TaskCard {
    const nova: TaskCard = {
      id: `tarefa-${Date.now()}`,
      titulo: dados.titulo,
      contato: dados.contato ?? "—",
      contatoId: dados.contatoId,
      data: dados.data || "Sem data",
      responsavel: dados.responsavel,
      urgencia: dados.urgencia,
      descricao: dados.descricao || "Sem descrição.",
      anexo: dados.anexo ?? null,
      modelo: dados.modelo,
    };
    setColunas((prev) => {
      const proximo = cloneColunas(prev);
      const colunaDestino =
        proximo.find((c) => c.titulo === (dados.coluna ?? "Hoje")) ?? proximo[0];
      colunaDestino?.cards.push(nova);
      return proximo;
    });
    return nova;
  }

  function editarTarefa(id: string, dados: Partial<Omit<TaskCard, "id">>) {
    setColunas((prev) =>
      prev.map((c) => ({
        ...c,
        cards: c.cards.map((card) => (card.id === id ? { ...card, ...dados } : card)),
      })),
    );
  }

  function excluirTarefa(id: string) {
    setColunas((prev) => prev.map((c) => ({ ...c, cards: c.cards.filter((card) => card.id !== id) })));
  }

  function moverTarefaPara(
    colOrigem: number,
    indiceOrigem: number,
    colDestino: number,
    indiceDestino?: number,
  ) {
    setColunas((prev) => {
      const proximo = cloneColunas(prev);
      const [card] = proximo[colOrigem].cards.splice(indiceOrigem, 1);
      if (!card) return prev;

      const tituloDestino = proximo[colDestino].titulo;
      card.concluida = tituloDestino === "Concluídas";
      card.atrasada = tituloDestino === "Atrasadas";

      const destino = proximo[colDestino].cards;
      const posicao = indiceDestino ?? destino.length;
      const posicaoAjustada =
        colOrigem === colDestino && indiceOrigem < posicao ? posicao - 1 : posicao;
      destino.splice(posicaoAjustada, 0, card);
      return proximo;
    });
  }

  function concluirTarefa(id: string) {
    setColunas((prev) => {
      const proximo = cloneColunas(prev);
      const colDestinoIndex = proximo.findIndex((c) => c.titulo === "Concluídas");
      if (colDestinoIndex < 0) return prev;
      for (const coluna of proximo) {
        const indice = coluna.cards.findIndex((card) => card.id === id);
        if (indice < 0) continue;
        const [card] = coluna.cards.splice(indice, 1);
        card.concluida = true;
        card.atrasada = false;
        proximo[colDestinoIndex].cards.push(card);
        break;
      }
      return proximo;
    });
  }

  function renomearEtapa(colIndex: number, titulo: string) {
    if (!titulo.trim()) return;
    setColunas((prev) => prev.map((c, i) => (i === colIndex ? { ...c, titulo: titulo.trim() } : c)));
  }

  function reordenarEtapa(origem: number, destino: number) {
    if (origem === destino) return;
    setColunas((prev) => {
      const proximo = [...prev];
      const [movida] = proximo.splice(origem, 1);
      if (!movida) return prev;
      proximo.splice(destino, 0, movida);
      return proximo;
    });
  }

  function criarEtapa(titulo: string) {
    const nome = titulo.trim();
    if (!nome) return;
    setColunas((prev) => [...prev, { titulo: nome, cards: [] }]);
  }

  function excluirEtapa(colIndex: number) {
    setColunas((prev) => prev.filter((_, i) => i !== colIndex));
  }

  return (
    <TarefasContext.Provider
      value={{
        colunas,
        setColunas,
        criarTarefa,
        editarTarefa,
        excluirTarefa,
        concluirTarefa,
        moverTarefaPara,
        renomearEtapa,
        reordenarEtapa,
        criarEtapa,
        excluirEtapa,
      }}
    >
      {children}
    </TarefasContext.Provider>
  );
}

export function useTarefas() {
  const ctx = useContext(TarefasContext);
  if (!ctx) throw new Error("useTarefas precisa estar dentro de TarefasProvider");
  return ctx;
}
