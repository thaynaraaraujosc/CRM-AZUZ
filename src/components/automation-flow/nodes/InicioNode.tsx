"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { FlowRFNode } from "../utils";
import { useIdioma } from "@/lib/idioma-context";

/**
 * "Iniciar robô": de onde o fluxo parte, desenhado dentro do canvas.
 *
 * É um nó DESENHADO, não um bloco salvo: ele não existe no fluxo e o motor nunca o executa. Ele
 * representa o gatilho — que, num robô de funil, mora na etapa — no lugar onde a pessoa está
 * olhando. Sem ele, um fluxo que começa numa caixa de mensagem solta não diz onde é o começo, e
 * com quinze blocos na tela "por onde isso entra?" vira pergunta de verdade.
 *
 * ARRASTÁVEL, desde que a Thaynara apontou que não era: "tudo tem que ser movível dentro do
 * quadro branco". Ele continua fora do fluxo gravado; o que se grava é só a POSIÇÃO, nas
 * configurações (ver `posicaoInicio` em `ConfiguracoesFluxo`).
 *
 * DUAS CARAS. Com blocos no canvas, é a pastilha verde compacta. Com o canvas vazio, é o cartão
 * de abertura — mesmo nó, mesma posição arrastável — com o botão que começa a automação. Era um
 * aviso centralizado por cima do canvas, que não se movia e não fazia parte do desenho.
 */
export default function InicioNode({ data }: NodeProps<FlowRFNode>) {
  const { t: traduzir } = useIdioma();
  const { detalheInicio: detalhe, inicioVazio: vazio } = data as {
    detalheInicio?: string;
    inicioVazio?: { titulo: string; descricao?: string; rotuloBotao: string; aoClicar: () => void };
  };

  if (vazio) {
    return (
      <div className="no-inicio-cartao">
        <span className="flow-node-aba">
          <span className="no-inicio-marca" aria-hidden="true">
            ▶
          </span>
          {traduzir("Início")}
        </span>
        <h4>{vazio.titulo}</h4>
        {vazio.descricao ? <p>{vazio.descricao}</p> : null}
        {/* `nodrag` é do React Flow: sem ele, apertar o botão começa a arrastar o cartão e o
            clique nunca chega. */}
        <button type="button" className="no-inicio-cartao-btn nodrag" onClick={vazio.aoClicar}>
          {vazio.rotuloBotao} <span aria-hidden="true">+</span>
        </button>
        <Handle type="source" position={Position.Right} isConnectable={false} />
      </div>
    );
  }

  return (
    <div className="no-inicio">
      <span className="no-inicio-marca" aria-hidden="true">
        ▶
      </span>
      <span className="no-inicio-texto">
        <strong>{traduzir("Iniciar robô")}</strong>
        {detalhe ? <span>{detalhe}</span> : null}
      </span>
      {/* Só saída: nada entra aqui, porque este é o começo. */}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}
