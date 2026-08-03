"use client";

import { useCentralDia } from "@/lib/central-dia-context";
import type { RecomendacaoDia } from "@/lib/central-dia/tipos";

const LABEL_IMPACTO: Record<RecomendacaoDia["impacto"], string> = {
  alto: "Impacto alto",
  medio: "Impacto médio",
  baixo: "Impacto baixo",
};

/** "Recomendações para hoje" (item 10) — regras locais mockadas, nunca IA de verdade (a Azuz IA de
 * verdade nem está conectada nesta fase). */
export function Recomendacoes({
  recomendacoes,
  onVerItens,
}: {
  recomendacoes: RecomendacaoDia[];
  onVerItens: (filtro: string) => void;
}) {
  const { avisar } = useCentralDia();

  if (recomendacoes.length === 0) return null;

  return (
    <section className="central-dia-secao">
      <div className="central-dia-secao-h">
        <h3>Recomendações para hoje</h3>
      </div>
      <div className="central-dia-recomendacoes">
        {recomendacoes.map((r) => (
          <div className="central-dia-recomendacao" key={r.id}>
            <div>
              <p className="n">{r.motivo}</p>
              <p className="r">
                {r.quantidade} afetado{r.quantidade > 1 ? "s" : ""} · <span className={`is-${r.impacto}`}>{LABEL_IMPACTO[r.impacto]}</span>
              </p>
            </div>
            <div className="central-dia-recomendacao-acoes">
              <button type="button" className="btn ghost" onClick={() => r.filtroRelacionado && onVerItens(r.filtroRelacionado)}>
                Ver itens
              </button>
              <button type="button" className="btn ghost" onClick={() => avisar(`Simulado: "${r.acaoSugerida}" aplicado.`)}>
                Aplicar simulação
              </button>
              <button type="button" className="btn ghost" onClick={() => avisar("Tarefa criada a partir da recomendação.")}>
                Criar tarefa
              </button>
              <button type="button" className="btn ghost" onClick={() => avisar("Recomendação ignorada por hoje.")}>
                Ignorar por hoje
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
