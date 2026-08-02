"use client";

import type { NodeProps } from "@xyflow/react";

import { NodeShell } from "./NodeShell";
import type { FlowRFNode } from "../utils";

/** Nó de categoria "Integracao" — reaproveita o layout comum de `NodeShell`. */
export default function IntegracaoNode(props: NodeProps<FlowRFNode>) {
  return <NodeShell {...props} />;
}
