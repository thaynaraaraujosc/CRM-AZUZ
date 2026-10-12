"use client";

import { useCentralDia } from "@/lib/central-dia-context";
import { SecaoLista } from "./SecaoLista";
import { useIdioma } from "@/lib/idioma-context";

/** Área "Concluídos hoje" (item 15). Só o que foi resolvido nesta sessão/navegador, nunca apaga
 * dado real (o item continua existindo no módulo de origem, só sai da lista principal aqui). */
export function ConcluidosHoje() {
  const { t: traduzir } = useIdioma();
  const { concluidos, desfazerConcluido, limparConcluidos } = useCentralDia();

  return (
    <SecaoLista
      titulo={traduzir("Concluídos hoje")}
      contagem={concluidos.length}
      abertaPadrao={false}
      vazio={<p className="hint">{traduzir("Nada concluído ainda hoje.")}</p>}
      acaoTopo={
        concluidos.length > 0 ? (
          <button type="button" className="btn ghost" onClick={limparConcluidos}>
            {traduzir("Limpar lista")}
          </button>
        ) : undefined
      }
    >
      {concluidos.map((c) => (
        <div className="central-dia-concluido-row" key={c.itemId}>
          <div>
            <p className="n">{c.titulo}</p>
            <p className="r">
              {c.tipo} · {c.acao} às {c.horario} por {c.usuario}
            </p>
          </div>
          <button type="button" className="btn ghost" onClick={() => desfazerConcluido(c.itemId)}>
            {traduzir("Desfazer")}
          </button>
        </div>
      ))}
    </SecaoLista>
  );
}
