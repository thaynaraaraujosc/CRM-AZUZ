"use client";

import type { DestinatarioEmailModo, MensagemEmailData, SeSemEmailModo } from "@/lib/automation-flow/types";

// Mocado — contas de e-mail configuradas no workspace, sem conexão real.
const CONTAS_EMAIL: string[] = [];

// Mocado — modelos de e-mail salvos, sem integração real.
const MODELOS_EMAIL = [
  { id: "proposta", nome: "Proposta pronta" },
  { id: "boas_vindas", nome: "Boas-vindas" },
  { id: "cobranca", nome: "Cobrança" },
];

/** Ação "Enviar e-mail" (item 5) — o destinatário precisa estar ligado dinamicamente ao lead da
 * automação, não só um assunto/corpo soltos. */
export function MensagemEmailForm({ data, onChange }: { data: MensagemEmailData; onChange: (novo: MensagemEmailData) => void }) {
  return (
    <div className="flow-form">
      <div className="field">
        <label>Destinatário</label>
        <select className="input" value={data.destinatarioModo} onChange={(e) => onChange({ ...data, destinatarioModo: e.target.value as DestinatarioEmailModo })}>
          <option value="contato_email">E-mail do contato deste fluxo</option>
          <option value="outro_campo">Outro campo de e-mail do contato</option>
          <option value="especifico">E-mail específico</option>
          <option value="responsavel">Responsável do lead</option>
          <option value="campo_personalizado">Campo personalizado</option>
        </select>
        {data.destinatarioModo === "contato_email" ? (
          <p className="hint" style={{ marginTop: 6 }}>Será utilizado automaticamente o e-mail cadastrado na ficha do lead que estiver passando por esta automação.</p>
        ) : null}
      </div>

      {data.destinatarioModo === "especifico" || data.destinatarioModo === "outro_campo" || data.destinatarioModo === "campo_personalizado" ? (
        <div className="field">
          <label>{data.destinatarioModo === "especifico" ? "E-mail" : "Nome do campo"}</label>
          <input
            className="input"
            placeholder={data.destinatarioModo === "especifico" ? "email@exemplo.com" : "Ex.: e-mail_secundario"}
            value={data.destinatarioEspecifico ?? ""}
            onChange={(e) => onChange({ ...data, destinatarioEspecifico: e.target.value })}
          />
        </div>
      ) : null}

      <div className="field" style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label>CC</label>
          <input className="input" style={{ width: "100%" }} value={data.cc ?? ""} onChange={(e) => onChange({ ...data, cc: e.target.value })} />
        </div>
        <div style={{ flex: 1 }}>
          <label>CCO</label>
          <input className="input" style={{ width: "100%" }} value={data.cco ?? ""} onChange={(e) => onChange({ ...data, cco: e.target.value })} />
        </div>
      </div>

      <div className="field">
        <label>Conta de envio (remetente)</label>
        {CONTAS_EMAIL.length === 0 ? (
          <p className="hint">⚠ Configure uma conta de e-mail antes de utilizar este bloco.</p>
        ) : (
          <select className="input" value={data.remetente ?? ""} onChange={(e) => onChange({ ...data, remetente: e.target.value })}>
            <option value="">Selecione…</option>
            {CONTAS_EMAIL.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      <div className="field">
        <label>Assunto</label>
        <input className="input" value={data.assunto} onChange={(e) => onChange({ ...data, assunto: e.target.value })} />
      </div>

      <div className="field">
        <label>Corpo do e-mail</label>
        <textarea
          className="input"
          style={{ width: "100%", minHeight: 100, resize: "vertical" }}
          value={data.corpo}
          onChange={(e) => onChange({ ...data, corpo: e.target.value })}
        />
        <p className="hint" style={{ marginTop: 4 }}>
          Variáveis: {"{{primeiro_nome}}"}, {"{{nome_completo}}"}, {"{{empresa}}"}, {"{{responsavel}}"}, {"{{valor_negocio}}"}, {"{{etapa}}"}, {"{{data_agendamento}}"}
        </p>
      </div>

      <div className="field">
        <label>Usar modelo salvo</label>
        <select className="input" value={data.modeloId ?? ""} onChange={(e) => onChange({ ...data, modeloId: e.target.value })}>
          <option value="">Nenhum</option>
          {MODELOS_EMAIL.map((m) => (
            <option key={m.id} value={m.id}>{m.nome}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Quando enviar</label>
        <select className="input" value={data.quandoModo ?? "imediato"} onChange={(e) => onChange({ ...data, quandoModo: e.target.value as "imediato" | "apos_tempo" })}>
          <option value="imediato">Imediatamente</option>
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
          <select className="input" style={{ flex: 1 }} value={data.tempoUnidade ?? "horas"} onChange={(e) => onChange({ ...data, tempoUnidade: e.target.value })}>
            <option value="minutos">Minutos</option>
            <option value="horas">Horas</option>
            <option value="dias">Dias</option>
          </select>
        </div>
      ) : null}

      <div className="field">
        <label>Se o contato não tiver e-mail</label>
        <select className="input" value={data.seSemEmail ?? "continuar"} onChange={(e) => onChange({ ...data, seSemEmail: e.target.value as SeSemEmailModo })}>
          <option value="continuar">Continuar fluxo sem enviar</option>
          <option value="encerrar">Encerrar fluxo</option>
          <option value="criar_tarefa">Criar tarefa para o responsável</option>
          <option value="caminho_alternativo">Seguir por caminho alternativo</option>
        </select>
      </div>
    </div>
  );
}
