"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { CabecalhoCategoria } from "./CabecalhoCategoria";
import { useIdioma } from "@/lib/idioma-context";

/** Aparência: só o tema (claro/escuro, real, liga em `ThemeToggle`). Densidade/tamanho/menu
 * lateral/prévia saíram: eram só decorativos, sem nenhuma aplicação de fato no resto do CRM. */
export function AparenciaSecao() {
  const { t: traduzir } = useIdioma();
  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo={traduzir("Aparência")} descricao={traduzir("Tema claro ou escuro.")} />

      <div className="config-bloco">
        <p className="config-bloco-titulo">{traduzir("Tema")}</p>
        <ThemeToggle />
      </div>
    </div>
  );
}
