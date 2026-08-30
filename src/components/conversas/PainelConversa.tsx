"use client";

import { Fragment, useEffect, useRef, useState } from "react";

import type { ConvMensagem } from "@/lib/data";
import { useContatos } from "@/lib/contatos-context";
import { useMensagensExtra } from "@/lib/mensagens-extra-context";
import { BolhaMensagem } from "./BolhaMensagem";

/**
 * Painel de conversa completo, em popup — a janela que abre ao clicar num card do Funil.
 *
 * É por AQUI que o dia a dia acontece pra quem compra o CRM: o vendedor olha o funil, abre o card,
 * atende, fecha e volta a arrastar. Por isso o popup não pode ser uma caixinha de canto com um
 * campo de texto: precisa das mesmas ferramentas da tela de Conversas — anexo, resposta rápida e
 * os dados do contato à mão.
 *
 * É sobreposto (não empurra o funil pro lado) e fecha inteiro, pra o arraste dos cards continuar
 * livre atrás dele.
 *
 * Mora em `components/` e não dentro da página do Funil de propósito: a tela de Conversas vai
 * passar a usar este mesmo painel. Enquanto existirem duas implementações da mesma conversa, uma
 * das duas fica pra trás — foi assim que a resposta pelo Funil ficou meses sem enviar de verdade.
 */
export type RespostaRapida = { id: string; titulo: string; texto: string };

