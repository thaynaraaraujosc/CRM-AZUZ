"use client";

import { useEffect, useState } from "react";

import { Topbar } from "@/components/ui";
import { AbasAutomacoes } from "@/components/automacoes/AbasAutomacoes";
import { AbasSocial } from "@/components/social/AbasSocial";
import { TabelaExecucoes } from "@/components/automacoes/TabelaExecucoes";
import type { PainelExecucoes } from "@/app/api/automacoes/execucoes/route";

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
  const [resposta, setResposta] = useState<{ paraErros: boolean; dados: PainelExecucoes | null } | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/automacoes/execucoes?area=social${soErros ? "&erros=1" : ""}`, { cache: "no-store" })
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
          ) : (
            <TabelaExecucoes
              execucoes={painel?.execucoes ?? []}
              vazio={soErros ? "Nenhuma execução com erro. É a notícia boa." : "Nenhuma execução ainda."}
            />
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
