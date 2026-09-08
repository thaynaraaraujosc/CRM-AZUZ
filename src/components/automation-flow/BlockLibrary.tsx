"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { BLOCOS_DISPONIVEIS, GRUPOS_BIBLIOTECA, buscarBlocos, type BlocoDefinicao } from "@/lib/automation-flow/blocos";
import type { FlowNodeType } from "@/lib/automation-flow/types";

/** Tipo MIME custom carregado no drag — o que a área do canvas lê no `onDrop`. */
export const FLOW_DND_MIME = "application/x-flow-node-type";

/**
 * "Mais usados" — a lista dos seis blocos que aparecem em quase toda automação comercial. É fixa,
 * não calculada: não há execução por bloco registrada em quantidade suficiente pra ranquear, e uma
 * lista que muda de ordem sozinha faria a pessoa procurar de novo a cada visita.
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
  const [iaDisponivel, setIaDisponivel] = useState(false);

  // Sem IA configurada no servidor, os blocos de IA não aparecem. Deixá-los na biblioteca faria
  // alguém montar um fluxo inteiro em volta de um bloco que, na hora de rodar, não manda nada.
  // Assim que a chave existir, eles aparecem sozinhos — não precisa mexer em código.
  useEffect(() => {
    let cancelado = false;
    fetch("/api/recursos", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ ia: boolean }>) : null))
      .then((dados) => {
        if (!cancelado && dados) setIaDisponivel(dados.ia);
      })
      .catch(() => {
        /* falha aqui só mantém os blocos de IA escondidos, que é o lado seguro do erro */
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const disponiveis = useMemo(
    () => (iaDisponivel ? BLOCOS_DISPONIVEIS : BLOCOS_DISPONIVEIS.filter((b) => !b.tipo.startsWith("ia_"))),
    [iaDisponivel],
  );

  const resultados = useMemo(
    () => buscarBlocos(busca).filter((b) => iaDisponivel || !b.tipo.startsWith("ia_")),
    [busca, iaDisponivel],
  );
  const buscando = busca.trim().length > 0;
  const maisUsados = useMemo(
    () => MAIS_USADOS.map((tipo) => disponiveis.find((b) => b.tipo === tipo)).filter((b): b is BlocoDefinicao => !!b),
    [disponiveis],
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
          {GRUPOS_BIBLIOTECA.map((cat) => (
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
              <span className={`flow-cat-dot flow-cat-${cat.cor}`} aria-hidden="true" />
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
            {GRUPOS_BIBLIOTECA.map((grupo) => {
              const blocos = disponiveis.filter((b) => b.grupo === grupo.id);
              // Grupo vazio não aparece. "Follow-up" só ganha bloco quando o gerador entra; até lá,
              // uma seção vazia só ocuparia espaço e faria a pessoa achar que faltou carregar algo.
              if (!blocos.length) return null;
              const fechada = categoriasFechadas.has(grupo.id);
              return (
                <div className="flow-lib-cat" key={grupo.id} data-flow-lib-cat={grupo.id}>
                  <button type="button" className="flow-lib-cat-h" onClick={() => alternarCategoria(grupo.id)} aria-expanded={!fechada}>
                    <span className={`flow-cat-dot flow-cat-${grupo.cor}`} aria-hidden="true" />
                    <span>{grupo.label}</span>
                    <span className="flow-lib-cat-n">{blocos.length}</span>
                    <span className="flow-lib-cat-arrow">{fechada ? "▸" : "▾"}</span>
                  </button>
                  {fechada ? null : (
                    <>
                      <p className="flow-lib-cat-ajuda">{grupo.ajuda}</p>
                      <BlocoSecao blocos={blocos} onAdicionarBloco={onAdicionarBloco} />
                    </>
                  )}
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
            e.currentTarget.classList.add("is-arrastando");
          }}
          onDragEnd={(e) => e.currentTarget.classList.remove("is-arrastando")}
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
