"use client";

import type { DestinatarioEmailModo, MensagemEmailData, SeSemEmailModo } from "@/lib/automation-flow/types";
import { IconAlerta } from "@/components/icons";
import { useIdioma } from "@/lib/idioma-context";

// Mocado: contas de e-mail configuradas no workspace, sem conexão real.
const CONTAS_EMAIL: string[] = [];

// Mocado: modelos de e-mail salvos, sem integração real.
const MODELOS_EMAIL = [
  { id: "proposta", nome: "Proposta pronta" },
  { id: "boas_vindas", nome: "Boas-vindas" },
  { id: "cobranca", nome: "Cobrança" },
];

/** Ação "Enviar e-mail" (item 5). O destinatário precisa estar ligado dinamicamente ao lead da
 * automação, não só um assunto/corpo soltos. */
export function MensagemEmailForm({ data, onChange }: { data: MensagemEmailData; onChange: (novo: MensagemEmailData) => void }) {
  const { t: traduzir } = useIdioma();
  return (
    <div className="flow-form">
      <div className="field">
        <label>{traduzir("Destinatário")}</label>
        <select className="input" value={data.destinatarioModo} onChange={(e) => onChange({ ...data, destinatarioModo: e.target.value as DestinatarioEmailModo })}>
          <option value="contato_email">{traduzir("E-mail do contato deste fluxo")}</option>
          <option value="outro_campo">{traduzir("Outro campo de e-mail do contato")}</option>
          <option value="especifico">{traduzir("E-mail específico")}</option>
          <option value="responsavel">{traduzir("Responsável do lead")}</option>
          <option value="campo_personalizado">{traduzir("Campo personalizado")}</option>
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
          <label>{traduzir("CCO")}</label>
          <input className="input" style={{ width: "100%" }} value={data.cco ?? ""} onChange={(e) => onChange({ ...data, cco: e.target.value })} />
        </div>
      </div>

      <div className="field">
        <label>{traduzir("Conta de envio (remetente)")}</label>
        {CONTAS_EMAIL.length === 0 ? (
          <p className="hint"><IconAlerta width={12} height={12} aria-hidden="true" /> {traduzir("Configure uma conta de e-mail antes de utilizar este bloco.")}</p>
        ) : (
          <select className="input" value={data.remetente ?? ""} onChange={(e) => onChange({ ...data, remetente: e.target.value })}>
            <option value="">{traduzir("Selecione…")}</option>
            {CONTAS_EMAIL.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      <div className="field">
        <label>{traduzir("Assunto")}</label>
        <input className="input" value={data.assunto} onChange={(e) => onChange({ ...data, assunto: e.target.value })} />
      </div>

      <div className="field">
        <label>{traduzir("Corpo do e-mail")}</label>
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
        <label>{traduzir("Usar modelo salvo")}</label>
        <select className="input" value={data.modeloId ?? ""} onChange={(e) => onChange({ ...data, modeloId: e.target.value })}>
          <option value="">{traduzir("Nenhum")}</option>
          {MODELOS_EMAIL.map((m) => (
            <option key={m.id} value={m.id}>{m.nome}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>{traduzir("Quando enviar")}</label>
        <select className="input" value={data.quandoModo ?? "imediato"} onChange={(e) => onChange({ ...data, quandoModo: e.target.value as "imediato" | "apos_tempo" })}>
          <option value="imediato">{traduzir("Imediatamente")}</option>
          <option value="apos_tempo">{traduzir("Após determinado tempo")}</option>
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
            <option value="minutos">{traduzir("Minutos")}</option>
            <option value="horas">{traduzir("Horas")}</option>
            <option value="dias">{traduzir("Dias")}</option>
          </select>
        </div>
      ) : null}

      <div className="field">
        <label>{traduzir("Se o contato não tiver e-mail")}</label>
        <select className="input" value={data.seSemEmail ?? "continuar"} onChange={(e) => onChange({ ...data, seSemEmail: e.target.value as SeSemEmailModo })}>
          <option value="continuar">{traduzir("Continuar fluxo sem enviar")}</option>
          <option value="encerrar">{traduzir("Encerrar fluxo")}</option>
          <option value="criar_tarefa">{traduzir("Criar tarefa para o responsável")}</option>
          <option value="caminho_alternativo">{traduzir("Seguir por caminho alternativo")}</option>
        </select>
      </div>
    </div>
  );
}
