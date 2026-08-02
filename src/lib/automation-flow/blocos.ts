/**
 * Registro de todos os blocos disponíveis pra paleta do construtor visual —
 * um item por `FlowNodeType`. `dataPadrao()` é o `data` inicial de um nó recém
 * arrastado pro canvas (sempre uma função nova, pra nunca compartilhar objeto
 * entre dois nós soltos na mesma sessão).
 */

import type {
  AguardarData,
  AlterarEtapaData,
  BlocoDefinicaoAlvo,
  CanalMensagem,
  FlowNodeCategory,
  FlowNodeType,
} from "./types";

// (BlocoDefinicaoAlvo não existe — placeholder removido abaixo; ver tipo real logo adiante)