export function PainelConversa({
  contatoNome,
  canal,
  initials,
  fotoUrl,
  respostasRapidas = [],
  etapaAtual,
  aoFechar,
}: {
  contatoNome: string;
  canal?: string;
  initials: string;
  fotoUrl?: string | null;
  respostasRapidas?: RespostaRapida[];
  /** Etapa em que o negócio está no funil — mostrada na aba Negociação. */
  etapaAtual?: string;
  aoFechar: () => void;
}) {
  const { mensagensExtraPorContato, setMensagensExtraPorContato } = useMensagensExtra();
  const { contatos, salvarDadosContato } = useContatos();

  const [texto, setTexto] = useState("");
  const [maisAberto, setMaisAberto] = useState(false);
  const [dadosAberto, setDadosAberto] = useState(false);
  const [aba, setAba] = useState<"contato" | "negociacao" | "atividades" | "historico">("contato");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const fimDaListaRef = useRef<HTMLDivElement>(null);
  const arquivoImagemRef = useRef<HTMLInputElement>(null);
  const arquivoDocumentoRef = useRef<HTMLInputElement>(null);

  const mensagens = mensagensExtraPorContato[contatoNome] ?? [];
  const ultima = mensagens[mensagens.length - 1];
  const contato = contatos.find((c) => c.nome === contatoNome);

  const [nomeEdit, setNomeEdit] = useState(contatoNome);
  const [whatsappEdit, setWhatsappEdit] = useState(contato?.whatsapp ?? "");
  const [emailEdit, setEmailEdit] = useState(contato?.email ?? "");
  const [empresaEdit, setEmpresaEdit] = useState(contato?.empresa ?? "");
  const [salvo, setSalvo] = useState(false);

  // Rola pro fim ao abrir e a cada mensagem nova — sem isso o painel abre no topo do histórico,
  // longe do que acabou de chegar.
  useEffect(() => {
    fimDaListaRef.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length, contatoNome]);

  // Ajuste durante o render (não num efeito) ao trocar de conversa — é o padrão do React pra
  // "adjusting state when a prop changes", e evita a cascata de re-render que um `useEffect`
  // fazendo a mesma coisa provoca. Só dispara na troca: reabrir a mesma conversa não pode
  // descartar o que está sendo digitado.
  const [contatoAnterior, setContatoAnterior] = useState(contatoNome);
  if (contatoNome !== contatoAnterior) {
    setContatoAnterior(contatoNome);
    setNomeEdit(contatoNome);
    setWhatsappEdit(contato?.whatsapp ?? "");
    setEmailEdit(contato?.email ?? "");
    setEmpresaEdit(contato?.empresa ?? "");
  }

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") aoFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  /** Põe a bolha na tela na hora e devolve um jeito de marcar o resultado real do envio. */
  function bolhaOtimista(msg: Omit<ConvMensagem, "id" | "hora" | "criadoEm">) {
    return adicionarBolhaOtimista(contatoNome, msg, setMensagensExtraPorContato);
  }

  async function enviarTexto(conteudo?: string) {
    const corpo = (conteudo ?? texto).trim();
    if (!corpo || enviando) return;
    setErro(null);
    setEnviando(true);
    const marcar = bolhaOtimista({ tipo: "out", texto: corpo });
    if (!conteudo) setTexto("");
    setMaisAberto(false);

    try {
      const resposta = await fetch("/api/conversas/enviar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversaNome: contatoNome, texto: corpo }),
      });
      if (!resposta.ok) throw new Error(((await resposta.json()) as { erro?: string }).erro);
      marcar({ status: "enviado" });
    } catch (e) {
      const motivo = e instanceof Error && e.message ? e.message : "Não foi possível enviar.";
      marcar({ status: "erro", erro: motivo });
      setErro(motivo);
    } finally {
      setEnviando(false);
    }
  }

  async function enviarArquivo(arquivo: File, tipo: "image" | "file") {
    setErro(null);
    setMaisAberto(false);
    const dataUrl = await lerComoDataUrl(arquivo);

    const marcar = bolhaOtimista(
      tipo === "image"
        ? { tipo: "out", texto: "", imagens: [{ url: dataUrl, nome: arquivo.name, tamanho: arquivo.size }] }
        : {
            tipo: "out",
            texto: "",
            documento: {
              url: dataUrl,
              nome: arquivo.name,
              tamanho: arquivo.size,
              formato: arquivo.name.split(".").pop()?.toUpperCase() ?? "ARQ",
              origem: "computador",
            },
          },
    );

    try {
      const resposta = await fetch("/api/integracoes/instagram/enviar-anexo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversaNome: contatoNome, dataUrl, nome: arquivo.name, tipo }),
      });
      if (!resposta.ok) throw new Error(((await resposta.json()) as { erro?: string }).erro);
      marcar({ status: "enviado" });
    } catch (e) {
      const motivo = e instanceof Error && e.message ? e.message : "Não foi possível enviar o anexo.";
      marcar({ status: "erro", erro: motivo });
      setErro(motivo);
    }
  }

  function salvarDados() {
    salvarDadosContato(contatoNome, {
      whatsapp: whatsappEdit.trim() || undefined,
      email: emailEdit.trim() || undefined,
      empresa: empresaEdit.trim() || undefined,
    });
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  return (
    <div className="painel-conversa-fundo" onClick={aoFechar}>
      <div className="painel-conversa" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Conversa com ${contatoNome}`}>
        <header className="painel-conversa-topo">
          <div className="name-cell">
            <div className="avatar">
              {fotoUrl ? <img src={fotoUrl} alt="" className="wa-avatar-foto" /> : initials}
            </div>
            <div>
              <p className="n">{nomeEdit}</p>
              <p className="s">{canal ?? "Conversa"}</p>
            </div>
          </div>
          <div className="painel-conversa-acoes">
            <button
              type="button"
              className={`gear-btn${dadosAberto ? " active" : ""}`}
              aria-pressed={dadosAberto}
              title="Dados do contato"
              onClick={() => setDadosAberto((v) => !v)}
            >
              ⚙
            </button>
            <button type="button" className="modal-close-btn" aria-label="Fechar" onClick={aoFechar}>
              ✕
            </button>
          </div>
        </header>

        <div className="painel-conversa-corpo">
          <div className="painel-conversa-mensagens chat-body">
            {mensagens.length === 0 ? (
              <p className="hint">Nenhuma mensagem ainda.</p>
            ) : (
              mensagens.map((msg, i) => {
                // Mesmo separador de dia da tela de Conversas — sem ele o histórico é um rolo
                // contínuo e não dá pra saber onde termina um dia e começa o outro.
                const dia = rotuloDoDia(msg.criadoEm);
                const diaAnterior = i > 0 ? rotuloDoDia(mensagens[i - 1].criadoEm) : null;
                return (
                  <Fragment key={msg.id ?? i}>
                    {dia && dia !== diaAnterior ? <span className="wa-separador-dia">{dia}</span> : null}
                    <BolhaMensagem msg={msg} />
                  </Fragment>
                );
              })
            )}
            <div ref={fimDaListaRef} />
          </div>

        </div>

        {erro ? <p className="hint" style={{ color: "var(--danger)", margin: "0 0 6px" }}>⚠ {erro}</p> : null}

        <div className="painel-conversa-rodape">
          {maisAberto ? (
            <div className="painel-conversa-mais">
              <button type="button" className="wa-anexo-item" onClick={() => arquivoImagemRef.current?.click()}>
                <span className="wa-anexo-label">🖼 Foto</span>
              </button>
              <button type="button" className="wa-anexo-item" onClick={() => arquivoDocumentoRef.current?.click()}>
                <span className="wa-anexo-label">📄 Documento</span>
              </button>
              <button type="button" className="wa-anexo-item" onClick={() => void compartilharLocalizacao()}>
                <span className="wa-anexo-label">📍 Localização</span>
              </button>
              {respostasRapidas.length ? (
                <div className="painel-conversa-respostas">
                  <p className="hint" style={{ margin: "6px 0 4px" }}>Respostas rápidas</p>
                  {respostasRapidas.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="dropdown-item"
                      style={{ width: "100%", textAlign: "left" }}
                      onClick={() => void enviarTexto(r.texto)}
                    >
                      {r.titulo}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="chat-input">
            <button
              type="button"
              className="chat-mais-btn"
              aria-label="Anexar"
              aria-expanded={maisAberto}
              onClick={() => setMaisAberto((v) => !v)}
            >
              +
            </button>
            <div className="chat-input-wrap box">
              <input
                className="chat-input-campo"
                placeholder="Digite uma mensagem…"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void enviarTexto();
                  }
                }}
              />
            </div>
            <button
              type="button"
              className="chat-mic-btn chat-send-btn"
              aria-label="Enviar"
              disabled={enviando || !texto.trim()}
              onClick={() => void enviarTexto()}
            >
              ➤
            </button>
          </div>
        </div>

        <input
          ref={arquivoImagemRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) void enviarArquivo(arquivo, "image");
            e.target.value = "";
          }}
        />
        <input
          ref={arquivoDocumentoRef}
          type="file"
          hidden
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) void enviarArquivo(arquivo, "file");
            e.target.value = "";
          }}
        />
      </div>

      {/* Fora da janela da conversa, ao lado dela — como o painel do WhatsApp. Espremido lá dentro,
          o formulário roubava a largura das mensagens e a conversa virava uma coluna estreita
          justamente enquanto a pessoa lia pra responder. */}
      {dadosAberto ? (
        <aside className="painel-conversa-dados" onClick={(e) => e.stopPropagation()}>
          <div className="wa-info-tabs" role="tablist" aria-label="Painel do contato">
            {(
              [
                { id: "contato", label: "Contato" },
                { id: "negociacao", label: "Negociação" },
                { id: "atividades", label: "Atividades" },
                { id: "historico", label: "Histórico" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={aba === t.id}
                className={`wa-info-tab${aba === t.id ? " active" : ""}`}
                onClick={() => setAba(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="painel-conversa-dados-scroll">
            {aba === "contato" ? (
              <>
                <div className="field">
                  <label>Nome</label>
                  <input className="input" value={nomeEdit} disabled />
                </div>
                <div className="field">
                  <label>WhatsApp</label>
                  <input className="input" value={whatsappEdit} onChange={(e) => setWhatsappEdit(e.target.value)} />
                </div>
                <div className="field">
                  <label>E-mail</label>
                  <input className="input" value={emailEdit} onChange={(e) => setEmailEdit(e.target.value)} />
                </div>
                <div className="field">
                  <label>Empresa</label>
                  <input className="input" value={empresaEdit} onChange={(e) => setEmpresaEdit(e.target.value)} />
                </div>
                <button type="button" className="btn primary block" onClick={salvarDados}>
                  {salvo ? "Salvo!" : "Salvar dados"}
                </button>
              </>
            ) : null}

            {aba === "negociacao" ? (
              <>
                <div className="field">
                  <label>Etapa atual</label>
                  <div className="input">{etapaAtual ?? "Fora do funil"}</div>
                </div>
                <div className="field">
                  <label>Origem</label>
                  <div className="input">{canal ?? "—"}</div>
                </div>
                <p className="hint" style={{ margin: 0 }}>
                  Pra mover de etapa, arraste o card no funil atrás desta janela — assim a mudança
                  passa pelas automações de entrada da etapa, como qualquer outro movimento.
                </p>
              </>
            ) : null}

            {aba === "atividades" ? (
              <>
                <p className="hint" style={{ margin: "0 0 8px" }}>
                  {mensagens.length} {mensagens.length === 1 ? "mensagem" : "mensagens"} nesta conversa.
                </p>
                <div className="field">
                  <label>Última mensagem</label>
                  <div className="input">{ultima ? `${ultima.hora} · ${resumo(ultima.texto)}` : "—"}</div>
                </div>
                <div className="field">
                  <label>Recebidas / enviadas</label>
                  <div className="input">
                    {mensagens.filter((m) => m.tipo === "in").length} recebidas ·{" "}
                    {mensagens.filter((m) => m.tipo === "out").length} enviadas
                  </div>
                </div>
              </>
            ) : null}

            {aba === "historico" ? (
              <ol className="painel-conversa-historico">
                {[...mensagens]
                  .reverse()
                  .slice(0, 40)
                  .map((m, i) => (
                    <li key={m.id ?? i}>
                      <span className="hint">{m.hora}</span> {m.tipo === "in" ? "Recebida" : m.tipo === "out" ? "Enviada" : "Sistema"} ·{" "}
                      {resumo(m.texto)}
                    </li>
                  ))}
                {mensagens.length === 0 ? <li className="hint">Sem histórico ainda.</li> : null}
              </ol>
            ) : null}
          </div>
        </aside>
      ) : null}
    </div>
  );

  function compartilharLocalizacao() {
    setMaisAberto(false);
    if (!navigator.geolocation) {
      setErro("Este navegador não sabe informar a localização.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        const { latitude, longitude } = posicao.coords;
        void enviarTexto(`📍 Minha localização: https://www.google.com/maps?q=${latitude},${longitude}`);
      },
      (falha) =>
        setErro(
          falha.code === falha.PERMISSION_DENIED
            ? "Você precisa permitir o acesso à localização no navegador."
            : "Não deu pra obter sua localização agora.",
        ),
      // Sem `timeout` a chamada pode ficar pendurada pra sempre, sem erro e sem resposta.
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }
}

