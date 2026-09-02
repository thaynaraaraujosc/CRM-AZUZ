"use client";

import { useRef, useState } from "react";

import { aplicarMascara, type PerguntaFormulario } from "@/lib/formularios-context";
import { IconAnexo, IconClose, IconDoc, IconImage, IconMic, IconStar, IconVideoCam } from "@/components/icons";
import { SeletorDeData } from "@/components/seletor-de-data";
import { AreaDeUpload } from "@/components/area-de-upload";

function lerComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result as string);
    leitor.onerror = () => reject(new Error("Falha ao ler o arquivo"));
    leitor.readAsDataURL(file);
  });
}

export type PessoaOpcao = { id: string; nome: string };

/** Campo de tags — digita e aperta Enter/vírgula pra virar chip; Backspace num campo vazio remove o
 * último chip. `valor` guarda as tags já confirmadas, separadas por vírgula. */
function CampoTags({
  interativo,
  valor = "",
  onMudarValor,
  placeholder,
}: {
  interativo?: boolean;
  valor?: string;
  onMudarValor?: (valor: string) => void;
  placeholder?: string;
}) {
  const [digitando, setDigitando] = useState("");
  const tags = valor ? valor.split(",").filter(Boolean) : [];

  function confirmarTag() {
    const nova = digitando.trim();
    if (!nova || tags.includes(nova)) {
      setDigitando("");
      return;
    }
    onMudarValor?.([...tags, nova].join(","));
    setDigitando("");
  }

  function removerTag(tag: string) {
    onMudarValor?.(tags.filter((t) => t !== tag).join(","));
  }

  if (!interativo) {
    return (
      <div className="form-tags-lista">
        {tags.length > 0 ? tags.map((t) => <span className="form-tag-chip" key={t}>{t}</span>) : <span className="hint">{placeholder || "Digite e aperte Enter…"}</span>}
      </div>
    );
  }

  return (
    <div className="form-tags-lista">
      {tags.map((t) => (
        <span className="form-tag-chip" key={t}>
          {t}
          <button type="button" onClick={() => removerTag(t)} aria-label={`Remover tag ${t}`}>
            <IconClose width={11} height={11} />
          </button>
        </span>
      ))}
      <input
        className="form-tags-input"
        value={digitando}
        placeholder={tags.length === 0 ? placeholder || "Digite e aperte Enter…" : ""}
        onChange={(e) => setDigitando(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            confirmarTag();
          } else if (e.key === "Backspace" && !digitando && tags.length > 0) {
            removerTag(tags[tags.length - 1]);
          }
        }}
        onBlur={confirmarTag}
      />
    </div>
  );
}

/** Assinatura por desenho (mouse/toque) — sem backend pra guardar arquivo, o "valor" salvo é a
 * própria imagem em data URL, gerada a partir do canvas. */
