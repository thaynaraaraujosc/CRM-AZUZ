"use client";

import type { AguardarData } from "@/lib/automation-flow/types";

/**
 * "O que você quer aguardar?": a pergunta que o bloco responde.
 *
 * Antes era uma lista de oito modos técnicos misturados ("Por X minutos", "Até uma tarefa ser
 * concluída"). Agora são cinco escolhas, cada uma com uma frase dizendo o que acontece. E o
 * segundo campo muda conforme a escolha, em vez de existirem todos ao mesmo tempo.
 */
const ESCOLHAS: { valor: AguardarData["modo"]; label: string; ajuda: string }[] = [
  { valor: "horas", label: "Um período de tempo", ajuda: "Segura o fluxo e continua sozinho quando o tempo passar." },
  {
    valor: "ate_resposta",
    label: "A resposta do contato",
    ajuda: "Continua no instante em que ele responder. Com prazo, o bloco ganha duas saídas: respondeu e não respondeu.",
  },
  { valor: "ate_horario", label: "Um horário do dia", ajuda: "Espera até chegar a hora marcada." },
  { valor: "ate_data", label: "Uma data", ajuda: "Espera até o dia marcado." },
  { valor: "ate_consulta", label: "A data da consulta", ajuda: "Espera até a consulta agendada do contato." },
];

const UNIDADES = [
  { valor: "minutos", label: "minutos" },
  { valor: "horas", label: "horas" },
  { valor: "dias", label: "dias" },
];

/** Os três modos de duração são a mesma escolha ("um período") com unidades diferentes. */
const DURACAO: AguardarData["modo"][] = ["minutos", "horas", "dias"];

export function AguardarForm({ data, onChange }: { data: AguardarData; onChange: (novo: AguardarData) => void }) {
  const ehDuracao = DURACAO.includes(data.modo);
  const escolhida = ehDuracao ? "horas" : data.modo;
  const ajuda = ESCOLHAS.find((e) => e.valor === escolhida)?.ajuda;

  return (
    <div className="flow-form">
      <div className="field">
        <label>O que você quer aguardar?</label>
        <select
          className="input"
          value={escolhida}
          onChange={(e) => {
            const modo = e.target.value as AguardarData["modo"];
            // Trocar de escolha limpa o que não vale mais: um prazo máximo de "esperar resposta"
            // ficaria pendurado num "esperar 2 dias" e criaria uma saída de timeout sem sentido.
            onChange(
              modo === "ate_resposta"
                ? { modo, tempoMaximo: data.tempoMaximo ?? { valor: 2, unidade: "horas" } }
                : { ...data, modo, valor: data.valor ?? 1, tempoMaximo: undefined },
            );
          }}
        >
          {ESCOLHAS.map((e) => (
            <option key={e.valor} value={e.valor}>
              {e.label}
            </option>
          ))}
        </select>
        {ajuda ? <p className="hint">{ajuda}</p> : null}
      </div>

      {ehDuracao ? (
        <div className="field">
          <label>Quanto tempo</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="input"
              style={{ flex: 1 }}
              type="number"
              min={1}
              value={data.valor ?? ""}
              onChange={(e) => onChange({ ...data, valor: e.target.value ? Number(e.target.value) : undefined })}
              aria-label="Quantidade de tempo"
            />
            <select
              className="input"
              style={{ flex: 1 }}
              value={data.modo}
              onChange={(e) => onChange({ ...data, modo: e.target.value as AguardarData["modo"] })}
              aria-label="Unidade de tempo"
            >
              {UNIDADES.map((u) => (
                <option key={u.valor} value={u.valor}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {data.modo === "ate_resposta" ? (
        <div className="field">
          <label>Esperar no máximo</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="input"
              style={{ flex: 1 }}
              type="number"
              min={1}
              value={data.tempoMaximo?.valor ?? 2}
              onChange={(e) =>
                onChange({
                  ...data,
                  tempoMaximo: { valor: Number(e.target.value) || 1, unidade: data.tempoMaximo?.unidade ?? "horas" },
                })
              }
              aria-label="Prazo máximo de espera"
            />
            <select
              className="input"
              style={{ flex: 1 }}
              value={data.tempoMaximo?.unidade ?? "horas"}
              onChange={(e) => onChange({ ...data, tempoMaximo: { valor: data.tempoMaximo?.valor ?? 2, unidade: e.target.value } })}
              aria-label="Unidade do prazo"
            >
              {UNIDADES.map((u) => (
                <option key={u.valor} value={u.valor}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
          <p className="hint">
            Se ele responder antes, o fluxo continua na hora pelo caminho <strong>Respondeu</strong>.
            Não fica esperando o prazo acabar.
          </p>
        </div>
      ) : null}

      {ehDuracao ? (
        <>
          <div className="toggle-row">
            <span className="tl">Contar só dias úteis</span>
            <button
              type="button"
              role="switch"
              aria-checked={!!data.apenasDiasUteis}
              aria-label="Contar só dias úteis"
              className={`toggle${data.apenasDiasUteis ? " on" : ""}`}
              onClick={() => onChange({ ...data, apenasDiasUteis: !data.apenasDiasUteis })}
            >
              <span className="knob" />
            </button>
          </div>
          <div className="toggle-row">
            <span className="tl">Não cair em fim de semana</span>
            <button
              type="button"
              role="switch"
              aria-checked={!!data.pularFinaisDeSemana}
              aria-label="Não cair em fim de semana"
              className={`toggle${data.pularFinaisDeSemana ? " on" : ""}`}
              onClick={() => onChange({ ...data, pularFinaisDeSemana: !data.pularFinaisDeSemana })}
            >
              <span className="knob" />
            </button>
          </div>
          <div className="toggle-row">
            <span className="tl">Contar só o horário de expediente</span>
            <button
              type="button"
              role="switch"
              aria-checked={!!data.somenteExpediente}
              aria-label="Contar só o horário de expediente"
              className={`toggle${data.somenteExpediente ? " on" : ""}`}
              onClick={() => onChange({ ...data, somenteExpediente: !data.somenteExpediente })}
            >
              <span className="knob" />
            </button>
          </div>
          {data.somenteExpediente ? (
            <p className="hint">
              &quot;2 horas&quot; às 17h20 de sexta não termina às 19h20: termina às 9h20 de
              segunda. É a diferença entre um follow-up que chega no meio do atendimento e um que
              chega de madrugada. O horário é o de Configurações, um só pro workspace.
            </p>
          ) : null}
          <p className="hint">
            Feriado não entra nessa conta: o CRM não tem calendário de feriados, e fingir que pula
            faria a mensagem sair no dia errado sem ninguém entender por quê.
          </p>
        </>
      ) : null}
    </div>
  );
}
