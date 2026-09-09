"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";

import { Topbar } from "@/components/ui";
import { AbasAutomacoes } from "@/components/automacoes/AbasAutomacoes";
import { AbasSocial } from "@/components/social/AbasSocial";
import type { PainelExecucoesSociais } from "@/app/api/social/execucoes/route";

const SITUACAO_LABEL: Record<string, string> = {
  em_andamento: "Rodando",
  aguardando_tempo: "Esperando o relógio",
  aguardando_evento: "Esperando a resposta",
  concluida: "Concluída",
  cancelada: "Cancelada",
  erro: "Erro",
};

const RESULTADO_LABEL: Record<string, string> = {
  ok: "feito",
  condicao_falsa: "condição não bateu",
  aguardando: "esperando",
  erro: "erro",
  pulado: "pulado",
};

function quando(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

/**
 * Execuções dos robôs do Instagram, e o log de erro.
 *
 * As duas listas ficam separadas porque as falhas são opostas na causa: execução com erro é
 * problema no fluxo ou no envio; evento com erro é problema ANTES do fluxo (token vencido,
 * permissão perdida, comentário sem autor), e ali nenhum robô chegou a rodar. Procurar no fluxo,
 * nesse caso, é procurar no lugar errado.
 */
export default function ExecucoesSociaisPage() {
  const [soErros, setSoErros] = useState(false);
  const [resposta, setResposta] = useState<{ paraErros: boolean; dados: PainelExecucoesSociais | null } | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/social/execucoes${soErros ? "?erros=1" : ""}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<PainelExecucoesSociais>) : null))
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
        sub="O que os robôs do Instagram fizeram, e o que deu errado"
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

      <div className="content social-layout">
        <AbasSocial />
        <div className="social-conteudo">
        <section className="card">
          <h3>Execuções</h3>
          {carregando && !painel ? (
            <p className="hint">Carregando…</p>
          ) : !painel?.execucoes.length ? (
            <p className="hint">
              {soErros ? "Nenhuma execução com erro. É a notícia boa." : "Nenhuma execução ainda."}
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Robô</th>
                  <th>Contato</th>
                  <th>Situação</th>
                  <th aria-label="Passos" />
                </tr>
              </thead>
              <tbody>
                {painel.execucoes.map((e) => (
                  // Duas linhas por execução (a linha e os passos abertos), então a chave vive no
                  // Fragment: no `<>` sem chave o React reclama e reordena errado ao filtrar.
                  <Fragment key={e.id}>
                    <tr>
                      <td className="hint">{quando(e.iniciadaEm)}</td>
                      <td>
                        <Link href={`/automacoes/editor/${e.fluxoId}`}>{e.fluxoNome}</Link>
                      </td>
                      <td>{e.contatoNome}</td>
                      <td>
                        <span className={`badge ${e.situacao === "erro" ? "badge-danger" : e.situacao === "concluida" ? "badge-success" : "badge-neutral"}`}>
                          {SITUACAO_LABEL[e.situacao] ?? e.situacao}
                        </span>
                        {e.erroMensagem ? <p className="hint">{e.erroMensagem}</p> : null}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => setAberta(aberta === e.id ? null : e.id)}
                        >
                          {aberta === e.id ? "Fechar" : `${e.passos.length} passos`}
                        </button>
                      </td>
                    </tr>
                    {aberta === e.id ? (
                      <tr>
                        <td colSpan={5}>
                          <ol className="hint">
                            {e.passos.map((p, i) => (
                              <li key={`${e.id}-${i}`}>
                                <strong>{p.titulo || p.noTipo}</strong> — {RESULTADO_LABEL[p.resultado] ?? p.resultado}
                                {p.detalhe ? `: ${p.detalhe}` : ""}
                              </li>
                            ))}
                            {!e.passos.length ? <li>Nenhum passo registrado.</li> : null}
                          </ol>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card mt16">
          <h3>Eventos que nem chegaram a virar execução</h3>
          <p className="hint">
            O webhook chegou e falhou antes de qualquer robô rodar: token vencido, permissão que a
            conta perdeu, comentário sem autor. Quando o erro está aqui, o defeito não está no fluxo.
          </p>
          {!painel?.eventosComErro.length ? (
            <p className="hint mt8">Nenhum. Tudo que chegou foi processado.</p>
          ) : (
            <table className="table mt8">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Evento</th>
                  <th>Contato</th>
                  <th>Erro</th>
                </tr>
              </thead>
              <tbody>
                {painel.eventosComErro.map((e) => (
                  <tr key={e.id}>
                    <td className="hint">{quando(e.criadoEm)}</td>
                    <td>{e.tipo.replace(/_/g, " ")}</td>
                    <td>{e.contatoNome ?? "—"}</td>
                    <td className="hint">{e.erro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        </div>
      </div>
    </>
  );
}
