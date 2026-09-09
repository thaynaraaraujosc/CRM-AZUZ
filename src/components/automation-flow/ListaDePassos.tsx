"use client";

import { useMemo, useState } from "react";

import { IconClose } from "@/components/icons";
import { BLOCOS_DISPONIVEIS } from "@/lib/automation-flow/blocos";
import { resumoNo, saidasDoNo } from "@/lib/automation-flow/resumo";
import type { FlowEdge, FlowNode, FlowNodeType, ProblemaValidacao } from "@/lib/automation-flow/types";

/**
 * O fluxo como uma LISTA NUMERADA de passos, na ordem em que a pessoa é atendida.
 *
 * O quadro continua existindo e continua sendo onde se organiza o desenho. O que faltava era ler
 * a automação como uma conversa: 1, 2, 3, e o que acontece depois de cada resposta. Num quadro,
 * essa ordem só existe na cabeça de quem montou, e pra saber o que vem depois é preciso seguir
 * seta por seta.
 *
 * Ramificação vira lista dentro de lista, com o nome da saída em cima ("1 · Sim", "Outra
 * resposta"). Um passo que já apareceu antes não é numerado de novo: dois caminhos que se
 * reencontram são o MESMO passo, e repeti-lo faria parecer que a mensagem vai duas vezes.
 */

type Contadores = Record<string, number>;

