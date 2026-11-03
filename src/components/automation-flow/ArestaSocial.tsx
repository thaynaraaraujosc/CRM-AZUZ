"use client";

import { useState } from "react";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

import { IconLixeira } from "@/components/icons";
import { useIdioma } from "@/lib/idioma-context";

/**
 * A LIGAÇÃO ENTRE DOIS BLOCOS, com a lixeira que aparece no hover.
 *
 * Desfazer uma ligação errada era: selecionar a seta e apertar Delete — descoberta por ninguém. O
 * caminho que se descobre sozinho é passar o mouse por cima do traço e ver aparecer um botão no
 * meio dele. O traço fica vermelho junto porque, com dez ligações cruzando a tela, ver "o botão
 * apareceu" não diz QUAL delas vai sumir.
 *
 * O botão vive em `EdgeLabelRenderer`, que desenha fora do SVG: dentro dele, um botão de verdade
 * não recebe clique.
 */
export function ArestaSocial({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
}: EdgeProps) {
  const { t: traduzir } = useIdioma();
  const [sobre, setSobre] = useState(false);
  const [caminho, meioX, meioY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const aoApagar = (data as { aoApagar?: (id: string) => void } | undefined)?.aoApagar;

  return (
    <>
      <BaseEdge
        id={id}
        path={caminho}
        markerEnd={markerEnd}
        style={{ ...style, stroke: sobre ? "#ef4444" : undefined, strokeWidth: sobre ? 2 : undefined }}
      />
      {/*
        UM TRAÇO DE 1px NÃO SE ACERTA COM O MOUSE. Este caminho invisível de 18px é a área de
        hover; sem ele, o botão só aparece quando o ponteiro encosta exatamente na linha, o que na
        prática é "não aparece".
      */}
      <path
        d={caminho}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        style={{ pointerEvents: "stroke", cursor: aoApagar ? "pointer" : "default" }}
        onMouseEnter={() => setSobre(true)}
        onMouseLeave={() => setSobre(false)}
      />
      {sobre && aoApagar ? (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="aresta-lixeira"
            style={{ transform: `translate(-50%, -50%) translate(${meioX}px, ${meioY}px)` }}
            aria-label={traduzir("Desfazer esta ligação")}
            title={traduzir("Desfazer esta ligação")}
            onMouseEnter={() => setSobre(true)}
            onMouseLeave={() => setSobre(false)}
            onClick={(e) => {
              e.stopPropagation();
              aoApagar(id);
            }}
          >
            <IconLixeira width={14} height={14} />
          </button>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
