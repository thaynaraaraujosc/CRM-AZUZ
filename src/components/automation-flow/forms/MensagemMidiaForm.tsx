"use client";

import { useRef, useState } from "react";
import { useSession } from "next-auth/react";

import {
  CATEGORIAS_ARQUIVO_AUTOMACAO,
  useBibliotecaDocumentos,
  type DocumentoBiblioteca,
  type TipoMidiaArquivo,
} from "@/lib/biblioteca-documentos-context";
import type { CanalMensagem, FlowNodeType, MensagemMidiaData } from "@/lib/automation-flow/types";
import { VariavelDropdown } from "./VariavelDropdown";
import { inserirTokenNoTexto } from "./variaveis";
import { AreaDeUpload } from "@/components/area-de-upload";

const CANAIS: { valor: CanalMensagem; label: string }[] = [
  { valor: "whatsapp", label: "WhatsApp" },
  { valor: "instagram", label: "Instagram" },
  { valor: "tiktok", label: "TikTok" },
  { valor: "email", label: "E-mail" },
  { valor: "interno", label: "Interno" },
];

function tipoMidiaDoBloco(tipo: FlowNodeType): TipoMidiaArquivo {
  switch (tipo) {
    case "mensagem_imagem":
      return "imagem";
    case "mensagem_video":
      return "video";
    case "mensagem_audio":
      return "audio";
    default:
      return "documento";
  }
}

const ACCEPT_POR_TIPO: Record<TipoMidiaArquivo, string> = {
  documento: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt",
  imagem: "image/*",
  video: "video/*",
  audio: "audio/*",
};

const ROTULO_POR_TIPO: Record<TipoMidiaArquivo, string> = {
  documento: "um documento",
  imagem: "uma imagem",
  video: "um vídeo",
  audio: "um áudio",
};

const EXTENSOES_ACEITAS_DOCUMENTO = ["PDF", "DOC", "DOCX", "XLS", "XLSX", "PPT", "PPTX", "TXT"];

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extensaoDoNome(nome: string): string {
  const partes = nome.split(".");
  return partes.length > 1 ? partes[partes.length - 1].toUpperCase() : "";
}

function lerComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result as string);
    leitor.onerror = () => reject(new Error("Falha ao ler o arquivo"));
    leitor.readAsDataURL(file);
  });
}

function GlyphArquivo({ tipo }: { tipo: TipoMidiaArquivo }) {
  const glyph = { documento: "📄", imagem: "🖼️", video: "🎬", audio: "🎵" }[tipo];
  return <span aria-hidden="true">{glyph}</span>;
}

/**
 * Form dedicado dos 4 blocos "enviar mídia" (item 3-9 da spec) — escolher da biblioteca reutilizável
 * OU enviar um arquivo novo, que entra de verdade na mesma biblioteca (base64 real, mesmo padrão de
 * imagem/documento/áudio em Conversas — ver `lerComoDataUrl`) em vez de um `blob:` URL que só existe
 * na aba do navegador e não sobreviveria até a automação disparar de verdade mais tarde.
 */
