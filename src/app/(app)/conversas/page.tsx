"use client";

import { useState } from "react";

import { conversas } from "@/lib/data";
import {
  CanalBadge,
  IconConfiguracoes,
  IconDoc,
} from "@/components/icons";
import { RadioList, Toggle, Topbar } from "@/components/ui";

export default function ConversasPage() {
  const [selectedId, setSelectedId] = useState(conversas[0].id);
  const aberta = conversas.find((c) => c.id === selectedId) ?? conversas[0];
  const { tarefa } = aberta;

  return (
    <>
      <Topbar
        title="WhatsApp"
        sub="WhatsApp, Instagram e TikTok — todas as conversas num só lugar"
        actions={
          <>
            <span className="fsel">Atendente: Todos ▾</span>
            <span className="fsel">Canal: Todos ▾</span>
          </>
        }
      />

      <div className="content wa-content">
        <aside className="wa-list">
          {conversas.map((c) => {
            const active = c.id === aberta.id;
            const last = c.mensagens[c.mensagens.length - 1];
            return (
              <button
                type="button"
                key={c.id}
                className={`wa-row${active ? " active" : ""}`}
                aria-pressed={active}
                onClick={() => setSelectedId(c.id)}
              >
                <span className="cr1">
                  <span className="avatar">
                    {c.initials}
                    <CanalBadge canal={c.canal} />
                  </span>
                  <span className="cname">{c.nome}</span>
                  <span className="ctime">{c.tempo}</span>
                </span>
                <span className="cmsg">
                  {last.tipo === "out" ? "Você: " : ""}
                  {last.texto}
                </span>
                <span className="cr3">
                  <span className="tag">{c.status}</span>
                  <span className="tag wa-tag-origem">{c.origem}</span>
                </span>
              </button>
            );
          })}
        </aside>

        <section className="wa-main">
          <div className="open-conv-h">
            <div className="avatar">{aberta.initials}</div>
            <div>
              <p className="n">{aberta.nome}</p>
              <p className="s">
                {aberta.canal} · {aberta.contato}
              </p>
            </div>
            <span className="gear-btn wa-main-gear">
              <IconConfiguracoes />
            </span>
          </div>

          <div className="chat-body">
            {aberta.mensagens.map((msg, i) => (
              <div className={`bubble ${msg.tipo}`} key={i}>
                {msg.texto}
                {msg.hora ? <span className="tm">{msg.hora}</span> : null}
              </div>
            ))}
          </div>
          <div className="chat-input">
            <div className="box">Escrever mensagem…</div>
          </div>
        </section>

        <aside className="wa-info">
          <div className="panel-h">
            <h4>Atribuir atendente</h4>
          </div>
          <RadioList
            key={aberta.id}
            options={aberta.atendentes.map((a) => ({
              nome: a.nome,
              descricao: a.papel,
            }))}
            initial={aberta.atendenteSelecionado}
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
          {tarefa.anexo ? (
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
          ) : (
            <div className="field">
              <label>Anexo</label>
              <button type="button" className="btn ghost block">
                + Anexar documento
              </button>
            </div>
          )}
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
        </aside>
      </div>
    </>
  );
}
