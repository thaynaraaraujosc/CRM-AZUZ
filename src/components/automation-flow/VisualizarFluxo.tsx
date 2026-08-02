"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useAutomationFlows } from "@/lib/automation-flow-context";
import { BLOCOS_DISPONIVEIS } from "@/lib/automation-flow/blocos";
import type { FluxoAutomacao } from "@/lib/automation-flow/types";

import { Simulador } from "./Simulador";
import { nodeTypes } from "./nodes";
import { autoLayout, domainEdgesToRF, domainNodesToRF } from "./utils";

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

/**
 * Lista "funcionalidades utilizadas" — derivada AO VIVO dos nós reais do
 * fluxo (nunca escrita à mão por fluxo), pra nunca ficar desatualizada em
 * relação ao que o fluxo de fato faz.
 */
function funcionalidadesDoFluxo(fluxo: FluxoAutomacao): string[] {
  const labels = new Set<string>();

  fluxo.nodes.forEach((n) => {
    const bloco = BLOCOS_DISPONIVEIS.find((b) => b.tipo === n.type);
    if (bloco) labels.add(bloco.label);
  });

  const saidasPorNo = new Map<string, number>();
  fluxo.edges.forEach((e) => saidasPorNo.set(e.source, (saidasPorNo.get(e.source) ?? 0) + 1));
  const temRamificacao = [...saidasPorNo.values()].some((n) => n > 1);
  if (temRamificacao) labels.add("Ramificações condicionais");

  return [...labels].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function CanvasPreview({ fluxo }: { fluxo: FluxoAutomacao }) {
  const rfNodes = useMemo(
    () => autoLayout(domainNodesToRF(fluxo.nodes), domainEdgesToRF(fluxo.edges)),
    [fluxo],
  );
  const rfEdges = useMemo(() => domainEdgesToRF(fluxo.edges), [fluxo]);

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={true}
      panOnDrag
      zoomOnScroll
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={18} />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable nodeColor={(n) => CORES_CATEGORIA[String(n.type)] ?? "#94a3b8"} />
    </ReactFlow>
  );
}

export function VisualizarFluxo({ fluxo, onFechar }: { fluxo: FluxoAutomacao; onFechar: () => void }) {
  const router = useRouter();
  const { duplicarFluxo } = useAutomationFlows();
  const [simuladorAberto, setSimuladorAberto] = useState(false);
  const [duplicando, setDuplicando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const funcionalidades = useMemo(() => funcionalidadesDoFluxo(fluxo), [fluxo]);

  function editar() {
    router.push(`/automacoes/editor/${fluxo.id}`);
  }

  function duplicarEUsar() {
    if (duplicando) return;
    setErro(null);
    setDuplicando(true);
    try {
      const copia = duplicarFluxo(fluxo.id);
      if (!copia) throw new Error("Não foi possível duplicar esse fluxo.");
      router.push(`/automacoes/editor/${copia.id}`);
    } catch {
      setErro("Não foi possível criar uma cópia agora. Tente novamente.");
    } finally {
      setDuplicando(false);
    }
  }

  return (
    <div className="flow-side-overlay" role="dialog" aria-label={`Visualizar fluxo ${fluxo.nome}`} onClick={onFechar}>
      <div className="flow-preview-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-h">
          <div>
            <h4>{fluxo.nome}</h4>
            {fluxo.descricao ? <p className="r" style={{ marginTop: 2 }}>{fluxo.descricao}</p> : null}
          </div>
          <button type="button" className="icon-btn subtle" aria-label="Fechar pré-visualização" onClick={onFechar}>
            ✕
          </button>
        </div>

        <div className="flow-preview-summary">
          {fluxo.objetivo ? <p className="r">{fluxo.objetivo}</p> : null}
          {funcionalidades.length > 0 ? (
            <div className="flow-preview-tags">
              <span className="hint" style={{ marginRight: 4 }}>Funcionalidades demonstradas:</span>
              {funcionalidades.map((f) => (
                <span key={f} className="pill secondary">
                  {f}
                </span>
              ))}
            </div>
          ) : null}
          {erro ? <p className="flow-problema erro">{erro}</p> : null}
        </div>

        <div className="flow-preview-canvas">
          <ReactFlowProvider>
            <CanvasPreview fluxo={fluxo} />
          </ReactFlowProvider>
        </div>

        <div className="section-foot">
          <button type="button" className="btn ghost" onClick={() => setSimuladorAberto(true)}>
            Testar no simulador
          </button>
          <button type="button" className="btn ghost" onClick={editar}>
            Editar
          </button>
          <button type="button" className="btn primary" disabled={duplicando} onClick={duplicarEUsar}>
            {duplicando ? "Duplicando…" : "Duplicar e usar"}
          </button>
        </div>
      </div>

      {simuladorAberto ? (
        <span onClick={(e) => e.stopPropagation()}>
          <Simulador fluxo={fluxo} onFechar={() => setSimuladorAberto(false)} />
        </span>
      ) : null}
    </div>
  );
}
