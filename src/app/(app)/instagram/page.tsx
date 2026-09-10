"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Topbar } from "@/components/ui";
import { IconEnviar, IconSearch } from "@/components/icons";
import type { ConversaInstagram } from "@/app/api/instagram/conversas/route";
import type { MensagemInstagram } from "@/app/api/instagram/mensagens/route";
import { INTERVALO_POLLING_MS } from "@/lib/conversas/polling";

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

  /*
   * As versões que o servidor já confirmou, mandadas de volta em `If-None-Match` na batida
   * seguinte. Quando nada mudou, a resposta é `304` sem corpo e o servidor nem consulta.
   *
   * É o que faz a atualização automática desta tela ser barata. Ver `src/lib/conversas/assinatura.ts`:
   * foi uma tela igual a esta, perguntando de tempos em tempos e recebendo a lista inteira toda
   * vez, que sozinha puxou ~1,9 TB do banco num mês.
   */
  const etagConversasRef = useRef<string | null>(null);
  /* A conversa aberta, lida pelo temporizador. Um `ref` e não a dependência do efeito: com
     `aberta` na lista, o intervalo seria destruído e recriado a cada troca de conversa, e a
     contagem dos 10 segundos recomeçaria do zero toda vez. */
  const abertaRef = useRef<string | null>(null);
  /* Conversas cuja busca de perfil já foi tentada nesta sessão de tela.
     Sem isto, um perfil que a Meta recusa (conta sem a permissão desses campos) seria pedido de
     novo a cada vez que a lista se renova: uma chamada à Meta por batida, pra sempre receber a
     mesma recusa. É chamada paga, e conta pro limite de requisições da conta. */
  const perfilTentadoRef = useRef<Set<string>>(new Set());
  const etagMensagensRef = useRef<{ de: string; etag: string } | null>(null);

  const carregarConversas = useCallback(async () => {
    const r = await fetch("/api/instagram/conversas", {
      // À mão, e não pelo cache do navegador: assim dá pra SABER que nada mudou e não mexer no
      // estado. Deixar o navegador revalidar sozinho devolveria um 200 vindo do cache, e a tela
      // re-renderizaria a cada batida sem nenhuma mensagem nova.
      cache: "no-store",
      headers: etagConversasRef.current ? { "if-none-match": etagConversasRef.current } : undefined,
    });
    if (r.status === 304) return;

    const etag = r.headers.get("etag");
    if (etag) etagConversasRef.current = etag;
    const lista = r.ok ? ((await r.json()) as ConversaInstagram[]) : [];
    setConversas(lista);

    /*
     * Abre a primeira conversa sozinha.
     *
     * "Escolha uma conversa à esquerda" era um passo a mais pra chegar em algum lugar que a pessoa
     * quase sempre queria: a conversa do topo é a mais recente, e é onde quem atende começa. O
     * painel vazio ocupava dois terços da tela sem dizer nada.
     *
     * `?? ` e não atribuição direta: esta função roda de novo depois de cada envio, e sobrescrever
     * ali jogaria a pessoa de volta pro topo no meio de uma resposta.
     */
    setAberta((atual) => atual ?? lista[0]?.nome ?? null);
  }, []);

  const carregarMensagens = useCallback(async (conversa: string) => {
    // O ETag guardado é de UMA conversa. Trocando de conversa ele não vale mais, e mandá-lo assim
    // mesmo faria o servidor responder 304 sobre a conversa errada: a tela ficaria com as
    // mensagens da anterior.
    const guardado = etagMensagensRef.current;
    const enviar = guardado?.de === conversa ? guardado.etag : null;

    const r = await fetch(`/api/instagram/mensagens?conversa=${encodeURIComponent(conversa)}`, {
      cache: "no-store",
      headers: enviar ? { "if-none-match": enviar } : undefined,
    });
    if (r.status === 304) return;

    const etag = r.headers.get("etag");
    if (etag) etagMensagensRef.current = { de: conversa, etag };
    const lista = r.ok ? ((await r.json()) as MensagemInstagram[]) : [];
    setMensagens({ de: conversa, lista });
  }, []);

  useEffect(() => {
    Promise.resolve()
      .then(carregarConversas)
      .catch(() => setConversas([]));
  }, [carregarConversas]);

  useEffect(() => {
    // O `ref` acompanha a conversa aberta pelo efeito, não durante a renderização: escrever num
    // ref no corpo do componente é proibido pelo React Compiler, e com razão.
    abertaRef.current = aberta;
    if (!aberta) return;
    Promise.resolve()
      .then(() => carregarMensagens(aberta))
      .catch(() => setMensagens({ de: aberta, lista: [] }));
  }, [aberta, carregarMensagens]);

  /*
   * Atualização automática: mensagem que chega pelo webhook aparece aqui sozinha.
   *
   * Três regras que existem por causa de custo, não de gosto:
   *
   * 1. **Só com a aba visível.** Aba de fundo não é lida por ninguém, e uma aba esquecida aberta
   *    a noite toda seria a maior fonte de batida inútil que existe.
   * 2. **O mesmo ritmo das outras telas** (`INTERVALO_POLLING_MS`, 10s). Ritmos diferentes fariam
   *    a lista de conversas e as mensagens discordarem por alguns segundos.
   * 3. **Com `If-None-Match`.** É o que transforma a batida num `304` de corpo vazio quando nada
   *    mudou, que é o caso quase sempre.
   *
   * E uma batida imediata ao voltar pra aba, pra quem volta do Instagram não esperar 10 segundos
   * pra ver o que chegou.
   */
  useEffect(() => {
    function atualizar() {
      if (document.visibilityState !== "visible") return;
      carregarConversas().catch(() => {});
      if (abertaRef.current) carregarMensagens(abertaRef.current).catch(() => {});
    }

    const intervalo = setInterval(atualizar, INTERVALO_POLLING_MS);
    document.addEventListener("visibilitychange", atualizar);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", atualizar);
    };
  }, [carregarConversas, carregarMensagens]);

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
    if (perfilTentadoRef.current.has(aberta)) return;
    perfilTentadoRef.current.add(aberta);

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
      // Pelo mesmo caminho do polling: uma busca crua aqui deixaria o ETag guardado velho, e a
      // batida seguinte pediria a conversa inteira de novo sem precisar.
      await carregarMensagens(aberta);
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
