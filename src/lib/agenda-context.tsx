"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import type { ColunaTarefas } from "@/lib/data";

export const AGENDA_STORAGE_KEY = "azuz-crm-agenda";

/** Data de referência ("hoje") usada em todo o CRM mockado — sem backend/relógio real, fixamos um
 * dia pra Agenda, Central do Dia e o restante do app concordarem sobre o que é "hoje". */
export const HOJE_ISO = "2026-07-30";

export type StatusCompromisso = "agendado" | "concluido" | "cancelado";

export type Compromisso = {
  id: string;
  contatoId?: string;
  contato: string;
  responsavel: string;
  /** Data no formato ISO (aaaa-mm-dd) — ao contrário de `TaskCard.data`, que é texto livre. */
  dataIso: string;
  hora: string;
  tipo: string;
  descricao?: string;
  local?: string;
  status: StatusCompromisso;
  /** "manual" = criado direto na Agenda; "tarefa" = derivado ao vivo de uma tarefa com data (ver `compromissosDeTarefas`). */
  origem: "manual" | "tarefa";
};

const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Deriva compromissos a partir das tarefas que têm data (mesma heurística que a Agenda já usava:
 * `TaskCard.data` é texto livre tipo "28 jul", sem ano — assume sempre 2026, o ano de referência do
 * app). Front-end apenas: quando o CRM tiver um jeito real de agendar hora/local numa tarefa, essa
 * função para de ser necessária. Reaproveitada tanto pela página Agenda quanto pela Central do Dia,
 * pra não ter duas heurísticas de parsing divergentes.
 */
export function compromissosDeTarefas(colunas: ColunaTarefas[], ano = 2026): Compromisso[] {
  const compromissos: Compromisso[] = [];
  for (const coluna of colunas) {
    if (coluna.titulo === "Concluídas") continue;
    for (const card of coluna.cards) {
      const partes = card.data.trim().split(" ");
      if (partes.length !== 2) continue;
      const dia = Number(partes[0]);
      const mesIndex = MESES_ABREV.indexOf(partes[1].toLowerCase());
      if (Number.isNaN(dia) || mesIndex < 0) continue;
      compromissos.push({
        id: `tarefa-${card.id}`,
        contatoId: card.contatoId,
        contato: card.contato,
        responsavel: card.responsavel.nome,
        dataIso: `${ano}-${pad2(mesIndex + 1)}-${pad2(dia)}`,
        hora: "",
        tipo: `Tarefa · ${coluna.titulo}`,
        descricao: card.titulo,
        status: card.atrasada ? "agendado" : "agendado",
        origem: "tarefa",
      });
    }
  }
  return compromissos;
}

type NovoCompromisso = {
  contato: string;
  contatoId?: string;
  responsavel: string;
  dataIso: string;
  hora: string;
  tipo: string;
  descricao?: string;
  local?: string;
};

type AgendaContextValue = {
  compromissos: Compromisso[];
  criarAgendamento: (dados: NovoCompromisso) => Compromisso;
  reagendar: (id: string, dataIso: string, hora: string) => void;
  cancelar: (id: string) => void;
  concluir: (id: string) => void;
};

const AgendaContext = createContext<AgendaContextValue | null>(null);

/**
 * Compromissos manuais vivem num contexto no topo do app pelo mesmo motivo de Tarefas e Funis: criar
 * um agendamento precisa aparecer na Agenda, no contato relacionado e na Central do Dia, sem cada tela
 * ficar com uma fonte própria e incompatível de "agenda" (antes eram duas: `EventoManual` só na
 * página Agenda, e `COMPROMISSOS_HOJE_MOCK` só na Central do Dia).
 */
export function AgendaProvider({ children }: { children: ReactNode }) {
  const [compromissos, setCompromissos] = useState<Compromisso[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const salvos = window.localStorage.getItem(AGENDA_STORAGE_KEY);
      if (!salvos) return [];
      return JSON.parse(salvos) as Compromisso[];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(AGENDA_STORAGE_KEY, JSON.stringify(compromissos));
    } catch {
      // localStorage indisponível (modo privado, por exemplo) — segue só em memória.
    }
  }, [compromissos]);

  function criarAgendamento(dados: NovoCompromisso): Compromisso {
    const novo: Compromisso = {
      id: `compromisso-${Date.now()}`,
      contato: dados.contato,
      contatoId: dados.contatoId,
      responsavel: dados.responsavel,
      dataIso: dados.dataIso,
      hora: dados.hora,
      tipo: dados.tipo,
      descricao: dados.descricao,
      local: dados.local,
      status: "agendado",
      origem: "manual",
    };
    setCompromissos((prev) => [...prev, novo]);
    return novo;
  }

  function reagendar(id: string, dataIso: string, hora: string) {
    setCompromissos((prev) => prev.map((c) => (c.id === id ? { ...c, dataIso, hora } : c)));
  }

  function cancelar(id: string) {
    setCompromissos((prev) => prev.map((c) => (c.id === id ? { ...c, status: "cancelado" } : c)));
  }

  function concluir(id: string) {
    setCompromissos((prev) => prev.map((c) => (c.id === id ? { ...c, status: "concluido" } : c)));
  }

  return (
    <AgendaContext.Provider value={{ compromissos, criarAgendamento, reagendar, cancelar, concluir }}>
      {children}
    </AgendaContext.Provider>
  );
}

export function useAgenda() {
  const ctx = useContext(AgendaContext);
  if (!ctx) throw new Error("useAgenda precisa estar dentro de AgendaProvider");
  return ctx;
}
