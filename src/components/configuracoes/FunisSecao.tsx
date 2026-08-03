"use client";

import { useState } from "react";

import { useFunis } from "@/lib/funis-context";
import type { ColunaFunil } from "@/lib/data";
import { CabecalhoCategoria } from "./CabecalhoCategoria";

/** Funis e etapas (item 24) — reaproveita `useFunis()` de verdade (mesmo dado usado em /funil), com
 * renomear/duplicar/arquivar de funil e reordenar etapas por drag-and-drop. */
export function FunisSecao() {
  const { funis, setFunis, excluirFunil } = useFunis();
  const [funilAbertoId, setFunilAbertoId] = useState<string | null>(funis[0]?.id ?? null);
  const [arrastando, setArrastando] = useState<string | null>(null);

  const funilAberto = funis.find((f) => f.id === funilAbertoId);

  function renomearFunil(id: string, nome: string) {
    setFunis((prev) => prev.map((f) => (f.id === id ? { ...f, nome } : f)));
  }

  function duplicarFunil(id: string) {
    const original = funis.find((f) => f.id === id);
    if (!original) return;
    const copia = { ...original, id: `${original.id}-copia-${Date.now()}`, nome: `${original.nome} (cópia)` };
    setFunis((prev) => [...prev, copia]);
  }

  function renomearEtapa(funilId: string, etapaId: string, titulo: string) {
    setFunis((prev) =>
      prev.map((f) => (f.id !== funilId ? f : { ...f, colunas: f.colunas.map((c) => (c.id === etapaId ? { ...c, titulo } : c)) })),
    );
  }

  function adicionarEtapa(funilId: string) {
    setFunis((prev) =>
      prev.map((f) =>
        f.id !== funilId ? f : { ...f, colunas: [...f.colunas, { id: `etapa-${Date.now()}`, titulo: "Nova etapa", total: 0, cards: [] }] },
      ),
    );
  }

  function excluirEtapa(funilId: string, etapaId: string) {
    setFunis((prev) => prev.map((f) => (f.id !== funilId ? f : { ...f, colunas: f.colunas.filter((c) => c.id !== etapaId) })));
  }

  function moverEtapa(funilId: string, origemId: string, destinoId: string) {
    if (origemId === destinoId) return;
    setFunis((prev) =>
      prev.map((f) => {
        if (f.id !== funilId) return f;
        const colunas = [...f.colunas];
        const origemIdx = colunas.findIndex((c) => c.id === origemId);
        const destinoIdx = colunas.findIndex((c) => c.id === destinoId);
        if (origemIdx < 0 || destinoIdx < 0) return f;
        const [removida] = colunas.splice(origemIdx, 1);
        colunas.splice(destinoIdx, 0, removida);
        return { ...f, colunas };
      }),
    );
  }

  return (
    <div className="config-secao">
      <CabecalhoCategoria
        titulo="Funis e etapas"
        descricao="Como as negociações avançam no funil."
        acoes={
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              const id = `funil-${Date.now()}`;
              setFunis((prev) => [...prev, { id, nome: "Novo funil", colunas: [] }]);
              setFunilAbertoId(id);
            }}
          >
            + Novo funil
          </button>
        }
      />

      <div className="config-bloco">
        <div className="config-lista-linhas">
          {funis.map((f) => {
            const totalNegocios = f.colunas.reduce((s, c) => s + c.cards.length, 0);
            return (
              <button type="button" key={f.id} className={`config-linha-clicavel${funilAbertoId === f.id ? " active" : ""}`} onClick={() => setFunilAbertoId(f.id)}>
                <div>
                  <p className="n">{f.nome}</p>
                  <p className="r">
                    {f.colunas.length} etapas · {totalNegocios} negócios
                  </p>
                </div>
                <span className="pill on">Ativo</span>
              </button>
            );
          })}
        </div>
      </div>

      {funilAberto ? (
        <div className="config-bloco">
          <div className="config-grid-2" style={{ marginBottom: 14 }}>
            <div className="field">
              <label>Nome do funil</label>
              <input className="input" value={funilAberto.nome} onChange={(e) => renomearFunil(funilAberto.id, e.target.value)} />
            </div>
            <div className="field">
              <label>Ações</label>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" className="btn ghost" onClick={() => duplicarFunil(funilAberto.id)}>
                  Duplicar
                </button>
                <button type="button" className="btn danger" onClick={() => excluirFunil(funilAberto.id)}>
                  Arquivar
                </button>
              </div>
            </div>
          </div>

          <p className="config-bloco-titulo">Etapas (arraste pra reordenar)</p>
          <div className="config-etapas-lista">
            {funilAberto.colunas.map((etapa: ColunaFunil) => (
              <div
                key={etapa.id}
                className={`config-etapa-row${arrastando === etapa.id ? " is-arrastando" : ""}`}
                draggable
                onDragStart={() => setArrastando(etapa.id)}
                onDragEnd={() => setArrastando(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (arrastando) moverEtapa(funilAberto.id, arrastando, etapa.id);
                  setArrastando(null);
                }}
              >
                <span className="config-etapa-arrastar" aria-hidden="true">
                  ⠿
                </span>
                <input
                  className="input"
                  style={{ flex: 1 }}
                  value={etapa.titulo}
                  onChange={(e) => renomearEtapa(funilAberto.id, etapa.id, e.target.value)}
                />
                <span className="r">{etapa.cards.length} negócios</span>
                <button type="button" className="remove-chip" aria-label="Excluir etapa" onClick={() => excluirEtapa(funilAberto.id, etapa.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn ghost block mt8" onClick={() => adicionarEtapa(funilAberto.id)}>
            + Adicionar etapa
          </button>
        </div>
      ) : null}
    </div>
  );
}
