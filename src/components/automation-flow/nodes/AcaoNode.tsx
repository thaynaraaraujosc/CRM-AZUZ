"use client";

import type { NodeProps } from "@xyflow/react";

import { NodeShell } from "./NodeShell";
import type { FlowRFNode } from "../utils";

/** Nó de categoria "Acao" — reaproveita o layout comum de `NodeShell`. */
export default function AcaoNode(props: NodeProps<FlowRFNode>) {
  return <NodeShell {...props} />;
}
