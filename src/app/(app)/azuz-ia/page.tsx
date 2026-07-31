"use client";

import { useState } from "react";

import { azuzIaMensagens } from "@/lib/data";
import { IconSparkle } from "@/components/icons";
import { Topbar } from "@/components/ui";

export default function AzuzIaPage() {
  const [mensagens] = useState(azuzIaMensagens);

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
          <div className="chat-input">
            <div className="box">Escrever pra Azuz IA…</div>
          </div>
        </section>
      </div>
    </>
  );
}
