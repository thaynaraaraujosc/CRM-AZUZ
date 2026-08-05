"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import type { ColunaTarefas } from "@/lib/data";

/** Data de referência ("hoje") usada em todo o CRM mockado — sem backend/relógio real, fixamos um
 * dia pra Agenda, Central do Dia e o restante do app concordarem sobre o que é "hoje". */
export const HOJE_ISO = "2026-07-30";

export type StatusCompromisso = "agendado" | "concluido" | "cancelado";

/** Categoria do compromisso — só pra dar uma distinção visual sutil (cor do chip) na Agenda; não
 * confundir com `tipo`, que é o rótulo livre exibido (ex.: "Retorno da Marina Costa"). */
export type CategoriaCompromisso = "consulta" | "retorno" | "reuniao" | "ligacao" | "outro";

export const CATEGORIAS_COMPROMISSO: { valor: CategoriaCompromisso; rotulo: string }[] = [
  { valor: "consulta", rotulo: "Consulta" },
  { valor: "retorno", rotulo: "Retorno" },
  { valor: "reuniao", rotulo: "Reunião" },
  { valor: "ligacao", rotulo: "Ligação" },
  { valor: "outro", rotulo: "Outro" },
];

export type Compromisso = {
  id: string;
  contatoId?: string;
  contato: string;
  responsavel: string;
  /** Data no formato ISO (aaaa-mm-dd) — ao contrário de `TaskCard.data`, que é texto livre. */
  dataIso: string;
  hora: string;
  /** Horário de término — opcional (compromissos derivados de tarefa e agendamentos antigos não têm). */
  horaFim?: string;
  tipo: string;
  categoria?: CategoriaCompromisso;
  descricao?: string;
  local?: string;
  status: StatusCompromisso;
  /** Preenchido só quando `status === "cancelado"` — motivo informado no cancelamento. */
  motivoCancelamento?: string;
  /** "manual" = criado direto na Agenda; "tarefa" = derivado ao vivo de uma tarefa com data (ver `compromissosDeTarefas`). */
  origem: "manual" | "tarefa";
};

/** Compromissos "manuais" (não cancelados) cujo intervalo [hora, horaFim) se sobrepõe ao informado,
 * no mesmo dia e responsável — usado pra alertar de conflito de horário antes de salvar (ver
 * `AgendaPage`). Sem `horaFim`, assume um intervalo mínimo de 30 minutos pra comparação. */
export function compromissosConflitantes(
  compromissos: Compromisso[],
  dados: { dataIso: string; hora: string; horaFim?: string; responsavel: string; ignorarId?: string },
): Compromisso[] {
  if (!dados.hora) return [];
  const inicioNovo = dados.hora;
  const fimNovo = dados.horaFim && dados.horaFim > dados.hora ? dados.horaFim : somarMinutos(dados.hora, 30);
  return compromissos.filter((c) => {
    if (c.id === dados.ignorarId) return false;
    if (c.status === "cancelado") return false;
    if (c.dataIso !== dados.dataIso) return false;
    if (c.responsavel !== dados.responsavel) return false;
    if (!c.hora) return false;
    const inicioExistente = c.hora;
    const fimExistente = c.horaFim && c.horaFim > c.hora ? c.horaFim : somarMinutos(c.hora, 30);
    return inicioNovo < fimExistente && inicioExistente < fimNovo;
  });
}

function somarMinutos(hora: string, minutos: number): string {
  const [h, m] = hora.split(":").map(Number);
  const total = h * 60 + m + minutos;
  const hh = Math.floor((total % (24 * 60)) / 60);
  const mm = total % 60;
  return `${pad2(hh)}:${pad2(mm)}`;
}

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
  horaFim?: string;
  tipo: string;
  categoria?: CategoriaCompromisso;
  descricao?: string;
  local?: string;
};

type AgendaContextValue = {
  compromissos: Compromisso[];
  criarAgendamento: (dados: NovoCompromisso) => Compromisso;
  editarAgendamento: (id: string, dados: Partial<NovoCompromisso>) => void;
  reagendar: (id: string, dataIso: string, hora: string, horaFim?: string) => void;
  cancelar: (id: string, motivo?: string) => void;
  concluir: (id: string) => void;
};

