"use client";

import type { ReactNode } from "react";

/** Cabeçalho padrão do painel de detalhe de cada categoria — título + descrição à esquerda, ações à
 * direita (item 18: "cabeçalho com título, descrição e ações"). */
export function CabecalhoCategoria({ titulo, descricao, acoes }: { titulo: string; descricao: string; acoes?: ReactNode }) {
  return (
    <div className="config-cabecalho">
      <div>
        <h3>{titulo}</h3>
        <p className="hint">{descricao}</p>
      </div>
      {acoes ? <div className="config-cabecalho-acoes">{acoes}</div> : null}
    </div>
  );
}
