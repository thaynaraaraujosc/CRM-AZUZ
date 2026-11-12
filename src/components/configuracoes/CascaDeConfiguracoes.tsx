"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { CategoriasNav } from "./CategoriasNav";
import type { CategoriaId } from "@/lib/configuracoes/estrutura";

/**
 * O MENU DE CONFIGURAÇÕES AO LADO DE UMA TELA QUE NÃO É A DE CONFIGURAÇÕES.
 *
 * Existe por causa da Equipe: ela virou uma categoria de Configurações sem deixar de ser uma tela
 * própria, e uma categoria que leva pra fora e some com o menu não é uma categoria — é um link
 * solto que dá a sensação de ter saído do lugar.
 *
 * Escolher qualquer outra categoria daqui volta pra `/configuracoes` já naquela categoria, pela
 * URL. É o que faz o caminho de ida e volta ser o mesmo, e é por isso que `?categoria=` existe.
 */
export function CascaDeConfiguracoes({
  ativa,
  children,
}: {
  ativa: CategoriaId;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <div className="int-casca">
      <nav className="int-menu" aria-label="Configurações">
        <CategoriasNav
          ativa={ativa}
          onSelecionar={(id) => router.push(`/configuracoes?categoria=${id}`)}
        />
      </nav>
      <div className="int-paginas">{children}</div>
    </div>
  );
}
