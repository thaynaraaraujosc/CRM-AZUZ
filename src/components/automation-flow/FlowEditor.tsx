"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useAutomationFlows } from "@/lib/automation-flow-context";
import { BLOCOS_DISPONIVEIS } from "@/lib/automation-flow/blocos";
import { validarFluxo } from "@/lib/automation-flow/validacao";
import type {
  ConfiguracoesFluxo,
  FlowNode as DomainFlowNode,
  FlowNodeType,
  FluxoAutomacao,
  ProblemaValidacao,
  VersaoFluxo,
} from "@/lib/automation-flow/types";

import { BlockLibrary, FLOW_DND_MIME } from "./BlockLibrary";
import { ConfigPanel } from "./ConfigPanel";
import { HistoricoVersoes } from "./HistoricoVersoes";
import { Simulador } from "./Simulador";
import { Toolbar } from "./Toolbar";
import { nodeTypes } from "./nodes";
import {
  autoLayout,
  domainEdgesToRF,
  domainNodesToRF,
  novoIdAresta,
  novoIdNo,
  rfEdgesToDomain,
  rfNodesToDomain,
  type FlowRFEdge,
  type FlowRFNode,
} from "./utils";

const CORES_CATEGORIA: Record<string, string> = {
  gatilho: "#2e6bff",
  condicao: "#8b5cf6",
  mensagem: "#16a34a",
  espera: "#f59e0b",
  acao: "#ca8a04",
  humano: "#db2777",
  integracao: "#64748b",
  fim: "#dc2626",
};

type Snapshot = { nodes: FlowRFNode[]; edges: FlowRFEdge[] };

