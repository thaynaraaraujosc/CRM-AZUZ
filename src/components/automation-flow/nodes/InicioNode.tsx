"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { FlowRFNode } from "../utils";

/**
 * "Iniciar robô": a pastilha verde que marca de onde o fluxo parte.
 *
 * É um nó DESENHADO, não um bloco salvo. Ele não existe no fluxo, não é arrastável, não é
 * apagável e o motor nunca o executa: ele é a representação do gatilho, que mora na etapa do
 * funil, dentro do canvas onde a pessoa está olhando.
 *
 * Existe porque um fluxo que começa numa caixa de mensagem solta não diz onde é o começo. Com
 * quinze blocos na tela, "por onde isso entra?" vira uma pergunta de verdade, e a resposta estava
 * noutra tela.
 */
export default function InicioNode({ data }: NodeProps<FlowRFNode>) {
  const detalhe = (data as { detalheInicio?: string }).detalheInicio;
  return (
    <div className="no-inicio">
      <span className="no-inicio-marca" aria-hidden="true">
        ▶
      </span>
      <span className="no-inicio-texto">
        <strong>Iniciar robô</strong>
        {detalhe ? <span>{detalhe}</span> : null}
      </span>
      {/* Só saída: nada entra aqui, porque este é o começo. */}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}
