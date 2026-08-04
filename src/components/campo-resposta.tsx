"use client";

import type { PerguntaFormulario } from "@/lib/formularios-context";

export type PessoaOpcao = { id: string; nome: string };

/**
 * Mostra o campo de resposta de acordo com o tipo escolhido.
 * `interativo` decide se o campo é preenchível de verdade (página pública) ou só um espelho
 * travado (linha da pergunta no construtor). Quando interativo, `valor`/`onMudarValor` controlam o
 * campo de verdade — sem isso a submissão pública não tem como capturar o que foi digitado.
 */
export function CampoResposta({
  pergunta,
  interativo = false,
  valor = "",
  onMudarValor,
  contatosDisponiveis = [],
  responsaveisDisponiveis = [],
}: {
  pergunta: PerguntaFormulario;
  interativo?: boolean;
  valor?: string;
  onMudarValor?: (valor: string) => void;
  contatosDisponiveis?: PessoaOpcao[];
  responsaveisDisponiveis?: PessoaOpcao[];
}) {
  const disabled = !interativo || pergunta.somenteLeitura;
  const props = interativo
    ? { value: valor, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onMudarValor?.(e.target.value) }
    : { placeholder: pergunta.placeholder || "Digite sua resposta…" };

  switch (pergunta.tipo) {
    case "texto_longo":
      return (
        <textarea
          className="input form-resposta-campo"
          style={{ width: "100%", minHeight: 90 }}
          placeholder={pergunta.placeholder || "Digite sua resposta…"}
          disabled={disabled}
          {...props}
        />
      );
    case "numero":
      return (
        <input
          className="input form-resposta-campo"
          style={{ width: "100%" }}
          type="number"
          placeholder={pergunta.placeholder || "0"}
          min={pergunta.min}
          max={pergunta.max}
          disabled={disabled}
          {...props}
        />
      );
    case "moeda":
      return (
        <div className="form-campo-prefixado">
          <span>R$</span>
          <input
            className="input form-resposta-campo"
            style={{ width: "100%" }}
            type="text"
            inputMode="decimal"
            placeholder={pergunta.placeholder || "0,00"}
            disabled={disabled}
            {...props}
          />
        </div>
      );
    case "data":
      return (
        <input className="input form-resposta-campo" style={{ width: "100%" }} type="date" disabled={disabled} {...props} />
      );
    case "hora":
      return (
        <input className="input form-resposta-campo" style={{ width: "100%" }} type="time" disabled={disabled} {...props} />
      );
    case "data_hora":
      return (
        <input
          className="input form-resposta-campo"
          style={{ width: "100%" }}
          type="datetime-local"
          disabled={disabled}
          {...props}
        />
      );
    case "arquivo":
    case "imagem":
      return interativo ? (
        <label className="form-upload-preview" style={{ cursor: "pointer" }}>
          {valor ? `📎 ${valor}` : pergunta.tipo === "imagem" ? "🖼 Escolher imagem" : "📎 Anexar arquivo"}
          <input
            type="file"
            accept={pergunta.tipo === "imagem" ? "image/*" : undefined}
            style={{ display: "none" }}
            onChange={(e) => onMudarValor?.(e.target.files?.[0]?.name ?? "")}
          />
        </label>
      ) : (
        <div className="form-upload-preview">{pergunta.tipo === "imagem" ? "🖼 Escolher imagem" : "📎 Anexar arquivo"}</div>
      );
    case "email":
      return (
        <input
          className="input form-resposta-campo"
          style={{ width: "100%" }}
          type="email"
          placeholder={pergunta.placeholder || "nome@email.com"}
          disabled={disabled}
          {...props}
        />
      );
    case "telefone":
      return (
        <input
          className="input form-resposta-campo"
          style={{ width: "100%" }}
          type="tel"
          placeholder={pergunta.placeholder || "+55 62 9XXXX-XXXX"}
          disabled={disabled}
          {...props}
        />
      );
    case "cpf":
      return (
        <input
          className="input form-resposta-campo"
          style={{ width: "100%" }}
          type="text"
          inputMode="numeric"
          placeholder={pergunta.placeholder || "000.000.000-00"}
          disabled={disabled}
          {...props}
        />
      );
    case "cnpj":
      return (
        <input
          className="input form-resposta-campo"
          style={{ width: "100%" }}
          type="text"
          inputMode="numeric"
          placeholder={pergunta.placeholder || "00.000.000/0000-00"}
          disabled={disabled}
          {...props}
        />
      );
    case "url":
      return (
        <input
          className="input form-resposta-campo"
          style={{ width: "100%" }}
          type="url"
          placeholder={pergunta.placeholder || "https://…"}
          disabled={disabled}
          {...props}
        />
      );
    case "lista_suspensa":
      return (
        <select className="input form-resposta-campo" style={{ width: "100%" }} disabled={disabled} {...props}>
          <option value="">Selecione…</option>
          {(pergunta.opcoes ?? []).map((op, i) => (
            <option key={i} value={op}>
              {op}
            </option>
          ))}
        </select>
      );
    case "opcao_unica":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(pergunta.opcoes ?? []).map((op, i) => (
            <label key={i} style={{ display: "flex", gap: 8, fontSize: 12, alignItems: "center" }}>
              <input
                type="radio"
                name={interativo ? pergunta.id : undefined}
                disabled={disabled}
                checked={interativo ? valor === op : undefined}
                onChange={() => onMudarValor?.(op)}
              />
              {op}
            </label>
          ))}
        </div>
      );
    case "checkbox":
      return (
        <label style={{ display: "flex", gap: 8, fontSize: 12, alignItems: "center" }}>
          <input
            type="checkbox"
            disabled={disabled}
            checked={interativo ? valor === "sim" : undefined}
            onChange={(e) => onMudarValor?.(e.target.checked ? "sim" : "")}
          />
          {pergunta.placeholder || "Confirmar"}
        </label>
      );
    case "multipla_escolha": {
      const selecionadas = valor ? valor.split(",") : [];
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(pergunta.opcoes ?? []).map((op, i) => (
            <label key={i} style={{ display: "flex", gap: 8, fontSize: 12, alignItems: "center" }}>
              <input
                type="checkbox"
                disabled={disabled}
                checked={interativo ? selecionadas.includes(op) : undefined}
                onChange={(e) => {
                  const proximas = e.target.checked ? [...selecionadas, op] : selecionadas.filter((s) => s !== op);
                  onMudarValor?.(proximas.join(","));
                }}
              />
              {op}
            </label>
          ))}
        </div>
      );
    }
    case "sim_nao":
      return (
        <div className="filters-row" style={{ margin: 0 }}>
          {["Sim", "Não"].map((op) => (
            <button
              key={op}
              type="button"
              className={`fchip${interativo && valor === op ? " active" : ""}`}
              disabled={!interativo}
              onClick={() => onMudarValor?.(op)}
            >
              {op}
            </button>
          ))}
        </div>
      );
    case "avaliacao": {
      const n = Number(valor) || 0;
      return (
        <div style={{ display: "flex", gap: 4 }}>
          {[1, 2, 3, 4, 5].map((estrela) => (
            <button
              key={estrela}
              type="button"
              disabled={!interativo}
              className="form-estrela-btn"
              aria-label={`${estrela} estrela(s)`}
              onClick={() => onMudarValor?.(String(estrela))}
              style={{ color: estrela <= n ? "#f5a623" : "var(--text-faint)" }}
            >
              ★
            </button>
          ))}
        </div>
      );
    }
    case "nota": {
      const n = Number(valor);
      return (
        <div className="form-nota-linha">
          {Array.from({ length: 11 }, (_, i) => i).map((num) => (
            <button
              key={num}
              type="button"
              disabled={!interativo}
              className={`form-nota-btn${n === num ? " active" : ""}`}
              onClick={() => onMudarValor?.(String(num))}
            >
              {num}
            </button>
          ))}
        </div>
      );
    }
    case "contato":
      return (
        <select className="input form-resposta-campo" style={{ width: "100%" }} disabled={disabled} {...props}>
          <option value="">Selecione um contato…</option>
          {contatosDisponiveis.map((c) => (
            <option key={c.id} value={c.nome}>
              {c.nome}
            </option>
          ))}
        </select>
      );
    case "responsavel":
      return (
        <select className="input form-resposta-campo" style={{ width: "100%" }} disabled={disabled} {...props}>
          <option value="">Selecione um responsável…</option>
          {responsaveisDisponiveis.map((r) => (
            <option key={r.id} value={r.nome}>
              {r.nome}
            </option>
          ))}
        </select>
      );
    case "titulo":
      return <h3 className="form-bloco-titulo">{pergunta.rotulo}</h3>;
    case "texto_bloco":
      return <p className="form-bloco-texto">{pergunta.descricao || pergunta.rotulo}</p>;
    case "divisor":
      return <hr className="form-bloco-divisor" />;
    case "espacamento":
      return <div className="form-bloco-espacamento" />;
    case "imagem_bloco":
      return pergunta.placeholder ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL livre informada pelo usuário, sem otimização de imagem local
        <img className="form-bloco-imagem" src={pergunta.placeholder} alt={pergunta.rotulo || ""} />
      ) : (
        <div className="form-bloco-imagem-vazia">🖼 Sem imagem definida</div>
      );
    default:
      return (
        <input
          className="input form-resposta-campo"
          style={{ width: "100%" }}
          placeholder={pergunta.placeholder || "Digite sua resposta…"}
          disabled={disabled}
          {...props}
        />
      );
  }
}

