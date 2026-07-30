import type { Metadata } from "next";

import { conversaAberta, conversas } from "@/lib/data";
import {
  CanalBadge,
  IconConfiguracoes,
  IconDoc,
} from "@/components/icons";
import { RadioList, Toggle, Topbar } from "@/components/ui";

export const metadata: Metadata = { title: "Conversas · CRM AZUZ" };

export default function ConversasPage() {
  const { tarefa } = conversaAberta;

  return (
    <>
      <Topbar
        title="Conversas"
        sub="WhatsApp, Instagram e TikTok — kanban por status de atendimento"
        actions={
          <>
            <span className="fsel">Atendente: Todos ▾</span>
            <span className="fsel">Canal: Todos ▾</span>
          </>
        }
      />

      <div className="content">
        <div className="kanban">
          {conversas.map((coluna) => (
            <div key={coluna.titulo}>
              <div className="kcol-h">
                <span className="t">
                  <span className="dot" />
                  {coluna.titulo}
                </span>
                <span className="c">{coluna.cards.length}</span>
              </div>

              {coluna.cards.map((card) => {
                const aberta = card.id === conversaAberta.id;
                return (
                  <button
                    type="button"
                    key={card.id}
                    className={`conv-card${aberta ? " open" : ""}`}
                  >
                    <span className="cr1">
                      <span className="avatar">
                        {card.initials}
                        <CanalBadge canal={card.canal} />
                      </span>
                      <span className="cname">{card.nome}</span>
                      {aberta ? (
                        <span className="gear-btn">
                          <IconConfiguracoes />
                        </span>
                      ) : (
                        <span className="ctime">{card.tempo}</span>
                      )}
                    </span>
                    <span className="cmsg">{card.mensagem}</span>
                    <span className="cr3">
                      <span className="tag">{card.origem}</span>
                      {aberta ? (
                        <span className="ctime">{conversaAberta.telefone}</span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Conversa aberta, embaixo do kanban */}
        <section className="open-conv">
          <div className="open-conv-h">
            <div className="avatar">{conversaAberta.initials}</div>
            <div>
              <p className="n">{conversaAberta.nome}</p>
              <p className="s">
                {conversaAberta.canal} · {conversaAberta.telefone}
              </p>
            </div>
            <span className="close">Fechar ✕</span>
          </div>

          <div className="open-conv-body">
            <div>
              <div className="chat-body">
                {conversaAberta.mensagens.map((msg, i) => (
                  <div className={`bubble ${msg.tipo}`} key={i}>
                    {msg.texto}
                    {msg.hora ? <span className="tm">{msg.hora}</span> : null}
                  </div>
                ))}
              </div>
              <div className="chat-input">
                <div className="box">Escrever mensagem…</div>
              </div>
            </div>

            <div>
              <div className="panel-h">
                <h4>Atribuir atendente</h4>
              </div>
              <RadioList
                options={conversaAberta.atendentes.map((a) => ({
                  nome: a.nome,
                  descricao: a.papel,
                }))}
                initial={conversaAberta.atendenteSelecionado}
              />

              <div className="panel-h divided">
                <h4>Tarefa</h4>
              </div>
              <div className="field">
                <label>Data da tarefa</label>
                <div className="input">{tarefa.data}</div>
              </div>
              <div className="field">
                <label>O que fazer</label>
                <div className="input">{tarefa.oQueFazer}</div>
              </div>
              <div className="field">
                <label>Valor combinado</label>
                <div className="input">{tarefa.valor}</div>
              </div>
              <div className="field">
                <label>Anexo</label>
                <div className="attach-chip">
                  <IconDoc />
                  <span className="fn">{tarefa.anexo.arquivo}</span>
                  <span className="fs">{tarefa.anexo.detalhe}</span>
                </div>
                <button type="button" className="btn ghost block mt14">
                  + Anexar outro documento
                </button>
              </div>
              <div className="field">
                <label>Atribuir tarefa para</label>
                <div className="input">{tarefa.responsavel}</div>
              </div>

              <div className="toggle-row">
                <span className="tl">Avisar por WhatsApp perto do vencimento</span>
                <Toggle defaultOn label="Avisar por WhatsApp perto do vencimento" />
              </div>
              <div className="toggle-row">
                <span className="tl">Mostrar essa tarefa no portal do cliente</span>
                <Toggle defaultOn label="Mostrar essa tarefa no portal do cliente" />
              </div>

              <div className="section-foot">
                <button type="button" className="btn primary block">
                  Salvar atribuição e tarefa
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
