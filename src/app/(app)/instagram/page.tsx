"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Topbar } from "@/components/ui";
import { AbasInstagram } from "@/components/instagram/AbasInstagram";
import { IconEnviar, IconSearch } from "@/components/icons";
import type { ConversaInstagram } from "@/app/api/instagram/conversas/route";
import type { MensagemInstagram } from "@/app/api/instagram/mensagens/route";

function hora(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function numero(valor: number | null): string {
  return typeof valor === "number" ? valor.toLocaleString("pt-BR") : "—";
}

function iniciais(nome: string): string {
  return (
    nome
      .replace(/^@/, "")
      .split(/[\s.|_]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

function Avatar({ nome, fotoUrl, tamanho = 38 }: { nome: string; fotoUrl: string | null; tamanho?: number }) {
  if (fotoUrl) {
    // A foto vem embutida (data URL) porque o link do CDN da Meta vence em horas. Ver
    // `baixarFotoPerfil`.
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="ig-avatar" src={fotoUrl} alt="" width={tamanho} height={tamanho} />;
  }
  return (
    <span className="ig-avatar ig-avatar-iniciais" style={{ width: tamanho, height: tamanho }}>
      {iniciais(nome)}
    </span>
  );
}

/**
 * A caixa de entrada do Direct.
 *
 * Três colunas, e cada uma responde uma pergunta: quem falou (a lista), o que foi dito (a conversa)
 * e quem é essa pessoa (o perfil). A terceira coluna é o que essa tela tem e a do WhatsApp não:
 * no Instagram a pessoa tem @, seguidores e um selo, e isso muda como se responde.
 *
 * O aviso da janela de 24 horas fica ao lado do campo de escrever, não escondido: é a diferença
 * entre saber que a mensagem não vai sair antes de escrevê-la e descobrir depois.
 */
export default function InstagramConversasPage() {
  const [conversas, setConversas] = useState<ConversaInstagram[] | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  // A resposta viaja com o nome da conversa: assim "carregando" é derivado (o que tenho não é da
  // conversa aberta) em vez de um segundo estado que erra sozinho quando duas buscas se cruzam.
  const [mensagens, setMensagens] = useState<{ de: string; lista: MensagemInstagram[] } | null>(null);
  const [busca, setBusca] = useState("");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregarConversas = useCallback(async () => {
    const r = await fetch("/api/instagram/conversas", { cache: "no-store" });
    setConversas(r.ok ? ((await r.json()) as ConversaInstagram[]) : []);
  }, []);

  useEffect(() => {
    Promise.resolve()
      .then(carregarConversas)
      .catch(() => setConversas([]));
  }, [carregarConversas]);

  useEffect(() => {
    if (!aberta) return;
    let cancelado = false;
    fetch(`/api/instagram/mensagens?conversa=${encodeURIComponent(aberta)}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<MensagemInstagram[]>) : []))
      .then((lista) => {
        if (!cancelado) setMensagens({ de: aberta, lista });
      })
      .catch(() => {
        if (!cancelado) setMensagens({ de: aberta, lista: [] });
      });
    return () => {
      cancelado = true;
    };
  }, [aberta]);

  /**
   * Busca o perfil na Meta quando ele está faltando.
   *
   * Toda conversa anterior à coluna de perfil ficou sem foto e sem os números, e não dá pra
   * preencher isso em lote: a Meta só responde sobre quem mandou mensagem pra conta, um por vez.
   * Uma chamada por conversa ABERTA, e não por conversa listada, que seria uma por linha da caixa.
   */
  useEffect(() => {
    if (!aberta) return;
    const alvo = conversas?.find((c) => c.nome === aberta);
    if (!alvo || (alvo.perfil?.seguidores != null && alvo.fotoUrl)) return;

    let cancelado = false;
    fetch("/api/instagram/perfil", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversa: aberta }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((dados: { fotoUrl?: string | null; username?: string | null; perfil?: ConversaInstagram["perfil"] } | null) => {
        if (cancelado || !dados) return;
        setConversas((atual) =>
          (atual ?? []).map((c) =>
            c.nome === aberta
              ? {
                  ...c,
                  fotoUrl: dados.fotoUrl ?? c.fotoUrl,
                  username: dados.username ?? c.username,
                  perfil: dados.perfil ?? c.perfil,
                }
              : c,
          ),
        );
      })
      .catch(() => {
        /* sem perfil a tela mostra traço, que já é o comportamento certo pra ausência */
      });
    return () => {
      cancelado = true;
    };
  }, [aberta, conversas]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return conversas ?? [];
    return (conversas ?? []).filter(
      (c) => c.exibicao.toLowerCase().includes(termo) || (c.username ?? "").toLowerCase().includes(termo),
    );
  }, [conversas, busca]);

  const atual = conversas?.find((c) => c.nome === aberta) ?? null;

  async function enviar() {
    if (!aberta || !texto.trim()) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch("/api/instagram/mensagens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversa: aberta, texto }),
      });
      const dados = (await r.json()) as { erro?: string };
      if (!r.ok) throw new Error(dados.erro ?? "Não deu pra enviar.");
      setTexto("");
      const lista = await fetch(`/api/instagram/mensagens?conversa=${encodeURIComponent(aberta)}`, {
        cache: "no-store",
      }).then((res) => (res.ok ? (res.json() as Promise<MensagemInstagram[]>) : []));
      setMensagens({ de: aberta, lista });
      await carregarConversas();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu pra enviar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Topbar title="Instagram" sub="Direct, respostas a story e comentários" />
      <AbasInstagram />

      <div className="content ig-layout">
        <aside className="ig-lista">
          <div className="ig-busca">
            <IconSearch width={14} height={14} aria-hidden="true" />
            <input
              className="input"
              placeholder="Buscar por nome ou @"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          <div className="ig-lista-itens">
            {conversas === null ? (
              <p className="hint ig-vazio">Carregando…</p>
            ) : !visiveis.length ? (
              <p className="hint ig-vazio">
                {conversas.length ? "Ninguém com esse nome." : "Nenhuma conversa do Direct ainda."}
              </p>
            ) : (
              visiveis.map((c) => (
                <button
                  key={c.nome}
                  type="button"
                  className={`ig-item${aberta === c.nome ? " on" : ""}`}
                  onClick={() => setAberta(c.nome)}
                >
                  <Avatar nome={c.exibicao} fotoUrl={c.fotoUrl} />
                  <span className="ig-item-texto">
                    <span className="ig-item-topo">
                      <strong>{c.exibicao}</strong>
                      <span className="ig-item-hora">{hora(c.ultimaEm)}</span>
                    </span>
                    <span className="ig-item-previa">{c.ultimaMensagem || "Sem mensagens"}</span>
                  </span>
                  {c.naoLidas > 0 ? <span className="ig-nao-lidas">{c.naoLidas}</span> : null}
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="ig-conversa">
          {!atual ? (
            <p className="hint ig-vazio">Escolha uma conversa à esquerda.</p>
          ) : (
            <>
              <header className="ig-conversa-topo">
                <Avatar nome={atual.exibicao} fotoUrl={atual.fotoUrl} tamanho={34} />
                <div>
                  <strong>{atual.exibicao}</strong>
                  {atual.username ? <span>@{atual.username.replace(/^@/, "")}</span> : null}
                </div>
              </header>

              <div className="ig-mensagens">
                {mensagens?.de !== atual.nome ? (
                  <p className="hint">Carregando…</p>
                ) : !mensagens.lista.length ? (
                  <p className="hint">Nenhuma mensagem nesta conversa.</p>
                ) : (
                  mensagens.lista.map((m) => (
                    <div key={m.id} className={`ig-bolha${m.tipo === "out" ? " nossa" : ""}`}>
                      <p>{m.texto || "(anexo)"}</p>
                      <span>{m.hora}</span>
                    </div>
                  ))
                )}
              </div>

              <footer className="ig-escrever">
                {!atual.dentroDaJanela ? (
                  <p className="hint ig-janela-fechada">
                    A janela de 24 horas fechou. O Instagram só deixa responder quem escreveu nas
                    últimas 24 horas, e não existe modelo aprovado como no WhatsApp oficial.
                  </p>
                ) : (
                  <p className="hint">
                    Dá pra responder até {new Date(atual.janelaFechaEm ?? "").toLocaleString("pt-BR")}.
                  </p>
                )}
                <div className="ig-escrever-linha">
                  <textarea
                    className="input"
                    placeholder="Escreva a resposta…"
                    value={texto}
                    maxLength={1000}
                    disabled={!atual.dentroDaJanela || enviando}
                    onChange={(e) => setTexto(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn primary"
                    disabled={!atual.dentroDaJanela || enviando || !texto.trim()}
                    onClick={enviar}
                    aria-label="Enviar"
                  >
                    <IconEnviar width={14} height={14} />
                  </button>
                </div>
                {erro ? <p className="hint" style={{ color: "var(--danger)" }}>{erro}</p> : null}
              </footer>
            </>
          )}
        </section>

        <aside className="ig-perfil">
          {!atual ? (
            <p className="hint ig-vazio">Nenhum contato aberto.</p>
          ) : (
            <>
              <header className="ig-perfil-topo">
                <Avatar nome={atual.exibicao} fotoUrl={atual.fotoUrl} tamanho={56} />
                <strong>{atual.exibicao}</strong>
                {atual.username ? <span>@{atual.username.replace(/^@/, "")}</span> : null}
              </header>

              <h4>Informações do perfil</h4>
              <div className="ig-perfil-numeros">
                <div>
                  <strong>{numero(atual.perfil?.seguidores ?? null)}</strong>
                  <span>Seguidores</span>
                </div>
                <div>
                  <strong>{atual.perfil?.verificado == null ? "—" : atual.perfil.verificado ? "Sim" : "Não"}</strong>
                  <span>Verificado</span>
                </div>
                <div>
                  <strong>{atual.perfil?.segueVoce == null ? "—" : atual.perfil.segueVoce ? "Sim" : "Não"}</strong>
                  <span>Segue você</span>
                </div>
              </div>
              <p className="hint">
                Vem do perfil que a Meta devolve pra quem escreveu pra sua conta. Quando a conta não
                concede esses campos, eles aparecem como traço em vez de zero.
              </p>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
