"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { CabecalhoCategoria } from "./CabecalhoCategoria";

/** Aparência — só o tema (claro/escuro, real, liga em `ThemeToggle`). Densidade/tamanho/menu
 * lateral/prévia saíram: eram só decorativos, sem nenhuma aplicação de fato no resto do CRM. */
export function AparenciaSecao() {
  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo="Aparência" descricao="Tema claro ou escuro." />

      <div className="config-bloco">
        <p className="config-bloco-titulo">Tema</p>
        <ThemeToggle />
      </div>
    </div>
  );
}
