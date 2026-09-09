"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Topbar } from "@/components/ui";
import { AbasSocial } from "@/components/social/AbasSocial";
import { useAutomationFlows } from "@/lib/automation-flow-context";
import { MODELOS_SOCIAIS } from "@/lib/social/modelos-rapidos";
import type { ConexaoSocial } from "@/app/api/social/conexoes/route";

/**
 * Os robôs do Instagram.
 *
 * Mesma lista, mesmo editor e mesmo motor dos robôs comerciais: o que separa os dois é a `area` do
 * fluxo, que decide quais gatilhos e quais blocos existem na tela. Um robô daqui pode mover o lead
 * no funil, criar tarefa e chamar um atendente exatamente como o outro, porque é o mesmo código
 * rodando.
 *
 * O aviso de conexão no topo não é decoração: sem a conta do Instagram ligada, nenhum gatilho
 * desta tela chega. Melhor dizer isso antes de a pessoa montar o fluxo inteiro.
 */
export default function AutomacoesSociaisPage() {
  const router = useRouter();
  const { fluxos, criarFluxo, alternarAtivo, excluirFluxo } = useAutomationFlows();
  const [conexoes, setConexoes] = useState<ConexaoSocial[] | null>(null);

  useEffect(() => {
    fetch("/api/social/conexoes", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<ConexaoSocial[]>) : null))
      .then((dados) => setConexoes(Array.isArray(dados) ? dados : []))
      .catch(() => setConexoes([]));
  }, []);

  const roboSociais = useMemo(
    () => fluxos.filter((f) => f.area === "social" && !f.arquivada),
    [fluxos],
  );

  const instagram = conexoes?.find((c) => c.canal === "instagram");

  function criarEmBranco() {
    const novo = criarFluxo({ nome: "Robô do Instagram", area: "social" });
    router.push(`/automacoes/editor/${novo.id}`);
  }

  function criarDoModelo(modeloId: string) {
    const modelo = MODELOS_SOCIAIS.find((m) => m.id === modeloId);
    if (!modelo) return;
    const { nodes, edges, configuracoes } = modelo.construir();
    // Rascunho, sempre. Publicar sozinho ligaria uma automação que ninguém leu, respondendo
    // cliente com texto de exemplo.
    const novo = criarFluxo({
      nome: modelo.nome,
      descricao: modelo.descricao,
      area: "social",
      nodes,
      edges,
      configuracoes,
    });
    router.push(`/automacoes/editor/${novo.id}`);
  }

  return (
    <>
      <Topbar
        title="Automações do Instagram"
        sub="Comentário, Direct, story e menção"
        actions={
          <button type="button" className="btn primary" onClick={criarEmBranco}>
            + Robô em branco
          </button>
        }
      />
      <AbasSocial />

      <div className="content">
        {instagram && !instagram.conectado ? (
          <section className="card" style={{ marginBottom: "var(--space-3)" }}>
            <strong>O Instagram não está conectado.</strong>
            <p className="hint mt8">
              {instagram.motivo} Enquanto isso, dá pra montar os robôs aqui, mas nenhum gatilho vai
              acontecer.
            </p>
          </section>
        ) : null}

        <section className="card">
          <h3>Começar por um modelo</h3>
          <p className="hint">
            Cada um é um robô inteiro, feito só de gatilhos e blocos que existem no Instagram. Nasce
            como rascunho: leia, troque o texto e publique quando estiver do seu jeito.
          </p>
          <div className="social-modelos">
            {MODELOS_SOCIAIS.map((m) => (
              <button key={m.id} type="button" className="social-modelo" onClick={() => criarDoModelo(m.id)}>
                <strong>{m.nome}</strong>
                <span>{m.descricao}</span>
                <em>{m.ajustar}</em>
              </button>
            ))}
          </div>
        </section>

        <section className="card mt16">
          <h3>Seus robôs</h3>
          {!roboSociais.length ? (
            <p className="hint">Nenhum robô do Instagram ainda. Comece por um modelo acima.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Situação</th>
                  <th>Execuções</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {roboSociais.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <button type="button" className="link" onClick={() => router.push(`/automacoes/editor/${f.id}`)}>
                        {f.nome}
                      </button>
                      {f.descricao ? <p className="hint">{f.descricao}</p> : null}
                    </td>
                    <td>
                      <span className={`badge ${f.status === "publicado" && f.ativa ? "badge-success" : "badge-neutral"}`}>
                        {f.status === "rascunho" ? "Rascunho" : f.ativa ? "Ligado" : "Pausado"}
                      </span>
                    </td>
                    <td>{f.execucoes}</td>
                    <td style={{ textAlign: "right" }}>
                      {f.status === "publicado" ? (
                        <button type="button" className="btn ghost" onClick={() => alternarAtivo(f.id)}>
                          {f.ativa ? "Pausar" : "Ligar"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => {
                          if (window.confirm(`Excluir "${f.nome}"? Isso não volta.`)) excluirFluxo(f.id);
                        }}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
