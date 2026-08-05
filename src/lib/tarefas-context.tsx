"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import type { ColunaTarefas, TaskCard, Urgencia } from "@/lib/data";

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
 *
 * Núcleo comercial (2ª leva de migração pro banco real, ver `src/app/api/tarefas/`) — a lógica local
 * de índice/splice (mover card, reordenar etapa) continua igual, porque já funcionava bem e mexer
 * nela seria o ponto de maior risco dessa migração. O que muda: cada mutação também resolve os ids
 * reais (vindos do fetch inicial) e dispara a chamada de API correspondente, sem bloquear a UI.
 */
export function TarefasProvider({ children }: { children: ReactNode }) {
  const [colunas, setColunas] = useState<ColunaTarefas[]>([]);

  useEffect(() => {
    fetch("/api/tarefas")
      .then((r) => r.json())
      .then((dados: ColunaTarefas[]) => setColunas(dados))
      .catch((erro) => console.error("Falha ao carregar tarefas da API:", erro));
  }, []);

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
    fetch("/api/tarefas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    })
      .then((r) => r.json())
      .then((salva: TaskCard) => {
        setColunas((prev) =>
          prev.map((c) => ({ ...c, cards: c.cards.map((card) => (card.id === nova.id ? salva : card)) })),
        );
      })
      .catch((erro) => console.error("Falha ao criar tarefa na API:", erro));
    return nova;
  }

  function editarTarefa(id: string, dados: Partial<Omit<TaskCard, "id">>) {
    setColunas((prev) =>
      prev.map((c) => ({
        ...c,
        cards: c.cards.map((card) => (card.id === id ? { ...card, ...dados } : card)),
      })),
    );
    fetch(`/api/tarefas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    }).catch((erro) => console.error("Falha ao editar tarefa na API:", erro));
  }

  function excluirTarefa(id: string) {
    setColunas((prev) => prev.map((c) => ({ ...c, cards: c.cards.filter((card) => card.id !== id) })));
    fetch(`/api/tarefas/${id}`, { method: "DELETE" }).catch((erro) =>
      console.error("Falha ao excluir tarefa na API:", erro),
    );
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

      const etapaDestino = proximo[colDestino];
      card.concluida = etapaDestino.titulo === "Concluídas";
      card.atrasada = etapaDestino.titulo === "Atrasadas";

      const destino = etapaDestino.cards;
      const posicao = indiceDestino ?? destino.length;
      const posicaoAjustada =
        colOrigem === colDestino && indiceOrigem < posicao ? posicao - 1 : posicao;
      destino.splice(posicaoAjustada, 0, card);

      // Reenvia a ordem final de todos os cards das etapas afetadas — mais simples e seguro do que
      // calcular só o delta, e o volume de cards por etapa é sempre pequeno nesse CRM.
      const etapasAfetadas = colOrigem === colDestino ? [proximo[colOrigem]] : [proximo[colOrigem], proximo[colDestino]];
      const cardsParaSincronizar = etapasAfetadas.flatMap((etapa) =>
        etapa.cards.map((c, indice) => ({
          id: c.id,
          etapaId: etapa.id ?? "",
          ordem: indice,
          concluida: c.concluida,
          atrasada: c.atrasada,
        })),
      );
      if (cardsParaSincronizar.every((c) => c.etapaId)) {
        fetch("/api/tarefas/mover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cards: cardsParaSincronizar }),
        }).catch((erro) => console.error("Falha ao mover tarefa na API:", erro));
      }

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
        const etapaDestino = proximo[colDestinoIndex];
        const ordem = etapaDestino.cards.length;
        etapaDestino.cards.push(card);
        if (etapaDestino.id) {
          fetch(`/api/tarefas/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ etapaId: etapaDestino.id, ordem, concluida: true, atrasada: false }),
          }).catch((erro) => console.error("Falha ao concluir tarefa na API:", erro));
        }
        break;
      }
      return proximo;
    });
  }

  function renomearEtapa(colIndex: number, titulo: string) {
    const nome = titulo.trim();
    if (!nome) return;
    const etapaId = colunas[colIndex]?.id;
    setColunas((prev) => prev.map((c, i) => (i === colIndex ? { ...c, titulo: nome } : c)));
    if (etapaId) {
      fetch(`/api/tarefas/etapas/${etapaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo: nome }),
      }).catch((erro) => console.error("Falha ao renomear etapa na API:", erro));
    }
  }

  function reordenarEtapa(origem: number, destino: number) {
    if (origem === destino) return;
    setColunas((prev) => {
      const proximo = [...prev];
      const [movida] = proximo.splice(origem, 1);
      if (!movida) return prev;
      proximo.splice(destino, 0, movida);

      const etapas = proximo.map((c, indice) => ({ id: c.id ?? "", ordem: indice }));
      if (etapas.every((e) => e.id)) {
        fetch("/api/tarefas/etapas/reordenar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ etapas }),
        }).catch((erro) => console.error("Falha ao reordenar etapas na API:", erro));
      }

      return proximo;
    });
  }

  function criarEtapa(titulo: string) {
    const nome = titulo.trim();
    if (!nome) return;
    const idTemporario = `etapa-${Date.now()}`;
    setColunas((prev) => [...prev, { id: idTemporario, titulo: nome, cards: [] }]);
    fetch("/api/tarefas/etapas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo: nome }),
    })
      .then((r) => r.json())
      .then((etapa: { id: string }) => {
        setColunas((prev) => prev.map((c) => (c.id === idTemporario ? { ...c, id: etapa.id } : c)));
      })
      .catch((erro) => console.error("Falha ao criar etapa na API:", erro));
  }

  function excluirEtapa(colIndex: number) {
    const etapaId = colunas[colIndex]?.id;
    setColunas((prev) => prev.filter((_, i) => i !== colIndex));
    if (etapaId) {
      fetch(`/api/tarefas/etapas/${etapaId}`, { method: "DELETE" }).catch((erro) =>
        console.error("Falha ao excluir etapa na API:", erro),
      );
    }
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
