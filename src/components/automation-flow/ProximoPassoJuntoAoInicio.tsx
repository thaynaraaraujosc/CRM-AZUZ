"use client";

import { useReactFlow, useViewport } from "@xyflow/react";
import type { ComponentProps } from "react";

import { PainelProximoPasso } from "./PainelProximoPasso";
import { posicaoDaLista } from "@/lib/automation-flow/posicao-da-lista";
import type { FlowRFNode } from "./utils";

/**
 * A CAIXA "ADICIONAR PRÓXIMO PASSO" ANCORADA NA PASTILHA "INICIAR ROBÔ".
 *
 * Num quadro novo a caixa abria sozinha, num lugar fixo no meio da tela, sem fio nenhum: a
 * pastilha ficava de um lado, a caixa do outro, e nada dizia que uma era a continuação da outra.
 * "Tudo que abre a janela de adicionar próximo passo tem que ter uma linha ligada."
 *
 * É UM COMPONENTE À PARTE por causa do `useViewport`: ele faz quem o chama re-renderizar a cada
 * quadro de arrasto e de zoom do canvas, e isso no editor inteiro seria caro. Aqui a assinatura
 * só existe enquanto a caixa está aberta, e só este pedacinho se redesenha — que é o preço certo
 * pra o fio continuar grudado na pastilha enquanto se move o quadro.
 */
export function ProximoPassoJuntoAoInicio({
  no,
  ...props
}: Omit<ComponentProps<typeof PainelProximoPasso>, "posicao" | "juntoAoInicio" | "fioVerde"> & {
  /** O nó DESENHADO da pastilha de início: posição no canvas e medida declarada. */
  no: FlowRFNode;
}) {
  const { zoom } = useViewport();
  const { flowToScreenPosition } = useReactFlow();

  /*
   * A ÂNCORA SAI DO DESENHO, não de uma conta.
   *
   * Calcular "posição no canvas × zoom + medida declarada" tem três lugares pra errar, e errou:
   * a caixa nascia uma pastilha inteira à direita de onde devia. Medir o elemento resolve de uma
   * vez — é o mesmo retângulo que os olhos veem. A conta fica só como rede de segurança pro
   * primeiríssimo quadro, quando o nó ainda pode não estar no DOM.
   *
   * Ler o DOM aqui no render é de leitura pura e acontece a cada quadro de arrasto/zoom (é pra
   * isso que serve o `useViewport` acima), então o fio acompanha o canvas em vez de ficar pra trás.
   */
  const noDesenhado =
    typeof document === "undefined"
      ? null
      : document.querySelector(`.react-flow__node[data-id="${CSS.escape(no.id)}"]`);
  const medido = noDesenhado?.getBoundingClientRect();
  const canto = flowToScreenPosition({ x: no.position.x, y: no.position.y });
  const ancora = medido
    ? { left: medido.left, top: medido.top, right: medido.right, bottom: medido.bottom }
    : {
        left: canto.x,
        top: canto.y,
        right: canto.x + (no.width ?? 150) * zoom,
        bottom: canto.y + (no.height ?? 40) * zoom,
      };

  const posicao = posicaoDaLista(ancora, { largura: window.innerWidth, altura: window.innerHeight });

  // Fio verde: ele sai da pastilha verde, e sair de lá com a cor dela é o que faz a caixa ler
  // como continuação do começo, e não como uma janela que apareceu do lado.
  return <PainelProximoPasso {...props} posicao={posicao} ancora={ancora} fioVerde />;
}
