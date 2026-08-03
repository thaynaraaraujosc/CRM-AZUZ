"use client";

import { useState } from "react";

import { Modal } from "@/components/ui";
import { MODELOS_SEGMENTO, type ModeloSegmento } from "@/lib/configuracoes/mock";

/** "Modelo do segmento" (item 20) — galeria de modelos + painel de pré-visualização. "Aplicar modelo"
 * só atualiza um aviso local (front-end apenas), nunca mexe em dados reais do workspace. */
export function ModelosSegmento() {
  const [selecionado, setSelecionado] = useState<ModeloSegmento | null>(null);
  const [aplicado, setAplicado] = useState<string | null>(null);

  return (
    <div className="config-bloco">
      <p className="config-bloco-titulo">Modelo do segmento</p>
      <p className="hint mb14">Escolha um modelo inicial para adaptar o CRM ao seu tipo de negócio.</p>

      <div className="config-modelos-grid">
        {MODELOS_SEGMENTO.map((m) => (
          <button type="button" key={m.id} className="config-modelo-card" onClick={() => setSelecionado(m)}>
            <p className="n">{m.nome}</p>
            <p className="r">{m.descricao}</p>
            <div className="config-modelo-meta">
              <span>{m.funis.length} funi{m.funis.length === 1 ? "l" : "s"}</span>
              <span>{m.automacoes} automações</span>
              <span>{m.camposPersonalizados} campos</span>
              <span>{m.mensagensProntas} mensagens</span>
            </div>
            {aplicado === m.id ? <span className="pill on mt8">Aplicado</span> : null}
          </button>
        ))}
      </div>

      <Modal
        aberto={!!selecionado}
        onFechar={() => setSelecionado(null)}
        titulo={selecionado?.nome ?? ""}
        largura={560}
        rodape={
          <>
            <button type="button" className="btn ghost" onClick={() => setSelecionado(null)}>
              Visualizar estrutura
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                if (selecionado) setAplicado(selecionado.id);
                setSelecionado(null);
              }}
            >
              Aplicar modelo
            </button>
          </>
        }
      >
        {selecionado ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p className="hint">{selecionado.descricao}</p>
            <div className="field">
              <label>Funis incluídos</label>
              <p className="r">{selecionado.funis.length > 0 ? selecionado.funis.join(", ") : "Nenhum (personalizado)"}</p>
            </div>
            <div className="field">
              <label>Etapas</label>
              <p className="r">{selecionado.etapas.length > 0 ? selecionado.etapas.join(" → ") : "—"}</p>
            </div>
            <div className="field">
              <label>Etiquetas</label>
              <p className="r">{selecionado.etiquetas.length > 0 ? selecionado.etiquetas.join(", ") : "—"}</p>
            </div>
            <div className="field">
              <label>Indicadores incluídos</label>
              <p className="r">
                {selecionado.automacoes} automações · {selecionado.camposPersonalizados} campos personalizados · {selecionado.mensagensProntas}{" "}
                mensagens prontas · tarefas padrão do segmento
              </p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
