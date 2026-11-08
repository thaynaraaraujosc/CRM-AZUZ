"use client";

import { useViewport } from "@xyflow/react";
import type { ComponentProps } from "react";

import { PainelProximoPasso } from "./PainelProximoPasso";
import { posicaoDaLista, type AncoraDaLista } from "@/lib/automation-flow/posicao-da-lista";

/**
 * A CAIXA "ADICIONAR PRÓXIMO PASSO" GRUDADA NO "+" QUE A ABRIU.
 *
 * O retângulo do "+" era medido UMA VEZ, no clique, e guardado. Enquanto a caixa estava aberta,
 * arrastar o bloco movia o bloco e deixava a caixa onde estava: o fio virava um arco atravessando
 * meia tela e a caixa parecia uma janela solta, sem dizer mais de qual saída ela tinha saído.
 * "Tem que ficar grudado também, porque aí você sabe o que você está escolhendo."
 *
 * A correção é medir o botão A CADA QUADRO, em vez de uma vez só — que é o que a caixa ancorada
 * na pastilha "Iniciar robô" já fazia. Por isso este componente existe à parte: o `useViewport`
 * faz quem o chama se redesenhar a cada quadro de arrasto e de zoom do canvas, e isso no editor
 * inteiro seria caro. Aqui ele só vive enquanto a caixa está aberta.
 *
 * O arrasto do BLOCO chega por outro caminho: o editor re-renderiza a cada quadro de
 * `onNodesChange`, e este componente, sendo filho dele, se redesenha junto.
 */
export function ProximoPassoJuntoAoBloco({
  nodeId,
  handleId,
  ancoraInicial,
  ...props
}: Omit<ComponentProps<typeof PainelProximoPasso>, "posicao" | "ancora" | "juntoAoInicio"> & {
  /** O bloco de onde a caixa saiu. */
  nodeId: string;
  /** Qual saída do bloco: o `data-mais` do botão "+". `undefined` é a saída única. */
  handleId?: string;
  /** O retângulo medido no clique. Rede de segurança pro quadro em que o DOM ainda não respondeu. */
  ancoraInicial?: AncoraDaLista;
}) {
  useViewport();

  const ancora = medirBotaoMais(nodeId, handleId) ?? ancoraInicial;
  if (!ancora || typeof window === "undefined") {
    return <PainelProximoPasso {...props} juntoAoInicio />;
  }

  const posicao = posicaoDaLista(ancora, { largura: window.innerWidth, altura: window.innerHeight });
  return <PainelProximoPasso {...props} posicao={posicao} ancora={ancora} />;
}

/**
 * Onde o "+" está NA TELA, agora.
 *
 * Ler o DOM aqui é leitura pura e acontece no render, de propósito: é o mesmo retângulo que os
 * olhos veem, sem refazer a conta de zoom e deslocamento que o React Flow acabou de fazer. Se o
 * botão não estiver mais lá (a saída foi conectada no meio do caminho), cai no retângulo do bloco
 * inteiro — que ainda diz de onde a caixa saiu.
 */
function medirBotaoMais(nodeId: string, handleId?: string): AncoraDaLista | undefined {
  if (typeof document === "undefined" || !nodeId) return undefined;
  const no = document.querySelector(`.react-flow__node[data-id="${CSS.escape(nodeId)}"]`);
  if (!no) return undefined;
  const botao = no.querySelector(`[data-mais="${CSS.escape(handleId ?? "__default__")}"]`) ?? no;
  const r = botao.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}