function FlowEditorInner({ fluxoId }: { fluxoId: string }) {
  const { fluxos, atualizarFluxo, publicarFluxo, restaurarVersao, alternarAtivo } = useAutomationFlows();
  const fluxo = fluxos.find((f) => f.id === fluxoId);
  const { screenToFlowPosition, fitView, setCenter } = useReactFlow();

  const [rfNodes, setRfNodes] = useState<FlowRFNode[]>(() => domainNodesToRF(fluxo?.nodes ?? []));
  const [rfEdges, setRfEdges] = useState<FlowRFEdge[]>(() => domainEdgesToRF(fluxo?.edges ?? []));
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [libAberta, setLibAberta] = useState(true);
  const [simuladorAberto, setSimuladorAberto] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [menuContexto, setMenuContexto] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [toasts, setToasts] = useState<{ id: number; texto: string }[]>([]);

  const historyRef = useRef<Snapshot[]>([{ nodes: rfNodes, edges: rfEdges }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  /** Espelha `historyRef.current.length` em estado — ref não pode ser lido durante o render (regra do React 19/compiler). */
  const [historyLen, setHistoryLen] = useState(1);
  const salvandoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipboardRef = useRef<DomainFlowNode[]>([]);
  const toastIdRef = useRef(0);

  function avisar(texto: string) {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev, { id, texto }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }

  function marcarSalvando(duracaoMs: number) {
    setSalvando(true);
    if (salvandoTimeoutRef.current) clearTimeout(salvandoTimeoutRef.current);
    salvandoTimeoutRef.current = setTimeout(() => setSalvando(false), duracaoMs);
  }

  function pushHistory(nodes: FlowRFNode[], edges: FlowRFEdge[]) {
    const cortado = historyRef.current.slice(0, historyIndex + 1);
    cortado.push({ nodes, edges });
    const limitado = cortado.length > 60 ? cortado.slice(cortado.length - 60) : cortado;
    historyRef.current = limitado;
    setHistoryIndex(limitado.length - 1);
    setHistoryLen(limitado.length);
  }

  /** Mudança estrutural (drag stop, conectar, excluir, adicionar bloco…) — persiste na hora e entra no histórico de undo/redo. */
  function persist(nodes: FlowRFNode[], edges: FlowRFEdge[]) {
    atualizarFluxo(fluxoId, { nodes: rfNodesToDomain(nodes), edges: rfEdgesToDomain(edges) });
    marcarSalvando(400);
    pushHistory(nodes, edges);
  }

  /** Edição de campo no painel de configuração — debounça a gravação (evita salvar/empilhar histórico a cada tecla). */
  function persistDebounced(nodes: FlowRFNode[], edges: FlowRFEdge[]) {
    setSalvando(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      atualizarFluxo(fluxoId, { nodes: rfNodesToDomain(nodes), edges: rfEdgesToDomain(edges) });
      pushHistory(nodes, edges);
      setSalvando(false);
    }, 500);
  }

  function undo() {
    if (historyIndex <= 0) return;
    const novoIndex = historyIndex - 1;
    const snap = historyRef.current[novoIndex];
    setRfNodes(snap.nodes);
    setRfEdges(snap.edges);
    setHistoryIndex(novoIndex);
    atualizarFluxo(fluxoId, { nodes: rfNodesToDomain(snap.nodes), edges: rfEdgesToDomain(snap.edges) });
    marcarSalvando(400);
  }
  function redo() {
    if (historyIndex >= historyRef.current.length - 1) return;
    const novoIndex = historyIndex + 1;
    const snap = historyRef.current[novoIndex];
    setRfNodes(snap.nodes);
    setRfEdges(snap.edges);
    setHistoryIndex(novoIndex);
    atualizarFluxo(fluxoId, { nodes: rfNodesToDomain(snap.nodes), edges: rfEdgesToDomain(snap.edges) });
    marcarSalvando(400);
  }

  /* --------------------------------------------------------------- canvas --- */

  function onNodesChange(changes: NodeChange<FlowRFNode>[]) {
    setRfNodes((nds) => applyNodeChanges(changes, nds));
  }
  function onEdgesChange(changes: EdgeChange<FlowRFEdge>[]) {
    setRfEdges((eds) => applyEdgeChanges(changes, eds));
  }
  function onConnect(connection: Connection) {
    const novaEdge: FlowRFEdge = {
      id: novoIdAresta(),
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle ?? undefined,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    };
    const novoEdges = addEdge(novaEdge, rfEdges);
    setRfEdges(novoEdges);
    persist(rfNodes, novoEdges);
  }
  function onNodeDragStop() {
    persist(rfNodes, rfEdges);
  }

  function removerNodes(ids: string[]) {
    const idsSet = new Set(ids);
    const novoNodes = rfNodes.filter((n) => !idsSet.has(n.id));
    const novoEdges = rfEdges.filter((e) => !idsSet.has(e.source) && !idsSet.has(e.target));
    setRfNodes(novoNodes);
    setRfEdges(novoEdges);
    setSelectedNodeIds((prev) => prev.filter((id) => !idsSet.has(id)));
    persist(novoNodes, novoEdges);
  }
  function onNodesDelete(deleted: FlowRFNode[]) {
    removerNodes(deleted.map((n) => n.id));
  }
  function onEdgesDelete(deleted: FlowRFEdge[]) {
    const idsSet = new Set(deleted.map((e) => e.id));
    const novoEdges = rfEdges.filter((e) => !idsSet.has(e.id));
    setRfEdges(novoEdges);
    persist(rfNodes, novoEdges);
  }

  function posicaoParaNovoBloco(): { x: number; y: number } {
    const selecionado = rfNodes.find((n) => n.id === selectedNodeIds[selectedNodeIds.length - 1]);
    if (selecionado) return { x: selecionado.position.x + 300, y: selecionado.position.y };
    if (rfNodes.length === 0) return { x: 80, y: 80 };
    const ultimo = rfNodes[rfNodes.length - 1];
    return { x: ultimo.position.x, y: ultimo.position.y + 160 };
  }

  function adicionarBloco(tipo: FlowNodeType, posicao?: { x: number; y: number }) {
    const bloco = BLOCOS_DISPONIVEIS.find((b) => b.tipo === tipo);
    if (!bloco) return;
    const pos = posicao ?? posicaoParaNovoBloco();
    const novoDomain: DomainFlowNode = {
      id: novoIdNo(),
      type: tipo,
      category: bloco.categoria,
      position: pos,
      data: bloco.dataPadrao() as Record<string, unknown>,
    };
    const novoRF: FlowRFNode = { id: novoDomain.id, type: novoDomain.category, position: pos, data: { flowNode: novoDomain, problemas: [] } };
    const novoNodes = [...rfNodes, novoRF];
    setRfNodes(novoNodes);
    setSelectedNodeIds([novoDomain.id]);
    persist(novoNodes, rfEdges);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const tipo = e.dataTransfer.getData(FLOW_DND_MIME) as FlowNodeType;
    if (!tipo) return;
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    adicionarBloco(tipo, pos);
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  function duplicarSelecionados() {
    if (selectedNodeIds.length === 0) return;
    const selecionados = rfNodes.filter((n) => selectedNodeIds.includes(n.id));
    const copias: FlowRFNode[] = selecionados.map((n) => {
      const id = novoIdNo();
      const pos = { x: n.position.x + 40, y: n.position.y + 40 };
      return { id, type: n.type, position: pos, data: { flowNode: { ...n.data.flowNode, id, position: pos }, problemas: [] } };
    });
    const novoNodes = [...rfNodes, ...copias];
    setRfNodes(novoNodes);
    setSelectedNodeIds(copias.map((c) => c.id));
    persist(novoNodes, rfEdges);
  }

  function copiarSelecionados() {
    clipboardRef.current = rfNodes.filter((n) => selectedNodeIds.includes(n.id)).map((n) => n.data.flowNode);
  }

  function colar() {
    if (clipboardRef.current.length === 0) return;
    const copias: FlowRFNode[] = clipboardRef.current.map((fn) => {
      const id = novoIdNo();
      const pos = { x: fn.position.x + 60, y: fn.position.y + 60 };
      return { id, type: fn.category, position: pos, data: { flowNode: { ...fn, id, position: pos }, problemas: [] } };
    });
    const novoNodes = [...rfNodes, ...copias];
    setRfNodes(novoNodes);
    setSelectedNodeIds(copias.map((c) => c.id));
    persist(novoNodes, rfEdges);
  }

  function organizarAutomaticamente() {
    const novo = autoLayout(rfNodes, rfEdges);
    setRfNodes(novo);
    persist(novo, rfEdges);
    requestAnimationFrame(() => fitView({ padding: 0.2, duration: 300 }));
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      const emCampoDeTexto = !!alvo && (["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName) || alvo.isContentEditable);
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }
      if (emCampoDeTexto) return;
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicarSelecionados();
        return;
      }
      if (mod && e.key.toLowerCase() === "c") {
        copiarSelecionados();
        return;
      }
      if (mod && e.key.toLowerCase() === "v") {
        colar();
        return;
      }
      if (e.key === "Escape") {
        setMenuContexto(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfNodes, rfEdges, selectedNodeIds, historyIndex]);

  /* -------------------------------------------------------- painel config --- */

  function updateNodeMeta(nodeId: string, patch: Partial<Pick<DomainFlowNode, "titulo" | "observacao">>) {
    const novo = rfNodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, flowNode: { ...n.data.flowNode, ...patch } } } : n));
    setRfNodes(novo);
    persistDebounced(novo, rfEdges);
  }
  function updateNodeData(nodeId: string, data: Record<string, unknown>) {
    const novo = rfNodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, flowNode: { ...n.data.flowNode, data } } } : n));
    setRfNodes(novo);
    persistDebounced(novo, rfEdges);
  }
  function removerOpcaoAresta(nodeId: string, opcaoId: string) {
    const novoEdges = rfEdges.filter((e) => !(e.source === nodeId && e.sourceHandle === opcaoId));
    setRfEdges(novoEdges);
    persistDebounced(rfNodes, novoEdges);
  }
  function updateFluxoMeta(patch: Partial<Pick<FluxoAutomacao, "nome" | "descricao" | "funilId" | "etapaId" | "categoria">>) {
    setSalvando(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      atualizarFluxo(fluxoId, patch);
      setSalvando(false);
    }, 500);
  }
  function updateConfiguracoes(patch: Partial<ConfiguracoesFluxo>) {
    setSalvando(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      atualizarFluxo(fluxoId, { configuracoes: { ...(fluxo?.configuracoes ?? {}), ...patch } });
      setSalvando(false);
    }, 500);
  }

  /* ------------------------------------------------------------- ações topo --- */

  function salvarRascunhoAgora() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    atualizarFluxo(fluxoId, { nodes: rfNodesToDomain(rfNodes), edges: rfEdgesToDomain(rfEdges) });
    setSalvando(false);
    avisar("Rascunho salvo.");
  }

  function publicar() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    atualizarFluxo(fluxoId, { nodes: rfNodesToDomain(rfNodes), edges: rfEdgesToDomain(rfEdges) });
    setSalvando(false);
    // setTimeout(0) garante que `publicarFluxo` (que lê o estado do contexto) já
    // enxerga o `atualizarFluxo` de cima — os dois não podem rodar na mesma
    // atualização em lote do React.
    setTimeout(() => {
      const resultado = publicarFluxo(fluxoId, "Você");
      const erros = resultado.filter((p) => p.severidade === "erro");
      if (erros.length > 0) {
        avisar(`Não deu pra publicar: ${erros.length} problema(s) — veja a aba "Problemas" no painel à direita.`);
      } else {
        avisar("Fluxo publicado com sucesso.");
      }
    }, 0);
  }

  function restaurar(versao: VersaoFluxo) {
    const novoNodes = domainNodesToRF(versao.nodes);
    const novoEdges = domainEdgesToRF(versao.edges);
    setRfNodes(novoNodes);
    setRfEdges(novoEdges);
    restaurarVersao(fluxoId, versao.versao);
    pushHistory(novoNodes, novoEdges);
    setHistoricoAberto(false);
    avisar(`Versão ${versao.versao} restaurada.`);
  }

  /* ------------------------------------------------------------- derivados --- */

  const domainNodesAtuais = useMemo(() => rfNodesToDomain(rfNodes), [rfNodes]);
  const domainEdgesAtuais = useMemo(() => rfEdgesToDomain(rfEdges), [rfEdges]);
  const problemas: ProblemaValidacao[] = useMemo(() => {
    if (!fluxo) return [];
    return validarFluxo({ ...fluxo, nodes: domainNodesAtuais, edges: domainEdgesAtuais });
  }, [fluxo, domainNodesAtuais, domainEdgesAtuais]);
  const problemasPorNode = useMemo(() => {
    const m = new Map<string, ProblemaValidacao[]>();
    problemas.forEach((p) => {
      if (!p.nodeId) return;
      if (!m.has(p.nodeId)) m.set(p.nodeId, []);
      m.get(p.nodeId)!.push(p);
    });
    return m;
  }, [problemas]);
  const nodesParaRenderizar = useMemo(
    () => rfNodes.map((n) => ({ ...n, data: { ...n.data, problemas: problemasPorNode.get(n.id) ?? [] } })),
    [rfNodes, problemasPorNode],
  );
  const selectedNodes = useMemo(
    () => rfNodes.filter((n) => selectedNodeIds.includes(n.id)).map((n) => ({ ...n.data.flowNode, position: n.position })),
    [rfNodes, selectedNodeIds],
  );
  const fluxoParaSimular = useMemo(
    () => (fluxo ? { ...fluxo, nodes: domainNodesAtuais, edges: domainEdgesAtuais } : null),
    [fluxo, domainNodesAtuais, domainEdgesAtuais],
  );

  if (!fluxo) {
    return (
      <div className="flow-shell-empty">
        <p>Esse fluxo não existe (mais).</p>
      </div>
    );
  }

  return (
    <div className="flow-shell">
      <Toolbar
        nome={fluxo.nome}
        onChangeNome={(nome) => updateFluxoMeta({ nome })}
        status={fluxo.status}
        salvando={salvando}
        ativa={fluxo.ativa}
        podeAtivar={fluxo.status === "publicado"}
        onToggleAtiva={() => alternarAtivo(fluxoId)}
        podeDesfazer={historyIndex > 0}
        podeRefazer={historyIndex < historyLen - 1}
        onUndo={undo}
        onRedo={redo}
        onTestar={() => setSimuladorAberto(true)}
        onSalvarRascunho={salvarRascunhoAgora}
        onPublicar={publicar}
        onAbrirHistorico={() => setHistoricoAberto(true)}
        onOrganizarAutomaticamente={organizarAutomaticamente}
      />

      <div className="flow-body">
        <BlockLibrary aberta={libAberta} onFechar={() => setLibAberta((v) => !v)} onAdicionarBloco={(tipo) => adicionarBloco(tipo)} />

        <div className="flow-canvas" onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodesParaRenderizar}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            onNodesDelete={onNodesDelete}
            onEdgesDelete={onEdgesDelete}
            onSelectionChange={({ nodes }) => {
              const ids = nodes.map((n) => n.id);
              setSelectedNodeIds((prev) =>
                prev.length === ids.length && prev.every((id, i) => id === ids[i])
                  ? prev
                  : ids,
              );
            }}
            onNodeContextMenu={(e, node) => {
              e.preventDefault();
              setSelectedNodeIds([node.id]);
              setMenuContexto({ x: e.clientX, y: e.clientY, nodeId: node.id });
            }}
            onPaneClick={() => setMenuContexto(null)}
            deleteKeyCode={["Delete", "Backspace"]}
            multiSelectionKeyCode={["Shift", "Meta", "Control"]}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={18} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeColor={(n) => CORES_CATEGORIA[String(n.type)] ?? "#94a3b8"} />
            <Panel position="top-right">
              <button type="button" className="btn ghost" onClick={() => setCenter(0, 0, { zoom: 1, duration: 300 })}>
                Centralizar
              </button>
            </Panel>
            {selectedNodeIds.length > 0 ? (
              <Panel position="top-center">
                <div className="flow-selection-bar">
                  <span>{selectedNodeIds.length} selecionado(s)</span>
                  <button type="button" className="btn ghost" onClick={duplicarSelecionados}>
                    Duplicar
                  </button>
                  <button type="button" className="btn ghost" onClick={() => removerNodes(selectedNodeIds)}>
                    Excluir
                  </button>
                </div>
              </Panel>
            ) : null}
          </ReactFlow>

          {menuContexto ? (
            <div className="flow-ctx-menu" style={{ top: menuContexto.y, left: menuContexto.x }}>
              <button
                type="button"
                onClick={() => {
                  duplicarSelecionados();
                  setMenuContexto(null);
                }}
              >
                Duplicar
              </button>
              <button
                type="button"
                onClick={() => {
                  removerNodes([menuContexto.nodeId]);
                  setMenuContexto(null);
                }}
              >
                Excluir
              </button>
            </div>
          ) : null}
        </div>

        <ConfigPanel
          fluxo={fluxo}
          selectedNodes={selectedNodes}
          problemas={problemas}
          onUpdateFluxoMeta={updateFluxoMeta}
          onUpdateConfiguracoes={updateConfiguracoes}
          onUpdateNode={updateNodeMeta}
          onUpdateNodeData={updateNodeData}
          onRemoverOpcaoAresta={removerOpcaoAresta}
          onSelecionarNode={(nodeId) => setSelectedNodeIds([nodeId])}
        />
      </div>

      {simuladorAberto && fluxoParaSimular ? <Simulador fluxo={fluxoParaSimular} onFechar={() => setSimuladorAberto(false)} /> : null}
      {historicoAberto ? (
        <HistoricoVersoes
          versoes={fluxo.historicoVersoes}
          versaoAtual={fluxo.versaoAtual}
          onFechar={() => setHistoricoAberto(false)}
          onRestaurar={restaurar}
        />
      ) : null}

      {toasts.length > 0 ? (
        <div className="toast-stack">
          {toasts.map((t) => (
            <div className="toast" key={t.id}>
              {t.texto}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function FlowEditor({ fluxoId }: { fluxoId: string }) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner fluxoId={fluxoId} />
    </ReactFlowProvider>
  );
}
