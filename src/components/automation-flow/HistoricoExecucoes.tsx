"use client";

import { useEffect, useState } from "react";

import { IconBloqueado, IconCheck, IconClose, IconErro, IconPause, IconPular } from "@/components/icons";

/**
 * "Rodou? Parou onde?" — a pergunta mais comum sobre automação, que até aqui não tinha resposta.
 *
 * O motor antigo não guardava nada: quando uma automação não respondia um cliente, ninguém tinha
 * como saber se ela chegou a disparar, em que bloco parou, ou por quê. Agora cada execução deixa
 * rastro, e esta tela é onde ele aparece.
 */
type Passo = {
  noId: string;
  noTipo: string;
  titulo: string | null;
  resultado: string;
  detalhe: string | null;
  em: string;
};

type Execucao = {
  id: string;
  contatoNome: string;
  gatilho: string;
  situacao: string;
  iniciadaEm: string;
  finalizadaEm: string | null;
  aguardandoAte: string | null;
  aguardandoEvento: string | null;
  erroMensagem: string | null;
  passos: Passo[];
};

const ICONE_PASSO: Record<string, typeof IconCheck> = {
  ok: IconCheck,
  condicao_falsa: IconBloqueado,
  aguardando: IconPause,
  erro: IconErro,
  pulado: IconPular,
};

const LABEL_SITUACAO: Record<string, string> = {
  em_andamento: "Em andamento",
  aguardando_tempo: "Esperando o tempo passar",
  aguardando_evento: "Esperando a resposta",
  concluida: "Concluída",
  cancelada: "Cancelada",
  erro: "Erro",
};

function quando(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function HistoricoExecucoes({ fluxoId, onFechar }: { fluxoId: string; onFechar: () => void }) {
  const [execucoes, setExecucoes] = useState<Execucao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/automacoes-fluxos/${fluxoId}/execucoes`)
      .then(async (r) => {
        if (!r.ok) throw new Error("falhou");
        return (await r.json()) as Execucao[];
      })
      .then((dados) => {
        if (!cancelado) setExecucoes(dados);
      })
      .catch(() => {
        if (!cancelado) setErro("Não foi possível carregar o histórico agora.");
      });
    return () => {
      cancelado = true;
    };
  }, [fluxoId]);

  return (
    <div className="flow-side-overlay" role="dialog" aria-label="Histórico de execuções" onClick={onFechar}>
      <div className="flow-side-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-h">
          <h4>Histórico de execuções</h4>
          <button type="button" className="icon-btn subtle" aria-label="Fechar histórico" onClick={onFechar}>
            <IconClose width={13} height={13} />
          </button>
        </div>
        <div className="flow-side-body">
          {erro ? <p className="flow-problema erro">{erro}</p> : null}

          {!execucoes && !erro ? <p className="hint">Carregando…</p> : null}

          {execucoes && execucoes.length === 0 ? (
            <p className="hint">
              Esse fluxo ainda não rodou pra ninguém. O histórico só existe para os fluxos com as
              esperas de verdade ligadas — nas Configurações gerais.
            </p>
          ) : null}

          {(execucoes ?? []).map((execucao) => {
            const expandida = aberta === execucao.id;
            return (
              <div className="flow-versao-row" key={execucao.id} style={{ display: "block" }}>
                <button
                  type="button"
                  className="flow-exec-cabecalho"
                  onClick={() => setAberta(expandida ? null : execucao.id)}
                  style={{ display: "flex", justifyContent: "space-between", width: "100%", background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left" }}
                >
                  <div>
                    <p className="n">{execucao.contatoNome}</p>
                    <p className="r">
                      {LABEL_SITUACAO[execucao.situacao] ?? execucao.situacao} · {quando(execucao.iniciadaEm)}
                    </p>
                  </div>
                  <span className="r">{expandida ? "−" : "+"}</span>
                </button>

                {expandida ? (
                  <>
                    {execucao.erroMensagem ? <p className="flow-problema erro mt14">{execucao.erroMensagem}</p> : null}
                    {execucao.aguardandoAte ? (
                      <p className="hint">Continua em {quando(execucao.aguardandoAte)}.</p>
                    ) : null}
                    {execucao.aguardandoEvento && !execucao.aguardandoAte ? (
                      <p className="hint">Esperando o contato responder — sem prazo.</p>
                    ) : null}

                    <ul className="flow-sim-passos">
                      {execucao.passos.map((passo, i) => {
                        const Icone = ICONE_PASSO[passo.resultado] ?? IconCheck;
                        return (
                          <li key={`${passo.noId}-${i}`}>
                            <span aria-hidden="true" style={{ display: "inline-flex" }}>
                              <Icone width={13} height={13} />
                            </span>
                            <div>
                              <p className="n">{passo.titulo || passo.noTipo}</p>
                              {passo.detalhe ? <p className="r">{passo.detalhe}</p> : null}
                            </div>
                          </li>
                        );
                      })}
                      {execucao.passos.length === 0 ? <li><div><p className="r">Sem passos registrados.</p></div></li> : null}
                    </ul>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
