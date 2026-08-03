"use client";

import { useState } from "react";

import type { CompromissoDia, StatusCompromisso } from "@/lib/central-dia/tipos";

const CLASSE_STATUS: Record<StatusCompromisso, string> = {
  Confirmado: "is-confirmado",
  "Aguardando confirmação": "is-aguardando",
  Cancelado: "is-cancelado",
  Concluído: "is-concluido",
  Atrasado: "is-atrasado",
};

/** Card de compromisso da seção "Agenda de hoje" (item 6) — campos e ações próprias (confirmar,
 * reagendar, cancelar), diferentes do card genérico de item do dia. Tudo local: mudar o status aqui
 * não mexe em nenhum agendamento real. */
export function CompromissoCard({ compromisso }: { compromisso: CompromissoDia }) {
  const [status, setStatus] = useState(compromisso.status);
  const [concluido, setConcluido] = useState(false);

  if (concluido) return null;

  return (
    <div className={`central-dia-compromisso ${CLASSE_STATUS[status]}`}>
      <div className="central-dia-compromisso-hora">{compromisso.horario}</div>
      <div className="central-dia-card-corpo">
        <p className="central-dia-card-titulo">
          {compromisso.contato} · {compromisso.tipo}
        </p>
        <div className="central-dia-card-meta">
          <span>Responsável: {compromisso.responsavel}</span>
          <span>{compromisso.local}</span>
          <span className={`central-dia-status-pill ${CLASSE_STATUS[status]}`}>{status}</span>
        </div>
        {compromisso.minutosParaComecar ? (
          <p className="central-dia-destaque">Começa em {compromisso.minutosParaComecar} minutos.</p>
        ) : null}
      </div>
      <div className="central-dia-card-acoes">
        {status !== "Confirmado" && status !== "Cancelado" && status !== "Concluído" ? (
          <button type="button" className="btn primary" onClick={() => setStatus("Confirmado")}>
            Confirmar
          </button>
        ) : null}
        <button type="button" className="btn ghost">
          Abrir agendamento
        </button>
        <button type="button" className="btn ghost">
          Reagendar
        </button>
        {status !== "Cancelado" && status !== "Concluído" ? (
          <button type="button" className="btn ghost" onClick={() => setStatus("Cancelado")}>
            Cancelar
          </button>
        ) : null}
        {status !== "Concluído" ? (
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setStatus("Concluído");
              setConcluido(true);
            }}
          >
            Marcar como concluído
          </button>
        ) : null}
      </div>
    </div>
  );
}
