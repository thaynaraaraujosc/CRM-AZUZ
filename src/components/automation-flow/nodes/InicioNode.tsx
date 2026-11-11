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
  /*
   * A PASTILHA NÃO CLICA, E ISSO É DECISÃO DELA.
   *
   * Cheguei a transformá-la em botão quando faltava gatilho: clicando, abria a gaveta. "Não é pra
   * clicar e fazer alguma coisa. Ele está ali pra dizer que a partir dali iniciou o gatilho. É pra
   * manter do jeito que estava, onde eu posso mover pra onde eu quiser."
   *
   * E faz sentido: virando botão, ela deixava de ser arrastável — o clique engolia o arrasto — e
   * perdia justamente o que ela é, uma peça do desenho que a pessoa põe onde quiser.
   */
  const detalhe = (data as { detalheInicio?: string }).detalheInicio;

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
