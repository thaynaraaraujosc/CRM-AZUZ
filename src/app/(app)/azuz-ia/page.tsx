"use client";

import { useState } from "react";

import { azuzIaMensagens } from "@/lib/data";
import { IconEnviar, IconSparkle } from "@/components/icons";
import { Topbar } from "@/components/ui";

const RESPOSTA_ERRO =
  "Não consegui responder agora — verifica se a Azuz IA está configurada (Configurações → Azuz IA) e tenta de novo em instantes.";

export default function AzuzIaPage() {
  const [mensagens, setMensagens] = useState(azuzIaMensagens);
  const [pergunta, setPergunta] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function enviarPergunta() {
    const texto = pergunta.trim();
    if (!texto || carregando) return;
    setPergunta("");
    const historico = mensagens;
    setMensagens((prev) => [...prev, { tipo: "out", texto }]);
    setCarregando(true);
    try {
      const resposta = await fetch("/api/azuz-ia/perguntar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mensagem: texto, historico }),
      });
      const dados = (await resposta.json()) as { resposta?: string; erro?: string };
      setMensagens((prev) => [...prev, { tipo: "in", texto: dados.resposta ?? RESPOSTA_ERRO }]);
    } catch {
      setMensagens((prev) => [...prev, { tipo: "in", texto: RESPOSTA_ERRO }]);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <Topbar
        title="Azuz IA"
        sub="Sua assistente dentro do CRM — pergunta qualquer coisa sobre leads, tarefas ou funil"
      />

      <div className="content wa-content" style={{ justifyContent: "center" }}>
        <section className="wa-main" style={{ borderRight: "none", maxWidth: 720 }}>
          <div className="open-conv-h">
            <div className="avatar">
              <IconSparkle width={16} height={16} />
            </div>
            <div>
              <p className="n">Azuz IA</p>
              <p className="s">Treinada com os dados do seu workspace</p>
            </div>
          </div>

          <div className="chat-body">
            {mensagens.map((msg, i) => (
              <div className={`bubble ${msg.tipo}`} key={i}>
                {msg.texto}
              </div>
            ))}
            {carregando ? <div className="bubble in">Digitando…</div> : null}
          </div>
          <form
            className="chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              enviarPergunta();
            }}
          >
            <input
              className="box chat-input-campo"
              placeholder="Escrever pra Azuz IA…"
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              disabled={carregando}
            />
            <button
              type="submit"
              className="chat-mic-btn chat-send-btn"
              aria-label="Enviar pergunta"
              disabled={!pergunta.trim() || carregando}
            >
              <IconEnviar />
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
