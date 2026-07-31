"use client";

import { useRef, useState } from "react";

import { acaoRascunho, acoesAnteriores, segmentos } from "@/lib/data";
import { useContatos } from "@/lib/contatos-context";
import { IconDoc, IconImage, IconMic, IconSearch } from "@/components/icons";
import { MediaPicker, SegmentChips, Topbar } from "@/components/ui";

const iconePorMidia = {
  imagem: <IconImage />,
  audio: <IconMic />,
  texto: <IconDoc />,
};

const CANAIS_ENVIO = [
  { label: "WhatsApp", ativo: true },
  { label: "Instagram", ativo: true },
  { label: "E-mail", ativo: false },
  { label: "SMS", ativo: false },
];

export default function AcoesPage() {
  const { contatos } = useContatos();
  const [selecionados, setSelecionados] = useState(
    () => new Set(contatos.map((c) => c.nome)),
  );
  const [listaAberta, setListaAberta] = useState(false);
  const [buscaContato, setBuscaContato] = useState("");
  const [midia, setMidia] = useState("Imagem");
  const [canaisEnvio, setCanaisEnvio] = useState(
    () => CANAIS_ENVIO.filter((c) => c.ativo).map((c) => c.label),
  );

  const contatosFiltrados = buscaContato.trim()
    ? contatos.filter((c) =>
        c.nome.toLowerCase().includes(buscaContato.trim().toLowerCase()),
      )
    : contatos;

  const [arquivoImagem, setArquivoImagem] = useState<File | null>(null);
  const [arquivoAudio, setArquivoAudio] = useState<File | null>(null);
  const [arquivoGenerico, setArquivoGenerico] = useState<File | null>(null);
  const [gravando, setGravando] = useState(false);
  const [audioGravadoUrl, setAudioGravadoUrl] = useState<string | null>(null);
  const [erroGravacao, setErroGravacao] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  function toggleContato(nome: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(nome)) next.delete(nome);
      else next.add(nome);
      return next;
    });
  }

  async function iniciarGravacao() {
    setErroGravacao(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioGravadoUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setGravando(true);
    } catch {
      setErroGravacao(
        "Não consegui acessar o microfone. Verifique a permissão do navegador.",
      );
    }
  }

  function pararGravacao() {
    mediaRecorderRef.current?.stop();
    setGravando(false);
  }

  return (
    <>
      <Topbar
        title="Ações"
        sub="Listas de transmissão segmentadas por período e tipo de contato"
        actions={
          <button type="button" className="btn primary">
            + Nova ação
          </button>
        }
      />

      <div className="content">
        <div className="grid rep-grid">
          <div>
            <div className="card mb14">
              <div className="panel-h">
                <h4>1. Quem vai receber</h4>
              </div>
              <SegmentChips
                options={segmentos}
                onChange={(labels) => {
                  if (labels.length === 0) return;
                  setSelecionados(new Set(contatos.map((c) => c.nome)));
                }}
              />
              <div className="aud-count">
                <div>
                  <p className="n">{selecionados.size} contatos</p>
                  <p className="l">Vão receber essa ação</p>
                </div>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setListaAberta((v) => !v)}
                >
                  {listaAberta ? "Fechar lista" : "Ver lista"}
                </button>
              </div>

              {listaAberta ? (
                <div style={{ borderTop: "1px solid var(--line)" }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      padding: "10px 17px",
                      borderBottom: "1px solid var(--line-soft)",
                    }}
                  >
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() =>
                        setSelecionados(new Set(contatos.map((c) => c.nome)))
                      }
                    >
                      Selecionar todos
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => setSelecionados(new Set())}
                    >
                      Começar do zero
                    </button>
                  </div>
                  <div style={{ padding: "10px 17px", borderBottom: "1px solid var(--line-soft)" }}>
                    <label className="search" style={{ width: "100%" }}>
                      <IconSearch />
                      <input
                        placeholder="Pesquisar contato pelo nome…"
                        aria-label="Pesquisar contato"
                        value={buscaContato}
                        onChange={(e) => setBuscaContato(e.target.value)}
                      />
                    </label>
                  </div>
                  <div style={{ maxHeight: 280, overflowY: "auto" }}>
                    {contatosFiltrados.length === 0 ? (
                      <p className="hint" style={{ padding: "12px 17px" }}>
                        Nada encontrado pra &quot;{buscaContato}&quot;
                      </p>
                    ) : (
                      contatosFiltrados.map((c) => (
                        <label
                          key={c.nome}
                          className="activity-row"
                          style={{ cursor: "pointer" }}
                        >
                          <input
                            type="checkbox"
                            checked={selecionados.has(c.nome)}
                            onChange={() => toggleContato(c.nome)}
                          />
                          <div className="avatar">{c.initials}</div>
                          <div className="body">
                            <p className="name">{c.nome}</p>
                            <p className="meta">{c.origem}</p>
                          </div>
                          <span className={`pill${c.whatsapp ? " on" : ""}`}>
                            {c.whatsapp ? "Número gravado" : "Sem número"}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="card">
              <div className="panel-h">
                <h4>2. O que vai enviar</h4>
              </div>
              <MediaPicker
                options={[
                  { label: "Imagem", icon: <IconImage /> },
                  { label: "Áudio", icon: <IconMic /> },
                  { label: "Arquivo", icon: <IconDoc /> },
                ]}
                onChange={(label) => setMidia(label)}
              />

              {midia === "Imagem" ? (
                <div className="field">
                  <label>Imagem</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="input"
                    style={{ width: "100%", padding: 8 }}
                    onChange={(e) => setArquivoImagem(e.target.files?.[0] ?? null)}
                  />
                  {arquivoImagem ? (
                    <div className="attach-chip mt14">
                      <IconImage />
                      <span className="fn">{arquivoImagem.name}</span>
                      <span className="fs">
                        {(arquivoImagem.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {midia === "Áudio" ? (
                <div className="field">
                  <label>Áudio</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input
                      type="file"
                      accept="audio/*"
                      id="upload-audio"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        setArquivoAudio(e.target.files?.[0] ?? null);
                        setAudioGravadoUrl(null);
                      }}
                    />
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() =>
                        document.getElementById("upload-audio")?.click()
                      }
                    >
                      + Enviar áudio
                    </button>
                    {!gravando ? (
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={iniciarGravacao}
                      >
                        ● Gravar áudio
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn primary"
                        onClick={pararGravacao}
                      >
                        ■ Parar gravação
                      </button>
                    )}
                  </div>
                  {erroGravacao ? (
                    <p className="hint" style={{ color: "var(--blue)", marginTop: 8 }}>
                      {erroGravacao}
                    </p>
                  ) : null}
                  {arquivoAudio ? (
                    <div className="attach-chip mt14">
                      <IconMic />
                      <span className="fn">{arquivoAudio.name}</span>
                      <span className="fs">
                        {(arquivoAudio.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                  ) : null}
                  {audioGravadoUrl ? (
                    <div className="mt14">
                      <p className="hint" style={{ marginBottom: 6 }}>
                        Áudio gravado — reservado pra essa ação
                      </p>
                      <audio controls src={audioGravadoUrl} style={{ width: "100%" }} />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {midia === "Arquivo" ? (
                <div className="field">
                  <label>Arquivo (PDF, documento etc.)</label>
                  <input
                    type="file"
                    className="input"
                    style={{ width: "100%", padding: 8 }}
                    onChange={(e) => setArquivoGenerico(e.target.files?.[0] ?? null)}
                  />
                  {arquivoGenerico ? (
                    <div className="attach-chip mt14">
                      <IconDoc />
                      <span className="fn">{arquivoGenerico.name}</span>
                      <span className="fs">
                        {(arquivoGenerico.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="field">
                <label>Legenda / mensagem</label>
                <div className="input" style={{ minHeight: 54 }}>
                  {acaoRascunho.legenda}
                </div>
              </div>
              <div className="field">
                <label>Canal de envio — pode escolher mais de um</label>
                <SegmentChips
                  options={CANAIS_ENVIO}
                  onChange={(labels) => setCanaisEnvio(labels)}
                />
              </div>
              <div className="field">
                <label>Enviar</label>
                <div className="input">
                  Hoje às 18h ·{" "}
                  {canaisEnvio.length > 0
                    ? canaisEnvio.join(" e ")
                    : "escolha pelo menos um canal"}
                </div>
              </div>
              <div className="section-foot">
                <button type="button" className="btn primary block">
                  Agendar envio pra {selecionados.size} contatos
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="panel-h">
              <h4>Ações anteriores</h4>
            </div>
            {acoesAnteriores.map((acao) => (
              <div className="broadcast-row" key={acao.titulo}>
                <div className="broadcast-icon">{iconePorMidia[acao.midia]}</div>
                <div className="broadcast-body">
                  <p className="broadcast-title">{acao.titulo}</p>
                  <p className="broadcast-meta">{acao.meta}</p>
                </div>
                <span
                  className={`broadcast-status ${
                    acao.agendado ? "scheduled" : "sent"
                  }`}
                >
                  {acao.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