const AgendaContext = createContext<AgendaContextValue | null>(null);

/**
 * Compromissos manuais vivem num contexto no topo do app pelo mesmo motivo de Tarefas e Funis: criar
 * um agendamento precisa aparecer na Agenda, no contato relacionado e na Central do Dia, sem cada tela
 * ficar com uma fonte própria e incompatível de "agenda" (antes eram duas: `EventoManual` só na
 * página Agenda, e `COMPROMISSOS_HOJE_MOCK` só na Central do Dia).
 *
 * Núcleo comercial (2ª leva de migração pro banco real, ver `src/app/api/agenda/`) — mesmo padrão do
 * piloto de Contatos: contrato público não muda, só o motor por dentro troca `localStorage` por
 * `fetch` na API real, com atualização otimista local. Falha de rede só loga no console.
 */
export function AgendaProvider({ children }: { children: ReactNode }) {
  const [compromissos, setCompromissos] = useState<Compromisso[]>([]);

  useEffect(() => {
    fetch("/api/agenda")
      .then((r) => r.json())
      .then((dados: Compromisso[]) => setCompromissos(dados))
      .catch((erro) => console.error("Falha ao carregar agenda da API:", erro));
  }, []);

  function atualizarRemoto(id: string, dados: Partial<Compromisso>) {
    fetch(`/api/agenda/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    }).catch((erro) => console.error("Falha ao atualizar compromisso na API:", erro));
  }

  function criarAgendamento(dados: NovoCompromisso): Compromisso {
    const novo: Compromisso = {
      id: `compromisso-${Date.now()}`,
      contato: dados.contato,
      contatoId: dados.contatoId,
      responsavel: dados.responsavel,
      dataIso: dados.dataIso,
      hora: dados.hora,
      horaFim: dados.horaFim,
      tipo: dados.tipo,
      categoria: dados.categoria,
      descricao: dados.descricao,
      local: dados.local,
      status: "agendado",
      origem: "manual",
    };
    setCompromissos((prev) => [...prev, novo]);
    fetch("/api/agenda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    })
      .then((r) => r.json())
      .then((salvo: Compromisso) => {
        // troca o id otimista pelo id real gerado no servidor (mesmo timestamp, mas evita
        // divergência se as duas chamadas caírem em milissegundos diferentes).
        setCompromissos((prev) => prev.map((c) => (c.id === novo.id ? salvo : c)));
      })
      .catch((erro) => console.error("Falha ao criar agendamento na API:", erro));
    return novo;
  }

  function editarAgendamento(id: string, dados: Partial<NovoCompromisso>) {
    setCompromissos((prev) => prev.map((c) => (c.id === id ? { ...c, ...dados } : c)));
    atualizarRemoto(id, dados);
  }

  function reagendar(id: string, dataIso: string, hora: string, horaFim?: string) {
    setCompromissos((prev) => prev.map((c) => (c.id === id ? { ...c, dataIso, hora, horaFim } : c)));
    atualizarRemoto(id, { dataIso, hora, horaFim });
  }

  function cancelar(id: string, motivo?: string) {
    setCompromissos((prev) => prev.map((c) => (c.id === id ? { ...c, status: "cancelado", motivoCancelamento: motivo } : c)));
    atualizarRemoto(id, { status: "cancelado", motivoCancelamento: motivo });
  }

  function concluir(id: string) {
    setCompromissos((prev) => prev.map((c) => (c.id === id ? { ...c, status: "concluido" } : c)));
    atualizarRemoto(id, { status: "concluido" });
  }

  return (
    <AgendaContext.Provider value={{ compromissos, criarAgendamento, editarAgendamento, reagendar, cancelar, concluir }}>
      {children}
    </AgendaContext.Provider>
  );
}

export function useAgenda() {
  const ctx = useContext(AgendaContext);
  if (!ctx) throw new Error("useAgenda precisa estar dentro de AgendaProvider");
  return ctx;
}
