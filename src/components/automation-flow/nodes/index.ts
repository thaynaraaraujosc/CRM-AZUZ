import type { NodeTypes } from "@xyflow/react";

import AcaoNode from "./AcaoNode";
import CondicaoNode from "./CondicaoNode";
import EsperaNode from "./EsperaNode";
import FimNode from "./FimNode";
import GatilhoNode from "./GatilhoNode";
import HumanoNode from "./HumanoNode";
import IntegracaoNode from "./IntegracaoNode";
import MensagemNode from "./MensagemNode";

/** Um componente por `FlowNodeCategory` — todos reaproveitam `NodeShell`, ver comentário lá. */
export const nodeTypes: NodeTypes = {
  gatilho: GatilhoNode,
  condicao: CondicaoNode,
  mensagem: MensagemNode,
  espera: EsperaNode,
  acao: AcaoNode,
  humano: HumanoNode,
  integracao: IntegracaoNode,
  fim: FimNode,
};
