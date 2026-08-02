"use client";

import dagre from "dagre";
import { MarkerType, type Edge, type Node } from "@xyflow/react";

import type {
  FlowEdge,
  FlowNode,
  FlowNodeCategory,
  ProblemaValidacao,
} from "@/lib/automation-flow/types";

/** `data` do nó React Flow — embrulha o `FlowNode` de domínio + os problemas de validação vigentes desse nó (mesclados na hora de renderizar, nunca guardados em estado). */
export type FlowRFNodeData = {
  flowNode: FlowNode;
  problemas: ProblemaValidacao[];
};

export type FlowRFNode = Node<FlowRFNodeData, FlowNodeCategory>;
export type FlowRFEdge = Edge<Record<string, never>>;

export function domainNodesToRF(nodes: FlowNode[]): FlowRFNode[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.category,
    position: n.position,
    data: { flowNode: n, problemas: [] },
  }));
}

export function rfNodesToDomain(nodes: FlowRFNode[]): FlowNode[] {
  return nodes.map((n) => ({ ...n.data.flowNode, position: n.position }));
}

export function domainEdgesToRF(edges: FlowEdge[]): FlowRFEdge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    label: e.label,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    style: e.cor ? { stroke: e.cor } : undefined,
  }));
}

export function rfEdgesToDomain(edges: FlowRFEdge[]): FlowEdge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    label: typeof e.label === "string" ? e.label : undefined,
  }));
}

let contadorId = 0;
export function novoIdNo(): string {
  contadorId += 1;
  return `no-${Date.now()}-${contadorId}`;
}
export function novoIdAresta(): string {
  contadorId += 1;
  return `aresta-${Date.now()}-${contadorId}`;
}

const LARGURA_NO = 260;
const ALTURA_NO = 96;

/** Recalcula a posição de todo mundo em camadas (dagre, topo→baixo) — usado pelo botão "organizar automaticamente". */
export function autoLayout(nodes: FlowRFNode[], edges: FlowRFEdge[]): FlowRFNode[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 70, ranksep: 120, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((n) => g.setNode(n.id, { width: LARGURA_NO, height: ALTURA_NO }));
  edges.forEach((e) => {
    if (nodes.some((n) => n.id === e.source) && nodes.some((n) => n.id === e.target)) {
      g.setEdge(e.source, e.target);
    }
  });

  dagre.layout(g);

  return nodes.map((n) => {
    const posicionado = g.node(n.id);
    if (!posicionado) return n;
    return { ...n, position: { x: posicionado.x - LARGURA_NO / 2, y: posicionado.y - ALTURA_NO / 2 } };
  });
}
