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
 * EXISTE DESDE O QUADRO VAZIO. Antes só aparecia depois do primeiro bloco, e o canvas novo abria
 * com um cartão de boas-vindas desenhado POR CIMA dele, que não se movia e sumia no instante em
 * que o primeiro bloco entrava. Agora a pastilha está lá desde o começo, e a lista de passos abre
 * sozinha ao lado dela — que é o que a referência faz.
 */
export default function InicioNode({ data }: NodeProps<FlowRFNode>) {
  const { t: traduzir } = useIdioma();
  const { detalheInicio: detalhe, aoEscolherGatilho } = data as {
    detalheInicio?: string;
    aoEscolherGatilho?: () => void;
  };

  const miolo = (
    <>
      <span className="no-inicio-marca" aria-hidden="true">
        ▶
      </span>
      <span className="no-inicio-texto">
        <strong>{traduzir("Iniciar robô")}</strong>
        {detalhe ? <span>{detalhe}</span> : null}
      </span>
    </>
  );

  /*
   * SEM GATILHO, A PASTILHA É O CAMINHO PRA ESCOLHER UM.
   *
   * "Por que ainda está pedindo pra adicionar um gatilho, sendo que eu já falei aqui?" — e a tela
   * ajudava a achar que já estava dito: a pastilha desenha uma linha até o primeiro bloco mesmo
   * quando não existe gatilho nenhum, e linha desenhada parece ligação feita.
   *
   * Ela continua sendo um desenho (o motor nunca a executa). O que muda é que, faltando o gatilho,
   * ela PARA de afirmar que algo acontece e passa a oferecer o que falta: um clique abre a gaveta
   * de gatilhos. É o único lugar da tela onde a pergunta "o que inicia isso?" aparece sozinha.
   */
  if (aoEscolherGatilho) {
    return (
      <button type="button" className="no-inicio no-inicio-vazio nodrag" onClick={aoEscolherGatilho}>
        {miolo}
        <Handle type="source" position={Position.Right} isConnectable={false} />
      </button>
    );
  }

  return (
    <div className="no-inicio">
      {miolo}
      {/* Só saída: nada entra aqui, porque este é o começo. */}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}
