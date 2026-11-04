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

  // A pastilha é desenhada exatamente com a medida declarada no nó (ver `inicioDesenhado`, no
  // FlowEditor, e `.no-inicio` no globals.css), então o retângulo dela na tela é o canto
  // convertido mais essa medida vezes o zoom.
  const canto = flowToScreenPosition({ x: no.position.x, y: no.position.y });
  const largura = (no.width ?? 150) * zoom;
  const altura = (no.height ?? 40) * zoom;
  const posicao = posicaoDaLista(
    { left: canto.x, top: canto.y, right: canto.x + largura, bottom: canto.y + altura },
    { largura: window.innerWidth, altura: window.innerHeight },
  );

  // Fio verde: ele sai da pastilha verde, e sair de lá com a cor dela é o que faz a caixa ler
  // como continuação do começo, e não como uma janela que apareceu do lado.
  return <PainelProximoPasso {...props} posicao={posicao} fioVerde />;
}
