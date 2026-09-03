"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

import { classeOrigem } from "@/lib/data";
import { useContatos } from "@/lib/contatos-context";
import { IconDoc, IconMic, IconSearch } from "@/components/icons";
import { IconCalendar } from "@/components/icons";
import { FloatingDropdown, Topbar } from "@/components/ui";
import { SeletorDeData } from "@/components/seletor-de-data";

const CANAIS_ENVIO = [
  { label: "WhatsApp", ativo: true },
  { label: "E-mail", ativo: true },
];

const PERIODOS = [
  { valor: "7", label: "Últimos 7 dias" },
  { valor: "30", label: "Últimos 30 dias" },
  { valor: "90", label: "Últimos 90 dias" },
] as const;

type PeriodoValor = (typeof PERIODOS)[number]["valor"] | "personalizado";
type ModoAudiencia = "periodo" | "origem" | "manual";

type Campanha = {
  id: string;
  titulo: string;
  corpo: string;
  assunto: string | null;
  canal: "whatsapp_oficial" | "whatsapp_nao_oficial" | "email";
  agendadoPara: string;
  status: "agendada" | "enviando" | "enviada";
  criadoEm: string;
  contatos?: string[];
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

  // Carrega do localStorage quando disponível
  const [selecionados, setSelecionados] = useState(
    () => {
      try {
        const salvo = localStorage.getItem("campanhas_selecionados");
        if (salvo) return new Set(JSON.parse(salvo) as string[]);
      } catch (e) {
        console.error("Erro ao carregar selecionados do localStorage:", e);
      }
      return new Set(contatos.map((c) => c.nome));
    },
  );
  const [listaAberta, setListaAberta] = useState(false);
  const [buscaContato, setBuscaContato] = useState("");
  const [corpo, setCorpo] = useState(() => {
    try {
      return localStorage.getItem("campanhas_corpo") || "";
    } catch {
      return "";
    }
  });
  const [assunto, setAssunto] = useState(() => {
    try {
      return localStorage.getItem("campanhas_assunto") || "";
    } catch {
      return "";
    }
  });
  const [canaisEnvio, setCanaisEnvio] = useState<string[]>(() => {
    try {
      const salvo = localStorage.getItem("campanhas_canais");
      if (salvo) return JSON.parse(salvo) as string[];
    } catch (e) {
      console.error("Erro ao carregar canais do localStorage:", e);
    }
    return ["WhatsApp"];
  });
  const [historicoAcoes, setHistoricoAcoes] = useState<Campanha[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);
  const [toastAcao, setToastAcao] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [preverDuracao, setPreverDuracao] = useState<{ min: number; max: number } | null>(null);
  const [contatosSemDestino, setContatosSemDestino] = useState<string[]>([]);

  // Salva dados no localStorage quando mudam
  useEffect(() => {
    try {
      localStorage.setItem("campanhas_corpo", corpo);
    } catch (e) {
      console.error("Erro ao salvar corpo no localStorage:", e);
    }
  }, [corpo]);

  useEffect(() => {
    try {
      localStorage.setItem("campanhas_assunto", assunto);
    } catch (e) {
      console.error("Erro ao salvar assunto no localStorage:", e);
    }
  }, [assunto]);

  useEffect(() => {
    try {
      localStorage.setItem("campanhas_selecionados", JSON.stringify(Array.from(selecionados)));
    } catch (e) {
      console.error("Erro ao salvar selecionados no localStorage:", e);
    }
  }, [selecionados]);

  useEffect(() => {
    try {
      localStorage.setItem("campanhas_canais", JSON.stringify(canaisEnvio));
    } catch (e) {
      console.error("Erro ao salvar canais no localStorage:", e);
    }
  }, [canaisEnvio]);

  useEffect(() => {
    fetch("/api/campanhas")
      .then((r) => r.json())
      .then(setHistoricoAcoes)
      .catch((erro) => console.error("Falha ao carregar campanhas:", erro))
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

  function toggleContato(nome: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(nome)) next.delete(nome);
      else next.add(nome);
      return next;
    });
  }

  async function agendarEnvio() {
    if (selecionados.size === 0 || canaisEnvio.length === 0 || enviando) return;

    const canalRaw = canaisEnvio[0] || "WhatsApp";
    const isWhatsApp = canalRaw.toLowerCase().startsWith("whatsapp");
    const canal = isWhatsApp ? "whatsapp_oficial" : "email";
    console.log("🔍 Canal Debug:", { raw: canalRaw, isWhatsApp, final: canal });
    if (canal === "email" && !assunto.trim()) {
      setToastAcao("E-mail precisa de assunto.");
      setTimeout(() => setToastAcao(null), 4000);
      return;
    }

    const tituloBase = corpo.trim().split("\n")[0] || `Campanha · ${canal}`;
    const titulo = tituloBase.length > 60 ? `${tituloBase.slice(0, 57)}…` : tituloBase;
    const agendadoPara = new Date(`${envioData}T${envioHora}:00`).toISOString();

    setEnviando(true);
    setPreverDuracao(null);
    setContatosSemDestino([]);
    try {
      const payload = {
        titulo,
        corpo: corpo.trim(),
        assunto: canal === "email" ? assunto.trim() : undefined,
        canal,
        agendadaPara: agendadoPara,
        contatos: Array.from(selecionados),
      };
      console.log("📤 Enviando payload:", JSON.stringify(payload, null, 2));
      console.log("🔐 Canal sendo enviado:", { canal, tipo: typeof canal });
      const resposta = await fetch("/api/campanhas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const statusText = resposta.statusText;
      console.log(`📡 Resposta: ${resposta.status} ${statusText}`);
      if (!resposta.ok) {
        const erro = await resposta.json();
        console.error("❌ Erro retornado:", erro);
        throw new Error(erro.erro || "Falha ao agendar campanha");
      }
      const resultado = await resposta.json();
      setPreverDuracao(resultado.previsao);
      if (resultado.semDestino?.length > 0) {
        setContatosSemDestino(resultado.semDestino);
      }

      const campanha: Campanha = {
        id: resultado.id,
        titulo,
        corpo: corpo.trim(),
        assunto: canal === "email" ? assunto.trim() : null,
        canal,
        agendadoPara,
        status: "agendada",
        criadoEm: new Date().toISOString(),
        contatos: Array.from(selecionados),
      };
      setHistoricoAcoes((prev) => [campanha, ...prev]);

      let mensagem = `Campanha agendada para ${resultado.destinatarios} contatos`;
      if (resultado.semDestino?.length > 0) {
        mensagem += ` (${resultado.semDestino.length} sem ${canal === "email" ? "e-mail" : "WhatsApp"})`;
      }
      setToastAcao(mensagem);
      setTimeout(() => setToastAcao(null), 5000);

      setCorpo("");
      setAssunto("");
    } catch (erro) {
      console.error("Falha ao agendar campanha:", erro);
      setToastAcao(erro instanceof Error ? erro.message : "Não foi possível agendar a campanha. Tente novamente.");
      setTimeout(() => setToastAcao(null), 4000);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Topbar
        title="Campanhas"
        sub="Envios de mensagens em massa por WhatsApp ou E-mail"
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
              <div className="field">
                <label>Mensagem</label>
                <textarea
                  className="input"
                  style={{ minHeight: 80, width: "100%" }}
                  placeholder="Escreva a mensagem que vai sair para os contatos…"
                  value={corpo}
                  onChange={(e) => setCorpo(e.target.value)}
                />
              </div>

              {canaisEnvio[0]?.toLowerCase() === "e-mail" ? (
                <div className="field">
                  <label>Assunto do e-mail</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Assunto…"
                    value={assunto}
                    onChange={(e) => setAssunto(e.target.value)}
                  />
                </div>
              ) : null}
              <div className="field">
                <label>Canal de envio</label>
                <div style={{ display: "flex", gap: 12 }}>
                  {CANAIS_ENVIO.map((canal) => (
                    <label key={canal.label} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="canal"
                        value={canal.label}
                        checked={canaisEnvio.includes(canal.label)}
                        onChange={() => setCanaisEnvio([canal.label])}
                      />
                      <span>{canal.label}</span>
                    </label>
                  ))}
                </div>
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
                  <IconCalendar width={12} height={12} aria-hidden="true" /> {formatarDataEnvio(envioData)} às {envioHora} ·{" "}
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

              {preverDuracao ? (
                <div style={{ padding: "12px 14px", backgroundColor: "var(--blue-soft)", borderRadius: 6, marginBottom: 12, border: "1px solid var(--blue-line)" }}>
                  <p className="n" style={{ margin: 0 }}>
                    ⏱️ Tempo estimado: {preverDuracao.min}-{preverDuracao.max} minutos
                  </p>
                  <p className="hint" style={{ margin: "4px 0 0" }}>
                    Os envios sairão em ritmo controlado para não sobrecarregar.
                  </p>
                </div>
              ) : null}

              {contatosSemDestino.length > 0 ? (
                <div style={{ padding: "12px 14px", backgroundColor: "var(--amber-soft)", borderRadius: 6, marginBottom: 12, border: "1px solid var(--amber-line)" }}>
                  <p className="n" style={{ margin: "0 0 8px" }}>
                    ⚠️ {contatosSemDestino.length} contato{contatosSemDestino.length !== 1 ? "s" : ""} sem {canaisEnvio[0]?.toLowerCase() === "e-mail" ? "e-mail" : "WhatsApp"}
                  </p>
                  <div style={{ maxHeight: 150, overflowY: "auto" }}>
                    {contatosSemDestino.map((nome) => (
                      <p key={nome} className="hint" style={{ margin: "2px 0" }}>
                        • {nome}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

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
              <h4>Campanhas anteriores</h4>
            </div>
            {carregandoHistorico ? (
              <p className="hint" style={{ padding: "14px 17px" }}>
                Carregando campanhas…
              </p>
            ) : historicoAcoes.length === 0 ? (
              <p className="hint" style={{ padding: "14px 17px" }}>
                Nenhuma campanha agendada ainda. Configure ao lado e agende o primeiro envio.
              </p>
            ) : (
              historicoAcoes.map((campanha) => {
                const expandida = acaoExpandida === campanha.id;
                const jaPassou = new Date(campanha.agendadoPara).getTime() <= agora;
                const contatoCount = campanha.contatos?.length ?? 0;
                const canalLabel = campanha.canal.startsWith("whatsapp") ? "WhatsApp" : "E-mail";
                const meta = `${contatoCount} contatos · ${canalLabel}`;
                const statusLabel = `${jaPassou ? "Enviado" : "Agendado"} · ${formatarDataHora(campanha.agendadoPara)}`;
                return (
                  <div key={campanha.id}>
                    <button
                      type="button"
                      className="broadcast-row"
                      style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
                      aria-expanded={expandida}
                      onClick={() =>
                        setAcaoExpandida((atual) => (atual === campanha.id ? null : campanha.id))
                      }
                    >
                      <div className="broadcast-icon">
                        {campanha.canal === "email" ? <IconDoc /> : <IconMic />}
                      </div>
                      <div className="broadcast-body">
                        <p className="broadcast-title">{campanha.titulo}</p>
                        <p className="broadcast-meta">{meta}</p>
                      </div>
                      <span className={`broadcast-status ${jaPassou ? "sent" : "scheduled"}`}>
                        {statusLabel}
                      </span>
                    </button>
                    {expandida && campanha.contatos ? (
                      <div style={{ padding: "0 17px 14px", borderBottom: "1px solid var(--line-soft)" }}>
                        <p className="hint" style={{ margin: "0 0 8px" }}>
                          Contatos que vão receber — clique num contato pra ir direto na conversa
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {campanha.contatos.map((nome) => (
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
