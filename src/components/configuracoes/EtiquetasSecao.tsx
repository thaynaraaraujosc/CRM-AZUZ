"use client";

import { useMemo, useState } from "react";

import { useConfiguracoes } from "@/lib/configuracoes-context";
import { contatos, funis } from "@/lib/data";
import { CabecalhoCategoria } from "./CabecalhoCategoria";

const CORES = ["#2e6bff", "#0f9d63", "#d8a400", "#d64545", "#8a3ffc", "#0891b2"];

/** Etiquetas (item 26) — a contagem "quantidade de contatos" é real (deriva de `contatos`/`funis`);
 * criar/mesclar/arquivar etiqueta novas fica em estado local (`configuracoes-context`). */
export function EtiquetasSecao() {
  const { estado, adicionarEtiqueta, removerEtiqueta } = useConfiguracoes();
  const [busca, setBusca] = useState("");
  const [nomeNovo, setNomeNovo] = useState("");
  const [corNova, setCorNova] = useState(CORES[0]);

  const contagemReal = useMemo(() => {
    const mapa = new Map<string, number>();
    contatos.forEach((c) => c.etiquetas?.forEach((e) => mapa.set(e, (mapa.get(e) ?? 0) + 1)));
    funis.forEach((f) => f.colunas.forEach((col) => col.cards.forEach((card) => card.etiquetas?.forEach((e) => mapa.set(e, (mapa.get(e) ?? 0) + 1)))));
    return mapa;
  }, []);

  const todasEtiquetas = useMemo(() => {
    const doDados = [...contagemReal.keys()].map((nome) => ({ id: `real-${nome}`, nome, cor: CORES[nome.length % CORES.length], real: true }));
    const criadas = estado.etiquetasPersonalizadas.map((e) => ({ ...e, real: false }));
    return [...doDados, ...criadas].filter((e) => e.nome.toLowerCase().includes(busca.trim().toLowerCase()));
  }, [contagemReal, estado.etiquetasPersonalizadas, busca]);

  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo="Etiquetas" descricao="Marcações usadas em contatos, negócios e automações." />

      <div className="config-bloco">
        <input className="input" style={{ width: "100%", marginBottom: 12 }} placeholder="Buscar etiqueta…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <div className="config-etiquetas-lista">
          {todasEtiquetas.map((e) => (
            <div className="config-etiqueta-row" key={e.id}>
              <span className="config-etiqueta-cor" style={{ background: e.cor }} />
              <span className="n">{e.nome}</span>
              <span className="r">{contagemReal.get(e.nome) ?? 0} contatos</span>
              {!e.real ? (
                <button type="button" className="remove-chip" aria-label={`Remover ${e.nome}`} onClick={() => removerEtiqueta(e.id)}>
                  ✕
                </button>
              ) : (
                <span className="hint">usada nos dados</span>
              )}
            </div>
          ))}
          {todasEtiquetas.length === 0 ? <p className="hint">Nenhuma etiqueta encontrada.</p> : null}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
          <input className="input" placeholder="Nova etiqueta" style={{ flex: 1 }} value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} />
          <input className="input" type="color" value={corNova} onChange={(e) => setCorNova(e.target.value)} style={{ width: 44 }} />
          <button
            type="button"
            className="btn primary"
            disabled={!nomeNovo.trim()}
            onClick={() => {
              adicionarEtiqueta({ nome: nomeNovo, cor: corNova });
              setNomeNovo("");
            }}
          >
            + Criar
          </button>
        </div>
      </div>
    </div>
  );
}