/**
 * Cria a bolha "pendente" e devolve o marcador do resultado.
 *
 * Fica fora do componente porque só roda dentro de um handler (clique/envio), nunca no render — e
 * `Date.now()`/`Math.random()` dentro do corpo de um componente são lidos como impuros pelo lint,
 * com razão: ali eles rodariam a cada renderização.
 */
function adicionarBolhaOtimista(
  contatoNome: string,
  msg: Omit<ConvMensagem, "id" | "hora" | "criadoEm">,
  setMensagens: ReturnType<typeof useMensagensExtra>["setMensagensExtraPorContato"],
) {
  const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const nova: ConvMensagem = {
    ...msg,
    id,
    hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    criadoEm: Date.now(),
    status: "pendente",
  };
  setMensagens((prev) => ({ ...prev, [contatoNome]: [...(prev[contatoNome] ?? []), nova] }));
  return (patch: Partial<ConvMensagem>) =>
    setMensagens((prev) => ({
      ...prev,
      [contatoNome]: (prev[contatoNome] ?? []).map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
}

/** "Hoje", "Ontem" ou a data por extenso — o separador de dia da conversa. Mora aqui e na tela de
 * Conversas; quando o painel substituir aquela tela, sobra só esta cópia. */
function rotuloDoDia(criadoEm: number | undefined): string | null {
  if (!criadoEm) return null;
  const data = new Date(criadoEm);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  const mesmoDia = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (mesmoDia(data, hoje)) return "Hoje";
  if (mesmoDia(data, ontem)) return "Ontem";
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: data.getFullYear() === hoje.getFullYear() ? undefined : "numeric",
  });
}

/** Primeira linha do texto, curta — o histórico é uma lista de referências, não a conversa toda. */
function resumo(texto: string): string {
  const limpo = texto.split("\n")[0].trim();
  if (!limpo) return "(anexo)";
  return limpo.length > 60 ? `${limpo.slice(0, 60)}…` : limpo;
}

function lerComoDataUrl(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    leitor.readAsDataURL(arquivo);
  });
}