export function MensagemMidiaForm({
  node,
  onChange,
}: {
  node: { type: FlowNodeType; data: Record<string, unknown> };
  onChange: (data: Record<string, unknown>) => void;
}) {
  const data = node.data as MensagemMidiaData;
  const tipoMidia = tipoMidiaDoBloco(node.type);
  const { data: sessao } = useSession();
  const { documentos, adicionarDocumento } = useBibliotecaDocumentos();
  const arquivosDoTipo = documentos.filter((d) => (d.tipoMidia ?? "documento") === tipoMidia);
  const arquivoBiblioteca = data.arquivoId ? documentos.find((d) => d.id === data.arquivoId) : undefined;

  const [modalAberto, setModalAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("Todas");
  const [enviando, setEnviando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const legendaRef = useRef<HTMLTextAreaElement>(null);

  function set(patch: Partial<MensagemMidiaData>) {
    onChange({ ...data, ...patch });
  }

  function selecionarDaBiblioteca(arq: DocumentoBiblioteca) {
    set({
      origemArquivo: "biblioteca",
      arquivoId: arq.id,
      arquivoNome: arq.nome,
      arquivoTipo: arq.formato,
      arquivoTamanho: formatarTamanho(arq.tamanho),
      arquivoUrlTemporaria: undefined,
    });
    setModalAberto(false);
  }

  async function processarUpload(file: File) {
    setEnviando(true);
    try {
      const url = await lerComoDataUrl(file);
      const salvo = adicionarDocumento({
        nome: file.name,
        categoria: "Outros",
        formato: extensaoDoNome(file.name),
        tamanho: file.size,
        autor: sessao?.user?.name ?? "—",
        url,
        tipoMidia,
      });
      set({
        origemArquivo: "biblioteca",
        arquivoId: salvo.id,
        arquivoNome: file.name,
        arquivoTipo: extensaoDoNome(file.name),
        arquivoTamanho: formatarTamanho(file.size),
        arquivoUrlTemporaria: undefined,
      });
    } catch {
      // Falha ao ler o arquivo (raríssimo) — não altera o estado, o usuário tenta de novo.
    } finally {
      setEnviando(false);
    }
  }

  function removerArquivo() {
    set({
      origemArquivo: undefined,
      arquivoId: undefined,
      arquivoNome: undefined,
      arquivoNomeExibicao: undefined,
      arquivoTipo: undefined,
      arquivoTamanho: undefined,
      arquivoUrlTemporaria: undefined,
    });
  }

  const temArquivo = !!data.arquivoNome;
  const urlPreview = data.arquivoUrlTemporaria ?? arquivoBiblioteca?.url;
  const nomeExibir = data.arquivoNomeExibicao || data.arquivoNome;

  return (
    <div className="flow-form">
      <div className="field">
        <label>Canal</label>
        <select className="input" value={data.canal ?? "whatsapp"} onChange={(e) => set({ canal: e.target.value as CanalMensagem })}>
          {CANAIS.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Origem do arquivo</label>
        <div className="flow-midia-origem">
          <button
            type="button"
            className="flow-midia-origem-btn"
            onClick={() => setModalAberto(true)}
          >
            📁 Escolher da biblioteca
          </button>
          <button
            type="button"
            className="flow-midia-origem-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={enviando}
          >
            {enviando ? "Enviando…" : "⬆ Enviar novo arquivo"}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_POR_TIPO[tipoMidia]}
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processarUpload(file);
            e.target.value = "";
          }}
        />

        {!temArquivo ? (
          <>
            <AreaDeUpload
              accept={ACCEPT_POR_TIPO[tipoMidia]}
              titulo={enviando ? "Enviando…" : `Enviar ${ROTULO_POR_TIPO[tipoMidia]}`}
              limiteMb={16}
              disabled={enviando}
              aoEscolher={(file) => void processarUpload(file)}
            />
            {tipoMidia === "documento" ? (
              <p className="hint mt8">Formatos aceitos: {EXTENSOES_ACEITAS_DOCUMENTO.join(", ")}</p>
            ) : null}
          </>
        ) : null}
      </div>

      {temArquivo ? (
        <div className="field">
          <label>Arquivo escolhido</label>
          <div className="flow-midia-preview">
            {tipoMidia === "imagem" && urlPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urlPreview} alt={nomeExibir ?? "Prévia"} className="flow-midia-preview-img" />
            ) : (
              <span className="flow-midia-preview-icone">
                <GlyphArquivo tipo={tipoMidia} />
              </span>
            )}
            <div className="flow-midia-preview-info">
              <span className="n">{nomeExibir}</span>
              <span className="r">
                {data.arquivoTipo} · {data.arquivoTamanho}
              </span>
              {data.legenda ? <span className="flow-midia-preview-legenda">&quot;{data.legenda}&quot;</span> : null}
            </div>
          </div>
          <div className="flow-midia-preview-acoes">
            <button type="button" className="btn ghost" onClick={() => setModalAberto(true)}>
              Substituir (biblioteca)
            </button>
            <button type="button" className="btn ghost" onClick={() => fileInputRef.current?.click()}>
              Substituir (upload)
            </button>
            <button type="button" className="btn ghost" onClick={removerArquivo}>
              Remover arquivo
            </button>
          </div>
        </div>
      ) : null}

      <div className="field">
        <label>Nome de exibição do arquivo</label>
        <input
          className="input"
          placeholder={data.arquivoNome || "Ex.: Catálogo de Toldos"}
          value={data.arquivoNomeExibicao ?? ""}
          onChange={(e) => set({ arquivoNomeExibicao: e.target.value })}
        />
        <p className="hint mt8">Opcional — se vazio, usa o nome real do arquivo ({data.arquivoNome || "nenhum ainda"}).</p>
      </div>

      <div className="field">
        <div className="flow-form-label-row">
          <label style={{ marginBottom: 0 }}>Mensagem ou legenda</label>
          <VariavelDropdown onEscolher={(t) => set({ legenda: inserirTokenNoTexto(data.legenda ?? "", t, legendaRef.current) })} />
        </div>
        <textarea
          ref={legendaRef}
          className="input"
          style={{ width: "100%", minHeight: 70, resize: "vertical" }}
          placeholder="Ex.: Vou te enviar nosso catálogo com os modelos que trabalhamos."
          value={data.legenda ?? ""}
          onChange={(e) => set({ legenda: e.target.value })}
        />
      </div>

      {modalAberto ? (
        <div className="modal-overlay" onClick={() => setModalAberto(false)}>
          <div className="modal flow-biblioteca-modal" onClick={(e) => e.stopPropagation()}>
            <div className="panel-h">
              <h4>Selecionar arquivo da biblioteca</h4>
              <button type="button" className="modal-close-btn" aria-label="Fechar" onClick={() => setModalAberto(false)}>
                ✕
              </button>
            </div>
            <input
              className="input"
              style={{ width: "100%" }}
              placeholder="Pesquisar arquivo…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <div className="filters-row" style={{ marginTop: 10, marginBottom: 4 }}>
              {["Todas", ...CATEGORIAS_ARQUIVO_AUTOMACAO].map((cat) => (
                <button
                  type="button"
                  key={cat}
                  className={`fchip${categoriaFiltro === cat ? " active" : ""}`}
                  onClick={() => setCategoriaFiltro(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="flow-biblioteca-lista">
              {arquivosDoTipo
                .filter(
                  (a) =>
                    (categoriaFiltro === "Todas" || a.categoria === categoriaFiltro) &&
                    a.nome.toLowerCase().includes(busca.trim().toLowerCase()),
                )
                .map((arq) => (
                  <button type="button" key={arq.id} className="flow-biblioteca-item" onClick={() => selecionarDaBiblioteca(arq)}>
                    {tipoMidia === "imagem" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={arq.url} alt={arq.nome} className="flow-biblioteca-item-thumb" />
                    ) : (
                      <span className="flow-biblioteca-item-icone">
                        <GlyphArquivo tipo={tipoMidia} />
                      </span>
                    )}
                    <span className="flow-biblioteca-item-info">
                      <span className="n">{arq.nome}</span>
                      <span className="r">
                        {arq.categoria} · {arq.formato} · {formatarTamanho(arq.tamanho)} · incluído em {arq.atualizadoEm}
                      </span>
                      {arq.descricao ? <span className="r">{arq.descricao}</span> : null}
                    </span>
                  </button>
                ))}
              {arquivosDoTipo.filter(
                (a) =>
                  (categoriaFiltro === "Todas" || a.categoria === categoriaFiltro) &&
                  a.nome.toLowerCase().includes(busca.trim().toLowerCase()),
              ).length === 0 ? (
                <p className="hint" style={{ padding: 16 }}>
                  Nenhum arquivo encontrado nessa categoria/tipo de mídia.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
