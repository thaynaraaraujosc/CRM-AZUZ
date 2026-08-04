"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  OPERADORES_LOGICA,
  labelTipoCampo,
  type LogicaCampo,
  type OperadorLogica,
  type PerguntaFormulario,
  type RegraLogica,
} from "@/lib/formularios-context";

/**
 * Construtor visual da lógica condicional de UM campo — "SE [condição] ENTÃO [mostrar/ocultar/
 * obrigatório este campo]". Reaproveita o mesmo motor (@xyflow/react) e a mesma linguagem visual
 * (classes `.flow-node`/`.flow-handle`) do editor de automações (`src/components/automation-flow`),
 * mas num escopo bem menor: só dois tipos de nó, topologia fixa (toda condição aponta pro nó
 * "resultado", sem o usuário desenhar conexões), sem undo/redo/minimapa/auto-layout — é uma lista de
 * regras (`RegraLogica[]`) desenhada como grafo, não um fluxo de automação de verdade.
 */

type CondicaoNodeData = {
  regra: RegraLogica;
  camposAnteriores: PerguntaFormulario[];
  onMudar: (patch: Partial<RegraLogica>) => void;
  onExcluir: () => void;
};

type ResultadoNodeData = {
  modo: LogicaCampo["modo"];
  rotuloCampo: string;
  onMudarModo: (modo: LogicaCampo["modo"]) => void;
};

type CondicaoRFNode = Node<CondicaoNodeData, "condicao">;
type ResultadoRFNode = Node<ResultadoNodeData, "resultado">;
type LogicaRFNode = CondicaoRFNode | ResultadoRFNode;

function CondicaoNode({ data }: NodeProps<CondicaoRFNode>) {
  const { regra, camposAnteriores, onMudar, onExcluir } = data;
  const escondeValor = regra.operador === "preenchido" || regra.operador === "vazio";
  return (
    <div className="flow-node form-logica-node">
      <button type="button" className="form-logica-node-excluir" title="Excluir condição" onClick={onExcluir}>
        ✕
      </button>
      <div className="flow-node-header">
        <span className="flow-node-categoria">SE</span>
      </div>
      <div className="flow-node-body form-logica-node-corpo">
        <select className="input" value={regra.campoId} onChange={(e) => onMudar({ campoId: e.target.value })}>
          <option value="">Campo…</option>
          {camposAnteriores.map((c) => (
            <option key={c.id} value={c.id}>
              {c.rotulo || labelTipoCampo(c.tipo)}
            </option>
          ))}
        </select>
        <select className="input" value={regra.operador} onChange={(e) => onMudar({ operador: e.target.value as OperadorLogica })}>
          {OPERADORES_LOGICA.map((o) => (
            <option key={o.operador} value={o.operador}>
              {o.label}
            </option>
          ))}
        </select>
        {!escondeValor ? (
          <input
            className="input"
            value={regra.valor ?? ""}
            onChange={(e) => onMudar({ valor: e.target.value })}
            placeholder="Valor"
          />
        ) : null}
      </div>
      <Handle type="source" position={Position.Bottom} className="flow-handle" />
    </div>
  );
}

