"use client";

import Link from "next/link";
import { useState } from "react";

import { useContatos } from "@/lib/contatos-context";
import { useEquipe } from "@/lib/equipe-context";
import { useTarefas } from "@/lib/tarefas-context";
import { PERMISSOES_POR_MODULO } from "@/lib/configuracoes/permissoes";
import { Toggle, Topbar } from "@/components/ui";

const LABEL_PERMISSAO: Record<string, string> = Object.fromEntries(
  PERMISSOES_POR_MODULO.flatMap((grupo) => grupo.permissoes.map((p) => [p.id, `${grupo.modulo} · ${p.label}`])),
);

function classePapel(papel: string) {
  const slug = papel.toLowerCase().replace(/[^a-z]+/g, "-");
  return `role-tag-${slug}`;
}

export default function EquipePage() {
  const { membros: equipe, alternarAtivo, removerMembro, resetarSenha } = useEquipe();
  const { colunas } = useTarefas();
  const { contatos } = useContatos();
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);
  const [gerandoSenha, setGerandoSenha] = useState(false);

  const membro = equipe.find((m) => m.nome === selecionado) ?? null;
  const tarefasDoMembro = membro
    ? colunas
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
            <table className="tbl equipe-tbl">
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
                {equipe.map((m) => {
                  return (
                  <tr key={m.id}>
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
                          setSenhaGerada(null);
                        }}
                      >
                        <div className="avatar">
                          {m.foto ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={m.foto}
                              alt=""
                              style={{
                                width: "100%",
                                height: "100%",
                                borderRadius: "inherit",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            m.initials
                          )}
                        </div>
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
                      <span className={`role-tag ${classePapel(m.papel)}`}>
                        {m.papel}
                        {m.papelNota ? (
                          <span className="soft"> {m.papelNota}</span>
                        ) : null}
                      </span>
                    </td>
                    <td>
                      {m.leads === "—" ? (
                        m.leads
                      ) : (
                        <span className="leads-pill">{m.leads}</span>
                      )}
                    </td>
                    <td>
                      <span className="access-note">{m.enxerga}</span>
                    </td>
                    <td>
                      {m.convitePendente ? (
                        <span className="pill">Convite pendente</span>
                      ) : (
                        <Toggle
                          key={`${m.id}-${m.ativo}`}
                          defaultOn={m.ativo}
                          label={`Ativar ${m.nome}`}
                          onToggle={() => alternarAtivo(m.id)}
                        />
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {membro ? (
          <section className="open-conv">
            <div className="open-conv-h">
              <div className="avatar">
                {membro.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={membro.foto}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "inherit",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  membro.initials
                )}
              </div>
              <div>
                <p className="n">{membro.nome}</p>
                <p className="s">
                  {membro.papel}
                  {membro.papelNota ? ` ${membro.papelNota}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="btn ghost danger"
                style={{ marginLeft: "auto", marginRight: 10 }}
                onClick={() => {
                  const mensagem = membro.convitePendente
                    ? `Excluir o convite de ${membro.nome}? Ele deixa de existir — dá pra convidar outro e-mail depois.`
                    : `Excluir ${membro.nome} da equipe? Ele perde o acesso ao CRM na hora.`;
                  if (!window.confirm(mensagem)) return;
                  removerMembro(membro.id);
                  setSelecionado(null);
                }}
              >
                Excluir
              </button>
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
                  <label>Senha</label>
                  {membro.convitePendente ? (
                    <span className="pill">Ainda não definida — convite pendente</span>
                  ) : senhaGerada ? (
                    <div className="key-row" style={{ padding: 0 }}>
                      <div className="key-box">{senhaGerada}</div>
                      <button type="button" className="btn ghost" onClick={() => navigator.clipboard?.writeText(senhaGerada)}>
                        Copiar
                      </button>
                      <button type="button" className="btn ghost" onClick={() => setSenhaGerada(null)}>
                        Fechar
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn ghost"
                        disabled={gerandoSenha}
                        onClick={async () => {
                          setGerandoSenha(true);
                          const nova = await resetarSenha(membro.id);
                          setSenhaGerada(nova);
                          setGerandoSenha(false);
                        }}
                      >
                        {gerandoSenha ? "Gerando…" : "Gerar nova senha"}
                      </button>
                      <p className="hint" style={{ padding: "8px 0 0" }}>
                        A senha antiga não pode ser mostrada (é guardada de forma irreversível). Gerar uma nova substitui a atual — repasse pra pessoa.
                      </p>
                    </>
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
                    <div className="stat-row" key={permissao}>
                      <span className="sl">{LABEL_PERMISSAO[permissao] ?? permissao}</span>
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
