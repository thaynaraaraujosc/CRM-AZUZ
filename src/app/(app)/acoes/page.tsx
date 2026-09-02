"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

import { classeOrigem } from "@/lib/data";
import { useContatos } from "@/lib/contatos-context";
import { IconDoc, IconImage, IconMic, IconSearch } from "@/components/icons";
import { FloatingDropdown, MediaPicker, SegmentChips, Topbar } from "@/components/ui";
import { SeletorDeData } from "@/components/seletor-de-data";

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

const PERIODOS = [
  { valor: "7", label: "Últimos 7 dias" },
  { valor: "30", label: "Últimos 30 dias" },
  { valor: "90", label: "Últimos 90 dias" },
] as const;

type PeriodoValor = (typeof PERIODOS)[number]["valor"] | "personalizado";
type ModoAudiencia = "periodo" | "origem" | "manual";

type AcaoEnvio = {
  id: string;
  titulo: string;
  legenda: string | null;
  midiaTipo: "imagem" | "audio" | "texto";
  canais: string[];
  agendadoPara: string;
  contatos: string[];
  criadoEm: string;
};

function formatarDataHora(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatarDataEnvio(iso: string) {
  if (!iso) return "Escolha a data";
  const [ano, mes, dia] = iso.split("-");
  if (iso === new Date().toISOString().slice(0, 10)) return "Hoje";
  return `${dia}/${mes}/${ano}`;
}

function clamp(valor: number, min: number, max: number) {
  return Math.min(Math.max(valor, min), Math.max(min, max));
}

/** Posiciona um popover logo abaixo do botão que o abriu, sem vazar da tela. */
function posicionarAbaixo(rect: DOMRect, width: number) {
  const margem = 12;
  return {
    top: rect.bottom + 6,
    left: clamp(rect.left, margem, window.innerWidth - width - margem),
  };
}

/** Posiciona um popover ao lado do item que o abriu (vira pra esquerda se não couber). */
function posicionarAoLado(rect: DOMRect, width: number) {
  const margem = 12;
  let left = rect.right + 6;
  if (left + width > window.innerWidth - margem) left = rect.left - width - 6;
  return {
    top: clamp(rect.top, margem, window.innerHeight - 280 - margem),
    left: clamp(left, margem, window.innerWidth - width - margem),
  };
}

export default function AcoesPage() {
  const { contatos } = useContatos();
  const origensDisponiveis = Array.from(new Set(contatos.map((c) => c.origem)));

  const [selecionados, setSelecionados] = useState(
    () => new Set(contatos.map((c) => c.nome)),
  );
  const [listaAberta, setListaAberta] = useState(false);
  const [buscaContato, setBuscaContato] = useState("");
  const [midia, setMidia] = useState("Imagem");
  const [legenda, setLegenda] = useState("");
  const [canaisEnvio, setCanaisEnvio] = useState(
    () => CANAIS_ENVIO.filter((c) => c.ativo).map((c) => c.label),
  );
  const [historicoAcoes, setHistoricoAcoes] = useState<AcaoEnvio[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);
  const [toastAcao, setToastAcao] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch("/api/acoes")
      .then((r) => r.json())
      .then(setHistoricoAcoes)
      .catch((erro) => console.error("Falha ao carregar ações:", erro))
      .finally(() => setCarregandoHistorico(false));
  }, []);

  const [envioAberto, setEnvioAberto] = useState(false);
  const [envioRect, setEnvioRect] = useState<DOMRect | null>(null);
  const [envioData, setEnvioData] = useState(() => new Date().toISOString().slice(0, 10));
  const [envioHora, setEnvioHora] = useState("18:00");

  const [modoAudiencia, setModoAudiencia] = useState<ModoAudiencia>("manual");
  const [periodoAudiencia, setPeriodoAudiencia] = useState<PeriodoValor>("30");
  const [periodoDe, setPeriodoDe] = useState("");
  const [periodoAte, setPeriodoAte] = useState("");
  const [origemAudiencia, setOrigemAudiencia] = useState<string | null>(null);

  const [audienciaAberta, setAudienciaAberta] = useState(false);
  const [audienciaRect, setAudienciaRect] = useState<DOMRect | null>(null);
  const audienciaBtnRef = useRef<HTMLButtonElement>(null);
  const audienciaFecharRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [submenuAudiencia, setSubmenuAudiencia] = useState<
    "periodo" | "origem" | "manual" | null
  >(null);
  const [submenuRect, setSubmenuRect] = useState<DOMRect | null>(null);

  const [acaoExpandida, setAcaoExpandida] = useState<string | null>(null);
  const [agora] = useState(() => Date.now());

  function cancelarFechamentoAudiencia() {
    if (audienciaFecharRef.current) {
      clearTimeout(audienciaFecharRef.current);
      audienciaFecharRef.current = null;
    }
  }

  /** Dá uma folga de 2s antes de fechar, pra dar tempo de levar o mouse até o submenu. */
  function agendarFechamentoAudiencia() {
    cancelarFechamentoAudiencia();
    audienciaFecharRef.current = setTimeout(() => {
      setAudienciaAberta(false);
      setSubmenuAudiencia(null);
    }, 2000);
  }

  function abrirAudiencia() {
    cancelarFechamentoAudiencia();
    if (!audienciaBtnRef.current) return;
    setAudienciaRect(audienciaBtnRef.current.getBoundingClientRect());
    setAudienciaAberta(true);
  }

  function abrirSubmenuAudiencia(
    nome: "periodo" | "origem" | "manual",
    rect: DOMRect,
  ) {
    cancelarFechamentoAudiencia();
    setSubmenuRect(rect);
    setSubmenuAudiencia(nome);
  }

  function fecharAudiencia() {
    setAudienciaAberta(false);
    setSubmenuAudiencia(null);
  }

  /** Simulação — os contatos ainda não guardam a data em que entraram, então usamos uma amostra proporcional ao período. */
  function aplicarPeriodo(valor: PeriodoValor) {
    setModoAudiencia("periodo");
    setPeriodoAudiencia(valor);
    const quantidade =
      valor === "7"
        ? Math.max(1, Math.round(contatos.length * 0.2))
        : valor === "30"
        ? Math.max(1, Math.round(contatos.length * 0.6))
        : contatos.length;
    setSelecionados(new Set(contatos.slice(0, quantidade).map((c) => c.nome)));
    fecharAudiencia();
  }

  function aplicarOrigem(origem: string) {
    setModoAudiencia("origem");
    setOrigemAudiencia(origem);
    setSelecionados(new Set(contatos.filter((c) => c.origem === origem).map((c) => c.nome)));
    fecharAudiencia();
  }

  function abrirManual(comTodos: boolean) {
    setModoAudiencia("manual");
    setSelecionados(comTodos ? new Set(contatos.map((c) => c.nome)) : new Set());
    setListaAberta(true);
    fecharAudiencia();
  }

  const rotuloAudiencia =
    modoAudiencia === "periodo"
      ? periodoAudiencia === "personalizado"
        ? periodoDe && periodoAte
          ? `${periodoDe} até ${periodoAte}`
          : "Período personalizado"
        : PERIODOS.find((p) => p.valor === periodoAudiencia)?.label ?? "Período"
      : modoAudiencia === "origem"
      ? `Origem: ${origemAudiencia}`
      : "Contato manual";

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

  async function agendarEnvio() {
    if (selecionados.size === 0 || canaisEnvio.length === 0 || enviando) return;
    const midiaChave = midia === "Imagem" ? "imagem" : midia === "Áudio" ? "audio" : "texto";
    const tituloBase = legenda.trim() || `Ação · ${midia.toLowerCase()}`;
    const titulo = tituloBase.length > 60 ? `${tituloBase.slice(0, 57)}…` : tituloBase;
    const agendadoPara = new Date(`${envioData}T${envioHora}:00`).toISOString();

    setEnviando(true);
    try {
      const resposta = await fetch("/api/acoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo,
          legenda: legenda.trim() || undefined,
          midiaTipo: midiaChave,
          canais: canaisEnvio,
          agendadoPara,
          contatos: Array.from(selecionados),
        }),
      });
      if (!resposta.ok) throw new Error("Falha ao agendar ação");
      const acao: AcaoEnvio = await resposta.json();
      setHistoricoAcoes((prev) => [acao, ...prev]);
      setToastAcao(`Envio agendado para ${selecionados.size} contatos.`);
      setTimeout(() => setToastAcao(null), 4000);
    } catch (erro) {
      console.error("Falha ao agendar ação:", erro);
      setToastAcao("Não foi possível agendar o envio. Tente novamente.");
      setTimeout(() => setToastAcao(null), 4000);
    } finally {
      setEnviando(false);
    }
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
              <div style={{ padding: "14px 17px", borderBottom: "1px solid var(--line)" }}>
                <button
                  type="button"
                  ref={audienciaBtnRef}
                  className="btn ghost"
                  aria-haspopup="true"
                  aria-expanded={audienciaAberta}
                  onClick={abrirAudiencia}
                  onMouseEnter={abrirAudiencia}
                  onMouseLeave={agendarFechamentoAudiencia}
                >
                  {rotuloAudiencia} ▾
                </button>

                {audienciaAberta && typeof document !== "undefined"
                  ? createPortal(
                      <div
                        className="dropdown-pop"
                        style={{
                          position: "fixed",
                          ...posicionarAbaixo(audienciaRect!, 230),
                          width: 230,
                          padding: "4px 0",
                          zIndex: 210,
                        }}
                        onMouseEnter={cancelarFechamentoAudiencia}
                        onMouseLeave={agendarFechamentoAudiencia}
                      >
                        <div
                          className="dropdown-item"
                          style={{
                            width: "100%",
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                          onMouseEnter={(e) =>
                            abrirSubmenuAudiencia(
                              "periodo",
                              e.currentTarget.getBoundingClientRect(),
                            )
                          }
                        >
                          <span className="n">Período</span>
                          <span className="r">▸</span>
                        </div>
                        <div
                          className="dropdown-item"
                          style={{
                            width: "100%",
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                          onMouseEnter={(e) =>
                            abrirSubmenuAudiencia(
                              "origem",
                              e.currentTarget.getBoundingClientRect(),
                            )
                          }
                        >
                          <span className="n">Origem</span>
                          <span className="r">▸</span>
                        </div>
                        <div
                          className="dropdown-item"
                          style={{
                            width: "100%",
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                          onMouseEnter={(e) =>
                            abrirSubmenuAudiencia(
                              "manual",
                              e.currentTarget.getBoundingClientRect(),
                            )
                          }
                        >
                          <span className="n">Contato manual</span>
                          <span className="r">▸</span>
                        </div>
                      </div>,
                      document.body,
                    )
                  : null}

                {submenuAudiencia && typeof document !== "undefined"
                  ? createPortal(
                      <div
                        className="dropdown-pop"
                        style={{
                          position: "fixed",
                          ...posicionarAoLado(submenuRect!, 280),
                          width: 280,
                          padding: "4px 0",
                          zIndex: 211,
                          overflowX: "hidden",
                        }}
                        onMouseEnter={cancelarFechamentoAudiencia}
                        onMouseLeave={agendarFechamentoAudiencia}
                      >
                        {submenuAudiencia === "periodo" ? (
                          <>
                            {PERIODOS.map((p) => (
                              <button
                                type="button"
                                key={p.valor}
                                className="dropdown-item"
                                style={{ width: "100%", textAlign: "left" }}
                                onClick={() => aplicarPeriodo(p.valor)}
                              >
                                <span className="n">{p.label}</span>
                              </button>
                            ))}
                            <div className="dropdown-sep" />
                            <div style={{ padding: "10px 14px" }}>
                              <p className="hint" style={{ marginBottom: 8 }}>
                                Ou escolha um período personalizado
                              </p>
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 8,
                                  marginBottom: 10,
                                }}
                              >
                                <div className="field" style={{ padding: 0 }}>
                                  <label>De</label>
                                  <SeletorDeData valor={periodoDe} onChange={setPeriodoDe} curto className="seletor-data-largo" />
                                </div>
                                <div className="field" style={{ padding: 0 }}>
                                  <label>Até</label>
                                  <SeletorDeData valor={periodoAte} onChange={setPeriodoAte} curto className="seletor-data-largo" />
                                </div>
                              </div>
                              <button
                                type="button"
                                className="btn primary block"
                                onClick={() => aplicarPeriodo("personalizado")}
                              >
                                Aplicar período
                              </button>
                            </div>
                          </>
                        ) : null}
                        {submenuAudiencia === "origem" ? (
                          origensDisponiveis.map((origem) => (
                            <button
                              type="button"
                              key={origem}
                              className="dropdown-item"
                              style={{ width: "100%", textAlign: "left" }}
                              onClick={() => aplicarOrigem(origem)}
                            >
                              <span className="n">{origem}</span>
                            </button>
                          ))
                        ) : null}
                        {submenuAudiencia === "manual" ? (
                          <>
                            <button
                              type="button"
                              className="dropdown-item"
                              style={{ width: "100%", textAlign: "left" }}
                              onClick={() => abrirManual(true)}
                            >
                              <span className="n">Selecionar todos os contatos</span>
                            </button>
                            <button
                              type="button"
                              className="dropdown-item"
                              style={{ width: "100%", textAlign: "left" }}
                              onClick={() => abrirManual(false)}
                            >
                              <span className="n">Selecionar do zero (pesquisar)</span>
                            </button>
                          </>
                        ) : null}
                      </div>,
                      document.body,
                    )
                  : null}
              </div>

              <div className="aud-count">
                <div>
                  <p className="n">{selecionados.size} contatos</p>
                  <p className="l">Vão receber essa ação</p>
                </div>
                {modoAudiencia === "manual" ? (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setListaAberta((v) => !v)}
                  >
                    {listaAberta ? "Fechar lista" : "Ver lista"}
                  </button>
                ) : null}
              </div>

              {modoAudiencia === "manual" && listaAberta ? (
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
                            <p className={`meta ${classeOrigem(c.origem)}`}>
                              {c.origem}
                            </p>
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
                <textarea
                  className="input"
                  style={{ minHeight: 54, width: "100%" }}
                  value={legenda}
                  onChange={(e) => setLegenda(e.target.value)}
                />
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
                <button
                  type="button"
                  className="input"
                  style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
                  onClick={(e) => {
                    setEnvioRect(e.currentTarget.getBoundingClientRect());
                    setEnvioAberto((v) => !v);
                  }}
                >
                  📅 {formatarDataEnvio(envioData)} às {envioHora} ·{" "}
                  {canaisEnvio.length > 0
                    ? canaisEnvio.join(" e ")
                    : "escolha pelo menos um canal"}
                </button>
                <FloatingDropdown
                  anchorRect={envioAberto ? envioRect : null}
                  onClose={() => setEnvioAberto(false)}
                  width={260}
                >
                  <div style={{ padding: "10px 14px" }}>
                    <div className="field" style={{ padding: 0, marginBottom: 10 }}>
                      <label>Qual dia enviar</label>
                      <SeletorDeData valor={envioData} onChange={setEnvioData} className="seletor-data-largo" />
                    </div>
                    <div className="field" style={{ padding: 0, marginBottom: 10 }}>
                      <label>Que horas</label>
                      <input
                        type="time"
                        className="input"
                        style={{ width: "100%" }}
                        value={envioHora}
                        onChange={(e) => setEnvioHora(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn primary block"
                      onClick={() => setEnvioAberto(false)}
                    >
                      Confirmar data e hora
                    </button>
                  </div>
                </FloatingDropdown>
              </div>
              <div className="section-foot">
                <button
                  type="button"
                  className="btn primary block"
                  disabled={selecionados.size === 0 || canaisEnvio.length === 0 || enviando}
                  onClick={agendarEnvio}
                >
                  {enviando ? "Agendando…" : `Agendar envio pra ${selecionados.size} contatos`}
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="panel-h">
              <h4>Ações anteriores</h4>
            </div>
            {carregandoHistorico ? (
              <p className="hint" style={{ padding: "14px 17px" }}>
                Carregando ações…
              </p>
            ) : historicoAcoes.length === 0 ? (
              <p className="hint" style={{ padding: "14px 17px" }}>
                Nenhuma ação agendada ainda. Configure ao lado e agende o primeiro envio.
              </p>
            ) : (
              historicoAcoes.map((acao) => {
                const expandida = acaoExpandida === acao.id;
                const jaPassou = new Date(acao.agendadoPara).getTime() <= agora;
                const meta = `${acao.contatos.length} contatos · ${acao.midiaTipo} · ${acao.canais.join(" e ")}`;
                const statusLabel = `${jaPassou ? "Enviado" : "Agendado"} · ${formatarDataHora(acao.agendadoPara)}`;
                return (
                  <div key={acao.id}>
                    <button
                      type="button"
                      className="broadcast-row"
                      style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
                      aria-expanded={expandida}
                      onClick={() =>
                        setAcaoExpandida((atual) => (atual === acao.id ? null : acao.id))
                      }
                    >
                      <div className="broadcast-icon">{iconePorMidia[acao.midiaTipo]}</div>
                      <div className="broadcast-body">
                        <p className="broadcast-title">{acao.titulo}</p>
                        <p className="broadcast-meta">{meta}</p>
                      </div>
                      <span className={`broadcast-status ${jaPassou ? "sent" : "scheduled"}`}>
                        {statusLabel}
                      </span>
                    </button>
                    {expandida ? (
                      <div style={{ padding: "0 17px 14px", borderBottom: "1px solid var(--line-soft)" }}>
                        <p className="hint" style={{ margin: "0 0 8px" }}>
                          Contatos que vão receber — clique num contato pra ir direto na conversa
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {acao.contatos.map((nome) => (
                            <Link
                              key={nome}
                              href={`/conversas?contato=${encodeURIComponent(nome)}`}
                              className="activity-row activity-row-link"
                            >
                              <div className="body">
                                <p className="name">{nome}</p>
                              </div>
                              <span className="meta">Ver conversa ▸</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {toastAcao ? (
        <div className="toast-stack">
          <div className="toast">{toastAcao}</div>
        </div>
      ) : null}
    </>
  );
}
