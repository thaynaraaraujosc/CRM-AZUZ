"use client";

import { useState, type ReactNode } from "react";

/** Seção recolhível padrão da Central do Dia — título, contador, recolher/expandir e estado vazio
 * próprio (itens 3 e 16 do pedido). Usada tanto pelos 3 grupos de prioridade quanto pelas seções por
 * módulo (conversas, agenda, tarefas…), pra não duplicar esse cabeçalho em cada uma. */
export function SecaoLista({
  titulo,
  contagem,
  vazio,
  acaoTopo,
  children,
  abertaPadrao = true,
}: {
  titulo: string;
  contagem: number;
  vazio: ReactNode;
  acaoTopo?: ReactNode;
  children: ReactNode;
  abertaPadrao?: boolean;
}) {
  const [aberta, setAberta] = useState(abertaPadrao);

  return (
    <section className="central-dia-secao">
      <div className="central-dia-secao-h">
        <button
          type="button"
          className="central-dia-secao-toggle"
          onClick={() => setAberta((v) => !v)}
          aria-expanded={aberta}
        >
          <span className={`central-dia-chevron${aberta ? " is-aberta" : ""}`} aria-hidden="true">
            ›
          </span>
          <h3>{titulo}</h3>
          <span className="central-dia-secao-contagem">{contagem}</span>
        </button>
        {acaoTopo}
      </div>
      {aberta ? (
        contagem === 0 ? (
          <div className="central-dia-vazio">{vazio}</div>
        ) : (
          <div className="central-dia-secao-lista">{children}</div>
        )
      ) : null}
    </section>
  );
}
