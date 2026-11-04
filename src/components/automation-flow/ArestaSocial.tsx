"use client";

import { useState } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";

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
  style,
  data,
}: EdgeProps) {
  const { t: traduzir } = useIdioma();
  const [sobre, setSobre] = useState(false);
  /*
   * CURVA, E NÃO DEGRAU.
   *
   * Era `getSmoothStepPath`: a linha saía reta, dobrava em ângulo e entrava reta — o desenho de um
   * diagrama de circuito. A Thaynara apontou o ManyChat, e a diferença que ela viu é essa: lá a
   * ligação é uma curva contínua, que atravessa o espaço entre os dois blocos como um traço só.
   * Num canvas com oito blocos, curva se segue com o olho; degrau obriga a acompanhar cada canto.
   */
  const [caminho, meioX, meioY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const aoApagar = (data as { aoApagar?: (id: string) => void } | undefined)?.aoApagar;
  /*
   * Valor literal, e não `var(--ss-cinza-400)`: isto vira o ATRIBUTO `stroke` de um elemento SVG,
   * e atributo de apresentação não resolve variável de CSS. Escrito como `var(...)` o traço
   * simplesmente não teria cor. É o mesmo `#94a3b8` do token.
   *
   * Vermelho no hover avisa QUAL das dez ligações da tela a lixeira vai desfazer.
   */
  const cor = sobre ? "#ef4444" : "#94a3b8";

  return (
    <>
      {/*
        A PONTA DE SETA É DESENHADA AQUI, e não herdada do `markerEnd` padrão.
        
        A seta diz a DIREÇÃO: sem ela, uma curva entre dois blocos não conta qual deles vem
        primeiro, e num fluxo que volta pra trás (uma condição que reencaminha) isso é a diferença
        entre entender e adivinhar. O marcador é por aresta porque ele muda de cor junto com o
        traço quando o mouse passa — um marcador global ficaria cinza com a linha vermelha.
      */}
      <defs>
        <marker
          id={`seta-${id}`}
          markerWidth={10}
          markerHeight={10}
          refX={8}
          refY={5}
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M1,1 L8,5 L1,9" fill="none" stroke={cor} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      </defs>
      <BaseEdge
        id={id}
        path={caminho}
        markerEnd={`url(#seta-${id})`}
        style={{ ...style, stroke: cor, strokeWidth: 2 }}
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
