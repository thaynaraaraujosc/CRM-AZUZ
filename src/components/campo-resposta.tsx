"use client";

import type { PerguntaFormulario } from "@/lib/formularios-context";

/**
 * Mostra o campo de resposta de acordo com o tipo escolhido.
 * `interativo` decide se o campo é preenchível de verdade (pré-visualização
 * e página pública) ou só um espelho travado (linha da pergunta no construtor).
 */
export function CampoResposta({
  pergunta,
  interativo = false,
}: {
  pergunta: PerguntaFormulario;
  interativo?: boolean;
}) {
  switch (pergunta.tipo) {
    case "texto_longo":
      return (
        <textarea
          className="input form-resposta-campo"
          style={{ width: "100%", minHeight: 90 }}
          placeholder="Digite sua resposta…"
          disabled={!interativo}
        />
      );
    case "data":
      return (
        <input
          className="input form-resposta-campo"
          style={{ width: "100%" }}
          type="date"
          disabled={!interativo}
        />
      );
    case "numero":
      return (
        <input
          className="input form-resposta-campo"
          style={{ width: "100%" }}
          type="number"
          placeholder="0"
          disabled={!interativo}
        />
      );
    case "upload":
      return interativo ? (
        <label className="form-upload-preview" style={{ cursor: "pointer" }}>
          📎 Anexar arquivo
          <input type="file" style={{ display: "none" }} />
        </label>
      ) : (
        <div className="form-upload-preview">📎 Anexar arquivo</div>
      );
    case "contato_email":
      return (
        <input
          className="input form-resposta-campo"
          style={{ width: "100%" }}
          type="email"
          placeholder="nome@email.com"
          disabled={!interativo}
        />
      );
    case "contato_telefone":
      return (
        <input
          className="input form-resposta-campo"
          style={{ width: "100%" }}
          type="tel"
          placeholder="+55 62 9XXXX-XXXX"
          disabled={!interativo}
        />
      );
    case "contato_site":
      return (
        <input
          className="input form-resposta-campo"
          style={{ width: "100%" }}
          placeholder="https://…"
          disabled={!interativo}
        />
      );
    case "contato_localizacao":
      return (
        <input
          className="input form-resposta-campo"
          style={{ width: "100%" }}
          placeholder="Cidade, Estado"
          disabled={!interativo}
        />
      );
    case "opcao_unica":
    case "multipla_escolha":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(pergunta.opcoes ?? []).map((op, i) => (
            <label key={i} style={{ display: "flex", gap: 8, fontSize: 12 }}>
              <input
                type={pergunta.tipo === "opcao_unica" ? "radio" : "checkbox"}
                name={interativo ? pergunta.id : undefined}
                disabled={!interativo}
              />
              {op}
            </label>
          ))}
        </div>
      );
    default:
      return (
        <input
          className="input form-resposta-campo"
          style={{ width: "100%" }}
          placeholder="Digite sua resposta…"
          disabled={!interativo}
        />
      );
  }
}

/** Enunciado numerado + dica + campo de resposta — usado no construtor, na pré-visualização e na página pública. */
export function PerguntaVisualizacao({
  pergunta,
  indice,
  interativo = false,
}: {
  pergunta: PerguntaFormulario;
  indice: number;
  interativo?: boolean;
}) {
  return (
    <div className="form-pergunta-enunciado-bloco">
      <p className="form-pergunta-enunciado">
        {indice}. {pergunta.rotulo}
        {pergunta.obrigatoria ? (
          <span className="form-pergunta-asterisco"> *</span>
        ) : null}
      </p>
      {pergunta.dica ? <p className="form-pergunta-dica">{pergunta.dica}</p> : null}
      <CampoResposta pergunta={pergunta} interativo={interativo} />
    </div>
  );
}
