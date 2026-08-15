"use client";

import type { MensagemLocalizacaoData, OrigemLocalizacao } from "@/lib/automation-flow/types";

// Mocado — localizações salvas do workspace, sem integração real com mapa.
const LOCALIZACOES_SALVAS = [
  { id: "sede", nome: "Sede", endereco: "Av. Exemplo, 123", cidade: "Goiânia", estado: "GO" },
  { id: "unidade_centro", nome: "Unidade Centro", endereco: "Rua das Flores, 45", cidade: "Goiânia", estado: "GO" },
  { id: "consultorio_principal", nome: "Consultório principal", endereco: "Av. T-4, 900", cidade: "Goiânia", estado: "GO" },
  { id: "escritorio", nome: "Escritório", endereco: "Rua 9, 320", cidade: "Goiânia", estado: "GO" },
];

const LOCALIZACAO_WORKSPACE = { nome: "Sede", endereco: "Av. Exemplo, 123", cidade: "Goiânia", estado: "GO" };

/** Ação "Enviar localização" (item 4) — de onde vem a localização enviada ao contato. */
export function MensagemLocalizacaoForm({ data, onChange }: { data: MensagemLocalizacaoData; onChange: (novo: MensagemLocalizacaoData) => void }) {
  const salva = LOCALIZACOES_SALVAS.find((l) => l.id === data.localSalvoId);

  let preview: { nome: string; endereco?: string; cidadeEstado?: string } | null = null;
  if (data.origem === "salva" && salva) {
    preview = { nome: salva.nome, endereco: salva.endereco, cidadeEstado: `${salva.cidade}/${salva.estado}` };
  } else if (data.origem === "workspace") {
    preview = { nome: LOCALIZACAO_WORKSPACE.nome, endereco: LOCALIZACAO_WORKSPACE.endereco, cidadeEstado: `${LOCALIZACAO_WORKSPACE.cidade}/${LOCALIZACAO_WORKSPACE.estado}` };
  } else if (data.origem === "endereco" && data.nomeLocal) {
    const cidadeEstado = [data.cidade, data.estado].filter(Boolean).join("/");
    preview = { nome: data.nomeLocal, endereco: data.endereco, cidadeEstado: cidadeEstado || undefined };
  } else if (data.origem === "coordenadas" && data.latitude && data.longitude) {
    preview = { nome: "Coordenadas", endereco: `${data.latitude}, ${data.longitude}` };
  }

  return (
    <div className="flow-form">
      <div className="field">
        <label>Origem da localização</label>
        <select className="input" value={data.origem} onChange={(e) => onChange({ ...data, origem: e.target.value as OrigemLocalizacao })}>
          <option value="salva">Localização salva</option>
          <option value="workspace">Localização do workspace</option>
          <option value="endereco">Informar endereço</option>
          <option value="coordenadas">Coordenadas</option>
        </select>
      </div>

      {data.origem === "salva" ? (
        <div className="field">
          <label>Localização salva</label>
          <select className="input" value={data.localSalvoId ?? ""} onChange={(e) => onChange({ ...data, localSalvoId: e.target.value })}>
            <option value="">Selecione…</option>
            {LOCALIZACOES_SALVAS.map((l) => (
              <option key={l.id} value={l.id}>{l.nome}</option>
            ))}
          </select>
        </div>
      ) : null}

      {data.origem === "workspace" ? (
        <p className="hint">Usa a localização cadastrada em Configurações do workspace: {LOCALIZACAO_WORKSPACE.nome} — {LOCALIZACAO_WORKSPACE.endereco}, {LOCALIZACAO_WORKSPACE.cidade}/{LOCALIZACAO_WORKSPACE.estado}.</p>
      ) : null}

      {data.origem === "endereco" ? (
        <>
          <div className="field">
            <label>Nome do local</label>
            <input className="input" placeholder="Ex.: Sede" value={data.nomeLocal ?? ""} onChange={(e) => onChange({ ...data, nomeLocal: e.target.value })} />
          </div>
          <div className="field">
            <label>Endereço</label>
            <input className="input" value={data.endereco ?? ""} onChange={(e) => onChange({ ...data, endereco: e.target.value })} />
          </div>
          <div className="field" style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label>Número</label>
              <input className="input" style={{ width: "100%" }} value={data.numero ?? ""} onChange={(e) => onChange({ ...data, numero: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Complemento</label>
              <input className="input" style={{ width: "100%" }} value={data.complemento ?? ""} onChange={(e) => onChange({ ...data, complemento: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>Bairro</label>
            <input className="input" value={data.bairro ?? ""} onChange={(e) => onChange({ ...data, bairro: e.target.value })} />
          </div>
          <div className="field" style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label>Cidade</label>
              <input className="input" style={{ width: "100%" }} value={data.cidade ?? ""} onChange={(e) => onChange({ ...data, cidade: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Estado</label>
              <input className="input" style={{ width: "100%" }} value={data.estado ?? ""} onChange={(e) => onChange({ ...data, estado: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>CEP</label>
            <input className="input" value={data.cep ?? ""} onChange={(e) => onChange({ ...data, cep: e.target.value })} />
          </div>
        </>
      ) : null}

      {data.origem === "coordenadas" ? (
        <div className="field" style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label>Latitude</label>
            <input className="input" style={{ width: "100%" }} value={data.latitude ?? ""} onChange={(e) => onChange({ ...data, latitude: e.target.value })} />
          </div>
          <div style={{ flex: 1 }}>
            <label>Longitude</label>
            <input className="input" style={{ width: "100%" }} value={data.longitude ?? ""} onChange={(e) => onChange({ ...data, longitude: e.target.value })} />
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className="field">
          <label>Pré-visualização</label>
          <div className="hint" style={{ border: "1px solid var(--line-soft)", borderRadius: 8, padding: 10 }}>
            <strong>📍 {preview.nome}</strong>
            {preview.endereco ? <div>{preview.endereco}</div> : null}
            {preview.cidadeEstado ? <div>{preview.cidadeEstado}</div> : null}
          </div>
        </div>
      ) : null}

      <div className="toggle-row">
        <span className="tl">Adicionar legenda/mensagem?</span>
        <button
          type="button"
          role="switch"
          aria-checked={!!data.temMensagem}
          className={`toggle${data.temMensagem ? " on" : ""}`}
          onClick={() => onChange({ ...data, temMensagem: !data.temMensagem })}
        >
          <span className="knob" />
        </button>
      </div>

      {data.temMensagem ? (
        <div className="field">
          <textarea
            className="input"
            style={{ width: "100%", minHeight: 60, resize: "vertical" }}
            placeholder="Ex.: Estamos te esperando neste endereço."
            value={data.mensagem ?? ""}
            onChange={(e) => onChange({ ...data, mensagem: e.target.value })}
          />
        </div>
      ) : null}
    </div>
  );
}
