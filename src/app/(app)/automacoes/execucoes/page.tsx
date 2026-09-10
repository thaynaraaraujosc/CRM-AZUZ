"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Topbar } from "@/components/ui";
import { AbasAutomacoes } from "@/components/automacoes/AbasAutomacoes";
import { TabelaExecucoes } from "@/components/automacoes/TabelaExecucoes";
import type { PainelExecucoes } from "@/app/api/automacoes/execucoes/route";

/**
 * O que os robôs do funil fizeram, e o que deu errado.
 *
 * Esta tela existia só pro Instagram, e a falta dela no comercial custou caro: um follow-up que
 * não saiu virou uma noite de investigação, quando a resposta já estava gravada no banco, passo a
 * passo, o tempo todo. O motor sempre registrou; só não havia onde olhar.
 */
export default function ExecucoesDoFunilPage() {
  const [soErros, setSoErros] = useState(false);
  const [resposta, setResposta] = useState<{ paraErros: boolean; dados: PainelExecucoes | null } | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/automacoes/execucoes?area=comercial${soErros ? "&erros=1" : ""}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<PainelExecucoes>) : null))
      .then((dados) => {
        if (!cancelado) setResposta({ paraErros: soErros, dados });
      })
      .catch(() => {
        if (!cancelado) setResposta({ paraErros: soErros, dados: null });
      });
    return () => {
      cancelado = true;
    };
  }, [soErros]);

  const carregando = resposta?.paraErros !== soErros;
  const painel = resposta?.dados ?? null;

  return (
    <>
      <Topbar
        title="Execuções"
        sub="O que cada robô do funil fez, lead por lead, passo por passo"
        actions={
          <div className="social-periodo">
            <button type="button" className={`seg-chip${soErros ? "" : " on"}`} onClick={() => setSoErros(false)}>
              Todas
            </button>
            <button type="button" className={`seg-chip${soErros ? " on" : ""}`} onClick={() => setSoErros(true)}>
              Só erros
            </button>
          </div>
        }
      />
      <AbasAutomacoes />

      <div className="content">
        <section className="card" style={{ padding: "var(--space-4)" }}>
          <div className="disp-item-cabecalho">
            <div>
              <h3>Execuções</h3>
              <p className="hint">
                Abra uma execução pra ver a linha do tempo: o que rodou, o que esperou e o motivo
                exato de qualquer falha, com a resposta do canal.
              </p>
            </div>
            <Link className="btn" href="/automacoes">
              Voltar pras automações
            </Link>
          </div>

          {carregando && !painel ? (
            <p className="hint mt8">Carregando…</p>
          ) : (
            <TabelaExecucoes
              execucoes={painel?.execucoes ?? []}
              vazio={
                soErros
                  ? "Nenhuma execução com erro. É a notícia boa."
                  : "Nenhuma execução ainda. Assim que um gatilho acontecer, ela aparece aqui."
              }
            />
          )}
        </section>
      </div>
    </>
  );
}
