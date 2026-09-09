"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { Topbar } from "@/components/ui";
import { AbasAutomacoes } from "@/components/automacoes/AbasAutomacoes";
import { AbasSocial } from "@/components/social/AbasSocial";
import { useAutomationFlows } from "@/lib/automation-flow-context";
import {
  CATEGORIA_RESPOSTA,
  OPCOES_QUANDO,
  lerRespostaDoFluxo,
  montarFluxoDaResposta,
  validarResposta,
  type RespostaAutomatica,
} from "@/lib/social/resposta-automatica";

function vazia(): RespostaAutomatica {
  return { nome: "", quando: "comentario", palavras: [], mensagem: "", respostaPublica: "", etiqueta: "" };
}

/**
 * Respostas automáticas: a forma curta de um robô social.
 *
 * A maior parte do que se quer no Instagram é uma frase só ("quem comentar X recebe Y no Direct"),
 * e pedir que isso seja montado no construtor é pedir que se aprenda um editor inteiro pra
 * escrever duas linhas.
 *
 * Não é um segundo sistema: cada resposta daqui É um fluxo social, com os mesmos nós, a mesma
 * execução e o mesmo versionamento. Quem quiser continuar dali abre no construtor e acrescenta o
 * que quiser. E quando o fluxo cresce além do que esta tela sabe representar, ela diz isso e manda
 * pro construtor, em vez de mostrar uma versão empobrecida que apagaria o resto ao salvar.
 */
