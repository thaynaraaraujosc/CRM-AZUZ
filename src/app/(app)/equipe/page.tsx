"use client";

import Link from "next/link";
import { useState } from "react";

import { contatos, equipe, tarefas } from "@/lib/data";
import { Toggle, Topbar } from "@/components/ui";

export default function EquipePage() {
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [senhaVisivel, setSenhaVisivel] = useState(false);

  const membro = equipe.find((m) => m.nome === selecionado) ?? null;
  const tarefasDoMembro = membro
    ? tarefas
        .flatMap((coluna) => coluna.cards)
        .filter((t) => t.responsavel.nome === membro.nome)
    : [];
  const leadsDoMembro = membro
    ? contatos.filter((c) => c.responsavel === membro.nome)
    : [];

  return (
    <>
      <Topbar
        title="Equipe"
        sub={`${equipe.length} pessoas · controle de acesso por papel`}
        actions={
          <Link className="btn primary" href="/equipe/convidar">
            + Convidar
          </Link>
        }
      />

      <div className="content">
        <div className="card mb14">
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Papel</th>
                  <th>Leads atribuídos</th>
                  <th>O que enxerga</th>
                  <th>Ativo</th>
                </tr>
              </thead>
              <tbody>
                {equipe.map((m) => (
                  <tr key={m.nome}>
                    <td>
                      <button
                        type="button"
                        className="name-cell"
                        style={{
                          background: "none",
                          border: 0,
                          padding: 0,
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          setSelecionado((atual) =>
                            atual === m.nome ? null : m.nome,
                          );
                          setSenhaVisivel(false);
                        }}
                      >
                        <div className="avatar">{m.initials}</div>
                        <span
                          className="n"
                          style={{
                            color:
                              selecionado === m.nome ? "var(--blue)" : undefined,
                          }}
                        >
                          {m.nome}
                        </span>
                      </button>
                    </td>
                    <td>
                      <span className={`role-tag ${m.papelTipo}`}>
                        {m.papel}
                        {m.papelNota ? (
                          <span className="soft"> {m.papelNota}</span>
                        ) : null}
                      </span>
                    </td>
                    <td>{m.leads}</td>
                    <td>
                      <span className="access-note">{m.enxerga}</span>
                    </td>
                    <td>
                      {m.convitePendente ? (
                        <span className="pill">Convite pendente</span>
                      ) : (
                        <Toggle defaultOn={m.ativo} label={`Ativar ${m.nome}`} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {membro ? (
          <section className="open-conv">
            <div className="open-conv-h">
              <div className="avatar">{membro.initials}</div>
              <div>
                <p className="n">{membro.nome}</p>
                <p className="s">
                  {membro.papel}
                  {membro.papelNota ? ` ${membro.papelNota}` : ""}
                </p>
              </div>
              <span
                className="close"
                style={{ cursor: "pointer" }}
                onClick={() => setSelecionado(null)}
              >
                Fechar ✕
              </span>
            </div>

            <div className="open-conv-body">
              <div>
                <div className="panel-h">
                  <h4>Acesso</h4>
                </div>
                <div className="field">
                  <label>E-mail cadastrado</label>
                  <div className="input">{membro.email}</div>
                </div>
                <div className="field">
                  <label>Senha atual</label>
                  {membro.senha ? (
                    <>
                      <div className="key-row" style={{ padding: 0 }}>
                        <div className="key-box">
                          {senhaVisivel ? membro.senha : "•".repeat(membro.senha.length)}
                        </div>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => setSenhaVisivel((v) => !v)}
                        >
                          {senhaVisivel ? "Ocultar" : "Mostrar"}
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() =>
                            navigator.clipboard?.writeText(membro.senha ?? "")
                          }
                        >
                          Copiar
                        </button>
                      </div>
                      <p className="hint" style={{ padding: "8px 0 0" }}>
                        Só quem é Admin enxerga essa senha — use pra ajudar em
                        caso de esquecimento.
                      </p>
                    </>
                  ) : (
                    <span className="pill">
                      Ainda não definida — convite pendente
                    </span>
                  )}
                </div>

                <div className="panel-h divided">
                  <h4>O que ela pode ver</h4>
                </div>
                {membro.permissoes.length === 0 ? (
                  <p className="hint">
                    Nenhuma permissão de CRM ligada a esse papel — {membro.enxerga.toLowerCase()}.
                  </p>
                ) : (
                  membro.permissoes.map((permissao) => (
                    <div className="toggle-row" key={permissao}>
                      <span className="tl">{permissao}</span>
                      <Toggle defaultOn label={permissao} />
                    </div>
                  ))
                )}
              </div>

              <div>
                <div className="panel-h">
                  <h4>Tarefas atribuídas</h4>
                </div>
                {tarefasDoMembro.length === 0 ? (
                  <p className="hint">Nenhuma tarefa atribuída no momento.</p>
                ) : (
                  tarefasDoMembro.map((t) => (
                    <div className="stat-row" key={t.id}>
                      <span className="sl">{t.titulo}</span>
                      <span className="sv">{t.data}</span>
                    </div>
                  ))
                )}

                <div className="panel-h divided">
                  <h4>Leads atribuídos</h4>
                </div>
                {leadsDoMembro.length === 0 ? (
                  <p className="hint">Nenhum lead atribuído no momento.</p>
                ) : (
                  leadsDoMembro.map((c) => (
                    <div className="stat-row" key={c.nome}>
                      <span className="sl">{c.nome}</span>
                      <span className="sv">{c.etapa}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
