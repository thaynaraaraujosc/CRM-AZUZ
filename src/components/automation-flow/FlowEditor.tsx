"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MarkerType,
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
import { useFecharMenuDeLinha } from "@/lib/menu-de-linha";
import { useBibliotecaDocumentos } from "@/lib/biblioteca-documentos-context";
import { ModalConfirmacao } from "@/components/ui";
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

import { FLOW_DND_MIME } from "./BlockLibrary";
import { blocoApareceNaArea } from "@/lib/canais/capacidades";
import { ConfigPanel } from "./ConfigPanel";
import { HistoricoExecucoes } from "./HistoricoExecucoes";
import { HistoricoVersoes } from "./HistoricoVersoes";
import { Simulador } from "./Simulador";
import { ToolbarSocial } from "./ToolbarSocial";
import { BarraFerramentasSocial } from "./BarraFerramentasSocial";
import { ArestaSocial } from "./ArestaSocial";
import { GatilhosDoSocial } from "./GatilhosDoSocial";
import { ListaDePassos } from "./ListaDePassos";
import { ProximoPassoJuntoAoInicio } from "./ProximoPassoJuntoAoInicio";
import { ProximoPassoJuntoAoBloco } from "./ProximoPassoJuntoAoBloco";
import { PainelProximoPasso } from "./PainelProximoPasso";
import { nodeTypes } from "./nodes";
import { IconCheck, IconClose } from "@/components/icons";
import { useIdioma } from "@/lib/idioma-context";
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
  const { t: traduzir } = useIdioma();
  const { fluxos, carregado, recarregarFluxos, atualizarFluxo, publicarFluxo, restaurarVersao, alternarAtivo, excluirFluxo } =
    useAutomationFlows();
  const router = useRouter();
  /** A confirmação de apagar o robô. Nada some sem passar por ela. */
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const fluxo = fluxos.find((f) => f.id === fluxoId);
  // Fluxo sem área é comercial: é o que todo fluxo criado antes desta coluna é.
  const area = fluxo?.area ?? "comercial";
  const ehSocial = area === "social";

  const { screenToFlowPosition, fitView, setCenter, zoomIn, zoomOut } = useReactFlow();
  const { funis } = useFunis();
  const { adicionarDocumento } = useBibliotecaDocumentos();


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
  /*
   * QUANDO GRAVOU, pro rodapé "Salvo em 03/11/2026 às 15:26" do canvas do Social Seller.
   *
   * É hora de RELÓGIO desta sessão, e não um campo do fluxo: a resposta que interessa é "o que
   * está na tela já está gravado?", e ela só vale pra esta aba. Começa nulo porque abrir um fluxo
   * não é gravar — dizer "Salvo às 15:26" assim que a tela abre seria afirmar algo que não houve.
   */
  const [salvoEm, setSalvoEm] = useState<string | null>(null);
  /* As configurações gerais do fluxo, no Social Seller, vêm pelo "⋮": o painel não fica mais
     preso aberto, então sem isto não haveria como chegar no nome, na descrição e nos horários. */
  const [configGeralAberta, setConfigGeralAberta] = useState(false);
  /* O "Salvo em …" do canvas marca a hora quando a gravação TERMINA: `salvando` indo de ligado
     pra desligado é o único instante em que se sabe que o que está na tela foi pro banco. */
  const estavaSalvando = useRef(false);
  useEffect(() => {
    if (estavaSalvando.current && !salvando) setSalvoEm(new Date().toISOString());
    estavaSalvando.current = salvando;
  }, [salvando]);
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
  const [simuladorAberto, setSimuladorAberto] = useState(false);
  const [execucoesAbertas, setExecucoesAbertas] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [menuContexto, setMenuContexto] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [toasts, setToasts] = useState<{ id: number; texto: string }[]>([]);
  const [escolherGatilhoAberto, setEscolherGatilhoAberto] = useState(false);
  /** Em qual etapa a gaveta de gatilhos abre: a lista, ou direto nas palavras-chave. */
  const [etapaDaGaveta, setEtapaDaGaveta] = useState<"lista" | "palavras" | "painel">("lista");
  /*
   * ONDE A PASTILHA DE INÍCIO ESTÁ ENQUANTO SE ARRASTA.
   *
   * O início não é um bloco: ele não entra em `rfNodes` e por isso `applyNodeChanges` não mexe
   * nele. Sem guardar a posição em algum lugar, o React Flow desenha o arraste e o nó volta pro
   * lugar no quadro seguinte. `null` = ainda não foi movido nesta sessão, então vale o que está
   * gravado nas configurações, e se nem isso houver, o lugar calculado.
   */
  const [posicaoInicioArrastada, setPosicaoInicioArrastada] = useState<{ x: number; y: number } | null>(null);
  /*
   * O QUADRO VAZIO JÁ ABRE COM AS OPÇÕES NA TELA.
   *
   * "Quando começa um do zero, ele começa com a tela limpa: só aparece iniciar robô e o próximo
   * passo." Antes havia um cartão de boas-vindas com um botão que abria a lista — um clique a
   * mais pra chegar na única coisa que dá pra fazer num fluxo vazio.
   *
   * Este estado é o "a pessoa fechou": sem ele, fechar a lista num fluxo que continua vazio a
   * abriria de novo no render seguinte, e não haveria como fechá-la.
   */
  const [dispensouAbertura, setDispensouAbertura] = useState(false);
  const [acaoRapida, setAcaoRapida] = useState<{
    nodeId: string;
    handleId: string | undefined;
    /** Onde o "+" clicado está na tela, pra lista abrir COLADA nele. */
    ancora?: DOMRect;
  } | null>(null);

  const [arrastandoSobreCanvas, setArrastandoSobreCanvas] = useState(false);
  const [entenderFluxoAtivo, setEntenderFluxoAtivo] = useState(false);
  /** Modo Visualizar (item 25): mesmo canvas, mas sem nada editável: sem arrastar bloco da
   * biblioteca, sem menu de contexto, sem botão "+", sem arrastar node. Útil pra revisar o fluxo
   * com alguém sem risco de mexer em nada sem querer. */
  const [modoConstrucao, setModoConstrucao] = useState(true);
  /*
   * A abertura automática é DERIVADA, não ligada por um efeito.
   *
   * "O quadro vazio não tem nada pra escolher além do primeiro passo" é um fato do render: dá pra
   * lê-lo direto do estado em vez de reagir a ele e chamar `setState` — que é um render a mais e
   * um caminho a mais pra sair do compasso. `dispensouAbertura` é o único estado de verdade: ele
   * guarda que a pessoa fechou a lista, pra ela não voltar sozinha no quadro seguinte.
   */
  const quadroVazio = carregado && modoConstrucao && rfNodes.length === 0;
  // No Instagram o fluxo começa escolhendo o GATILHO; num robô de funil o gatilho já está na
  // etapa, então o que falta escolher é o primeiro passo.
  const abrirGatilhoSozinho = quadroVazio && !dispensouAbertura && ehSocial;
  const abrirPassoSozinho = quadroVazio && !dispensouAbertura && !ehSocial;
  const escolhendoGatilho = escolherGatilhoAberto || abrirGatilhoSozinho;
  const escolhendoProximoPasso = acaoRapida ?? (abrirPassoSozinho ? { nodeId: "", handleId: undefined } : null);

  const fecharMenuContexto = useCallback(() => setMenuContexto(null), []);
  useFecharMenuDeLinha(menuContexto !== null, fecharMenuContexto);

  /** Fechar qualquer uma das duas também desliga a abertura automática. */
  function fecharEscolha() {
    setDispensouAbertura(true);
    setEscolherGatilhoAberto(false);
    // Volta pro começo: a próxima abertura decide de novo onde começa, pelo que foi clicado.
    setEtapaDaGaveta("lista");
    setAcaoRapida(null);
  }
  const [modoPassos, setModoPassos] = useState(false);
  /** Quantas execuções passaram por cada bloco. Só é buscado quando a lista de passos abre. */
  const [contadores, setContadores] = useState<Record<string, number>>({});

  const historyRef = useRef<Snapshot[]>([{ nodes: rfNodes, edges: rfEdges }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  /** Espelha `historyRef.current.length` em estado: ref não pode ser lido durante o render (regra do React 19/compiler). */
  const [historyLen, setHistoryLen] = useState(1);
  const salvandoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipboardRef = useRef<DomainFlowNode[]>([]);
  /** O bloco que está piscando agora, depois de alguém clicar num problema. */
  const [nodePiscando, setNodePiscando] = useState<string | null>(null);
  /** Qual aba o painel deve mostrar, quando alguém pede do canvas (o "!" de um bloco). */
  const [abaPedida, setAbaPedida] = useState<{ aba: "configurar" | "problemas"; token: number } | undefined>(undefined);
  const piscarRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  /**
   * Avisa antes de perder o que não foi gravado.
   *
   * O editor não grava sozinho, de propósito (ver o comentário do `temPendencia`). O preço disso é
   * que sair da tela apaga o trabalho, e sair da tela é um clique no menu lateral. Sem este aviso
   * dava pra montar um robô inteiro e perder tudo sem nenhum sinal: F5, fechar aba ou um link do
   * menu, todos silenciosos.
   *
   * `beforeunload` cobre recarregar e fechar. O ouvinte de clique na fase de captura cobre a
   * navegação interna, que não passa por `beforeunload` porque não recarrega a página.
   */
  useEffect(() => {
    if (!temPendencia) return;
    function aoSair(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    function aoClicar(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const alvo = e.target as HTMLElement | null;
      const link = alvo?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      const destino = link.getAttribute("href") ?? "";
      if (!destino.startsWith("/") || link.target === "_blank") return;
      if (destino === window.location.pathname) return;
      if (!window.confirm(traduzir("Você tem alterações não salvas neste robô. Sair mesmo assim?"))) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    window.addEventListener("beforeunload", aoSair);
    document.addEventListener("click", aoClicar, true);
    return () => {
      window.removeEventListener("beforeunload", aoSair);
      document.removeEventListener("click", aoClicar, true);
    };
  }, [temPendencia]);

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
    // sabe executar. O que ela tem de próprio é a POSIÇÃO, que vai pra um estado à parte —
    // senão o arraste é desenhado e desfeito no quadro seguinte.
    for (const mudanca of changes) {
      if (mudanca.type === "position" && mudanca.id === ID_INICIO && mudanca.position) {
        setPosicaoInicioArrastada(mudanca.position);
      }
    }
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
    const novoNodes = garantirPrazoDeEspera(rfNodes, novaEdge.source, novaEdge.sourceHandle);
    setRfEdges(novoEdges);
    if (novoNodes !== rfNodes) setRfNodes(novoNodes);
    persist(novoNodes, novoEdges);
  }
  function onNodeDragStop(_evento: unknown, node?: { id: string; position: { x: number; y: number } }) {
    // Soltar o início grava a posição nas CONFIGURAÇÕES, não entre os blocos: ele continua fora
    // do fluxo que o motor executa.
    if (node?.id === ID_INICIO) {
      updateConfiguracoes({ posicaoInicio: node.position });
      return;
    }
    persist(rfNodes, rfEdges);
  }

  /** Desfaz UMA ligação, sem mexer nos blocos dos dois lados. */
  function removerAresta(id: string) {
    const novoEdges = rfEdges.filter((e) => e.id !== id);
    setRfEdges(novoEdges);
    persist(rfNodes, novoEdges);
  }

  /** Copia UM bloco, pelo botão em cima dele. `duplicarSelecionados` cuida da seleção múltipla. */
  function duplicarUm(nodeId: string) {
    const origem = rfNodes.find((n) => n.id === nodeId);
    if (!origem) return;
    const id = novoIdNo();
    const pos = { x: origem.position.x + 40, y: origem.position.y + 40 };
    const copia: FlowRFNode = {
      id,
      type: origem.type,
      position: pos,
      data: { flowNode: { ...origem.data.flowNode, id, position: pos }, problemas: [] },
    };
    const novoNodes = [...rfNodes, copia];
    setRfNodes(novoNodes);
    setSelectedNodeIds([id]);
    persist(novoNodes, rfEdges);
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
  /**
   * Escrever a mensagem direto no cartão do canvas.
   *
   * `persistDebounced` e não `persist`: cada tecla digitada passa por aqui, e gravar a cada tecla
   * manda o fluxo inteiro pro servidor dezenas de vezes por frase.
   *
   * O campo varia por tipo de bloco — texto é `texto`, mídia é `legenda` — e por isso o nome do
   * campo é decidido aqui e não no cartão: o cartão desenha, não sabe do formato do bloco.
   */
  function editarTextoDoBloco(nodeId: string, texto: string) {
    const novoNodes = rfNodes.map((n) => {
      if (n.id !== nodeId) return n;
      const tipo = n.data.flowNode.type;
      const campo = tipo.startsWith("mensagem_") && !["mensagem_texto", "mensagem_botoes", "mensagem_lista"].includes(tipo)
        ? "legenda"
        : "texto";
      return {
        ...n,
        data: {
          ...n.data,
          flowNode: { ...n.data.flowNode, data: { ...(n.data.flowNode.data ?? {}), [campo]: texto } },
        },
      };
    });
    setRfNodes(novoNodes);
    persistDebounced(novoNodes, rfEdges);
  }

  /** Trocar o nome do bloco pelo "⋯" do cartão. Vazio volta ao nome padrão do tipo. */
  function renomearBloco(nodeId: string, titulo: string) {
    const novoNodes = rfNodes.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, flowNode: { ...n.data.flowNode, titulo: titulo || undefined } } }
        : n,
    );
    setRfNodes(novoNodes);
    persist(novoNodes, rfEdges);
  }

  /**
   * O ARQUIVO PRESO NO CARTÃO: clipe e microfone.
   *
   * Duas etapas, e a primeira é a que faz o robô conseguir enviar: o arquivo entra na BIBLIOTECA
   * de documentos, que é de onde o motor lê a mídia na hora do envio. Guardá-lo dentro do fluxo
   * não serviria — o fluxo é desenho, não é cofre de arquivo.
   *
   * Depois o bloco TROCA DE TIPO. Um `mensagem_texto` com um áudio pendurado não existe pro
   * motor: quem manda áudio é `mensagem_audio`. O texto que já estava escrito vira a LEGENDA, em
   * vez de se perder — é o mesmo texto, no campo que o novo tipo usa.
   */
  async function anexarNoBloco(
    nodeId: string,
    arquivo: { dataUrl: string; nome: string; mimeType: string; bytes: number },
  ) {
    const tipoMidia = arquivo.mimeType.startsWith("image/")
      ? "imagem"
      : arquivo.mimeType.startsWith("video/")
        ? "video"
        : arquivo.mimeType.startsWith("audio/")
          ? "audio"
          : "documento";
    const tipoDoBloco = (
      { imagem: "mensagem_imagem", video: "mensagem_video", audio: "mensagem_audio", documento: "mensagem_documento" } as const
    )[tipoMidia];

    let documentoId: string;
    try {
      /*
       * PELO CONTEXTO, e não por um `fetch` direto na API.
       *
       * Os dois gravam a mesma linha, mas só o contexto acrescenta o arquivo à lista que está na
       * memória desta aba. Com o `fetch` cru, o cartão acabava de anexar a imagem e não achava o
       * documento pra desenhar a miniatura: aparecia o clipe genérico até alguém recarregar a
       * página.
       */
      const salvo = await adicionarDocumento({
        nome: arquivo.nome,
        categoria: "Automação",
        formato: (arquivo.nome.split(".").pop() ?? "").toUpperCase() || tipoMidia.toUpperCase(),
        tamanho: arquivo.bytes,
        autor: "Automação",
        url: arquivo.dataUrl,
        tipoMidia,
      });
      documentoId = salvo.id;
    } catch {
      window.alert("Não deu pra guardar o arquivo. Tente de novo.");
      return;
    }

    const novoNodes = rfNodes.map((n) => {
      if (n.id !== nodeId) return n;
      const antigo = (n.data.flowNode.data ?? {}) as Record<string, unknown>;
      const textoAnterior = typeof antigo.texto === "string" ? antigo.texto : (antigo.legenda as string | undefined);
      return {
        ...n,
        data: {
          ...n.data,
          flowNode: {
            ...n.data.flowNode,
            type: tipoDoBloco,
            data: {
              canal: antigo.canal,
              origemArquivo: "upload",
              arquivoId: documentoId,
              arquivoNome: arquivo.nome,
              arquivoTipo: (arquivo.nome.split(".").pop() ?? "").toUpperCase(),
              arquivoTamanho: `${Math.max(1, Math.round(arquivo.bytes / 1024))} KB`,
              legenda: textoAnterior,
            },
          },
        },
      } as typeof n;
    });
    setRfNodes(novoNodes);
    persist(novoNodes, rfEdges);
  }

  /**
   * Mexer nos botões de resposta pela própria bolha.
   *
   * O TIPO DO BLOCO ACOMPANHA: um `mensagem_texto` não tem onde guardar opção, e um
   * `mensagem_botoes` sem nenhuma opção é uma pergunta que não pergunta nada. Então o primeiro
   * botão promove o bloco e o último rebaixa — sem isso, "adicionar botão" salvaria num campo
   * que o motor não lê, e o robô mandaria o texto sem botão nenhum, calado.
   *
   * As arestas das opções apagadas vão junto: uma ligação saindo de um botão que não existe mais
   * é um caminho que nunca é tomado e que ninguém consegue ver pra apagar.
   */
  function mudarOpcoesDoBloco(nodeId: string, opcoes: { id: string; rotulo: string; url?: string }[]) {
    const atual = rfNodes.find((n) => n.id === nodeId);
    if (!atual) return;
    const tipo = opcoes.length ? "mensagem_botoes" : "mensagem_texto";
    const dados = (atual.data.flowNode.data ?? {}) as Record<string, unknown>;
    const novoNodes = rfNodes.map((n) =>
      n.id === nodeId
        ? ({
            ...n,
            data: {
              ...n.data,
              flowNode: { ...n.data.flowNode, type: tipo, data: { ...dados, opcoes } },
            },
          } as typeof n)
        : n,
    );
    const idsVivos = new Set(opcoes.map((o) => o.id));
    const novoEdges = rfEdges.filter(
      (e) => e.source !== nodeId || !e.sourceHandle || idsVivos.has(e.sourceHandle) || !e.sourceHandle.startsWith("op-"),
    );
    setRfNodes(novoNodes);
    setRfEdges(novoEdges);
    persist(novoNodes, novoEdges);
  }

  /**
   * LIGAR UM CAMINHO EM "SEM RESPOSTA" PRECISA DE UM PRAZO, senão ele nunca é seguido.
   *
   * Uma pergunta sem prazo espera pra sempre: o motor só marca a hora de desistir quando
   * `esperaMinutos` existe (ver `motor-estado.ts`). A saída aparece sempre no cartão, como na
   * referência — e é aqui que ela deixa de ser promessa vazia: no instante em que um caminho é
   * ligado nela, o bloco ganha uma hora de prazo, se ainda não tiver um.
   *
   * UMA HORA e não cinco minutos: a pessoa do outro lado está vivendo a vida dela, e desistir
   * em cinco minutos trata "ainda não viu" como "não quer". Quem precisar de outro prazo troca
   * no painel do bloco; o que não pode é o caminho existir e nunca acontecer.
   */
  const PRAZO_PADRAO_SEM_RESPOSTA = 60;
  function garantirPrazoDeEspera(nodes: FlowRFNode[], nodeId: string, handleId?: string | null) {
    if (handleId !== "nao_respondeu") return nodes;
    return nodes.map((n) => {
      if (n.id !== nodeId) return n;
      const dados = (n.data.flowNode.data ?? {}) as { esperaMinutos?: number };
      if (dados.esperaMinutos) return n;
      return {
        ...n,
        data: {
          ...n.data,
          flowNode: {
            ...n.data.flowNode,
            data: { ...dados, esperaMinutos: PRAZO_PADRAO_SEM_RESPOSTA },
          },
        },
      };
    });
  }

  /**
   * O tempo do cronômetro, gravado SEMPRE EM MINUTOS.
   *
   * O bloco aceita "minutos", "horas" e "dias" como unidade, e o cartão edita horas e minutos
   * juntos. Normalizar na gravação evita o caso em que 90 minutos viram "1 hora" e os 30 minutos
   * somem no arredondamento da unidade.
   */
  function definirCronometro(nodeId: string, minutos: number) {
    const valor = Math.max(0, Math.min(43200, Math.round(minutos)));
    const novoNodes = rfNodes.map((n) => {
      if (n.id !== nodeId) return n;
      const dados = (n.data.flowNode.data ?? {}) as { modo?: string };
      /* "Até a resposta" guarda o tempo em `tempoMaximo`, e o modo NÃO muda: ele é o bloco que
         espera a pessoa e só segue pelo outro caminho se o prazo estourar. Trocar o modo aqui
         transformaria um follow-up ("se não responder em 2h, cobra") numa espera cega que manda
         a cobrança mesmo pra quem já respondeu. */
      const data =
        dados.modo === "ate_resposta"
          ? { ...dados, tempoMaximo: { valor, unidade: "minutos" } }
          : { ...dados, modo: "minutos", valor };
      return { ...n, data: { ...n.data, flowNode: { ...n.data.flowNode, data } } };
    });
    setRfNodes(novoNodes);
    persistDebounced(novoNodes, rfEdges);
  }

  /** Grava um campo solto nos dados do bloco (canal, por ora). */
  function editarCampoDoBloco(nodeId: string, campo: string, valor: unknown) {
    const novoNodes = rfNodes.map((n) =>
      n.id === nodeId
        ? {
            ...n,
            data: {
              ...n.data,
              flowNode: { ...n.data.flowNode, data: { ...(n.data.flowNode.data ?? {}), [campo]: valor } },
            },
          }
        : n,
    );
    /*
     * APAGAR UMA CONDIÇÃO APAGA A LIGAÇÃO DELA JUNTO.
     *
     * A saída de cada condição é identificada pelo id dela. Tirando a condição e deixando a
     * aresta, sobra uma ligação que aponta pra uma saída que não existe mais: ela some da tela
     * (o React Flow não acha o ponto) e continua gravada no fluxo, aparecendo de novo no
     * histórico de versões e na exportação. É a mesma limpeza que os botões de resposta já
     * fazem ao serem apagados (ver `mudarOpcoesDoBloco`).
     */
    let novoEdges = rfEdges;
    if (campo === "ramos") {
      const vivos = new Set((valor as { id: string }[] | undefined)?.map((r) => r.id) ?? []);
      novoEdges = rfEdges.filter(
        (e) => e.source !== nodeId || !e.sourceHandle || e.sourceHandle === "senao" || vivos.has(e.sourceHandle),
      );
      if (novoEdges.length !== rfEdges.length) setRfEdges(novoEdges);
    }
    setRfNodes(novoNodes);
    persist(novoNodes, novoEdges);
  }

  /** Tira a ligação que sai desta saída. Uma saída tem no máximo um caminho. */
  function desligarSaida(nodeId: string, handleId: string | undefined) {
    // O cartão de gatilhos fala por todos: desligar a saída dele desliga a dos gatilhos
    // escondidos junto, senão eles seguiriam disparando pro passo que a tela diz ter sido solto.
    const todos = idsDeGatilho(rfNodes, ehSocial);
    const fontes = nodeId === todos[0] ? new Set(todos) : new Set([nodeId]);
    const novoEdges = rfEdges.filter(
      (e) => !(fontes.has(e.source) && (e.sourceHandle ?? undefined) === handleId),
    );
    setRfEdges(novoEdges);
    persist(rfNodes, novoEdges);
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
    /* O passo seguinte nasce AO LADO no Social Seller e ABAIXO no funil: no mesmo sentido em que
       a pessoa lê o fluxo. Nascer no sentido errado obriga a arrastar todo bloco criado. */
    const pos = posicaoLivre(
      ehSocial ? { x: origem.position.x + 380, y: origem.position.y } : { x: origem.position.x, y: origem.position.y + 170 },
      rfNodes,
      ehSocial,
    );
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
    /*
     * SAINDO DO CARTÃO DE GATILHOS, TODOS OS GATILHOS SE LIGAM AO PASSO NOVO.
     *
     * O cartão desenha os gatilhos do fluxo inteiro, mas o "+" dele é o do PRIMEIRO bloco. Sem
     * isto, um robô com três gatilhos sairia com um ligado ao primeiro passo e dois sem saída
     * nenhuma: comentário dispararia e resposta de story não faria nada — e nada na tela diria
     * por quê, porque os dois não são desenhados.
     */
    const irmaos =
      nodeOrigemId === idsDeGatilho(rfNodes, ehSocial)[0]
        ? idsDeGatilho(rfNodes, ehSocial).filter((id) => id !== nodeOrigemId)
        : [];
    const edgesDosIrmaos: FlowRFEdge[] = irmaos.map((id) => ({
      id: novoIdAresta(),
      source: id,
      target: novoDomain.id,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    }));
    // O prazo entra junto: ver `garantirPrazoDeEspera`.
    const novoNodes = garantirPrazoDeEspera([...rfNodes, novoRF], nodeOrigemId, handleId);
    const novoEdges = [...rfEdges, novaEdge, ...edgesDosIrmaos];
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
  function adicionarFollowUp(nodeOrigemId: string | undefined, handleId: string | undefined) {
    // `nodeOrigemId` vazio = follow-up como PRIMEIRO passo de um robô que começa na etapa do
    // funil. Não há bloco anterior a que ligar, e o par entra solto no canvas, do mesmo jeito que
    // `onEscolher` já fazia com um bloco avulso. Sem este caminho o botão "Adicionar follow-up"
    // aparecia no primeiro passo e não fazia absolutamente nada.
    const origem = nodeOrigemId ? rfNodes.find((n) => n.id === nodeOrigemId) : undefined;
    if (nodeOrigemId && !origem) return;
    const base = origem ? origem.position : { x: 80, y: 80 };
    const receita = nosDeFollowUp({ horas: 2, mensagem: "" });

    const defEspera = BLOCOS_DISPONIVEIS.find((b) => b.tipo === receita.espera.tipo);
    const defMensagem = BLOCOS_DISPONIVEIS.find((b) => b.tipo === receita.mensagem.tipo);
    const defFim = BLOCOS_DISPONIVEIS.find((b) => b.tipo === receita.fim.tipo);
    if (!defEspera || !defMensagem || !defFim) return;

    const espera: DomainFlowNode = {
      id: novoIdNo(),
      type: receita.espera.tipo,
      category: defEspera.categoria,
      position: origem ? { x: base.x, y: base.y + 170 } : base,
      titulo: "Cronômetro",
      data: receita.espera.data,
    };
    const mensagem: DomainFlowNode = {
      id: novoIdNo(),
      type: receita.mensagem.tipo,
      category: defMensagem.categoria,
      // Desloca pra direita: o follow-up sai pelo ramo do tempo esgotado, e empilhar os dois na
      // mesma coluna faria a mensagem parecer o caminho de quem respondeu.
      position: origem ? { x: base.x + 260, y: base.y + 340 } : { x: base.x + 260, y: base.y + 170 },
      titulo: "Follow-up",
      data: receita.mensagem.data,
    };

    const fim: DomainFlowNode = {
      id: novoIdNo(),
      type: receita.fim.tipo,
      category: defFim.categoria,
      position: { x: mensagem.position.x, y: mensagem.position.y + 170 },
      titulo: "Fim do follow-up",
      data: receita.fim.data,
    };

    const rfEspera: FlowRFNode = { id: espera.id, type: espera.category, position: espera.position, data: { flowNode: espera, problemas: [] } };
    const rfMensagem: FlowRFNode = { id: mensagem.id, type: mensagem.category, position: mensagem.position, data: { flowNode: mensagem, problemas: [] } };
    const rfFim: FlowRFNode = { id: fim.id, type: fim.category, position: fim.position, data: { flowNode: fim, problemas: [] } };

    const seta = (source: string, target: string, sourceHandle?: string): FlowRFEdge => ({
      id: novoIdAresta(),
      source,
      target,
      sourceHandle,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    });

    const novoNodes = [...rfNodes, rfEspera, rfMensagem, rfFim];
    const novoEdges = [
      ...rfEdges,
      ...(nodeOrigemId ? [seta(nodeOrigemId, espera.id, handleId)] : []),
      seta(espera.id, mensagem.id, receita.saidaDaEspera),
      seta(mensagem.id, fim.id),
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
    // O Social Seller lê da esquerda pra direita; o funil, de cima pra baixo. Ver `autoLayout`.
    const novo = autoLayout(rfNodes, rfEdges, ehSocial ? "LR" : "TB");
    setRfNodes(novo);
    /*
     * ORGANIZAR TAMBÉM SOLTA A PASTILHA DE INÍCIO.
     *
     * Ela fica onde a pessoa a largou (posição gravada nas configurações), e isso é certo no dia
     * a dia. Mas depois de reorganizar tudo, a posição guardada vira a única peça fora de lugar:
     * o resto se arruma e ela fica sozinha do outro lado, ligada por uma linha atravessando a
     * tela. "Organizar" quer dizer tudo.
     */
    setPosicaoInicioArrastada(null);
    if (fluxo?.configuracoes?.posicaoInicio) updateConfiguracoes({ posicaoInicio: undefined });
    persist(novo, rfEdges);
    requestAnimationFrame(() => centralizarTudo());
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
  /**
   * TROCA O CONJUNTO INTEIRO DE GATILHOS DO FLUXO.
   *
   * A gaveta devolve a lista marcada, e não uma mudança: "estes são os gatilhos desta automação".
   * Reconciliar aqui é o que permite marcar dois e desmarcar um sem a gaveta precisar saber o que
   * havia antes.
   *
   * O QUE É PRESERVADO: o bloco de um gatilho que continua marcado mantém o MESMO id. Trocar o id
   * cortaria a aresta que sai dele, e com ela o caminho inteiro montado depois — a automação
   * perderia os passos por causa de uma caixinha desmarcada do lado.
   *
   * O QUE É LIGADO: todo gatilho novo recebe uma aresta pro mesmo primeiro passo dos que já
   * existiam. É isso que faz "responde a comentário E a story" ser uma automação só em vez de
   * duas: dois começos, um caminho.
   */
  function aplicarGatilhos(
    escolhas: { tipo: FlowNodeType; data: Record<string, unknown> }[],
    respostas: string[] = [],
  ) {
    const antigos = rfNodes.filter((n) => n.data.flowNode.category === "gatilho");
    const primeiroPasso = rfEdges.find((e) => antigos.some((g) => g.id === e.source))?.target;

    const porTipo = new Map(antigos.map((n) => [n.data.flowNode.type, n]));
    const usados = new Set<string>();

    /* O lugar do grupo: onde o primeiro gatilho já estava, ou o canto de sempre num fluxo novo. */
    const ancora = antigos[0]?.position ?? { x: 80, y: 80 };
    const novosGatilhos: FlowRFNode[] = escolhas.map((escolha) => {
      const bloco = BLOCOS_DISPONIVEIS.find((b) => b.tipo === escolha.tipo);
      const reaproveitado = porTipo.get(escolha.tipo);
      if (reaproveitado) usados.add(reaproveitado.id);
      const id = reaproveitado?.id ?? novoIdNo();
      /*
       * TODOS NO MESMO LUGAR: só o primeiro é desenhado.
       *
       * Eram empilhados numa coluna, um cartão por gatilho — que é justamente o que o cartão
       * único veio desfazer. Quem está escondido não precisa de lugar próprio, e dar um a ele
       * reabriria a pilha no dia em que alguém desenhasse os gatilhos de novo.
       */
      const position = reaproveitado?.position ?? ancora;
      const domain: DomainFlowNode = {
        id,
        type: escolha.tipo,
        category: "gatilho",
        position,
        data: { ...(bloco?.dataPadrao() as Record<string, unknown> | undefined), ...escolha.data },
      };
      return { id, type: "gatilho", position, data: { flowNode: domain, problemas: [] } };
    });

    const idsNovos = new Set(novosGatilhos.map((n) => n.id));
    const semGatilhos = rfNodes.filter((n) => n.data.flowNode.category !== "gatilho");
    const novoNodes = [...novosGatilhos, ...semGatilhos];

    // Arestas de gatilhos que saíram do conjunto vão junto com eles.
    const edgesMantidas = rfEdges.filter(
      (e) => !antigos.some((g) => g.id === e.source) || idsNovos.has(e.source),
    );
    const novoEdges = [...edgesMantidas];
    if (primeiroPasso) {
      novosGatilhos.forEach((g) => {
        if (novoEdges.some((e) => e.source === g.id)) return;
        novoEdges.push({
          id: novoIdAresta(),
          source: g.id,
          target: primeiroPasso,
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        });
      });
    }

    /*
     * A RESPOSTA DA ÚLTIMA ETAPA VIRA O PRIMEIRO PASSO.
     *
     * A gaveta terminava com os gatilhos ligados a nada, e quem acabou de criar a automação
     * tinha que descobrir sozinho que faltava arrastar um bloco de mensagem no canvas — que é
     * exatamente o passo em que se desiste.
     *
     * Existindo um primeiro passo de mensagem, ele é EDITADO; não existindo, nasce um. Trocar um
     * bloco que a pessoa já configurou (com anexo, com botões) por um de texto apagaria trabalho
     * feito, então só o texto é escrito.
     *
     * Lista vazia quer dizer "não mexa": é o que o "Pular" manda.
     */
    let nodesComResposta = novoNodes;
    let edgesComResposta = novoEdges;
    if (respostas.length) {
      const [principal, ...variacoes] = respostas;
      const alvo = primeiroPasso
        ? nodesComResposta.find((n) => n.id === primeiroPasso && n.data.flowNode.category === "mensagem")
        : undefined;

      if (alvo) {
        nodesComResposta = nodesComResposta.map((n) =>
          n.id === alvo.id
            ? {
                ...n,
                data: {
                  ...n.data,
                  flowNode: {
                    ...n.data.flowNode,
                    data: { ...(n.data.flowNode.data ?? {}), texto: principal, variacoes },
                  },
                },
              }
            : n,
        );
      } else if (!primeiroPasso) {
        const bloco = BLOCOS_DISPONIVEIS.find((b) => b.tipo === "mensagem_texto");
        const id = novoIdNo();
        const position = { x: ancora.x + 420, y: ancora.y };
        const domain: DomainFlowNode = {
          id,
          type: "mensagem_texto",
          category: "mensagem",
          position,
          data: {
            ...(bloco?.dataPadrao() as Record<string, unknown> | undefined),
            canal: "instagram",
            texto: principal,
            variacoes,
          },
        };
        nodesComResposta = [...nodesComResposta, { id, type: "mensagem", position, data: { flowNode: domain, problemas: [] } }];
        edgesComResposta = [
          ...edgesComResposta,
          ...novosGatilhos.map((g) => ({
            id: novoIdAresta(),
            source: g.id,
            target: id,
            type: "smoothstep",
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
          })),
        ];
      }
    }

    setRfNodes(nodesComResposta);
    setRfEdges(edgesComResposta);
    setSelectedNodeIds(novosGatilhos.length ? [novosGatilhos[0].id] : []);
    persist(nodesComResposta, edgesComResposta);
  }

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
   * Enquadra o fluxo inteiro no meio da tela.
   *
   * `fitView` sem mais nada obedecia o piso de zoom do React Flow (0.5), e um fluxo maior que isso
   * simplesmente não cabia: o enquadramento parava no limite e metade do desenho ficava fora da
   * vista. Com `minZoom` liberado na chamada, "Centralizar" volta a significar o que promete.
   */
  function centralizarTudo() {
    fitView({ duration: 300, padding: 0.2, minZoom: 0.05, maxZoom: 1.5 });
  }

  /**
   * Leva a tela até um bloco e pisca nele.
   *
   * Clicar num problema tem que MOSTRAR o problema. Antes isto usava `fitView` com folga de 150%,
   * e o resultado era enquadrar o bloco tão de longe que ele virava um pontinho: a tela mexia, e
   * quem estava procurando continuava sem achar. `setCenter` num zoom de leitura resolve, porque o
   * enquadramento passa a ser uma decisão e não uma consequência do tamanho do bloco.
   *
   * O piscar existe pelo mesmo motivo: num fluxo com vinte blocos parecidos, o que está no centro
   * da tela não é obviamente o que foi clicado.
   */
  function irParaONode(nodeId: string) {
    const alvo = rfNodes.find((n) => n.id === nodeId);
    if (!alvo) return;
    setSelectedNodeIds([nodeId]);

    // O centro do bloco, não o canto: `position` é o canto superior esquerdo, e centralizar por ele
    // deixa o bloco encostado na borda de cima em vez de no meio.
    const largura = alvo.measured?.width ?? 280;
    const altura = alvo.measured?.height ?? 120;
    setCenter(alvo.position.x + largura / 2, alvo.position.y + altura / 2, { zoom: 1.1, duration: 400 });

    setNodePiscando(nodeId);
    if (piscarRef.current) clearTimeout(piscarRef.current);
    piscarRef.current = setTimeout(() => setNodePiscando(null), 1800);
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
    // Lido ANTES do `setTimeout`: depois de publicar, `versaoAtual` já subiu e `ativa` já pode ter
    // sido ligada, e o aviso passaria a descrever o depois em vez do antes.
    const jaEstavaAtiva = fluxo?.ativa ?? false;
    const primeiraPublicacao = (fluxo?.versaoAtual ?? 0) === 0;
    // setTimeout(0) garante que `publicarFluxo` (que lê o estado do contexto) já
    // enxerga o `atualizarFluxo` de cima. Os dois não podem rodar na mesma
    // atualização em lote do React.
    setTimeout(() => {
      const resultado = publicarFluxo(fluxoId, "Você");
      const erros = resultado.filter((p) => p.severidade === "erro");
      if (erros.length > 0) {
        avisar(`Não deu pra publicar: ${erros.length} problema(s). Veja a aba "Problemas" no painel à direita.`);
      } else if (jaEstavaAtiva || primeiraPublicacao) {
        avisar("Fluxo publicado e no ar.");
      } else {
        // Republicar não religa um robô pausado de propósito. Dizer só "publicado com sucesso"
        // aqui faria a pessoa esperar por uma execução que não vem.
        avisar("Fluxo publicado, mas ele está pausado. Ligue no botão ao lado pra ele voltar a rodar.");
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
  const nodesParaRenderizar = useMemo(() => {
    const idsGatilho = idsDeGatilho(rfNodes, ehSocial);
    /** O bloco que DESENHA o cartão de gatilhos: o primeiro do fluxo. */
    const host = idsGatilho.length ? idsGatilho[0] : null;
    /** Os que existem, estão ligados e não são desenhados. */
    const escondidos = new Set(idsGatilho.slice(1));
    const doGrupo = idsGatilho.map((id) => {
      const no = rfNodes.find((x) => x.id === id);
      const tipo = no?.data.flowNode.type as FlowNodeType;
      const bloco = BLOCOS_DISPONIVEIS.find((b) => b.tipo === tipo);
      return { tipo, label: bloco?.label ?? String(tipo) };
    });
    const dadosDoPrimeiro = (rfNodes.find((x) => x.id === host)?.data.flowNode.data ?? {}) as {
      palavras?: unknown;
    };
    const palavrasDoGrupo = Array.isArray(dadosDoPrimeiro.palavras)
      ? dadosDoPrimeiro.palavras.filter((pa): pa is string => typeof pa === "string" && pa.trim().length > 0)
      : [];

    return rfNodes
      .map((n, indice) => ({
        ...n,
        /* O primeiro gatilho de um fluxo social não se desenha como bloco: ele desenha o cartão
           com todos. O tipo trocado aqui é só de DESENHO — `rfNodes` segue com `gatilho`, que é
           o que vai pro fluxo salvo. */
        type: n.id === host ? ("grupo-gatilhos" as const) : n.type,
        className: [
          nodesRelacionados && !nodesRelacionados.has(n.id) ? "flow-node-apagado" : "",
          n.id === nodePiscando ? "flow-node-piscando" : "",
        ]
          .filter(Boolean)
          .join(" ") || undefined,
        data: {
          ...n.data,
          /* O cartão de gatilhos responde pelos escondidos: a pendência de um gatilho que não é
             desenhado não teria onde aparecer, e some da tela um aviso que o robô tem. */
          problemas:
            n.id === host
              ? idsGatilho.flatMap((id) => problemasPorNode.get(id) ?? [])
              : (problemasPorNode.get(n.id) ?? []),
          saidasConectadas: saidasConectadasPorNode.get(n.id),
          caminhosConvergindo: entradasPorNode.get(n.id) ?? 0,
          ordemNarrativa: ordemNarrativaPorNode?.get(n.id),
          explicacao: entenderFluxoAtivo ? explicacaoDoNo(n.data.flowNode, funis) : undefined,
          onAdicionarApos: modoConstrucao
            ? (handleId: string | undefined, ancora?: DOMRect) => setAcaoRapida({ nodeId: n.id, handleId, ancora })
            : undefined,
          area,
          /* Os dois botões que aparecem em cima do bloco selecionado, no Social Seller. */
          /* Duplicar e apagar deixaram de ser exclusivos do Social Seller: agora os dois
             editores têm o "⋯" no cartão, que é onde a referência os põe. */
          aoDuplicar: modoConstrucao ? () => duplicarUm(n.id) : undefined,
          aoRemover: modoConstrucao ? () => removerNodes([n.id]) : undefined,
          numero: indice + 1,
          aoEditarTexto: modoConstrucao ? (texto: string) => editarTextoDoBloco(n.id, texto) : undefined,
          aoRenomear: modoConstrucao ? (titulo: string) => renomearBloco(n.id, titulo) : undefined,
          aoTestar: () => setSimuladorAberto(true),
          aoAnexar:
            modoConstrucao && n.data.flowNode.category === "mensagem"
              ? (arquivo: { dataUrl: string; nome: string; mimeType: string; bytes: number }) =>
                  void anexarNoBloco(n.id, arquivo)
              : undefined,
          aoDesligarSaida: modoConstrucao ? (handleId: string | undefined) => desligarSaida(n.id, handleId) : undefined,
          aoMudarCanal:
            modoConstrucao && n.data.flowNode.category === "mensagem"
              ? (canal: string) => editarCampoDoBloco(n.id, "canal", canal)
              : undefined,
          aoMudarCampo: modoConstrucao
            ? (campo: string, valor: unknown) => editarCampoDoBloco(n.id, campo, valor)
            : undefined,
          // Só no funil: no Social Seller o painel não tem abas, e as pendências ficam no
          // cabeçalho do editor (ver `ConfigPanel`).
          aoAbrirProblemas: ehSocial
            ? undefined
            : () => {
                setSelectedNodeIds([n.id]);
                setAbaPedida({ aba: "problemas", token: Date.now() });
              },
          /* O cronômetro só aparece no modo de tempo puro: "até a resposta" e "até tal data" não
             têm minutos pra editar, e um campo de minutos ali mentiria sobre o que o bloco faz. */
          aoMudarCronometro:
            modoConstrucao &&
            n.data.flowNode.type === "aguardar" &&
            ["minutos", "horas", "dias", "ate_resposta"].includes(
              ((n.data.flowNode.data ?? {}) as { modo?: string }).modo ?? "",
            )
              ? (minutos: number) => definirCronometro(n.id, minutos)
              : undefined,
          aoMudarOpcoes:
            modoConstrucao &&
            (n.data.flowNode.type === "mensagem_texto" || n.data.flowNode.type === "mensagem_botoes")
              ? (opcoes: { id: string; rotulo: string; url?: string }[]) => mudarOpcoesDoBloco(n.id, opcoes)
              : undefined,
          ...(n.id === host
            ? {
                gatilhosDoGrupo: doGrupo,
                palavrasDoGrupo,
                /*
                 * O CARTÃO ABRE O PAINEL, não o passo a passo.
                 *
                 * Clicar em "Gatilhos ativos" num robô que já existe não é começar de novo: é ir
                 * ver o que está escolhido e mexer. O passo a passo continua sendo o caminho de
                 * quem está MONTANDO — ele abre sozinho no quadro vazio.
                 */
                aoAbrirGatilhos: modoConstrucao
                  ? () => {
                      setEtapaDaGaveta(idsGatilho.length ? "painel" : "lista");
                      setEscolherGatilhoAberto(true);
                    }
                  : undefined,
                aoAbrirPalavras: modoConstrucao
                  ? () => {
                      setEtapaDaGaveta(idsGatilho.length ? "painel" : "palavras");
                      setEscolherGatilhoAberto(true);
                    }
                  : undefined,
                /* Apagar o cartão apaga o GRUPO: ele representa todos, e deixar um gatilho
                   invisível vivo depois de "tirar os gatilhos" é um robô que continua disparando
                   sem nada na tela dizendo por quê. */
                aoRemover: modoConstrucao
                  ? () => removerNodes(idsDeGatilho(rfNodes, ehSocial))
                  : undefined,
              }
            : {}),
        },
      }))
      .filter((n) => !escondidos.has(n.id));
  },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `duplicarUm` e `removerNodes` são
    // funções recriadas a cada render; incluí-las refaria o mapa de nós em todo render, que é o
    // oposto do que este memo existe pra evitar. Elas só leem estado no momento do clique.
    [rfNodes, problemasPorNode, saidasConectadasPorNode, entradasPorNode, ordemNarrativaPorNode, entenderFluxoAtivo, nodesRelacionados, modoConstrucao, funis, nodePiscando, area, ehSocial],
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
   * A pastilha verde (ou o cartão de abertura) e a linha que sai dela.
   *
   * Entram no que é DESENHADO, nunca no estado: não são blocos do fluxo, o motor não os executa, e
   * salvá-los criaria um passo fantasma. Por isso não se selecionam e não se apagam.
   *
   * ARRASTAM, sim. "Tudo tem que ser movível dentro do quadro branco" — e a pastilha era a única
   * peça presa, grudada 230px à esquerda do primeiro bloco. O que se grava é só a posição, nas
   * configurações; o início continua fora do fluxo.
   *
   * COM O CANVAS VAZIO ele vira o cartão de abertura, no mesmo lugar onde antes havia um aviso
   * centralizado POR CIMA do canvas — que não se movia, não fazia parte do desenho, e sumia no
   * instante em que o primeiro bloco entrava.
   */
  /**
   * ONDE A PASTILHA DE INÍCIO ESTÁ AGORA.
   *
   * Serve pra duas coisas, e é por isso que mora fora do memo: desenhar a pastilha, e colocar o
   * PRIMEIRO bloco ao lado dela. Sem a segunda, o primeiro bloco nascia numa coordenada fixa e a
   * ligação entre os dois virava um "L" atravessando meia tela — que foi exatamente a
   * reclamação. Com ela, o bloco nasce colado e a linha é um traço curto.
   */
  const posicaoDoInicio = posicaoInicioArrastada ?? fluxo?.configuracoes?.posicaoInicio ?? { x: 120, y: 120 };

  const inicioDesenhado = useMemo(() => {
    const alvo = rfNodes.find((n) => n.id === idDoPrimeiroBloco);
    if (!alvo && !modoConstrucao) return null;

    /*
     * A PASTILHA NASCE À ESQUERDA DO PRIMEIRO BLOCO — E SEM ENCOSTAR NELE.
     *
     * Eram 200px fixos, decididos quando a pastilha media 150. No funil ela mede 230, porque tem
     * uma segunda linha ("Lead entra em …"): 230 de largura em 200 de distância é a pastilha
     * COBRINDO 30px do primeiro bloco. O afastamento passa a sair da largura dela mais a folga,
     * em vez de um número que vale pra um dos dois tamanhos.
     */
    const larguraDoInicio = inicioNoFunil ? 230 : 150;
    const posicaoPadrao = alvo
      ? { x: alvo.position.x - (larguraDoInicio + 70), y: alvo.position.y + 6 }
      : { x: 120, y: 120 };
    const no: FlowRFNode = {
      id: ID_INICIO,
      type: "inicio",
      position: posicaoInicioArrastada ?? fluxo?.configuracoes?.posicaoInicio ?? posicaoPadrao,
      /*
       * O TAMANHO VAI ESCRITO, e isto não é enfeite.
       *
       * O React Flow descobre o tamanho de cada nó medindo o DOM e avisando por `onNodesChange`
       * — e este nó é desenhado, então a gente DESCARTA as mudanças dele pra ele não ser salvo.
       * Resultado: o React Flow nunca aprendia o tamanho dele. Com ele sozinho no canvas (fluxo
       * novo), o `fitView` calculava um retângulo vazio e jogava a viewport pra um lugar
       * qualquer: a pastilha existia e ficava fora da tela. Era exatamente o "não aparece iniciar
       * robô". Com a medida declarada, o enquadramento acha a peça.
       */
      /*
       * A MEDIDA DECLARADA É A MEDIDA DESENHADA: a pastilha preenche o nó (ver `.no-inicio` no
       * globals.css), então estes números são, ao pé da letra, o tamanho dela na tela. Dois
       * valores porque no funil ela tem uma segunda linha ("Lead entra em …") e precisa de mais
       * largura pra frase caber sem reticências.
       */
      width: inicioNoFunil ? 230 : 150,
      height: inicioNoFunil ? 56 : 40,
      /*
       * `measured` À MÃO, e é isto que faz o FIO aparecer.
       *
       * O React Flow calcula o ponto de onde a linha sai a partir de `measured` — que ele mesmo
       * preenche medindo o DOM e avisando por `onNodesChange`. Como a gente descarta as mudanças
       * dos nós desenhados (pra eles não virarem bloco salvo), este nó nunca tinha medida, e a
       * aresta que sai dele não tinha de onde partir: o "Iniciar robô" ficava solto, sem ligação
       * com o primeiro bloco. Declarar a medida resolve sem reabrir a porta do salvamento.
       */
      measured: { width: inicioNoFunil ? 230 : 150, height: inicioNoFunil ? 56 : 40 },
      draggable: modoConstrucao,
      selectable: false,
      deletable: false,
      data: {
        // Sem bloco de destino (canvas vazio) não há `flowNode` de verdade; o componente do
        // início não lê nenhum campo dele, e o tipo exige que exista.
        flowNode: alvo?.data.flowNode ?? ({ id: ID_INICIO, type: "inicio", category: "gatilho" } as unknown as DomainFlowNode),
        problemas: [],
        ...(inicioNoFunil ? { detalheInicio: `Lead entra em “${inicioNoFunil.etapaTitulo}”` } : {}),
      } as FlowRFNode["data"],
    };
    if (!alvo) return { no, aresta: null };
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
  }, [
    rfNodes,
    idDoPrimeiroBloco,
    inicioNoFunil,
    modoConstrucao,
    posicaoDoInicio,
    posicaoInicioArrastada,
    fluxo?.configuracoes?.posicaoInicio,
  ]);

  const edgesParaRenderizar = useMemo(() => {
    /* A ligação de um gatilho escondido levaria ao mesmo lugar que a do cartão: desenhada,
       seriam três curvas sobrepostas saindo do nada. */
    const escondidos = new Set(idsDeGatilho(rfNodes, ehSocial).slice(1));
    return rfEdges
      .filter((e) => !escondidos.has(e.source))
      .map((e) => ({
        ...e,
        className: arestasRelacionadas && !arestasRelacionadas.has(e.id) ? "flow-edge-apagada" : undefined,
        zIndex: arestasRelacionadas?.has(e.id) ? 1 : 0,
      }));
  }, [rfEdges, rfNodes, ehSocial, arestasRelacionadas]);

  const edgesComInicio = useMemo(
    () => (inicioDesenhado?.aresta ? [inicioDesenhado.aresta, ...edgesParaRenderizar] : edgesParaRenderizar),
    [inicioDesenhado, edgesParaRenderizar],
  );

  /* A lixeira do hover da ligação. Só no Social Seller: no funil a seta se apaga pela seleção. */
  const edgeTypes = useMemo(() => ({ social: ArestaSocial }), []);
  const edgesDesenhadas = useMemo(
    () =>
      ehSocial
        ? edgesComInicio.map((e) => ({ ...e, type: "social", data: { aoApagar: removerAresta } }) as FlowRFEdge)
        : edgesComInicio,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [edgesComInicio, ehSocial],
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

  /**
   * As props da caixa de próximo passo, montadas uma vez.
   *
   * Um objeto, e não uma função que devolve o JSX: chamar uma função durante o render que lê
   * `ref` é o que o `react-hooks/refs` proíbe — e os `adicionar…` aqui dentro leem. Como objeto,
   * eles só são chamados no clique, que é o lugar certo.
   */
  const propsDoProximoPasso = {
    tipoAnterior: noDaAcaoRapida?.type,
    categoriaAnterior: noDaAcaoRapida?.category,
    area,
    rotuloDaSaida: saidaDaAcaoRapida?.label || undefined,
    onEscolher: (tipo: FlowNodeType) => {
      // `nodeId` vazio = "primeiro passo" de um robô que começa na etapa do funil: não há bloco
      // anterior a que conectar, então o passo entra solto no canvas.
      if (escolhendoProximoPasso?.nodeId)
        adicionarBlocoConectado(tipo, escolhendoProximoPasso.nodeId, escolhendoProximoPasso.handleId);
      // Ao lado da pastilha, e não numa coordenada fixa: ver `posicaoDoInicio`.
      else adicionarBloco(tipo, posicaoLivre({ x: posicaoDoInicio.x + 300, y: posicaoDoInicio.y - 6 }, rfNodes, ehSocial));
      setAcaoRapida(null);
    },
    onFollowUp: () => {
      if (!escolhendoProximoPasso) return;
      adicionarFollowUp(escolhendoProximoPasso.nodeId, escolhendoProximoPasso.handleId);
      setAcaoRapida(null);
    },
    onFechar: () => fecharEscolha(),
    /*
     * A CAIXINHA TAMBÉM NO FUNIL, e não só no Social Seller.
     *
     * A gaveta de altura cheia cobria metade do desenho pra uma escolha de um segundo, e repetia
     * o título no topo. A caixa mostra a mesma lista inteira, com busca, sem tirar o fluxo da
     * vista — que é como a referência faz.
     */
    compacto: true,
  };

  if (!fluxo) {
    return (
      <div className="flow-shell-empty">
        <p>{carregado && desistiuDeAchar ? "Esse fluxo não existe (mais)." : "Carregando o fluxo…"}</p>
      </div>
    );
  }

  return (
    <div className={`flow-shell${ehSocial ? " flow-shell-social" : ""}`}>
      {/*
        UMA BARRA SÓ, pros dois editores.
        
        A do funil tinha doze controles na mesma linha: voltar, nome, etiqueta, aviso de
        pendência, três modos, desfazer, refazer, organizar, entender fluxo, histórico, execuções,
        testar, um interruptor de ativo e dois botões de gravar. Cabia porque foi crescendo, não
        porque foi desenhada — e a Thaynara comparou com o Kommo, onde o editor abre com o nome, o
        salvar e o fechar, e mais nada.
        
        NADA SAIU DO EDITOR. O que não está na barra está no "⋮" ou na coluna de ferramentas do
        canvas, à direita.
      */}
      <ToolbarSocial
        hrefVoltar={ehSocial ? "/social-seller/automacoes" : "/automacoes"}
        nome={fluxoNaTela.nome}
        onChangeNome={(nome) => updateFluxoMeta({ nome })}
        status={fluxo.status}
        salvando={salvando}
        salvoEm={salvoEm}
        temPendencia={temPendencia}
        onSalvarAlteracoes={salvarAlteracoes}
        onDescartarAlteracoes={descartarAlteracoes}
        ativa={fluxo.ativa}
        podeAtivar={fluxo.status === "publicado"}
        onToggleAtiva={() => alternarAtivo(fluxoId)}
        onTestar={() => setSimuladorAberto(true)}
        onSalvarRascunho={salvarRascunhoAgora}
        onPublicar={publicar}
        onAbrirHistorico={() => setHistoricoAberto(true)}
        onAbrirExecucoes={() => setExecucoesAbertas(true)}
        onExcluir={() => setConfirmandoExclusao(true)}
        onAbrirConfiguracoes={() => {
          setSelectedNodeIds([]);
          setConfigGeralAberta(true);
        }}
        entenderFluxoAtivo={entenderFluxoAtivo}
        onAlternarEntenderFluxo={() => setEntenderFluxoAtivo((v) => !v)}
        modoConstrucao={modoConstrucao}
        onAlternarModo={() => setModoConstrucao((v) => !v)}
        modoPassos={modoPassos}
        onModoPassos={setModoPassos}
      />

      <div className="flow-body">
        {/*
          SEM BIBLIOTECA FIXA à esquerda, em nenhum dos dois.
          
          Era uma coluna com dez categorias e sessenta blocos, aberta o tempo todo, ocupando um
          terço da tela. O bloco entra por onde a pessoa está olhando: o "+" da saída do bloco
          anterior, ou o "+" da coluna de ferramentas — e os dois abrem a MESMA lista, com busca.
          Uma paleta fixa a mais era um terceiro lugar pra procurar a mesma coisa.
        */}

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
            edges={edgesDesenhadas}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            /*
             * Zoom bem largo nos dois sentidos.
             *
             * O padrão do React Flow é de 0.5 a 2, e o piso de 0.5 era o defeito: "Centralizar"
             * respeita esse limite, então um fluxo maior que a tela em 50% não cabia de jeito
             * nenhum. O enquadramento parava no limite e o resto ficava pra fora, exatamente o
             * sintoma de clicar em Centralizar e o desenho sumir.
             *
             * 0.05 deixa caber um fluxo de dezenas de blocos; 4 deixa ler o texto de um bloco
             * sem apertar os olhos.
             */
            minZoom={0.05}
            maxZoom={4}
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
            /* Com um nó só no canvas, o enquadramento sem teto estoura o zoom até `maxZoom` (4) e
               a pastilha vira um cartaz. 1.1 deixa o fluxo novo abrir no tamanho em que ele vai
               ser editado. */
            fitViewOptions={{ padding: 0.35, minZoom: 0.05, maxZoom: 1.1 }}
            proOptions={{ hideAttribution: true }}
          >
            {/*
              SEM PONTILHADO, em nenhum dos dois editores.
              
              Ele já tinha saído do Social Seller, onde a referência é papel liso. A Thaynara pediu
              a mesma coisa no editor do funil: "esse pontilhado causa muita estranheza". É um
              padrão de ferramenta de diagrama — ele serve pra sugerir uma malha onde as peças
              encaixam, e aqui nada encaixa em malha nenhuma. O que fica é papel, e a atenção vai
              pros blocos.
            */}
            {/*
              No Social Seller a coluna da direita substitui estes controles: ter os dois seria
              zoom em dois lugares, e o de baixo-à-esquerda é o que ninguém acha.
            */}
            {/* A COLUNA DE FERRAMENTAS, nos dois editores: zoom, desfazer, refazer, organizar,
                execuções, histórico e o "+" que abre a lista de blocos. Ela substitui a fileira de
                botões que ficava na barra de cima do funil. */}
            <Panel position="top-right">
              <BarraFerramentasSocial
                  podeDesfazer={historyIndex > 0}
                  podeRefazer={historyIndex < historyLen - 1}
                  habilitado={modoConstrucao}
                  entenderFluxoAtivo={entenderFluxoAtivo}
                  onAdicionar={() => setAcaoRapida({ nodeId: "", handleId: undefined })}
                  onZoomMais={() => zoomIn({ duration: 200 })}
                  onZoomMenos={() => zoomOut({ duration: 200 })}
                  onCentralizar={() => centralizarTudo()}
                  onDesfazer={undo}
                  onRefazer={redo}
                  onOrganizar={organizarAutomaticamente}
                  onExecucoes={() => setExecucoesAbertas(true)}
                  onHistorico={() => setHistoricoAberto(true)}
                onAlternarEntenderFluxo={() => setEntenderFluxoAtivo((v) => !v)}
              />
            </Panel>

            {/* "Salvo em…" longe dos botões: é informação, não controle. */}
            <Panel position="bottom-right">
                <span className={`ss-salvo${salvando ? " salvando" : ""}`}>
                  {salvando ? (
                    traduzir("Salvando…")
                  ) : salvoEm ? (
                    <>
                      <IconCheck width={13} height={13} aria-hidden="true" />
                      {traduzir("Salvo em")} {new Date(salvoEm).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}{" "}
                      {traduzir("às")}{" "}
                      {new Date(salvoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </>
                  ) : null}
                </span>
            </Panel>

            {/*
              SEM OS CONTROLES DE BAIXO E SEM O MINIMAPA.
              
              O zoom existia em dois lugares — no canto de baixo à esquerda, que ninguém acha, e
              agora na coluna da direita. O minimapa vinha ligado por padrão e ocupava um pedaço
              do canvas num fluxo de seis blocos, que é o tamanho da maioria. A coluna da direita
              tem "Centralizar", que é o que o minimapa de fato resolvia.
            */}
            {modoConstrucao && selectedNodeIds.length > 0 ? (
              <Panel position="top-center">
                <div className="flow-selection-bar">
                  <span>{selectedNodeIds.length} selecionado(s)</span>
                  <button type="button" className="btn ghost" title={traduzir("Duplicar (Ctrl+D)")} onClick={duplicarSelecionados}>
                    {traduzir("Duplicar")}
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    title={traduzir("Excluir (Delete)")}
                    onClick={() => removerNodes(selectedNodeIds)}
                  >
                    {traduzir("Excluir")}
                  </button>
                </div>
              </Panel>
            ) : null}
          </ReactFlow>

          {!modoConstrucao && rfNodes.length === 0 ? (
            <div className="flow-inicio-vazio">
              <p className="flow-inicio-vazio-titulo">{traduzir("Esse fluxo ainda não tem nenhum bloco.")}</p>
              <p className="flow-inicio-vazio-sub">{traduzir("Troque pro modo Construir pra montar a automação.")}</p>
            </div>
          ) : null}

          {escolhendoGatilho && ehSocial ? (
            <GatilhosDoSocial
              etapaInicial={etapaDaGaveta}
              /* O que o fluxo já responde: a gaveta reabre com o texto na tela, em vez de pedir
                 de novo o que já está escrito no primeiro bloco. */
              respostasIniciais={(() => {
                const ids = idsDeGatilho(rfNodes, ehSocial);
                const alvoId = rfEdges.find((e) => ids.includes(e.source))?.target;
                const alvo = alvoId ? rfNodes.find((n) => n.id === alvoId) : undefined;
                if (!alvo || alvo.data.flowNode.category !== "mensagem") return undefined;
                const d = (alvo.data.flowNode.data ?? {}) as { texto?: string; variacoes?: string[] };
                const todas = [d.texto ?? "", ...(d.variacoes ?? [])].filter((t) => t.trim());
                return todas.length ? todas : undefined;
              })()}
              gatilhosAtuais={domainNodesAtuais
                .filter((n) => n.category === "gatilho")
                .map((n) => ({ tipo: n.type, data: (n.data ?? {}) as Record<string, unknown> }))}
              onFechar={fecharEscolha}
              onEscolher={(escolhas, respostas) => {
                aplicarGatilhos(escolhas, respostas);
                setEscolherGatilhoAberto(false);
                setEtapaDaGaveta("lista");
              }}
            />
          ) : null}

          {escolhendoGatilho && !ehSocial ? (
            <div className="modal-overlay" onClick={fecharEscolha}>
              <div className="modal flow-escolher-gatilho" onClick={(e) => e.stopPropagation()}>
                <div className="panel-h">
                  <h4>{traduzir("Quando isso deve acontecer?")}</h4>
                  <button
                    type="button"
                    className="modal-close-btn"
                    aria-label={traduzir("Fechar")}
                    onClick={fecharEscolha}
                  >
                    <IconClose width={13} height={13} />
                  </button>
                </div>
                {/*
                  TODOS OS GATILHOS DA ÁREA, e não só os comuns com um "ver todos" embaixo.
                  
                  O "ver todos" abria a biblioteca fixa da esquerda, que não existe mais. Em vez
                  de um segundo lugar pra procurar, a lista inteira fica aqui — ela tem dezesseis
                  linhas, cabe, e some a pergunta "onde está o resto?".
                */}
                <div className="flow-escolher-gatilho-lista">
                  {BLOCOS_DISPONIVEIS.filter(
                    (b) => b.categoria === "gatilho" && blocoApareceNaArea(b, area),
                  ).map((bloco) => (
                    <button
                      type="button"
                      key={bloco.tipo}
                      className="flow-escolher-gatilho-item"
                      onClick={() => {
                        adicionarBloco(bloco.tipo, { x: posicaoDoInicio.x + 260, y: posicaoDoInicio.y - 6 });
                        fecharEscolha();
                      }}
                    >
                      <span className="n">{traduzir(bloco.label)}</span>
                      <span className="r">{traduzir(bloco.descricao)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {escolhendoProximoPasso ? (
            /*
             * A CAIXA FICA GRUDADA NO QUE A ABRIU, e o fio junto.
             *
             * Dois caminhos, e a diferença é só de onde sai o fio: do "+" de um bloco, ou da
             * pastilha "Iniciar robô" — que não é clicada. Nos dois a âncora é MEDIDA A CADA
             * QUADRO, e não guardada no clique: guardada, a caixa ficava onde estava quando o
             * bloco era arrastado, e o fio virava um arco atravessando meia tela.
             *
             * O "+" da barra de ferramentas cai no caso da pastilha de propósito: o bloco que ele
             * cria nasce ao lado dela, então é de lá que a linha tem que sair. O lugar fixo no
             * meio da tela é o último recurso, pro quadro vazio sem pastilha nenhuma.
             */
            acaoRapida?.nodeId ? (
              <ProximoPassoJuntoAoBloco
                {...propsDoProximoPasso}
                nodeId={acaoRapida.nodeId}
                handleId={acaoRapida.handleId}
                ancoraInicial={acaoRapida.ancora}
              />
            ) : inicioDesenhado ? (
              <ProximoPassoJuntoAoInicio no={inicioDesenhado.no} {...propsDoProximoPasso} />
            ) : (
              <PainelProximoPasso {...propsDoProximoPasso} juntoAoInicio />
            )
          ) : null}

          {menuContexto
            ? (() => {
                const noAlvo = rfNodes.find((n) => n.id === menuContexto.nodeId);
                const podeAdicionarDepois =
                  noAlvo && saidasDoNo(noAlvo.data.flowNode).length === 1 && !saidasConectadasPorNode.get(noAlvo.id)?.has("__default__");
                return (
                  /* Fecha clicando em qualquer lugar fora dele, como todo menu do CRM. Antes só
                     fechava clicando no fundo do canvas: clicar num bloco deixava o menu aberto
                     em cima de outro bloco. */
                  <div className="flow-ctx-menu" data-menu-de-linha="" style={{ top: menuContexto.y, left: menuContexto.x }}>
                    {podeAdicionarDepois ? (
                      <button
                        type="button"
                        onClick={() => {
                          // Com âncora: a caixa nasce colada no bloco e o fio diz de qual bloco
                          // ela saiu. Sem isso ela abria longe, sem ligação com nada.
                          setAcaoRapida({
                            nodeId: menuContexto.nodeId,
                            handleId: undefined,
                            ancora: retanguloDoNo(menuContexto.nodeId),
                          });
                          setMenuContexto(null);
                        }}
                      >
                        {traduzir("Adicionar depois")}
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
                      {traduzir("Duplicar")}
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
                      {traduzir("Excluir")}
                    </button>
                  </div>
                );
              })()
            : null}
        </div>
        )}

        {/*
          NO SOCIAL SELLER O PAINEL SÓ EXISTE COM UM BLOCO SELECIONADO.
          
          No funil ele é uma coluna fixa: fica aberta o tempo todo e, sem seleção, mostra as
          configurações gerais do fluxo. Na referência do Instagram é uma GAVETA — ela aparece
          quando se clica num bloco e some quando se fecha. A diferença não é estética: com a
          coluna presa, o canvas de uma automação de seis blocos perde 448px de largura o tempo
          todo pra um painel que, sem seleção, não está respondendo pergunta nenhuma.
          
          As configurações gerais do fluxo não se perderam: elas continuam no "⋮" do cabeçalho.
        */}
        {/*
          O PAINEL DA DIREITA SÓ EXISTE QUANDO HÁ O QUE CONFIGURAR.
          
          Ele ficava aberto o tempo todo no funil, com "Configurar" e "Problemas", ocupando 380px
          de tela pra mostrar o nome do fluxo — que já está escrito na barra de cima. Agora abre
          ao clicar num bloco, ou pelo "Configurações da automação" do menu "⋮".
        */}
        {selectedNodes.length === 0 && !configGeralAberta ? null : (
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
          onSelecionarNode={irParaONode}
          abaPedida={abaPedida}
          ehSocial={ehSocial}
          onFechar={() => {
            setSelectedNodeIds([]);
            setConfigGeralAberta(false);
          }}
          onSalvar={salvarAlteracoes}
          temPendencia={temPendencia}
        />
        )}
      </div>

      {simuladorAberto && fluxoParaSimular ? <Simulador fluxo={fluxoParaSimular} onFechar={() => setSimuladorAberto(false)} /> : null}

      {/*
        APAGAR O ROBÔ, com confirmação e dizendo o que vai junto.
        
        Os gatilhos de etapa que executam este robô são apagados com ele (ver o DELETE em
        `/api/automacoes-fluxos/[id]`): deixá-los pra trás enchia a grade do funil de cartões
        "robô apagado" e fazia a varredura do cron tentar executar um fluxo que não existe mais.
      */}
      <ModalConfirmacao
        aberto={confirmandoExclusao}
        titulo={traduzir("Excluir este robô?")}
        mensagem={traduzir(
          "O robô \"{nome}\" e os gatilhos de etapa que o executam são apagados. As execuções que já aconteceram ficam no histórico. Não dá pra desfazer.",
          { nome: fluxo.nome },
        )}
        rotuloConfirmar={traduzir("Excluir o robô")}
        perigoso
        onCancelar={() => setConfirmandoExclusao(false)}
        onConfirmar={() => {
          setConfirmandoExclusao(false);
          excluirFluxo(fluxoId);
          router.push("/automacoes");
        }}
      />
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

/**
 * O retângulo de um bloco NA TELA, pela marcação que o React Flow deixa no DOM.
 *
 * Serve pra caixa de próximo passo nascer colada no bloco quando ela não foi aberta por um "+"
 * (que já entrega o retângulo no clique), e sim pelo menu de contexto. Só é chamado dentro de um
 * clique: ler o DOM durante o render seria ler um layout que ainda vai mudar.
 */
/*
 * TODOS OS GATILHOS NUM CARTÃO SÓ (ver `GrupoGatilhosNode`).
 *
 * O motor guarda um bloco por gatilho — cada um tem configuração própria — e o canvas desenhava
 * um cartão por bloco. Três gatilhos viravam três cartões empilhados, cada um com a sua linha
 * saindo pro mesmo primeiro passo, como se o fluxo tivesse três começos. Tem um só.
 *
 * O PRIMEIRO bloco desenha a lista inteira; os outros continuam salvos e ligados, só não são
 * desenhados. Nada muda no fluxo gravado: muda o desenho.
 *
 * Função de módulo, e não um `useMemo` compartilhado: um objeto criado no render e usado como
 * dependência de outros memos é exatamente o que o compilador do React recusa ("esta dependência
 * pode ser modificada depois"). Recalcular uma lista de ids dentro de cada memo é barato.
 */
function idsDeGatilho(nodes: FlowRFNode[], ehSocial: boolean): string[] {
  if (!ehSocial) return [];
  return nodes.filter((n) => n.data.flowNode.category === "gatilho").map((n) => n.id);
}

function retanguloDoNo(nodeId: string): DOMRect | undefined {
  if (typeof document === "undefined") return undefined;
  const elemento = document.querySelector(`.react-flow__node[data-id="${CSS.escape(nodeId)}"]`);
  return elemento?.getBoundingClientRect();
}


/**
 * UM LUGAR LIVRE PRO BLOCO NOVO, a partir de onde ele deveria nascer.
 *
 * O passo seguinte nascia num deslocamento fixo — 380 à direita no Social Seller, 170 abaixo no
 * funil — e, quando aquele lugar já estava ocupado, o bloco novo nascia EM CIMA do que já estava
 * lá. Com um bloco alto (uma condição com quatro caminhos é alta), isso acontece sempre que o
 * fluxo tem mais de um ramo.
 *
 * A busca anda no sentido perpendicular ao da leitura: no Social Seller, que lê da esquerda pra
 * direita, o bloco desce; no funil, que lê de cima pra baixo, ele vai pra direita. Assim a linha
 * continua saindo na direção em que a pessoa lê, sem volta por cima.
 */
function posicaoLivre(
  desejada: { x: number; y: number },
  nodes: FlowRFNode[],
  ehSocial: boolean,
): { x: number; y: number } {
  const LARGURA = 300;
  const ALTURA = 170;
  const FOLGA = 28;
  const cruza = (p: { x: number; y: number }) =>
    nodes.some((n) => {
      const l = n.measured?.width ?? LARGURA;
      const a = n.measured?.height ?? ALTURA;
      return (
        p.x < n.position.x + l + FOLGA &&
        p.x + LARGURA + FOLGA > n.position.x &&
        p.y < n.position.y + a + FOLGA &&
        p.y + ALTURA + FOLGA > n.position.y
      );
    });

  let tentativa = desejada;
  // Vinte tentativas e desiste: num canvas tão cheio assim, insistir só joga o bloco pra longe
  // demais pra ser encontrado. Melhor nascer encostado e a pessoa arrastar.
  for (let i = 1; i <= 20 && cruza(tentativa); i++) {
    tentativa = ehSocial
      ? { x: desejada.x, y: desejada.y + i * (ALTURA + FOLGA) }
      : { x: desejada.x + i * (LARGURA + FOLGA), y: desejada.y };
  }
  return tentativa;
}

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
