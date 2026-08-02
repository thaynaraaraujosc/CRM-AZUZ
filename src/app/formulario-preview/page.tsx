"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  FORMULARIOS_STORAGE_KEY,
  type Formulario,
} from "@/lib/formularios-context";
import { PerguntaVisualizacao } from "@/components/campo-resposta";

function carregarFormularios(): Formulario[] {
  if (typeof window === "undefined") return [];
  try {
    const salvos = localStorage.getItem(FORMULARIOS_STORAGE_KEY);
    return salvos ? JSON.parse(salvos) : [];
  } catch {
    return [];
  }
}

function FormularioPreviewContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [formularios] = useState<Formulario[]>(carregarFormularios);
  const [enviado, setEnviado] = useState(false);

  const formulario = formularios.find((f) => f.id === id) ?? null;

  if (!formulario) {
    return (
      <div className="form-public-page">
        <div className="form-public-card" style={{ background: "#ffffff" }}>
          <h2>Formulário não encontrado</h2>
          <p className="hint">
            Volte pro CRM, abra o formulário e clique em &quot;Pré-visualizar
            como o cliente vê&quot; de novo.
          </p>
        </div>
      </div>
    );
  }

  if (enviado) {
    return (
      <div className="form-public-page">
        <div
          className="form-public-obrigado"
          style={{ background: formulario.corFundo }}
        >
          <h2>Obrigado!</h2>
          <p className="hint">Sua resposta foi enviada com sucesso.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="form-public-page">
      <div
        className="form-public-card"
        style={{ background: formulario.corFundo }}
      >
        <h2>{formulario.nome}</h2>
        {formulario.descricao ? (
          <p className="hint" style={{ marginBottom: 6 }}>
            {formulario.descricao}
          </p>
        ) : null}
        {formulario.perguntas.map((pergunta, indice) => (
          <div key={pergunta.id} style={{ padding: "10px 0" }}>
            <PerguntaVisualizacao
              pergunta={pergunta}
              indice={indice + 1}
              interativo
            />
          </div>
        ))}
        <button
          type="button"
          className="btn block"
          style={{
            background: formulario.corBotao,
            color: "#fff",
            marginTop: 10,
          }}
          onClick={() => setEnviado(true)}
        >
          {formulario.rotuloBotao}
        </button>
      </div>
    </div>
  );
}

export default function FormularioPreviewPage() {
  return (
    <Suspense fallback={null}>
      <FormularioPreviewContent />
    </Suspense>
  );
}
