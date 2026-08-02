"use client";

import type { AguardarData } from "@/lib/automation-flow/types";

const MODOS: { valor: AguardarData["modo"]; label: string }[] = [
  { valor: "minutos", label: "Por X minutos" },
  { valor: "horas", label: "Por X horas" },
  { valor: "dias", label: "Por X dias" },
  { valor: "ate_data", label: "Até uma data específica" },
  { valor: "ate_horario", label: "Até um horário específico" },
  { valor: "ate_resposta", label: "Até o lead responder" },
  { valor: "ate_tarefa", label: "Até uma tarefa ser concluída" },
  { valor: "ate_consulta", label: "Até a data da consulta" },
];

const MODOS_COM_VALOR: AguardarData["modo"][] = ["minutos", "horas", "dias"];

export function AguardarForm({ data, onChange }: { data: AguardarData; onChange: (novo: AguardarData) => void }) {
  return (
    <div className="flow-form">
      <div className="field">
        <label>Aguardar</label>
        <select className="input" value={data.modo} onChange={(e) => onChange({ ...data, modo: e.target.value as AguardarData["modo"] })}>
          {MODOS.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {MODOS_COM_VALOR.includes(data.modo) ? (
        <div className="field">
          <label>Quantidade</label>
          <input
            className="input"
            type="number"
            min={1}
            value={data.valor ?? ""}
            onChange={(e) => onChange({ ...data, valor: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
      ) : null}

      <div className="toggle-row">
        <span className="tl">Só contar dias úteis</span>
        <button
          type="button"
          role="switch"
          aria-checked={!!data.apenasDiasUteis}
          aria-label="Só contar dias úteis"
          className={`toggle${data.apenasDiasUteis ? " on" : ""}`}
          onClick={() => onChange({ ...data, apenasDiasUteis: !data.apenasDiasUteis })}
        >
          <span className="knob" />
        </button>
      </div>
      <div className="toggle-row">
        <span className="tl">Pular finais de semana</span>
        <button
          type="button"
          role="switch"
          aria-checked={!!data.pularFinaisDeSemana}
          aria-label="Pular finais de semana"
          className={`toggle${data.pularFinaisDeSemana ? " on" : ""}`}
          onClick={() => onChange({ ...data, pularFinaisDeSemana: !data.pularFinaisDeSemana })}
        >
          <span className="knob" />
        </button>
      </div>
      <div className="toggle-row">
        <span className="tl">Pular feriados</span>
        <button
          type="button"
          role="switch"
          aria-checked={!!data.pularFeriados}
          aria-label="Pular feriados"
          className={`toggle${data.pularFeriados ? " on" : ""}`}
          onClick={() => onChange({ ...data, pularFeriados: !data.pularFeriados })}
        >
          <span className="knob" />
        </button>
      </div>

      <div className="toggle-row">
        <span className="tl">Tem tempo máximo de espera</span>
        <button
          type="button"
          role="switch"
          aria-checked={!!data.tempoMaximo}
          aria-label="Tem tempo máximo de espera"
          className={`toggle${data.tempoMaximo ? " on" : ""}`}
          onClick={() =>
            onChange({ ...data, tempoMaximo: data.tempoMaximo ? undefined : { valor: 1, unidade: "dias" } })
          }
        >
          <span className="knob" />
        </button>
      </div>
      {data.tempoMaximo ? (
        <div className="field">
          <label>Tempo máximo (gera as saídas &quot;OK&quot; / &quot;Tempo esgotado&quot;)</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="input"
              type="number"
              min={1}
              style={{ flex: 1 }}
              value={data.tempoMaximo.valor}
              onChange={(e) =>
                onChange({ ...data, tempoMaximo: { ...data.tempoMaximo!, valor: Number(e.target.value) || 1 } })
              }
            />
            <select
              className="input"
              style={{ flex: 1 }}
              value={data.tempoMaximo.unidade}
              onChange={(e) => onChange({ ...data, tempoMaximo: { ...data.tempoMaximo!, unidade: e.target.value } })}
            >
              <option value="minutos">Minutos</option>
              <option value="horas">Horas</option>
              <option value="dias">Dias</option>
            </select>
          </div>
        </div>
      ) : null}
    </div>
  );
}