export default function RespostasAutomaticasPage() {
  const router = useRouter();
  const { data: sessao } = useSession();
  const { fluxos, criarFluxo, atualizarFluxo, publicarFluxo, alternarAtivo, excluirFluxo } = useAutomationFlows();

  const [editando, setEditando] = useState<{ id: string | null; dados: RespostaAutomatica } | null>(null);
  const [problemas, setProblemas] = useState<string[]>([]);

  const respostas = useMemo(
    () =>
      fluxos
        .filter((f) => f.area === "social" && f.categoria === CATEGORIA_RESPOSTA && !f.arquivada)
        .map((f) => ({ fluxo: f, resposta: lerRespostaDoFluxo(f) })),
    [fluxos],
  );

  function abrir(id: string | null) {
    if (!id) {
      setEditando({ id: null, dados: vazia() });
      setProblemas([]);
      return;
    }
    const alvo = respostas.find((r) => r.fluxo.id === id);
    if (!alvo?.resposta) return;
    setEditando({ id, dados: alvo.resposta });
    setProblemas([]);
  }

  function salvar() {
    if (!editando) return;
    const encontrados = validarResposta(editando.dados);
    setProblemas(encontrados);
    if (encontrados.length) return;

    const { nodes, edges } = montarFluxoDaResposta(editando.dados);
    const usuario = sessao?.user?.name ?? "Equipe";

    if (editando.id) {
      atualizarFluxo(editando.id, { nome: editando.dados.nome, nodes, edges });
      // Publica na hora: resposta automática que fica em rascunho é uma resposta que não responde,
      // e ninguém abre esta tela pra deixar um rascunho.
      publicarFluxo(editando.id, usuario);
    } else {
      const novo = criarFluxo({
        nome: editando.dados.nome,
        area: "social",
        categoria: CATEGORIA_RESPOSTA,
        nodes,
        edges,
        configuracoes: { motorNovo: true, naoIniciarSeJaNoFluxo: true },
        ativa: true,
      });
      publicarFluxo(novo.id, usuario);
    }
    setEditando(null);
  }

  const d = editando?.dados;

  return (
    <>
      <Topbar
        title="Respostas automáticas"
        sub="Uma frase que o robô responde sozinho, sem abrir o construtor"
        actions={
          <button type="button" className="btn primary" onClick={() => abrir(null)}>
            + Nova resposta
          </button>
        }
      />
      <AbasAutomacoes />

      <div className="content social-layout">
        <AbasSocial />
        <div className="social-conteudo">
        {editando && d ? (
          <section className="card" style={{ marginBottom: "var(--space-3)" }}>
            <h3>{editando.id ? "Editar resposta" : "Nova resposta"}</h3>

            <div className="field mt8">
              <label>Nome</label>
              <input
                className="input"
                value={d.nome}
                placeholder='Ex.: Comentou "quero"'
                onChange={(e) => setEditando({ ...editando, dados: { ...d, nome: e.target.value } })}
              />
            </div>

            <div className="field">
              <label>Quando</label>
              <select
                className="input"
                value={d.quando}
                onChange={(e) =>
                  setEditando({
                    ...editando,
                    dados: {
                      ...d,
                      quando: e.target.value as RespostaAutomatica["quando"],
                      // Resposta pública só existe onde há comentário a responder. Guardar o texto
                      // escondido faria o salvamento recusar por um campo que sumiu da tela.
                      respostaPublica: e.target.value === "comentario" ? d.respostaPublica : "",
                    },
                  })
                }
              >
                {OPCOES_QUANDO.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="hint">{OPCOES_QUANDO.find((o) => o.valor === d.quando)?.ajuda}</p>
            </div>

            <div className="field">
              <label>Só quando tiver estas palavras (opcional)</label>
              <input
                className="input"
                value={d.palavras.join(", ")}
                placeholder="quero, preço, valor"
                onChange={(e) =>
                  setEditando({
                    ...editando,
                    dados: { ...d, palavras: e.target.value.split(",").map((p) => p.trim()).filter(Boolean) },
                  })
                }
              />
              <p className="hint">
                Separe por vírgula. Vazio = qualquer mensagem daquele tipo dispara. A comparação é
                por palavra inteira e ignora acento, então &quot;quero&quot; não dispara em
                &quot;não quero&quot;.
              </p>
            </div>

            <div className="field">
              <label>Mensagem no Direct</label>
              <textarea
                className="input"
                style={{ minHeight: 90, resize: "vertical" }}
                value={d.mensagem}
                maxLength={1000}
                onChange={(e) => setEditando({ ...editando, dados: { ...d, mensagem: e.target.value } })}
              />
              <p className="hint">{d.mensagem.length}/1000 caracteres, o limite do Direct.</p>
            </div>

            {d.quando === "comentario" ? (
              <div className="field">
                <label>Responder o comentário em público (opcional)</label>
                <input
                  className="input"
                  value={d.respostaPublica ?? ""}
                  placeholder="Chamei você no Direct 💙"
                  onChange={(e) => setEditando({ ...editando, dados: { ...d, respostaPublica: e.target.value } })}
                />
                <p className="hint">
                  É o que aparece pra quem está lendo os comentários, e costuma ser o que faz a
                  próxima pessoa comentar também.
                </p>
              </div>
            ) : null}

            <div className="field">
              <label>Etiquetar o contato (opcional)</label>
              <input
                className="input"
                value={d.etiqueta ?? ""}
                placeholder="Veio do Instagram"
                onChange={(e) => setEditando({ ...editando, dados: { ...d, etiqueta: e.target.value } })}
              />
            </div>

            {problemas.length ? (
              <ul className="hint" style={{ color: "var(--danger)" }}>
                {problemas.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : null}

            <div className="mt8">
              <button type="button" className="btn primary" onClick={salvar}>
                Salvar e ligar
              </button>
              <button type="button" className="btn ghost" onClick={() => setEditando(null)}>
                Cancelar
              </button>
            </div>
          </section>
        ) : null}

        <section className="card">
          <h3>Suas respostas</h3>
          {!respostas.length ? (
            <p className="hint">Nenhuma ainda.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Quando</th>
                  <th>Situação</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {respostas.map(({ fluxo, resposta }) => (
                  <tr key={fluxo.id}>
                    <td>{fluxo.nome}</td>
                    <td className="hint">
                      {resposta
                        ? OPCOES_QUANDO.find((o) => o.valor === resposta.quando)?.label
                        : "Editada no construtor"}
                    </td>
                    <td>
                      <span className={`badge ${fluxo.status === "publicado" && fluxo.ativa ? "badge-success" : "badge-neutral"}`}>
                        {fluxo.status === "rascunho" ? "Rascunho" : fluxo.ativa ? "Ligada" : "Pausada"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {resposta ? (
                        <button type="button" className="btn ghost" onClick={() => abrir(fluxo.id)}>
                          Editar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn ghost"
                          title="Este fluxo tem passos que esta tela não sabe representar. Editar aqui apagaria o resto."
                          onClick={() => router.push(`/automacoes/editor/${fluxo.id}`)}
                        >
                          Abrir no construtor
                        </button>
                      )}
                      {fluxo.status === "publicado" ? (
                        <button type="button" className="btn ghost" onClick={() => alternarAtivo(fluxo.id)}>
                          {fluxo.ativa ? "Pausar" : "Ligar"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => {
                          if (window.confirm(`Excluir "${fluxo.nome}"? Isso não volta.`)) excluirFluxo(fluxo.id);
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
      </div>
    </>
  );
}
