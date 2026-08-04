"use client";

import { useState } from "react";

import { azuzIaMensagens } from "@/lib/data";
import { IconEnviar, IconSparkle } from "@/components/icons";
import { Topbar } from "@/components/ui";

const RESPOSTA_PADRAO =
  "Essa é uma prévia da interface — ainda não estou conectada aos dados reais do seu workspace. Em breve vou conseguir responder perguntas como essa de verdade.";

export default function AzuzIaPage() {
  const [mensagens, setMensagens] = useState(azuzIaMensagens);
  const [pergunta, setPergunta] = useState("");

  function enviarPergunta() {
    const texto = pergunta.trim();
    if (!texto) return;
    setPergunta("");
    setMensagens((prev) => [...prev, { tipo: "out", texto }]);
    setTimeout(() => {
      setMensagens((prev) => [...prev, { tipo: "in", texto: RESPOSTA_PADRAO }]);
    }, 500);
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
            />
            <button
              type="submit"
              className="chat-mic-btn chat-send-btn"
              aria-label="Enviar pergunta"
              disabled={!pergunta.trim()}
            >
              <IconEnviar />
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
