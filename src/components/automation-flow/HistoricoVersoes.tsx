"use client";

import { useEffect, useState } from "react";

import type { VersaoFluxo } from "@/lib/automation-flow/types";
import { IconClose } from "@/components/icons";

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * As versões vêm do SERVIDOR, da mesma tabela que o motor executa.
 *
 * Antes vinham do Json guardado dentro do fluxo, que o editor mantinha por conta própria. As duas
 * listas podiam divergir: o histórico mostrava uma versão e o cliente recebia outra. Ler do mesmo
 * lugar que executa é o que faz "restaurar a versão 3" significar a mesma coisa nos dois lados.
 */
export function HistoricoVersoes({
  fluxoId,
  versoes,
  versaoAtual,
  onFechar,
  onRestaurar,
}: {
  fluxoId: string;
  /** O que o editor tem em mãos. Aparece enquanto o servidor responde, pra a lista não piscar. */
  versoes: VersaoFluxo[];
  versaoAtual: number;
  onFechar: () => void;
  onRestaurar: (versao: VersaoFluxo) => void;
}) {
  const [doServidor, setDoServidor] = useState<VersaoFluxo[] | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/automacoes-fluxos/${fluxoId}/versoes`)
      .then((r) => (r.ok ? r.json() : null))
      .then((lista: VersaoFluxo[] | null) => {
        if (vivo && Array.isArray(lista)) setDoServidor(lista);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [fluxoId]);

  const ordenadas = [...(doServidor ?? versoes)].sort((a, b) => b.versao - a.versao);

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
            <p className="hint">Esse fluxo ainda não foi publicado. Não existe versão salva.</p>
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
