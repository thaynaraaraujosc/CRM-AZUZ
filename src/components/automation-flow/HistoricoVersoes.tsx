"use client";

import type { VersaoFluxo } from "@/lib/automation-flow/types";
import { IconClose } from "@/components/icons";

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function HistoricoVersoes({
  versoes,
  versaoAtual,
  onFechar,
  onRestaurar,
}: {
  versoes: VersaoFluxo[];
  versaoAtual: number;
  onFechar: () => void;
  onRestaurar: (versao: VersaoFluxo) => void;
}) {
  const ordenadas = [...versoes].sort((a, b) => b.versao - a.versao);

  return (
    <div className="flow-side-overlay" role="dialog" aria-label="Histórico de versões" onClick={onFechar}>
      <div className="flow-side-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-h">
          <h4>Histórico de versões</h4>
          <button type="button" className="icon-btn subtle" aria-label="Fechar histórico" onClick={onFechar}>
            <IconClose width={13} height={13} />
          </button>
        </div>
        <div className="flow-side-body">
          {ordenadas.length === 0 ? (
            <p className="hint">Esse fluxo ainda não foi publicado — não existe versão salva.</p>
          ) : (
            ordenadas.map((v) => (
              <div className="flow-versao-row" key={v.versao}>
                <div>
                  <p className="n">
                    Versão {v.versao} {v.versao === versaoAtual ? <span className="pill on">Atual</span> : null}
                  </p>
                  <p className="r">
                    Publicado em {formatarData(v.publicadoEm)} por {v.publicadoPor}
                  </p>
                </div>
                <button type="button" className="btn ghost" onClick={() => onRestaurar(v)} disabled={v.versao === versaoAtual}>
                  Restaurar
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
