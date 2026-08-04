"use client";

import { useMemo, useState } from "react";

import { useContatos } from "@/lib/contatos-context";
import { useEquipe } from "@/lib/equipe-context";
import type { DestinoEnvioContato, MensagemContatoData, OrigemContatoEnvio } from "@/lib/automation-flow/types";
import { useEquipesDisponiveis } from "./useEquipesDisponiveis";

const CAMPOS_COMPARTILHAVEIS: { valor: string; label: string }[] = [
  { valor: "nome", label: "Nome" },
  { valor: "telefone", label: "Telefone" },
  { valor: "email", label: "E-mail" },
  { valor: "empresa", label: "Empresa" },
  { valor: "cargo", label: "Cargo" },
  { valor: "observacao", label: "Observação" },
  { valor: "endereco", label: "Endereço" },
  { valor: "campos_personalizados", label: "Campos personalizados" },
];

/** Ação "Enviar contato" (item 3) — qual contato compartilhar, quais dados dele, e pra quem enviar. */
export function MensagemContatoForm({ data, onChange }: { data: MensagemContatoData; onChange: (novo: MensagemContatoData) => void }) {
  const equipes = useEquipesDisponiveis();
  const { contatos } = useContatos();
  const { membros: equipe } = useEquipe();
  const [busca, setBusca] = useState(data.contatoBuscaTexto ?? "");
  const resultados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return [];
    return contatos.filter((c) => c.nome.toLowerCase().includes(termo) || c.whatsapp?.includes(termo) || c.email?.toLowerCase().includes(termo)).slice(0, 6);
  }, [busca, contatos]);

  function alternarCampo(valor: string) {
    const atual = data.camposCompartilhados ?? [];
    const novo = atual.includes(valor) ? atual.filter((c) => c !== valor) : [...atual, valor];
    onChange({ ...data, camposCompartilhados: novo });
  }

  return (
    <div className="flow-form">
      <div className="field">
        <label>Qual contato?</label>
        <select
          className="input"
          value={data.origemContato}
          onChange={(e) => onChange({ ...data, origemContato: e.target.value as OrigemContatoEnvio })}
        >
          <option value="atual">Contato/lead atual da automação</option>
          <option value="outro">Selecionar outro contato do CRM</option>
          <option value="campo_dinamico">Campo dinâmico</option>
        </select>
      </div>

      {data.origemContato === "outro" ? (
        <div className="field">
          <label>Buscar contato</label>
          <input
            className="input"
            placeholder="Buscar por nome, telefone ou e-mail…"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              onChange({ ...data, contatoBuscaTexto: e.target.value });
            }}
          />
          {resultados.length > 0 ? (
            <div className="filters-row" style={{ margin: "6px 0 0", flexWrap: "wrap" }}>
              {resultados.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`fchip${data.contatoSelecionadoNome === c.nome ? " active" : ""}`}
                  onClick={() => onChange({ ...data, contatoSelecionadoNome: c.nome })}
                >
                  {c.nome}
                </button>
              ))}
            </div>
          ) : null}
          {data.contatoSelecionadoNome ? <p className="hint" style={{ marginTop: 6 }}>Selecionado: {data.contatoSelecionadoNome}</p> : null}
        </div>
      ) : null}

      <div className="field">
        <label>Dados que serão compartilhados</label>
        <div className="filters-row" style={{ margin: "0 0 6px" }}>
          <button type="button" className="fchip" onClick={() => onChange({ ...data, camposCompartilhados: CAMPOS_COMPARTILHAVEIS.map((c) => c.valor) })}>Selecionar tudo</button>
          <button type="button" className="fchip" onClick={() => onChange({ ...data, camposCompartilhados: [] })}>Limpar seleção</button>
        </div>
        {CAMPOS_COMPARTILHAVEIS.map((c) => (
          <label key={c.valor} className="hint" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <input type="checkbox" checked={(data.camposCompartilhados ?? []).includes(c.valor)} onChange={() => alternarCampo(c.valor)} />
            {c.label}
          </label>
        ))}
      </div>

      <div className="field">
        <label>Para quem enviar?</label>
        <select className="input" value={data.destinoModo} onChange={(e) => onChange({ ...data, destinoModo: e.target.value as DestinoEnvioContato })}>
          <option value="conversa_atual">Contato atual da conversa</option>
          <option value="atendente">Atendente específico</option>
          <option value="equipe">Equipe</option>
          <option value="numero">Número específico</option>
        </select>
      </div>

      {data.destinoModo === "atendente" ? (
        <div className="field">
          <label>Atendente</label>
          <select className="input" value={data.destinoAtendente ?? ""} onChange={(e) => onChange({ ...data, destinoAtendente: e.target.value })}>
            <option value="">Selecione…</option>
            {equipe.map((m) => (
              <option key={m.id} value={m.nome}>{m.nome}</option>
            ))}
          </select>
        </div>
      ) : null}

      {data.destinoModo === "equipe" ? (
        <div className="field">
          <label>Equipe</label>
          <select className="input" value={data.destinoEquipe ?? ""} onChange={(e) => onChange({ ...data, destinoEquipe: e.target.value })}>
            <option value="">Selecione…</option>
            {equipes.map((nome) => (
              <option key={nome} value={nome}>{nome}</option>
            ))}
          </select>
        </div>
      ) : null}

      {data.destinoModo === "numero" ? (
        <div className="field">
          <label>Número (com DDD)</label>
          <input className="input" placeholder="Ex.: (62) 99999-0000" value={data.destinoNumero ?? ""} onChange={(e) => onChange({ ...data, destinoNumero: e.target.value })} />
        </div>
      ) : null}
    </div>
  );
}