function ResultadoNode({ data }: NodeProps<ResultadoRFNode>) {
  const { modo, rotuloCampo, onMudarModo } = data;
  return (
    <div className="flow-node form-logica-node form-logica-node-resultado">
      <Handle type="target" position={Position.Top} className="flow-handle" />
      <div className="flow-node-header">
        <span className="flow-node-categoria">ENTÃO</span>
      </div>
      <div className="flow-node-body form-logica-node-corpo">
        <select className="input" value={modo} onChange={(e) => onMudarModo(e.target.value as LogicaCampo["modo"])}>
          <option value="mostrar_se">Mostrar este campo</option>
          <option value="ocultar_se">Ocultar este campo</option>
          <option value="obrigatorio_se">Tornar obrigatório</option>
        </select>
        <p className="hint" style={{ margin: "2px 0 0" }}>
          {rotuloCampo}
        </p>
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = { condicao: CondicaoNode, resultado: ResultadoNode };

function construirGrafo(
  logica: LogicaCampo,
  camposAnteriores: PerguntaFormulario[],
  rotuloCampo: string,
  posicoesCustom: Record<string, { x: number; y: number }>,
  atualizarRegras: (regras: RegraLogica[]) => void,
  atualizarModo: (modo: LogicaCampo["modo"]) => void,
): { nodes: LogicaRFNode[]; edges: Edge[] } {
  const condicoes: CondicaoRFNode[] = logica.regras.map((regra, i) => ({
    id: `regra-${i}`,
    type: "condicao",
    position: posicoesCustom[`regra-${i}`] ?? { x: 0, y: i * 132 },
    data: {
      regra,
      camposAnteriores,
      onMudar: (patch) => atualizarRegras(logica.regras.map((r, idx) => (idx === i ? { ...r, ...patch } : r))),
      onExcluir: () => atualizarRegras(logica.regras.filter((_, idx) => idx !== i)),
    },
  }));
  const resultado: ResultadoRFNode = {
    id: "resultado",
    type: "resultado",
    position: posicoesCustom.resultado ?? { x: 280, y: Math.max(0, logica.regras.length - 1) * 66 },
    data: { modo: logica.modo, rotuloCampo, onMudarModo: atualizarModo },
  };
  const edges: Edge[] = logica.regras.map((_, i) => ({
    id: `e-regra-${i}`,
    source: `regra-${i}`,
    target: "resultado",
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
  }));
  return { nodes: [...condicoes, resultado], edges };
}

function LogicaCanvasInner({
  pergunta,
  camposAnteriores,
  onAtualizar,
}: {
  pergunta: PerguntaFormulario;
  camposAnteriores: PerguntaFormulario[];
  onAtualizar: (patch: Partial<PerguntaFormulario>) => void;
}) {
  const logicaAtual: LogicaCampo = pergunta.logica ?? { modo: "mostrar_se", regras: [] };
  const [posicoesCustom, setPosicoesCustom] = useState<Record<string, { x: number; y: number }>>({});

  function atualizarRegras(regras: RegraLogica[]) {
    onAtualizar({ logica: { modo: logicaAtual.modo, regras } });
  }
  function atualizarModo(modo: LogicaCampo["modo"]) {
    onAtualizar({ logica: { modo, regras: logicaAtual.regras } });
  }

  const { nodes, edges } = construirGrafo(
    logicaAtual,
    camposAnteriores,
    pergunta.rotulo || labelTipoCampo(pergunta.tipo),
    posicoesCustom,
    atualizarRegras,
    atualizarModo,
  );

  // Posição do node é só visual (arrastar pra organizar a leitura) — nunca persistida no domínio,
  // só guardada localmente pra sobreviver ao próximo render enquanto o campo continuar selecionado.
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setPosicoesCustom((prev) => {
      let mudou = false;
      const next = { ...prev };
      for (const c of changes) {
        if (c.type === "position" && c.position) {
          next[c.id] = c.position;
          mudou = true;
        }
      }
      return mudou ? next : prev;
    });
  }, []);

  function adicionarCondicao() {
    const novaRegra: RegraLogica = { campoId: camposAnteriores[0]?.id ?? "", operador: "igual", valor: "" };
    atualizarRegras([...logicaAtual.regras, novaRegra]);
  }

  const { fitView } = useReactFlow();
  // `fitView` (prop abaixo) só roda na primeira montagem — sem isso, um node de condição adicionado
  // depois fica fora da área visível (e inacessível a clique), porque o pan/zoom continua enquadrado
  // no que existia no instante do mount.
  useEffect(() => {
    fitView({ padding: 0.3, duration: 200 });
  }, [logicaAtual.regras.length, fitView]);

  return (
    <div className="form-logica-canvas-shell">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        nodesConnectable={false}
        edgesFocusable={false}
        deleteKeyCode={[]}
        fitView
        minZoom={0.4}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} />
        <Controls showInteractive={false} />
        <Panel position="top-left">
          <button type="button" className="btn ghost form-logica-add-btn" onClick={adicionarCondicao}>
            + Adicionar condição
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export function LogicaCanvas(props: {
  pergunta: PerguntaFormulario;
  camposAnteriores: PerguntaFormulario[];
  onAtualizar: (patch: Partial<PerguntaFormulario>) => void;
}) {
  return (
    <ReactFlowProvider>
      <LogicaCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
