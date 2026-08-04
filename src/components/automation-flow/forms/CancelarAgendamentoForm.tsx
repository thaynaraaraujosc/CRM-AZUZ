"use client";

import { useEquipe } from "@/lib/equipe-context";
import type { CancelarAgendamentoData, CriterioAgendamento, OrigemMensagemCancelamento } from "@/lib/automation-flow/types";

const TIPOS_AGENDAMENTO = ["Consulta", "Reunião", "Retorno", "Visita", "Demonstração", "Avaliação", "Outro"];

// Mocado — modelos de mensagem de cancelamento prontos, sem integração real.
const MODELOS_CANCELAMENTO = [
  { id: "padrao", nome: "Cancelamento padrão" },
  { id: "indisponibilidade", nome: "Cancelamento por indisponibilidade" },
  { id: "pedido_cliente", nome: "Cancelamento a pedido do cliente" },
];

const CRITERIOS: { valor: CriterioAgendamento; label: string }[] = [
  { valor: "proximo", label: "Próximo agendamento do contato" },
  { valor: "ultimo_criado", label: "Último agendamento criado" },
  { valor: "tipo", label: "Agendamento de determinado tipo" },
  { valor: "responsavel", label: "Agendamento com determinado responsável" },
  { valor: "especifico", label: "Agendamento específico" },
];

/** Ação "Cancelar agendamento" (item 2) — qual agendamento cancelar, e opcionalmente qual mensagem
 * de cancelamento enviar ao contato. */
export function CancelarAgendamentoForm({ data, onChange }: { data: CancelarAgendamentoData; onChange: (novo: CancelarAgendamentoData) => void }) {
  const { membros: equipe } = useEquipe();
  return (
    <div className="flow-form">
      <div className="field">
        <label>Qual agendamento cancelar?</label>
        <select className="input" value={data.criterio} onChange={(e) => onChange({ ...data, criterio: e.target.value as CriterioAgendamento })}>
          {CRITERIOS.map((c) => (
            <option key={c.valor} value={c.valor}>{c.label}</option>
          ))}
        </select>
      </div>

      {data.criterio === "tipo" ? (
        <div className="field">
          <label>Tipo de agendamento</label>
          <select className="input" value={data.tipoAgendamento ?? ""} onChange={(e) => onChange({ ...data, tipoAgendamento: e.target.value })}>
            <option value="">Selecione…</option>
            {TIPOS_AGENDAMENTO.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      ) : null}

      {data.criterio === "responsavel" ? (
        <div className="field">
          <label>Responsável</label>
          <select className="input" value={data.responsavel ?? ""} onChange={(e) => onChange({ ...data, responsavel: e.target.value })}>
            <option value="">Selecione…</option>
            {equipe.map((m) => (
              <option key={m.id} value={m.nome}>{m.nome}</option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="toggle-row">
        <span className="tl">Enviar mensagem ao contato?</span>
        <button
          type="button"
          role="switch"
          aria-checked={!!data.enviarMensagem}
          className={`toggle${data.enviarMensagem ? " on" : ""}`}
          onClick={() => onChange({ ...data, enviarMensagem: !data.enviarMensagem })}
        >
          <span className="knob" />
        </button>
      </div>

      {data.enviarMensagem ? (
        <>
          <div className="field">
            <label>Canal</label>
            <select className="input" value={data.canalMensagem ?? "whatsapp"} onChange={(e) => onChange({ ...data, canalMensagem: e.target.value })}>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">E-mail</option>
            </select>
          </div>
          <div className="field">
            <label>Origem da mensagem</label>
            <select className="input" value={data.origemMensagem ?? "criar_agora"} onChange={(e) => onChange({ ...data, origemMensagem: e.target.value as OrigemMensagemCancelamento })}>
              <option value="modelo">Mensagem pronta</option>
              <option value="criar_agora">Criar mensagem agora</option>
            </select>
          </div>
          {data.origemMensagem === "modelo" ? (
            <div className="field">
              <label>Modelo</label>
              <select className="input" value={data.modeloId ?? ""} onChange={(e) => onChange({ ...data, modeloId: e.target.value })}>
                <option value="">Selecione um modelo…</option>
                {MODELOS_CANCELAMENTO.map((m) => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="field">
              <label>Mensagem</label>
              <textarea
                className="input"
                style={{ width: "100%", minHeight: 70, resize: "vertical" }}
                placeholder="Ex.: Olá, {{primeiro_nome}}. Seu agendamento do dia {{data}} às {{horario}} foi cancelado."
                value={data.mensagem ?? ""}
                onChange={(e) => onChange({ ...data, mensagem: e.target.value })}
              />
              <p className="hint" style={{ marginTop: 4 }}>Variáveis: {"{{primeiro_nome}}"}, {"{{data}}"}, {"{{horario}}"}, {"{{responsavel}}"}, {"{{tipo_agendamento}}"}, {"{{local}}"}</p>
            </div>
          )}
          <div className="field">
            <label>Quando enviar</label>
            <select className="input" value={data.quandoModo ?? "imediato"} onChange={(e) => onChange({ ...data, quandoModo: e.target.value as "imediato" | "apos_tempo" })}>
              <option value="imediato">Imediatamente após o cancelamento</option>
              <option value="apos_tempo">Após determinado tempo</option>
            </select>
          </div>
          {data.quandoModo === "apos_tempo" ? (
            <div className="field" style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                type="number"
                min={1}
                style={{ flex: 1 }}
                value={data.tempoValor ?? ""}
                onChange={(e) => onChange({ ...data, tempoValor: e.target.value ? Number(e.target.value) : undefined })}
              />
              <select className="input" style={{ flex: 1 }} value={data.tempoUnidade ?? "minutos"} onChange={(e) => onChange({ ...data, tempoUnidade: e.target.value })}>
                <option value="minutos">Minutos</option>
                <option value="horas">Horas</option>
                <option value="dias">Dias</option>
              </select>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
