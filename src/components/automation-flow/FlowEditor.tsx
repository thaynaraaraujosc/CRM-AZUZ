"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  ControlButton,
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
import { resumoNo, saidasDoNo } from "@/lib/automation-flow/resumo";
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
  CORES_CATEGORIA,
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

type Snapshot = { nodes: FlowRFNode[]; edges: FlowRFEdge[] };

/**
 * Gatilhos mais comuns, na ordem sugerida pro fluxo guiado de primeira automação — evita jogar as 31
 * opções de gatilho de uma vez só pra quem está começando. "Ver todos os gatilhos" continua abrindo a
 * biblioteca completa (nada fica escondido, só não é a primeira coisa que aparece).
 */
const GATILHOS_COMUNS: FlowNodeType[] = [
  "mensagem_recebida",
  "lead_criado",
  "lead_entrou_etapa",
  "lead_saiu_etapa",
  "lead_respondeu",
  "lead_nao_respondeu",
  "etiqueta_adicionada",
  "campo_alterado",
  "horario_programado",
];

/** Ações mais comuns no botão "+" ("O que acontece agora?") — o resto continua na biblioteca completa. */
const ACOES_COMUNS: FlowNodeType[] = [
  "mensagem_texto",
  "mensagem_botoes",
  "aguardar",
  "condicao_grupo",
  "alterar_etapa",
  "adicionar_etiqueta",
  "criar_tarefa",
];

/** Frase curta pro modo "Entender fluxo" (item 24) — mesma frase de resumoNo(), só emoldurada por
 * categoria pra ler como narrativa ("Começa quando...", "Verifica...", "Envia...") em vez de um
 * fragmento solto. */
function explicacaoDoNo(flowNode: DomainFlowNode): string {
  const resumo = resumoNo(flowNode);
  switch (flowNode.category) {
    case "gatilho":
      return `Começa quando: ${resumo}`;
    case "condicao":
      return `Verifica: ${resumo}`;
    case "mensagem":
      return flowNode.type === "mensagem_botoes" || flowNode.type === "mensagem_lista"
        ? `Pergunta e espera a resposta: ${resumo}`
        : `Envia: ${resumo}`;
    case "espera":
      return `Aguarda: ${resumo}`;
    case "humano":
      return `Encaminha pra uma pessoa: ${resumo}`;
    case "integracao":
      return `Chama um sistema externo: ${resumo}`;
    case "fim":
      return "Termina esse caminho aqui.";
    default:
      return `Executa: ${resumo}`;
  }
}