/** Enunciado numerado + descrição/ajuda + campo de resposta — usado no construtor, na pré-visualização e na página pública. */
export function PerguntaVisualizacao({
  pergunta,
  indice,
  interativo = false,
  valor,
  onMudarValor,
  erro,
  contatosDisponiveis,
  responsaveisDisponiveis,
}: {
  pergunta: PerguntaFormulario;
  indice: number;
  interativo?: boolean;
  valor?: string;
  onMudarValor?: (valor: string) => void;
  erro?: string;
  contatosDisponiveis?: PessoaOpcao[];
  responsaveisDisponiveis?: PessoaOpcao[];
}) {
  const ehLayout = pergunta.tipo === "titulo" || pergunta.tipo === "texto_bloco" || pergunta.tipo === "divisor" || pergunta.tipo === "espacamento" || pergunta.tipo === "imagem_bloco";

  if (ehLayout) {
    return (
      <div className="form-pergunta-enunciado-bloco">
        <CampoResposta pergunta={pergunta} interativo={interativo} valor={valor} onMudarValor={onMudarValor} />
      </div>
    );
  }

  return (
    <div className="form-pergunta-enunciado-bloco">
      <p className="form-pergunta-enunciado">
        {indice}. {pergunta.rotulo || "Pergunta sem título"}
        {pergunta.obrigatoria ? <span className="form-pergunta-asterisco"> *</span> : null}
      </p>
      {pergunta.descricao ? <p className="form-pergunta-dica">{pergunta.descricao}</p> : null}
      <CampoResposta
        pergunta={pergunta}
        interativo={interativo}
        valor={valor}
        onMudarValor={onMudarValor}
        contatosDisponiveis={contatosDisponiveis}
        responsaveisDisponiveis={responsaveisDisponiveis}
      />
      {pergunta.textoAjuda ? <p className="form-pergunta-ajuda">{pergunta.textoAjuda}</p> : null}
      {erro ? <p className="form-pergunta-erro">{erro}</p> : null}
    </div>
  );
}
