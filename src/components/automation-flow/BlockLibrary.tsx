"use client";

import { useMemo, useState, type ReactNode } from "react";

import { BLOCOS_DISPONIVEIS, CATEGORIAS_BLOCOS, buscarBlocos, type BlocoDefinicao } from "@/lib/automation-flow/blocos";
import type { FlowNodeType } from "@/lib/automation-flow/types";

/** Tipo MIME custom carregado no drag — o que a área do canvas lê no `onDrop`. */
export const FLOW_DND_MIME = "application/x-flow-node-type";

/**
 * "Mais usados" — mockado por enquanto (não há execuções reais registradas por bloco pra calcular
 * isso de verdade ainda). Reduz bastante a necessidade de procurar os itens mais comuns dentro das
 * 8 categorias.
 */
const MAIS_USADOS: FlowNodeType[] = [
  "mensagem_texto",
  "aguardar",
  "condicao_grupo",
  "alterar_etapa",
  "adicionar_etiqueta",
  "criar_tarefa",
];

export function BlockLibrary({
  aberta,
  onFechar,
  onAdicionarBloco,
}: {
  aberta: boolean;
  onFechar: () => void;
  onAdicionarBloco: (tipo: FlowNodeType) => void;
}) {
  const [busca, setBusca] = useState("");
  const [categoriasFechadas, setCategoriasFechadas] = useState<Set<string>>(new Set());

  const resultados = useMemo(() => buscarBlocos(busca), [busca]);
  const buscando = busca.trim().length > 0;
  const maisUsados = useMemo(
    () => MAIS_USADOS.map((tipo) => BLOCOS_DISPONIVEIS.find((b) => b.tipo === tipo)).filter((b): b is BlocoDefinicao => !!b),
    [],
  );

  function alternarCategoria(id: string) {
    setCategoriasFechadas((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  if (!aberta) {
    return (
      <aside className="flow-lib-recolhida" aria-label="Biblioteca de blocos (recolhida)">
        <button type="button" className="flow-lib-reabrir icon-btn" aria-label="Abrir biblioteca de blocos" onClick={onFechar}>
          ▶
        </button>
        <div className="flow-lib-recolhida-cats">
          {CATEGORIAS_BLOCOS.map((cat) => (
            <button
              type="button"
              key={cat.id}
              className="flow-lib-recolhida-cat"
              title={cat.label}
              aria-label={`Abrir biblioteca na categoria ${cat.label}`}
              onClick={() => {
                setCategoriasFechadas((prev) => {
                  const novo = new Set(prev);
                  novo.delete(cat.id);
                  return novo;
                });
                onFechar();
                // A biblioteca abre com todas as categorias já visíveis — só remover do
                // "fechadas" não rola até ela, então precisa esperar o próximo frame (depois
                // do painel reabrir) pra achar e rolar até a seção certa.
                requestAnimationFrame(() => {
                  document.querySelector(`[data-flow-lib-cat="${cat.id}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });
                });
              }}
            >
              <span className={`flow-cat-dot flow-cat-${cat.id}`} aria-hidden="true" />
            </button>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="flow-lib" aria-label="Biblioteca de blocos">
      <div className="flow-lib-head">
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="Buscar bloco…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label="Buscar bloco"
        />
        <button type="button" className="icon-btn subtle" aria-label="Recolher biblioteca de blocos" onClick={onFechar}>
          ◀
        </button>
      </div>

      <div className="flow-lib-lista">
        {buscando ? (
          <BlocoSecao
            titulo={`Resultados (${resultados.length})`}
            blocos={resultados}
            onAdicionarBloco={onAdicionarBloco}
            termoDestacado={busca}
          />
        ) : (
          <>
            <BlocoSecao titulo="Mais usados" blocos={maisUsados} onAdicionarBloco={onAdicionarBloco} />
            {CATEGORIAS_BLOCOS.map((cat) => {
              const blocos = BLOCOS_DISPONIVEIS.filter((b) => b.categoria === cat.id);
              const fechada = categoriasFechadas.has(cat.id);
              return (
                <div className="flow-lib-cat" key={cat.id} data-flow-lib-cat={cat.id}>
                  <button type="button" className="flow-lib-cat-h" onClick={() => alternarCategoria(cat.id)} aria-expanded={!fechada}>
                    <span className={`flow-cat-dot flow-cat-${cat.id}`} aria-hidden="true" />
                    <span>{cat.label}</span>
                    <span className="flow-lib-cat-n">{blocos.length}</span>
                    <span className="flow-lib-cat-arrow">{fechada ? "▸" : "▾"}</span>
                  </button>
                  {fechada ? null : <BlocoSecao blocos={blocos} onAdicionarBloco={onAdicionarBloco} />}
                </div>
              );
            })}
          </>
        )}
      </div>
    </aside>
  );
}

/** Envolve a parte do texto que bate com o termo buscado num <mark> — só na visão de resultados de busca. */
function destacarTermo(texto: string, termo: string): ReactNode {
  const t = termo.trim();
  if (!t) return texto;
  const indice = texto.toLowerCase().indexOf(t.toLowerCase());
  if (indice === -1) return texto;
  return (
    <>
      {texto.slice(0, indice)}
      <mark className="flow-lib-destaque">{texto.slice(indice, indice + t.length)}</mark>
      {texto.slice(indice + t.length)}
    </>
  );
}

function BlocoSecao({
  titulo,
  blocos,
  onAdicionarBloco,
  termoDestacado,
}: {
  titulo?: string;
  blocos: BlocoDefinicao[];
  onAdicionarBloco: (tipo: FlowNodeType) => void;
  termoDestacado?: string;
}) {
  return (
    <div>
      {titulo ? <p className="flow-lib-secao-titulo">{titulo}</p> : null}
      {blocos.map((b) => (
        <div
          key={b.tipo}
          className="flow-lib-bloco"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(FLOW_DND_MIME, b.tipo);
            e.dataTransfer.effectAllowed = "copy";
          }}
        >
          <div className={`flow-lib-bloco-icone flow-cat-${b.categoria}`} aria-hidden="true">
            {b.label.slice(0, 1).toUpperCase()}
          </div>
          <div className="flow-lib-bloco-texto">
            <span className="flow-lib-bloco-label">
              {termoDestacado ? destacarTermo(b.label, termoDestacado) : b.label}
            </span>
            <span className="flow-lib-bloco-desc">
              {termoDestacado ? destacarTermo(b.descricao, termoDestacado) : b.descricao}
            </span>
          </div>
          <button
            type="button"
            className="icon-btn subtle"
            aria-label={`Adicionar bloco ${b.label}`}
            onClick={() => onAdicionarBloco(b.tipo)}
          >
            +
          </button>
        </div>
      ))}
    </div>
  );
}