function CampoAssinatura({
  interativo,
  valor = "",
  onMudarValor,
}: {
  interativo?: boolean;
  valor?: string;
  onMudarValor?: (valor: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhandoRef = useRef(false);

  function posicao(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function iniciar(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!interativo) return;
    desenhandoRef.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    const { x, y } = posicao(e);
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  }

  function desenhar(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!interativo || !desenhandoRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = posicao(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0b1533";
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function finalizar() {
    if (!interativo || !desenhandoRef.current) return;
    desenhandoRef.current = false;
    const dataUrl = canvasRef.current?.toDataURL("image/png");
    if (dataUrl) onMudarValor?.(dataUrl);
  }

  function limpar() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    onMudarValor?.("");
  }

  return (
    <div>
      {valor && !interativo ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL local, sem otimização de imagem cabível
        <img src={valor} alt="Assinatura" className="form-assinatura-preview" />
      ) : (
        <canvas
          ref={canvasRef}
          className={`form-assinatura-canvas${interativo ? "" : " desabilitado"}`}
          width={280}
          height={110}
          onMouseDown={iniciar}
          onMouseMove={desenhar}
          onMouseUp={finalizar}
          onMouseLeave={finalizar}
        />
      )}
      {interativo ? (
        <button type="button" className="link" style={{ marginTop: 4 }} onClick={limpar}>
          Limpar assinatura
        </button>
      ) : null}
    </div>
  );
}

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
  function aoMudar(v: string) {
    onMudarValor?.(pergunta.mascara ? aplicarMascara(v, pergunta.mascara) : v);
  }
  const props = interativo
    ? { value: valor, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => aoMudar(e.target.value) }
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
    case "porcentagem":
      return (
        <div className="form-campo-prefixado form-campo-sufixado">
          <input
            className="input form-resposta-campo"
            style={{ width: "100%" }}
            type="text"
            inputMode="decimal"
            placeholder={pergunta.placeholder || "0"}
            disabled={disabled}
            {...props}
          />
          <span>%</span>
        </div>
      );
    case "senha":
      return (
        <input
          className="input form-resposta-campo"
          style={{ width: "100%" }}
          type="password"
          placeholder={pergunta.placeholder || "••••••••"}
          disabled={disabled}
          {...props}
        />
      );
    case "data":
      return (
        <SeletorDeData
          valor={interativo ? valor : ""}
          onChange={aoMudar}
          disabled={disabled}
          className="seletor-data-largo"
        />
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
    case "periodo": {
      const [de, ate] = valor ? valor.split("|") : ["", ""];
      return (
        <div className="filters-row" style={{ margin: 0 }}>
          <SeletorDeData
            valor={interativo ? de : ""}
            onChange={(iso) => onMudarValor?.(`${iso}|${ate}`)}
            disabled={disabled}
            curto
            className="seletor-data-flex"
          />
          <SeletorDeData
            valor={interativo ? ate : ""}
            onChange={(iso) => onMudarValor?.(`${de}|${iso}`)}
            disabled={disabled}
            curto
            className="seletor-data-flex"
          />
        </div>
      );
    }
    case "arquivo":
    case "documento":
    case "imagem":
    case "video":
    case "audio": {
      const accept = pergunta.tipo === "imagem" ? "image/*" : pergunta.tipo === "video" ? "video/*" : pergunta.tipo === "audio" ? "audio/*" : pergunta.tipo === "documento" ? ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" : undefined;
      const IconRotuloVazio =
        pergunta.tipo === "imagem" ? IconImage : pergunta.tipo === "video" ? IconVideoCam : pergunta.tipo === "audio" ? IconMic : pergunta.tipo === "documento" ? IconDoc : IconAnexo;
      const textoRotuloVazio =
        pergunta.tipo === "imagem" ? "Escolher imagem" : pergunta.tipo === "video" ? "Escolher vídeo" : pergunta.tipo === "audio" ? "Escolher áudio" : pergunta.tipo === "documento" ? "Escolher documento" : "Anexar arquivo";
      // `valor` guarda "nomeDoArquivo|data:...;base64,..." — o conteúdo real do arquivo, não só o
      // nome (que era tudo que se salvava antes: quem preenchia achava que tinha anexado o arquivo,
      // mas ele nunca chegava no CRM). Mesmo delimitador "|" já usado no campo de intervalo de datas.
      const nomeExibicao = valor?.split("|")[0];
      return interativo ? (
        <AreaDeUpload
          accept={accept}
          titulo={textoRotuloVazio}
          limiteMb={10}
          disabled={disabled}
          nomeDoArquivo={nomeExibicao}
          aoRemover={() => onMudarValor?.("")}
          aoEscolher={async (file) => {
            const url = await lerComoDataUrl(file);
            onMudarValor?.(`${file.name}|${url}`);
          }}
        />
      ) : (
        <div className="form-upload-preview" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <IconRotuloVazio width={13} height={13} /> {textoRotuloVazio}
        </div>
      );
    }
    case "assinatura":
      return <CampoAssinatura interativo={interativo} valor={valor} onMudarValor={onMudarValor} />;
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
    case "tags":
      return <CampoTags interativo={interativo} valor={valor} onMudarValor={onMudarValor} placeholder={pergunta.placeholder} />;
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
              <IconStar width={16} height={16} fill={estrela <= n ? "currentColor" : "none"} />
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
        <div className="form-bloco-imagem-vazia" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <IconImage width={14} height={14} /> Sem imagem definida
        </div>
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

  const estilo = pergunta.estilo;
  const estiloBloco: React.CSSProperties = estilo
    ? {
        background: estilo.corFundo || undefined,
        borderColor: estilo.corBorda || undefined,
        borderWidth: estilo.corBorda ? 1 : undefined,
        borderStyle: estilo.corBorda ? "solid" : undefined,
        borderRadius: estilo.raioBorda,
        color: estilo.corTexto || undefined,
        marginTop: estilo.margemSuperior,
        marginBottom: estilo.margemInferior,
        padding: estilo.corFundo || estilo.corBorda ? 12 : undefined,
      }
    : {};

  if (ehLayout) {
    return (
      <div className="form-pergunta-enunciado-bloco" style={estiloBloco}>
        <CampoResposta pergunta={pergunta} interativo={interativo} valor={valor} onMudarValor={onMudarValor} />
      </div>
    );
  }

  return (
    <div className="form-pergunta-enunciado-bloco" style={estiloBloco}>
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