function FlowEditorInner({ fluxoId }: { fluxoId: string }) {
  const { fluxos, atualizarFluxo, publicarFluxo, restaurarVersao, alternarAtivo } = useAutomationFlows();
  const fluxo = fluxos.find((f) => f.id === fluxoId);
  const { screenToFlowPosition, fitView, setCenter, zoomIn, zoomOut } = useReactFlow();

  const [rfNodes, setRfNodes] = useState<FlowRFNode[]>(() => domainNodesToRF(fluxo?.nodes ?? []));
  const [rfEdges, setRfEdges] = useState<FlowRFEdge[]>(() => domainEdgesToRF(fluxo?.edges ?? []));
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [libAberta, setLibAberta] = useState(true);
  const [simuladorAberto, setSimuladorAberto] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [menuContexto, setMenuContexto] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [toasts, setToasts] = useState<{ id: number; texto: string }[]>([]);
  const [escolherGatilhoAberto, setEscolherGatilhoAberto] = useState(false);
  const [acaoRapida, setAcaoRapida] = useState<{ nodeId: string; handleId: string | undefined } | null>(null);
  const [minimapaVisivel, setMinimapaVisivel] = useState(true);
  const [arrastandoSobreCanvas, setArrastandoSobreCanvas] = useState(false);
  const [entenderFluxoAtivo, setEntenderFluxoAtivo] = useState(false);
  /** Modo Visualizar (item 25): mesmo canvas, mas sem nada editável — sem arrastar bloco da
   * biblioteca, sem menu de contexto, sem botão "+", sem arrastar node. Útil pra revisar o fluxo
   * com alguém sem risco de mexer em nada sem querer. */
  const [modoConstrucao, setModoConstrucao] = useState(true);

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
  function alternarDesativado(nodeId: string) {
    const novoNodes = rfNodes.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, flowNode: { ...n.data.flowNode, desativado: !n.data.flowNode.desativado } } } : n,
    );
    setRfNodes(novoNodes);
    persist(novoNodes, rfEdges);
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

  /** "O que acontece agora?" (botão + depois de um node) — cria o bloco já conectado à saída clicada. */
  function adicionarBlocoConectado(tipo: FlowNodeType, nodeOrigemId: string, handleId: string | undefined) {
    const bloco = BLOCOS_DISPONIVEIS.find((b) => b.tipo === tipo);
    const origem = rfNodes.find((n) => n.id === nodeOrigemId);
    if (!bloco || !origem) return;
    const pos = { x: origem.position.x, y: origem.position.y + 170 };
    const novoDomain: DomainFlowNode = {
      id: novoIdNo(),
      type: tipo,
      category: bloco.categoria,
      position: pos,
      data: bloco.dataPadrao() as Record<string, unknown>,
    };
    const novoRF: FlowRFNode = { id: novoDomain.id, type: novoDomain.category, position: pos, data: { flowNode: novoDomain, problemas: [] } };
    const novaEdge: FlowRFEdge = {
      id: novoIdAresta(),
      source: nodeOrigemId,
      target: novoDomain.id,
      sourceHandle: handleId,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    };
    const novoNodes = [...rfNodes, novoRF];
    const novoEdges = [...rfEdges, novaEdge];
    setRfNodes(novoNodes);
    setRfEdges(novoEdges);
    setSelectedNodeIds([novoDomain.id]);
    persist(novoNodes, novoEdges);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setArrastandoSobreCanvas(false);
    if (!modoConstrucao) return;
    const tipo = e.dataTransfer.getData(FLOW_DND_MIME) as FlowNodeType;
    if (!tipo) return;
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    adicionarBloco(tipo, pos);
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!modoConstrucao) return;
    e.dataTransfer.dropEffect = "copy";
    if (!arrastandoSobreCanvas) setArrastandoSobreCanvas(true);
  }
  function onDragLeave(e: React.DragEvent) {
    // Só desliga o destaque quando sai de fato da área do canvas — dragleave também dispara ao passar
    // por cima de um node/filho dentro dela, e não queremos piscar o destaque nesses casos.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setArrastandoSobreCanvas(false);
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
      if (!modoConstrucao) return;
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
        setEscolherGatilhoAberto(false);
        setAcaoRapida(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfNodes, rfEdges, selectedNodeIds, historyIndex, modoConstrucao]);

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
  /** Quais saídas (por nó) já têm uma aresta indo pra algum lugar — o botão "+" só aparece nas que não têm. */
  const saidasConectadasPorNode = useMemo(() => {
    const m = new Map<string, Set<string>>();
    rfEdges.forEach((e) => {
      if (!e.source) return;
      const chave = e.sourceHandle ?? "__default__";
      if (!m.has(e.source)) m.set(e.source, new Set());
      m.get(e.source)!.add(chave);
    });
    return m;
  }, [rfEdges]);
  /** Ordem narrativa (1, 2, 3...) pro modo "Entender fluxo" — BFS a partir dos gatilhos, seguindo as
   * arestas na ordem em que aparecem; um node já visitado (branches que se reencontram) não ganha
   * um segundo número. */
  const ordemNarrativaPorNode = useMemo(() => {
    if (!entenderFluxoAtivo) return null;
    const m = new Map<string, number>();
    const porOrigem = new Map<string, string[]>();
    rfEdges.forEach((e) => {
      if (!e.source || !e.target) return;
      if (!porOrigem.has(e.source)) porOrigem.set(e.source, []);
      porOrigem.get(e.source)!.push(e.target);
    });
    const fila = rfNodes.filter((n) => n.data.flowNode.category === "gatilho").map((n) => n.id);
    let proximo = 1;
    while (fila.length > 0) {
      const atual = fila.shift()!;
      if (m.has(atual)) continue;
      m.set(atual, proximo);
      proximo += 1;
      (porOrigem.get(atual) ?? []).forEach((destino) => {
        if (!m.has(destino)) fila.push(destino);
      });
    }
    return m;
  }, [entenderFluxoAtivo, rfNodes, rfEdges]);
  /** Quantos caminhos diferentes chegam em cada node — >1 quer dizer que branches diferentes se
   * reencontram ali (item 31), o que merece um aviso visual em vez de parecer só mais uma seta. */
  const entradasPorNode = useMemo(() => {
    const m = new Map<string, number>();
    rfEdges.forEach((e) => {
      if (!e.target) return;
      m.set(e.target, (m.get(e.target) ?? 0) + 1);
    });
    return m;
  }, [rfEdges]);
  /**
   * Com exatamente 1 node selecionado, destaca ele + vizinhos diretos (quem alimenta e quem recebe
   * dele) e apaga levemente o resto — ajuda a acompanhar o fluxo em automações com muitos nós/
   * conexões cruzando a tela. Com 0 ou 2+ selecionados (seleção múltipla), não apaga nada.
   */
  const nodesRelacionados = useMemo(() => {
    if (selectedNodeIds.length !== 1) return null;
    const [alvo] = selectedNodeIds;
    const relacionados = new Set<string>([alvo]);
    rfEdges.forEach((e) => {
      if (e.source === alvo && e.target) relacionados.add(e.target);
      if (e.target === alvo && e.source) relacionados.add(e.source);
    });
    return relacionados;
  }, [selectedNodeIds, rfEdges]);
  const arestasRelacionadas = useMemo(() => {
    if (selectedNodeIds.length !== 1) return null;
    const [alvo] = selectedNodeIds;
    return new Set(rfEdges.filter((e) => e.source === alvo || e.target === alvo).map((e) => e.id));
  }, [selectedNodeIds, rfEdges]);
  const nodesParaRenderizar = useMemo(
    () =>
      rfNodes.map((n) => ({
        ...n,
        className: nodesRelacionados && !nodesRelacionados.has(n.id) ? "flow-node-apagado" : undefined,
        data: {
          ...n.data,
          problemas: problemasPorNode.get(n.id) ?? [],
          saidasConectadas: saidasConectadasPorNode.get(n.id),
          caminhosConvergindo: entradasPorNode.get(n.id) ?? 0,
          ordemNarrativa: ordemNarrativaPorNode?.get(n.id),
          explicacao: entenderFluxoAtivo ? explicacaoDoNo(n.data.flowNode) : undefined,
          onAdicionarApos: modoConstrucao ? (handleId: string | undefined) => setAcaoRapida({ nodeId: n.id, handleId }) : undefined,
        },
      })),
    [rfNodes, problemasPorNode, saidasConectadasPorNode, entradasPorNode, ordemNarrativaPorNode, entenderFluxoAtivo, nodesRelacionados, modoConstrucao],
  );
  const edgesParaRenderizar = useMemo(
    () =>
      rfEdges.map((e) => ({
        ...e,
        className: arestasRelacionadas && !arestasRelacionadas.has(e.id) ? "flow-edge-apagada" : undefined,
        zIndex: arestasRelacionadas?.has(e.id) ? 1 : 0,
      })),
    [rfEdges, arestasRelacionadas],
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
        entenderFluxoAtivo={entenderFluxoAtivo}
        onAlternarEntenderFluxo={() => setEntenderFluxoAtivo((v) => !v)}
        modoConstrucao={modoConstrucao}
        onAlternarModo={() => setModoConstrucao((v) => !v)}
      />

      <div className="flow-body">
        {modoConstrucao ? (
          <BlockLibrary aberta={libAberta} onFechar={() => setLibAberta((v) => !v)} onAdicionarBloco={(tipo) => adicionarBloco(tipo)} />
        ) : null}

        <div
          className={`flow-canvas${arrastandoSobreCanvas ? " flow-canvas-recebendo" : ""}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
        >
          <ReactFlow
            nodes={nodesParaRenderizar}
            edges={edgesParaRenderizar}
            nodeTypes={nodeTypes}
            nodesDraggable={modoConstrucao}
            nodesConnectable={modoConstrucao}
            edgesFocusable={modoConstrucao}
            deleteKeyCode={modoConstrucao ? ["Delete", "Backspace"] : []}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={modoConstrucao ? onConnect : undefined}
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
              if (!modoConstrucao) return;
              setSelectedNodeIds([node.id]);
              // Grampeia (clamp) a posição aos limites da viewport — tamanho estimado do menu
              // (min-width 180px + ~2 itens), pra nunca abrir cortado perto da borda da tela.
              const margem = 8;
              const larguraEstimada = 180;
              const alturaEstimada = 90;
              const x = Math.min(e.clientX, window.innerWidth - larguraEstimada - margem);
              const y = Math.min(e.clientY, window.innerHeight - alturaEstimada - margem);
              setMenuContexto({ x: Math.max(margem, x), y: Math.max(margem, y), nodeId: node.id });
            }}
            onPaneClick={() => setMenuContexto(null)}
            multiSelectionKeyCode={["Shift", "Meta", "Control"]}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={18} />
            <Controls showZoom={false} showFitView={false} showInteractive={false}>
              <ControlButton title="Aumentar zoom" aria-label="Aumentar zoom" onClick={() => zoomIn({ duration: 200 })}>
                +
              </ControlButton>
              <ControlButton title="Diminuir zoom" aria-label="Diminuir zoom" onClick={() => zoomOut({ duration: 200 })}>
                −
              </ControlButton>
              <ControlButton title="Centralizar fluxo" aria-label="Centralizar fluxo" onClick={() => fitView({ duration: 300, padding: 0.2 })}>
                ⛶
              </ControlButton>
            </Controls>
            {minimapaVisivel ? (
              <MiniMap pannable zoomable nodeColor={(n) => CORES_CATEGORIA[String(n.type)] ?? "#94a3b8"} />
            ) : null}
            <Panel position="top-right">
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn ghost"
                  title={minimapaVisivel ? "Ocultar minimapa" : "Mostrar minimapa"}
                  onClick={() => setMinimapaVisivel((v) => !v)}
                >
                  {minimapaVisivel ? "Ocultar minimapa" : "Mostrar minimapa"}
                </button>
                <button type="button" className="btn ghost" onClick={() => setCenter(0, 0, { zoom: 1, duration: 300 })}>
                  Centralizar
                </button>
              </div>
            </Panel>
            {modoConstrucao && selectedNodeIds.length > 0 ? (
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

          {!modoConstrucao && rfNodes.length === 0 ? (
            <div className="flow-inicio-vazio">
              <p className="flow-inicio-vazio-titulo">Esse fluxo ainda não tem nenhum bloco.</p>
              <p className="flow-inicio-vazio-sub">Troque pro modo Construir pra montar a automação.</p>
            </div>
          ) : null}

          {modoConstrucao && rfNodes.length === 0 ? (
            <div className="flow-inicio-vazio">
              <p className="flow-inicio-vazio-titulo">Como esta automação deve começar?</p>
              <p className="flow-inicio-vazio-sub">Toda automação começa a partir de um gatilho.</p>
              <button type="button" className="btn primary" onClick={() => setEscolherGatilhoAberto(true)}>
                + Escolher gatilho
              </button>
            </div>
          ) : null}

          {escolherGatilhoAberto ? (
            <div className="modal-overlay" onClick={() => setEscolherGatilhoAberto(false)}>
              <div className="modal flow-escolher-gatilho" onClick={(e) => e.stopPropagation()}>
                <div className="panel-h">
                  <h4>Quando isso deve acontecer?</h4>
                  <button
                    type="button"
                    className="modal-close-btn"
                    aria-label="Fechar"
                    onClick={() => setEscolherGatilhoAberto(false)}
                  >
                    ✕
                  </button>
                </div>
                <div className="flow-escolher-gatilho-lista">
                  {GATILHOS_COMUNS.map((tipo) => {
                    const bloco = BLOCOS_DISPONIVEIS.find((b) => b.tipo === tipo);
                    if (!bloco) return null;
                    return (
                      <button
                        type="button"
                        key={tipo}
                        className="flow-escolher-gatilho-item"
                        onClick={() => {
                          adicionarBloco(tipo, { x: 80, y: 80 });
                          setEscolherGatilhoAberto(false);
                        }}
                      >
                        <span className="n">{bloco.label}</span>
                        <span className="r">{bloco.descricao}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="btn ghost block"
                  onClick={() => {
                    setEscolherGatilhoAberto(false);
                    setLibAberta(true);
                  }}
                >
                  Ver todos os gatilhos
                </button>
              </div>
            </div>
          ) : null}

          {acaoRapida ? (
            <div className="modal-overlay" onClick={() => setAcaoRapida(null)}>
              <div className="modal flow-escolher-gatilho" onClick={(e) => e.stopPropagation()}>
                <div className="panel-h">
                  <h4>O que acontece agora?</h4>
                  <button
                    type="button"
                    className="modal-close-btn"
                    aria-label="Fechar"
                    onClick={() => setAcaoRapida(null)}
                  >
                    ✕
                  </button>
                </div>
                <div className="flow-escolher-gatilho-lista">
                  {ACOES_COMUNS.map((tipo) => {
                    const bloco = BLOCOS_DISPONIVEIS.find((b) => b.tipo === tipo);
                    if (!bloco) return null;
                    return (
                      <button
                        type="button"
                        key={tipo}
                        className="flow-escolher-gatilho-item"
                        onClick={() => {
                          adicionarBlocoConectado(tipo, acaoRapida.nodeId, acaoRapida.handleId);
                          setAcaoRapida(null);
                        }}
                      >
                        <span className="n">{bloco.label}</span>
                        <span className="r">{bloco.descricao}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="btn ghost block"
                  onClick={() => {
                    setAcaoRapida(null);
                    setLibAberta(true);
                  }}
                >
                  Ver todas as ações
                </button>
              </div>
            </div>
          ) : null}

          {menuContexto
            ? (() => {
                const noAlvo = rfNodes.find((n) => n.id === menuContexto.nodeId);
                const podeAdicionarDepois =
                  noAlvo && saidasDoNo(noAlvo.data.flowNode).length === 1 && !saidasConectadasPorNode.get(noAlvo.id)?.has("__default__");
                return (
                  <div className="flow-ctx-menu" style={{ top: menuContexto.y, left: menuContexto.x }}>
                    {podeAdicionarDepois ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAcaoRapida({ nodeId: menuContexto.nodeId, handleId: undefined });
                          setMenuContexto(null);
                        }}
                      >
                        Adicionar depois
                      </button>
                    ) : null}
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
                        alternarDesativado(menuContexto.nodeId);
                        setMenuContexto(null);
                      }}
                    >
                      {noAlvo?.data.flowNode.desativado ? "Ativar" : "Desativar"}
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
                );
              })()
            : null}
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
          onSelecionarNode={(nodeId) => {
            setSelectedNodeIds([nodeId]);
            // Clicar num problema não pode só selecionar o node fora da vista — centraliza a
            // viewport nele, senão quem tem um fluxo grande não acha o que precisa corrigir.
            requestAnimationFrame(() => fitView({ nodes: [{ id: nodeId }], duration: 300, padding: 1.5, maxZoom: 1 }));
          }}
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