export function ListaDePassos({
  nodes,
  edges,
  selecionadoId,
  problemasPorNode,
  contadores,
  somenteLeitura,
  onSelecionar,
  onAdicionar,
  onRemover,
}: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  selecionadoId: string | null;
  problemasPorNode: Map<string, ProblemaValidacao[]>;
  contadores: Contadores;
  somenteLeitura: boolean;
  onSelecionar: (id: string) => void;
  onAdicionar: (nodeOrigemId: string, handleId: string | undefined, tipo: FlowNodeType) => void;
  onRemover: (id: string) => void;
}) {
  const [menuEm, setMenuEm] = useState<{ nodeId: string; handleId?: string } | null>(null);
  const [busca, setBusca] = useState("");

  const porId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const saidasPorNode = useMemo(() => {
    const mapa = new Map<string, FlowEdge[]>();
    edges.forEach((e) => {
      if (!mapa.has(e.source)) mapa.set(e.source, []);
      mapa.get(e.source)!.push(e);
    });
    return mapa;
  }, [edges]);

  /** Onde a leitura começa: o gatilho, ou o único bloco em que ninguém entra (robô de etapa). */
  const inicio = useMemo(() => {
    const gatilho = nodes.find((n) => n.category === "gatilho");
    if (gatilho) return gatilho;
    const comEntrada = new Set(edges.map((e) => e.target));
    const entradas = nodes.filter((n) => !comEntrada.has(n.id));
    return entradas.length === 1 ? entradas[0] : null;
  }, [nodes, edges]);

  /** O 100% da porcentagem: quantas execuções chegaram no primeiro passo. */
  const totalDoTopo = useMemo(() => {
    if (!inicio) return 0;
    const primeiro = saidasPorNode.get(inicio.id)?.[0]?.target;
    return (primeiro ? contadores[primeiro] : 0) || contadores[inicio.id] || 0;
  }, [inicio, saidasPorNode, contadores]);

  const blocosDoMenu = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = BLOCOS_DISPONIVEIS.filter((b) => b.categoria !== "gatilho");
    if (!termo) return lista;
    return lista.filter(
      (b) => b.label.toLowerCase().includes(termo) || (b.descricao ?? "").toLowerCase().includes(termo),
    );
  }, [busca]);

  if (!inicio) {
    return (
      <div className="passos-vazio">
        <strong>Não dá pra ler este fluxo como lista.</strong>
        <p>
          Ou ele não tem gatilho nenhum, ou tem mais de um bloco solto sem nada entrando. Abra o
          modo Construir, ligue os blocos soltos e volte aqui.
        </p>
      </div>
    );
  }

  const jaVistos = new Set<string>();
  let contador = 0;

  function botaoAdicionar(nodeId: string, handleId: string | undefined, rotulo: string) {
    if (somenteLeitura) return null;
    const aberto = menuEm?.nodeId === nodeId && menuEm?.handleId === handleId;
    return (
      <div className="passos-add-area">
        <button
          type="button"
          className="passos-add"
          onClick={() => {
            setBusca("");
            setMenuEm(aberto ? null : { nodeId, handleId });
          }}
        >
          <span aria-hidden="true">+</span> {rotulo}
        </button>
        {aberto ? (
          <div className="passos-menu">
            <input
              className="input"
              placeholder="Buscar passo…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              autoFocus
            />
            <div className="passos-menu-lista">
              {blocosDoMenu.map((b) => (
                <button
                  key={b.tipo}
                  type="button"
                  className="passos-menu-item"
                  onClick={() => {
                    onAdicionar(nodeId, handleId, b.tipo);
                    setMenuEm(null);
                  }}
                >
                  <strong>{b.label}</strong>
                  <span>{b.descricao}</span>
                </button>
              ))}
              {blocosDoMenu.length === 0 ? <p className="hint">Nada com esse nome.</p> : null}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  /** Desenha um passo e, embaixo, o que vem depois dele. */
  function renderarPasso(node: FlowNode, profundidade: number): React.ReactNode {
    // Já numerado antes: dois caminhos que se reencontram são o mesmo passo.
    if (jaVistos.has(node.id)) {
      return (
        <div key={`volta-${node.id}`} className="passos-volta">
          ↩ volta para o passo {node.titulo || resumoNo(node) || node.type}
        </div>
      );
    }
    jaVistos.add(node.id);
    contador += 1;
    const numero = contador;

    const problemas = problemasPorNode.get(node.id) ?? [];
    const temErro = problemas.some((p) => p.severidade === "erro");
    const saidas = saidasDoNo(node);
    const arestas = saidasPorNode.get(node.id) ?? [];
    const passagens = contadores[node.id] ?? 0;
    const porcentagem = totalDoTopo > 0 ? Math.round((passagens / totalDoTopo) * 100) : null;

    return (
      <div key={node.id} className="passos-item">
        {passagens > 0 ? (
          <div className="passos-contador">
            Lançamentos: {passagens.toLocaleString("pt-BR")}
            {porcentagem !== null ? ` / ${porcentagem}%` : ""}
          </div>
        ) : null}

        <div
          className={`passos-cartao${selecionadoId === node.id ? " ativo" : ""}${temErro ? " com-erro" : ""}`}
        >
          <button type="button" className="passos-cartao-corpo" onClick={() => onSelecionar(node.id)}>
            <span className="passos-numero">{numero}</span>
            <span className="passos-texto">
              <span className="passos-titulo">{node.titulo || rotuloDoTipo(node.type)}</span>
              <span className="passos-resumo">{resumoNo(node) || "Ainda sem configuração"}</span>
              {temErro ? (
                <span className="passos-erro">{problemas.find((p) => p.severidade === "erro")?.mensagem}</span>
              ) : null}
            </span>
          </button>
          {somenteLeitura ? null : (
            <button
              type="button"
              className="passos-remover"
              aria-label={`Remover o passo ${numero}`}
              onClick={() => onRemover(node.id)}
            >
              <IconClose width={11} height={11} />
            </button>
          )}
        </div>

        {/* Uma saída só: o próximo passo vem logo abaixo, sem rótulo. Várias: cada uma vira um
            ramo com o nome dela, que é como a pessoa lê "se responder Sim, acontece isto". */}
        {saidas.length <= 1 ? (
          arestas.length ? (
            <div className="passos-seguinte">
              {arestas.map((aresta) => {
                const alvo = porId.get(aresta.target);
                return alvo ? renderarPasso(alvo, profundidade) : null;
              })}
            </div>
          ) : (
            botaoAdicionar(node.id, undefined, "Adicionar próximo passo")
          )
        ) : (
          <div className="passos-ramos">
            {saidas.map((saida) => {
              const aresta = arestas.find((e) => e.sourceHandle === saida.handleId);
              const alvo = aresta ? porId.get(aresta.target) : undefined;
              return (
                <div key={saida.handleId} className="passos-ramo">
                  <div className="passos-ramo-rotulo">{saida.label}</div>
                  {alvo ? (
                    renderarPasso(alvo, profundidade + 1)
                  ) : (
                    botaoAdicionar(node.id, saida.handleId, "Adicionar passo")
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const primeiraAresta = saidasPorNode.get(inicio.id) ?? [];

  return (
    <div className="passos">
      <div className="passos-inicio">
        <span className="passos-inicio-marca">▶</span>
        <div>
          <strong>{inicio.category === "gatilho" ? inicio.titulo || rotuloDoTipo(inicio.type) : "Iniciar robô"}</strong>
          <span>
            {inicio.category === "gatilho"
              ? resumoNo(inicio) || "Quando a automação começa"
              : "Quem dispara este robô é a etapa do funil"}
          </span>
        </div>
      </div>

      {primeiraAresta.length ? (
        primeiraAresta.map((aresta) => {
          const alvo = porId.get(aresta.target);
          return alvo ? renderarPasso(alvo, 0) : null;
        })
      ) : (
        botaoAdicionar(inicio.id, undefined, "Adicionar primeiro passo")
      )}
    </div>
  );
}

/** O nome do tipo do bloco, pra quando o passo ainda não ganhou título próprio. */
function rotuloDoTipo(tipo: FlowNodeType): string {
  return BLOCOS_DISPONIVEIS.find((b) => b.tipo === tipo)?.label ?? tipo;
}
