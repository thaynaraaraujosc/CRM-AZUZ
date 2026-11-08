import type { NodeTypes } from "@xyflow/react";

import AcaoNode from "./AcaoNode";
import CondicaoNode from "./CondicaoNode";
import EsperaNode from "./EsperaNode";
import FimNode from "./FimNode";
import GatilhoNode from "./GatilhoNode";
import GrupoGatilhosNode from "./GrupoGatilhosNode";
import HumanoNode from "./HumanoNode";
import InicioNode from "./InicioNode";
import IntegracaoNode from "./IntegracaoNode";
import MensagemNode from "./MensagemNode";

/** Um componente por `FlowNodeCategory`: todos reaproveitam `NodeShell`, ver comentário lá. */
export const nodeTypes: NodeTypes = {
  gatilho: GatilhoNode,
  condicao: CondicaoNode,
  mensagem: MensagemNode,
  espera: EsperaNode,
  acao: AcaoNode,
  humano: HumanoNode,
  integracao: IntegracaoNode,
  fim: FimNode,
  /** Desenhado, não salvo: ver `InicioNode`. Não é uma `FlowNodeCategory`. */
  inicio: InicioNode,
  /**
   * O cartão único com TODOS os gatilhos do fluxo (ver `GrupoGatilhosNode`).
   *
   * Não é uma categoria: é como o PRIMEIRO bloco de gatilho de um fluxo social se desenha. Os
   * blocos continuam sendo de categoria `gatilho` no fluxo salvo; o editor só troca o tipo de
   * desenho na hora de renderizar.
   */
  "grupo-gatilhos": GrupoGatilhosNode,
};
