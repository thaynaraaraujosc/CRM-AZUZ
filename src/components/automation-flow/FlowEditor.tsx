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
import { nosDeFollowUp } from "@/lib/automation-flow/sugestoes";
import { validarFluxo } from "@/lib/automation-flow/validacao";
import type { Funil } from "@/lib/data";
import { useFunis } from "@/lib/funis-context";
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
import { HistoricoExecucoes } from "./HistoricoExecucoes";
import { HistoricoVersoes } from "./HistoricoVersoes";
import { Simulador } from "./Simulador";
import { Toolbar } from "./Toolbar";
import { ListaDePassos } from "./ListaDePassos";
import { PainelGatilho } from "./PainelGatilho";
import { PainelProximoPasso } from "./PainelProximoPasso";
import { nodeTypes } from "./nodes";
import { IconClose, IconExpandir } from "@/components/icons";
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
 * Gatilhos mais comuns, na ordem sugerida pro fluxo guiado de primeira automação. Evita jogar as 31
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

/** Frase curta pro modo "Entender fluxo" (item 24). Mesma frase de resumoNo(), só emoldurada por
 * categoria pra ler como narrativa ("Começa quando...", "Verifica...", "Envia...") em vez de um
 * fragmento solto. */
function explicacaoDoNo(flowNode: DomainFlowNode, funis: Funil[]): string {
  const resumo = resumoNo(flowNode, funis);
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
  const { fluxos, carregado, recarregarFluxos, atualizarFluxo, publicarFluxo, restaurarVersao, alternarAtivo } =
    useAutomationFlows();
  const fluxo = fluxos.find((f) => f.id === fluxoId);
  // Fluxo sem área é comercial: é o que todo fluxo criado antes desta coluna é.
  const area = fluxo?.area ?? "comercial";

  const { screenToFlowPosition, fitView, setCenter, zoomIn, zoomOut } = useReactFlow();
  const { funis } = useFunis();


  /**
   * De qual etapa do funil este robô começa, quando ele começa de uma.
   *
   * Quando existe, o gatilho NÃO mora no canvas: ele mora na etapa, e foi configurado lá (quando
   * executar, em que dias, com que condição). Aqui se configura o resto: a mensagem, o que chega,
   * o que fazer com a resposta. Perguntar "como esta automação deve começar?" de novo faria a
   * pessoa responder duas vezes a mesma coisa, e dois gatilhos pro mesmo fluxo é como ele dispara
   * em duplicidade.
   */
  const funilIdDoFluxo = fluxo?.funilId;
  const etapaIdDoFluxo = fluxo?.etapaId;
  const inicioNoFunil = useMemo(() => {
    if (!funilIdDoFluxo || !etapaIdDoFluxo) return null;
    const funil = funis.find((f) => f.id === funilIdDoFluxo);
    const etapa = funil?.colunas.find((c) => c.id === etapaIdDoFluxo);
    if (!funil || !etapa) return null;
    return { funilNome: funil.nome, etapaTitulo: etapa.titulo };
  }, [funilIdDoFluxo, etapaIdDoFluxo, funis]);

  const [rfNodes, setRfNodes] = useState<FlowRFNode[]>(() => domainNodesToRF(fluxo?.nodes ?? []));
  const [rfEdges, setRfEdges] = useState<FlowRFEdge[]>(() => domainEdgesToRF(fluxo?.edges ?? []));
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  /** Já pedimos a lista de novo por causa deste fluxo? Uma vez basta: mais que isso vira laço. */
  const jaPediuListaRef = useRef(false);
  /** A busca extra já terminou. Só depois dela "não achei" pode virar "não existe". */
  const [desistiuDeAchar, setDesistiuDeAchar] = useState(false);
  /**
   * O que foi mexido e ainda NÃO foi gravado.
   *
   * O editor gravava sozinho, a cada tecla, com meio segundo de espera. Isso tem dois preços que
   * só aparecem com o robô ligado: a tela pisca a cada gravação enquanto se digita um título, e um
   * erro de digitação vai pro ar antes de a pessoa terminar a frase. Agora nada é gravado sem
   * clique: o que muda fica aqui, com "Salvar" e "Descartar" à vista.
   */
  const [temPendencia, setTemPendencia] = useState(false);
  /** Alterações de nome/descrição/configuração do fluxo, ainda não gravadas. */
  const [metaPendente, setMetaPendente] = useState<Partial<FluxoAutomacao>>({});
  // A biblioteca começa FECHADA. Ela ocupava um terço da tela o tempo todo, inclusive nas horas
  // em que a pessoa só quer ler o fluxo, e o canvas é o que precisa de espaço. Abrir é um clique.
  const [libAberta, setLibAberta] = useState(false);
  const [simuladorAberto, setSimuladorAberto] = useState(false);
  const [execucoesAbertas, setExecucoesAbertas] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [menuContexto, setMenuContexto] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [toasts, setToasts] = useState<{ id: number; texto: string }[]>([]);
  const [escolherGatilhoAberto, setEscolherGatilhoAberto] = useState(false);
  /** O painel de gatilho em etapas. Só existe na área social: ver `PainelGatilho`. */
  const [painelGatilhoAberto, setPainelGatilhoAberto] = useState(false);
  const [acaoRapida, setAcaoRapida] = useState<{ nodeId: string; handleId: string | undefined } | null>(null);
  const [minimapaVisivel, setMinimapaVisivel] = useState(true);
  const [arrastandoSobreCanvas, setArrastandoSobreCanvas] = useState(false);
  const [entenderFluxoAtivo, setEntenderFluxoAtivo] = useState(false);
  /** Modo Visualizar (item 25): mesmo canvas, mas sem nada editável: sem arrastar bloco da
   * biblioteca, sem menu de contexto, sem botão "+", sem arrastar node. Útil pra revisar o fluxo
   * com alguém sem risco de mexer em nada sem querer. */
  const [modoConstrucao, setModoConstrucao] = useState(true);
  const [modoPassos, setModoPassos] = useState(false);
  /** Quantas execuções passaram por cada bloco. Só é buscado quando a lista de passos abre. */
  const [contadores, setContadores] = useState<Record<string, number>>({});

  const historyRef = useRef<Snapshot[]>([{ nodes: rfNodes, edges: rfEdges }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  /** Espelha `historyRef.current.length` em estado: ref não pode ser lido durante o render (regra do React 19/compiler). */
  const [historyLen, setHistoryLen] = useState(1);
  const salvandoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipboardRef = useRef<DomainFlowNode[]>([]);

  /**
   * Fluxo que não está na lista: pede a lista de novo, uma vez, antes de dizer que não existe.
   *
   * Nem todo robô nasce nesta tela. O "Criar um novo robô" da grade do funil cria direto no banco,
   * por outra rota, e a lista do navegador foi buscada uma vez só, quando a página abriu. O robô
   * recém-criado não estava nela, e abrir o editor dele dava "esse fluxo não existe (mais)" pra
   * algo que tinha acabado de ser criado.
   */
  useEffect(() => {
    if (fluxo || !carregado || jaPediuListaRef.current) return;
    jaPediuListaRef.current = true;
    recarregarFluxos()
      .catch(() => {
        /* falhou a busca: sobra o "não existe", que é a informação honesta que resta */
      })
      .finally(() => setDesistiuDeAchar(true));
  }, [fluxo, carregado, recarregarFluxos]);
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

  /** Mudança estrutural (drag stop, conectar, excluir, adicionar bloco…): persiste na hora e entra no histórico de undo/redo. */
  /**
   * Registra a mudança no canvas SEM gravar.
   *
   * O histórico (desfazer/refazer) continua sendo empilhado: ele é local e existe justamente pra
   * consertar o passo anterior sem precisar descartar tudo.
   */
  function persist(nodes: FlowRFNode[], edges: FlowRFEdge[]) {
    setTemPendencia(true);
    pushHistory(nodes, edges);
  }

  /** Edição de campo no painel: idêntico ao acima, e mantido pelo nome pra não reescrever as
   * dezenas de chamadas. A diferença de antes (esperar meio segundo pra gravar) deixou de existir
   * porque não há mais gravação automática nenhuma. */
  function persistDebounced(nodes: FlowRFNode[], edges: FlowRFEdge[]) {
    persist(nodes, edges);
  }

  /** Grava tudo que está pendente: canvas e meta, numa escrita só. */
  function salvarAlteracoes() {
    setSalvando(true);
    atualizarFluxo(fluxoId, {
      nodes: rfNodesToDomain(rfNodes),
      edges: rfEdgesToDomain(rfEdges),
      ...metaPendente,
    });
    setMetaPendente({});
    setTemPendencia(false);
    marcarSalvando(400);
  }

  /**
   * Joga fora o que não foi gravado e volta pro que está no banco.
   *
   * Recarrega do `fluxo` do contexto, e não de um snapshot próprio: o que está lá é exatamente o
   * que foi gravado por último, e é isso que "descartar" tem que devolver.
   */
  function descartarAlteracoes() {
    setRfNodes(domainNodesToRF(fluxo?.nodes ?? []));
    setRfEdges(domainEdgesToRF(fluxo?.edges ?? []));
    setMetaPendente({});
    setTemPendencia(false);
    setSelectedNodeIds([]);
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
    // A pastilha de início é desenhada, não salva. Deixar uma mudança dela chegar ao estado a
    // gravaria no fluxo, e ela passaria a existir de verdade: um bloco fantasma que o motor não
    // sabe executar.
    setRfNodes((nds) => applyNodeChanges(changes.filter((c) => !ehDesenhado("id" in c ? c.id : "")), nds));
  }
  function onEdgesChange(changes: EdgeChange<FlowRFEdge>[]) {
    setRfEdges((eds) => applyEdgeChanges(changes.filter((c) => !ehDesenhado("id" in c ? c.id : "")), eds));
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

  /** "O que acontece agora?" (botão + depois de um node). Cria o bloco já conectado à saída clicada. */
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

  /**
   * Insere um follow-up depois de um bloco: a espera com prazo e a mensagem que sai quando o prazo
   * vence, já ligadas. Não é um bloco novo nem um motor novo. É o par que a pessoa montaria à
   * mão, montado por ela.
   */
  function adicionarFollowUp(nodeOrigemId: string, handleId: string | undefined) {
    const origem = rfNodes.find((n) => n.id === nodeOrigemId);
    if (!origem) return;
    const receita = nosDeFollowUp({ horas: 2, mensagem: "" });

    const defEspera = BLOCOS_DISPONIVEIS.find((b) => b.tipo === receita.espera.tipo);
    const defMensagem = BLOCOS_DISPONIVEIS.find((b) => b.tipo === receita.mensagem.tipo);
    if (!defEspera || !defMensagem) return;

    const espera: DomainFlowNode = {
      id: novoIdNo(),
      type: receita.espera.tipo,
      category: defEspera.categoria,
      position: { x: origem.position.x, y: origem.position.y + 170 },
      titulo: "Aguardar resposta",
      data: receita.espera.data,
    };
    const mensagem: DomainFlowNode = {
      id: novoIdNo(),
      type: receita.mensagem.tipo,
      category: defMensagem.categoria,
      // Desloca pra direita: o follow-up sai pelo ramo do tempo esgotado, e empilhar os dois na
      // mesma coluna faria a mensagem parecer o caminho de quem respondeu.
      position: { x: origem.position.x + 260, y: origem.position.y + 340 },
      titulo: "Follow-up",
      data: receita.mensagem.data,
    };

    const rfEspera: FlowRFNode = { id: espera.id, type: espera.category, position: espera.position, data: { flowNode: espera, problemas: [] } };
    const rfMensagem: FlowRFNode = { id: mensagem.id, type: mensagem.category, position: mensagem.position, data: { flowNode: mensagem, problemas: [] } };

    const seta = (source: string, target: string, sourceHandle?: string): FlowRFEdge => ({
      id: novoIdAresta(),
      source,
      target,
      sourceHandle,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    });

    const novoNodes = [...rfNodes, rfEspera, rfMensagem];
    const novoEdges = [
      ...rfEdges,
      seta(nodeOrigemId, espera.id, handleId),
      seta(espera.id, mensagem.id, receita.saidaDaEspera),
    ];
    setRfNodes(novoNodes);
    setRfEdges(novoEdges);
    setSelectedNodeIds([mensagem.id]);
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
    // Só desliga o destaque quando sai de fato da área do canvas. Dragleave também dispara ao passar
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
  /**
   * Troca o TIPO de um bloco, mantendo id, posição e as setas que chegam nele.
   *
   * É o que faz "+ Botão de ação" numa mensagem de texto virar uma pergunta: no Kommo o botão
   * mora dentro da mensagem, aqui a pergunta é um tipo próprio. Sem esta troca, a pessoa teria
   * que apagar o bloco, criar outro e religar tudo.
   *
   * As setas que SAEM são descartadas de propósito: as saídas do tipo novo são outras, e uma
   * seta apontando pra um handle que não existe mais é um caminho que nunca é seguido.
   */
  function trocarTipoDoNode(nodeId: string, tipo: FlowNodeType, data: Record<string, unknown>) {
    const bloco = BLOCOS_DISPONIVEIS.find((b) => b.tipo === tipo);
    if (!bloco) return;
    const novoNodes = rfNodes.map((n) =>
      n.id === nodeId
        ? {
            ...n,
            type: bloco.categoria,
            data: { ...n.data, flowNode: { ...n.data.flowNode, type: tipo, category: bloco.categoria, data } },
          }
        : n,
    );
    const novoEdges = rfEdges.filter((e) => e.source !== nodeId);
    setRfNodes(novoNodes);
    setRfEdges(novoEdges);
    persist(novoNodes, novoEdges);
  }

  /**
   * Grava o gatilho escolhido no painel em etapas.
   *
   * Troca o tipo do gatilho que já existe, em vez de criar um segundo: um fluxo tem UM começo, e
   * dois blocos de gatilho no canvas fariam a automação parecer que dispara por dois caminhos.
   * As arestas que saíam dele são preservadas quando o tipo não muda, porque trocar só o escopo
   * ("qualquer publicação" → "esta publicação") não pode desmontar o fluxo já construído.
   */
  function salvarGatilhoSocial(tipo: FlowNodeType, data: Record<string, unknown>) {
    const bloco = BLOCOS_DISPONIVEIS.find((b) => b.tipo === tipo);
    if (!bloco) return;
    const existente = rfNodes.find((n) => n.data.flowNode.category === "gatilho");

    if (!existente) {
      const novoDomain: DomainFlowNode = {
        id: novoIdNo(),
        type: tipo,
        category: bloco.categoria,
        position: { x: 80, y: 80 },
        data,
      };
      const novoNodes = [
        ...rfNodes,
        { id: novoDomain.id, type: novoDomain.category, position: novoDomain.position, data: { flowNode: novoDomain, problemas: [] } },
      ];
      setRfNodes(novoNodes);
      persist(novoNodes, rfEdges);
      setPainelGatilhoAberto(false);
      return;
    }

    const mudouDeTipo = existente.data.flowNode.type !== tipo;
    const novoNodes = rfNodes.map((n) =>
      n.id === existente.id
        ? {
            ...n,
            type: bloco.categoria,
            data: { ...n.data, flowNode: { ...n.data.flowNode, type: tipo, category: bloco.categoria, data } },
          }
        : n,
    );
    // Trocar o TIPO do gatilho muda as saídas possíveis, então as arestas antigas não valem mais.
    // Trocar só a configuração não mexe em nada do que já foi montado depois dele.
    const novoEdges = mudouDeTipo ? rfEdges.filter((e) => e.source !== existente.id) : rfEdges;
    setRfNodes(novoNodes);
    setRfEdges(novoEdges);
    persist(novoNodes, novoEdges);
    setPainelGatilhoAberto(false);
  }

  function removerOpcaoAresta(nodeId: string, opcaoId: string) {
    const novoEdges = rfEdges.filter((e) => !(e.source === nodeId && e.sourceHandle === opcaoId));
    setRfEdges(novoEdges);
    persistDebounced(rfNodes, novoEdges);
  }
  function updateFluxoMeta(patch: Partial<Pick<FluxoAutomacao, "nome" | "descricao" | "funilId" | "etapaId" | "categoria">>) {
    setMetaPendente((atual) => ({ ...atual, ...patch }));
    setTemPendencia(true);
  }
  function updateConfiguracoes(patch: Partial<ConfiguracoesFluxo>) {
    setMetaPendente((atual) => ({
      ...atual,
      configuracoes: { ...(fluxo?.configuracoes ?? {}), ...(atual.configuracoes ?? {}), ...patch },
    }));
    setTemPendencia(true);
  }

  /* ------------------------------------------------------------- ações topo --- */

  function salvarRascunhoAgora() {
    // Grava o canvas E o que foi digitado no painel: são a mesma alteração pra quem está editando,
    // e salvar só metade produziria um rascunho que não é o que está na tela.
    salvarAlteracoes();
    avisar("Rascunho salvo.");
  }

  function publicar() {
    // Publicar grava o que está pendente ANTES de versionar. Sem isso, a versão publicada seria a
    // anterior ao que a pessoa acabou de digitar, e ela veria o texto novo na tela com o texto
    // velho rodando pros clientes.
    salvarAlteracoes();
    // setTimeout(0) garante que `publicarFluxo` (que lê o estado do contexto) já
    // enxerga o `atualizarFluxo` de cima. Os dois não podem rodar na mesma
    // atualização em lote do React.
    setTimeout(() => {
      const resultado = publicarFluxo(fluxoId, "Você");
      const erros = resultado.filter((p) => p.severidade === "erro");
      if (erros.length > 0) {
        avisar(`Não deu pra publicar: ${erros.length} problema(s). Veja a aba "Problemas" no painel à direita.`);
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

  // Os contadores só interessam na lista de passos, e são uma consulta de agregação: buscar
  // sempre encareceria o editor inteiro por um número que quase nunca está na tela.
  useEffect(() => {
    if (!modoPassos) return;
    let vivo = true;
    fetch(`/api/automacoes-fluxos/${fluxoId}/contadores`)
      .then((r) => (r.ok ? r.json() : { porNo: {} }))
      .then((dados: { porNo?: Record<string, number> }) => {
        if (vivo) setContadores(dados.porNo ?? {});
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [modoPassos, fluxoId]);

  /** De qual bloco e de qual saída o "+" foi clicado. Deriva fora do JSX: calcular dentro de uma
   * função imediata no meio do render faz o lint (com razão) achar que estamos lendo valores que
   * não deveriam ser lidos ali. */
  const noDaAcaoRapida = useMemo(
    () => (acaoRapida ? rfNodes.find((n) => n.id === acaoRapida.nodeId)?.data.flowNode : undefined),
    [acaoRapida, rfNodes],
  );
  const saidaDaAcaoRapida = useMemo(
    () => (noDaAcaoRapida ? saidasDoNo(noDaAcaoRapida).find((s) => s.handleId === acaoRapida?.handleId) : undefined),
    [noDaAcaoRapida, acaoRapida],
  );

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
  /** Quais saídas (por nó) já têm uma aresta indo pra algum lugar. O botão "+" só aparece nas que não têm. */
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
  /** Ordem narrativa (1, 2, 3...) pro modo "Entender fluxo". BFS a partir dos gatilhos, seguindo as
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
  /** Quantos caminhos diferentes chegam em cada node. >1 quer dizer que branches diferentes se
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
   * dele) e apaga levemente o resto. Ajuda a acompanhar o fluxo em automações com muitos nós/
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
          explicacao: entenderFluxoAtivo ? explicacaoDoNo(n.data.flowNode, funis) : undefined,
          onAdicionarApos: modoConstrucao ? (handleId: string | undefined) => setAcaoRapida({ nodeId: n.id, handleId }) : undefined,
        },
      })),
    [rfNodes, problemasPorNode, saidasConectadasPorNode, entradasPorNode, ordemNarrativaPorNode, entenderFluxoAtivo, nodesRelacionados, modoConstrucao, funis],
  );
  /**
   * De qual bloco o fluxo parte: o gatilho, ou o primeiro bloco sem nada chegando nele.
   *
   * É a mesma pergunta que a pastilha verde responde, e ela precisa de uma resposta mesmo em fluxo
   * torto (dois começos, ninguém ligado a ninguém): aí ela aponta pro primeiro, que é melhor que
   * não aparecer.
   */
  const idDoPrimeiroBloco = useMemo(() => {
    if (!rfNodes.length) return null;
    const gatilho = rfNodes.find((n) => n.data.flowNode.category === "gatilho");
    if (gatilho) return gatilho.id;
    const comEntrada = new Set(rfEdges.map((e) => e.target));
    return (rfNodes.find((n) => !comEntrada.has(n.id)) ?? rfNodes[0]).id;
  }, [rfNodes, rfEdges]);

  /**
   * A pastilha verde e a linha que sai dela.
   *
   * Entram no que é DESENHADO, nunca no estado: não são blocos do fluxo, o motor não os executa, e
   * salvá-los criaria um passo fantasma. Por isso também não se arrastam, não se selecionam e não
   * se apagam.
   */
  const inicioDesenhado = useMemo(() => {
    const alvo = rfNodes.find((n) => n.id === idDoPrimeiroBloco);
    if (!alvo) return null;
    const no: FlowRFNode = {
      id: ID_INICIO,
      type: "inicio",
      position: { x: alvo.position.x - 230, y: alvo.position.y + 8 },
      draggable: false,
      selectable: false,
      deletable: false,
      data: {
        flowNode: alvo.data.flowNode,
        problemas: [],
        ...(inicioNoFunil ? { detalheInicio: `Lead entra em “${inicioNoFunil.etapaTitulo}”` } : {}),
      } as FlowRFNode["data"],
    };
    const aresta: FlowRFEdge = {
      id: `${ID_INICIO}-linha`,
      source: ID_INICIO,
      target: alvo.id,
      type: "smoothstep",
      deletable: false,
      selectable: false,
      style: { stroke: "var(--success)" },
    };
    return { no, aresta };
  }, [rfNodes, idDoPrimeiroBloco, inicioNoFunil]);

  const edgesParaRenderizar = useMemo(
    () =>
      rfEdges.map((e) => ({
        ...e,
        className: arestasRelacionadas && !arestasRelacionadas.has(e.id) ? "flow-edge-apagada" : undefined,
        zIndex: arestasRelacionadas?.has(e.id) ? 1 : 0,
      })),
    [rfEdges, arestasRelacionadas],
  );

  const edgesComInicio = useMemo(
    () => (inicioDesenhado ? [inicioDesenhado.aresta, ...edgesParaRenderizar] : edgesParaRenderizar),
    [inicioDesenhado, edgesParaRenderizar],
  );

  /**
   * O fluxo como está NA TELA: o gravado, com o que foi digitado por cima.
   *
   * Sem isso, digitar no nome do fluxo não mostrava nada, porque o campo lê do que está gravado e
   * a gravação passou a depender de um clique.
   */
  const fluxoNaTela = useMemo(
    () => ({ ...(fluxo as FluxoAutomacao), ...metaPendente }) as FluxoAutomacao,
    [fluxo, metaPendente],
  );

  const nodesComInicio = useMemo(
    () => (inicioDesenhado ? [inicioDesenhado.no, ...nodesParaRenderizar] : nodesParaRenderizar),
    [inicioDesenhado, nodesParaRenderizar],
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
        <p>{carregado && desistiuDeAchar ? "Esse fluxo não existe (mais)." : "Carregando o fluxo…"}</p>
      </div>
    );
  }

  return (
    <div className="flow-shell">
      <Toolbar
        nome={fluxoNaTela.nome}
        onChangeNome={(nome) => updateFluxoMeta({ nome })}
        status={fluxo.status}
        salvando={salvando}
        temPendencia={temPendencia}
        onSalvarAlteracoes={salvarAlteracoes}
        onDescartarAlteracoes={descartarAlteracoes}
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
        onAbrirExecucoes={() => setExecucoesAbertas(true)}
        onOrganizarAutomaticamente={organizarAutomaticamente}
        entenderFluxoAtivo={entenderFluxoAtivo}
        onAlternarEntenderFluxo={() => setEntenderFluxoAtivo((v) => !v)}
        modoConstrucao={modoConstrucao}
        onAlternarModo={() => setModoConstrucao((v) => !v)}
        modoPassos={modoPassos}
        onModoPassos={setModoPassos}
      />

      <div className="flow-body">
        {modoConstrucao ? (
          <BlockLibrary
            aberta={libAberta}
            area={area}
            onFechar={() => setLibAberta((v) => !v)}
            onAdicionarBloco={(tipo) => adicionarBloco(tipo)}
          />
        ) : null}

        {modoPassos ? (
          <div className="flow-canvas passos-area">
            <ListaDePassos
              nodes={domainNodesAtuais}
              edges={domainEdgesAtuais}
              selecionadoId={selectedNodeIds[0] ?? null}
              problemasPorNode={problemasPorNode}
              contadores={contadores}
              somenteLeitura={!modoConstrucao}
              onSelecionar={(id) => setSelectedNodeIds([id])}
              onAdicionar={(origemId, handleId, tipo) => adicionarBlocoConectado(tipo, origemId, handleId)}
              onRemover={(id) => removerNodes([id])}
            />
          </div>
        ) : (
        <div
          className={`flow-canvas${arrastandoSobreCanvas ? " flow-canvas-recebendo" : ""}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
        >
          <ReactFlow
            nodes={nodesComInicio}
            edges={edgesComInicio}
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
              // Grampeia (clamp) a posição aos limites da viewport. Tamanho estimado do menu
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
                <IconExpandir width={13} height={13} />
              </ControlButton>
            </Controls>
            {minimapaVisivel ? (
              <MiniMap pannable zoomable nodeColor={(n) => CORES_CATEGORIA[String(n.type)] ?? "#94a3b8"} />
            ) : null}
            {inicioNoFunil ? (
              <Panel position="top-left">
                {/* O começo e o fim ficam à vista o tempo todo, como no Kommo: quem abre um fluxo
                    com quinze blocos precisa saber de onde ele parte sem procurar, e precisa de um
                    jeito curto de fechar o caminho que acabou de montar. */}
                {/* O começo já aparece como pastilha verde no canvas, ligada ao primeiro bloco.
                    Aqui fica só o funil, que a pastilha não tem espaço pra dizer. O fim sai da
                    biblioteca, pelo bloco "Encerrar fluxo": um segundo atalho pra criar o mesmo
                    bloco só faria a pessoa procurar em dois lugares. */}
                <span className="flow-inicio-fim-funil">{inicioNoFunil.funilNome}</span>
              </Panel>
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
                  <button type="button" className="btn ghost" title="Duplicar (Ctrl+D)" onClick={duplicarSelecionados}>
                    Duplicar
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    title="Excluir (Delete)"
                    onClick={() => removerNodes(selectedNodeIds)}
                  >
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

          {modoConstrucao && rfNodes.length === 0 && area === "social" ? (
            <div className="flow-inicio-vazio">
              {/* O cartão do gatilho vazio: o canvas em branco de uma automação nova precisa dizer
                  o que fazer primeiro, senão a tela é uma parede. */}
              <div className="no-gatilho-vazio">
                <span className="no-gatilho-vazio-selo">Gatilho</span>
                <div className="no-gatilho-vazio-corpo">
                  <h4>Gatilho para acionar a automação</h4>
                  <button
                    type="button"
                    className="no-gatilho-vazio-btn"
                    onClick={() => setPainelGatilhoAberto(true)}
                  >
                    Adicionar gatilho +
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {modoConstrucao && rfNodes.length === 0 && area !== "social" && inicioNoFunil ? (
            <div className="flow-inicio-vazio">
              <div className="flow-inicio-etapa">
                <span className="flow-inicio-etapa-selo">Início</span>
                <div className="flow-inicio-etapa-corpo">
                  <h4>Quando o lead entra em “{inicioNoFunil.etapaTitulo}”</h4>
                  <p className="hint">
                    {inicioNoFunil.funilNome}. Quando executar, os dias e a condição foram
                    configurados na etapa, em Automatizar funil. Aqui você monta o que o robô faz.
                  </p>
                  <button
                    type="button"
                    className="btn primary mt8"
                    onClick={() => setAcaoRapida({ nodeId: "", handleId: undefined })}
                  >
                    + Adicionar primeiro passo
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {modoConstrucao && rfNodes.length === 0 && area !== "social" && !inicioNoFunil ? (
            <div className="flow-inicio-vazio">
              <p className="flow-inicio-vazio-titulo">Como esta automação deve começar?</p>
              <p className="flow-inicio-vazio-sub">Toda automação começa a partir de um gatilho.</p>
              <button type="button" className="btn primary" onClick={() => setEscolherGatilhoAberto(true)}>
                + Escolher gatilho
              </button>
            </div>
          ) : null}

          {painelGatilhoAberto ? (
            <PainelGatilho
              area={area}
              tipoAtual={rfNodes.find((n) => n.data.flowNode.category === "gatilho")?.data.flowNode.type}
              dataAtual={
                rfNodes.find((n) => n.data.flowNode.category === "gatilho")?.data.flowNode.data as
                  | Record<string, unknown>
                  | undefined
              }
              onSalvar={salvarGatilhoSocial}
              onFechar={() => setPainelGatilhoAberto(false)}
            />
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
                    <IconClose width={13} height={13} />
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
            <PainelProximoPasso
              tipoAnterior={noDaAcaoRapida?.type}
              categoriaAnterior={noDaAcaoRapida?.category}
              area={area}
              rotuloDaSaida={saidaDaAcaoRapida?.label || undefined}
              onEscolher={(tipo) => {
                // `nodeId` vazio = "primeiro passo" de um robô que começa na etapa do funil: não há
                // bloco anterior a que conectar, então o passo entra solto no canvas.
                if (acaoRapida.nodeId) adicionarBlocoConectado(tipo, acaoRapida.nodeId, acaoRapida.handleId);
                else adicionarBloco(tipo, { x: 80, y: 80 });
                setAcaoRapida(null);
              }}
              onFollowUp={() => {
                if (acaoRapida.nodeId) adicionarFollowUp(acaoRapida.nodeId, acaoRapida.handleId);
                setAcaoRapida(null);
              }}
              onFechar={() => setAcaoRapida(null)}
            />
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
                      title="Ctrl+D"
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
                      title="Delete"
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
        )}

        <ConfigPanel
          fluxo={fluxoNaTela}
          selectedNodes={selectedNodes}
          problemas={problemas}
          onUpdateFluxoMeta={updateFluxoMeta}
          onUpdateConfiguracoes={updateConfiguracoes}
          onUpdateNode={updateNodeMeta}
          onUpdateNodeData={updateNodeData}
          onRemoverOpcaoAresta={removerOpcaoAresta}
          onTrocarTipo={trocarTipoDoNode}
          onEditarGatilho={area === "social" ? () => setPainelGatilhoAberto(true) : undefined}
          onSelecionarNode={(nodeId) => {
            setSelectedNodeIds([nodeId]);
            // Clicar num problema não pode só selecionar o node fora da vista. Centraliza a
            // viewport nele, senão quem tem um fluxo grande não acha o que precisa corrigir.
            requestAnimationFrame(() => fitView({ nodes: [{ id: nodeId }], duration: 300, padding: 1.5, maxZoom: 1 }));
          }}
        />
      </div>

      {simuladorAberto && fluxoParaSimular ? <Simulador fluxo={fluxoParaSimular} onFechar={() => setSimuladorAberto(false)} /> : null}
      {execucoesAbertas ? <HistoricoExecucoes fluxoId={fluxoId} onFechar={() => setExecucoesAbertas(false)} /> : null}
      {historicoAberto ? (
        <HistoricoVersoes
          fluxoId={fluxoId}
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

/** Id da pastilha verde de começo e da linha que sai dela. */
const ID_INICIO = "__inicio__";

/** O nó/aresta é apenas desenhado (nunca salvo)? Ver `InicioNode`. */
function ehDesenhado(id: string): boolean {
  return id.startsWith("__");
}

export function FlowEditor({ fluxoId }: { fluxoId: string }) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner fluxoId={fluxoId} />
    </ReactFlowProvider>
  );
}
