import type { Metadata } from "next";

import { tarefaAberta, tarefas } from "@/lib/data";
import { IconConfiguracoes, IconDoc } from "@/components/icons";
import { Toggle, Topbar } from "@/components/ui";

export const metadata: Metadata = { title: "Tarefas · CRM AZUZ" };

export default function TarefasPage() {
  return (
    <>
      <Topbar
        title="Tarefas"
        sub="Kanban por prazo — de todas as conversas, num lugar só"
        actions={
          <button type="button" className="btn primary">
            + Nova tarefa
          </button>
        }
      />

      <div className="content">
        <div className="kanban">
          {tarefas.map((coluna) => (
            <div key={coluna.titulo}>
              <div className="kcol-h">
                <span className="t">
                  <span className="dot" />
                  {coluna.titulo}
                </span>
                <span className="c">{coluna.cards.length}</span>
              </div>

              {coluna.cards.map((card) => {
                const aberta = card.id === tarefaAberta.id;
                const classes = [
                  "task-card",
                  aberta ? "open" : "",
                  card.concluida ? "done" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <button type="button" key={card.id} className={classes}>
                    <span className="tc-r1">
                      <span className="tc-title">{card.titulo}</span>
                      {aberta ? (
                        <span className="gear-btn">
                          <IconConfiguracoes />
                        </span>
                      ) : (
                        <span
                          className={`tc-date${card.atrasada ? " late" : ""}`}
                        >
                          {card.data}
                        </span>
                      )}
                    </span>
                    <span className="tc-meta" style={{ display: "block" }}>
                      {card.contato}
                      {aberta ? ` · ${card.data}` : ""}
                    </span>
                    <span className="tc-r3">
                      <span className="task-who">
                        <span className="avatar xs">
                          {card.responsavel.initials}
                        </span>
                        {card.responsavel.nome}
                      </span>
                      {card.valor ? (
                        <span className="tc-val">{card.valor}</span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Tarefa aberta, embaixo do kanban */}
        <section className="open-conv">
          <div className="open-conv-h">
            <div className="avatar">{tarefaAberta.initials}</div>
            <div>
              <p className="n">{tarefaAberta.titulo}</p>
              <p className="s">{tarefaAberta.subtitulo}</p>
            </div>
            <span className="close">Fechar ✕</span>
          </div>

          <div className="open-conv-body">
            <div>
              <div className="panel-h">
                <h4>O que precisa ser feito</h4>
              </div>
              <div className="field">
                <div className="input" style={{ minHeight: 80 }}>
                  {tarefaAberta.descricao}
                </div>
              </div>

              <div className="panel-h divided">
                <h4>Anexos</h4>
              </div>
              <div style={{ padding: "14px 17px" }}>
                <div className="attach-chip" style={{ marginBottom: 8 }}>
                  <IconDoc />
                  <span className="fn">{tarefaAberta.anexo.arquivo}</span>
                  <span className="fs">{tarefaAberta.anexo.detalhe}</span>
                </div>
                <button type="button" className="btn ghost block">
                  + Anexar documento
                </button>
              </div>
            </div>

            <div>
              <div className="panel-h">
                <h4>Detalhes</h4>
              </div>
              <div className="field">
                <label>Data</label>
                <div className="input">{tarefaAberta.data}</div>
              </div>
              <div className="field">
                <label>Valor combinado</label>
                <div className="input">{tarefaAberta.valor}</div>
              </div>
              <div className="field">
                <label>Atribuir para</label>
                <div className="input">{tarefaAberta.responsavel}</div>
              </div>
              <div className="toggle-row">
                <span className="tl">Avisar por WhatsApp perto do vencimento</span>
                <Toggle defaultOn label="Avisar por WhatsApp perto do vencimento" />
              </div>
              <div className="section-foot">
                <button type="button" className="btn primary" style={{ flex: 1 }}>
                  Salvar tarefa
                </button>
                <button type="button" className="btn ghost" style={{ flex: 1 }}>
                  Marcar concluída
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
