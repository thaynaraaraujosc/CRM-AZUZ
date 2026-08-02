"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { classeOrigem, conversas, type Funil, type NegocioCard } from "@/lib/data";
import { useAutomacoes } from "@/lib/automacoes-context";
import { useContatos } from "@/lib/contatos-context";
import { useFunis } from "@/lib/funis-context";
import { useNotificacoes } from "@/lib/notificacoes-context";
import {
  CanalBadge,
  IconAutomacoes,
  IconConfiguracoes,
  IconDoc,
  IconMic,
  IconSearch,
} from "@/components/icons";
import { RadioList, Toggle, Topbar } from "@/components/ui";

const FILTROS_CONVERSA = [
  { valor: "tudo", label: "Tudo" },
  { valor: "nao-lidas", label: "Não lidas" },
  { valor: "favoritas", label: "Favoritas" },
] as const;

type FiltroConversa = (typeof FILTROS_CONVERSA)[number]["valor"];

/** Mesmo dia de referência usado em todo o app (ver `today` em lib/data.ts). */
const HOJE_ISO = "2026-07-30";

function localizarNoFunil(
  listaFunis: Funil[],
  nomeContato: string,
): { funilId: string; etapa: string } | null {
  for (const f of listaFunis) {
    for (const coluna of f.colunas) {
      if (coluna.cards.some((c) => c.nome === nomeContato)) {
        return { funilId: f.id, etapa: coluna.titulo };
      }
    }
  }
  return null;
}

type HistoricoItem = {
  id: string;
  tipo: "sistema" | "anotacao" | "email";
  texto: string;
  quando: string;
};

/** Monta o histórico automático (etapa do funil, tempo até fechar/perder) a partir dos dados já existentes do card no funil. */
function historicoInicialDoContato(
  listaFunis: Funil[],
  contato: { id: string; nome: string; mensagens: { hora?: string }[] },
): HistoricoItem[] {
  const localizacao = localizarNoFunil(listaFunis, contato.nome);
  const itens: HistoricoItem[] = [];

  const primeiraHora = contato.mensagens[0]?.hora;
  itens.push({
    id: `hist-inicio-${contato.id}`,
    tipo: "sistema",
    texto: `Primeira conversa registrada${primeiraHora ? ` · ${primeiraHora}` : ""}`,
    quando: primeiraHora ?? "—",
  });

  if (localizacao) {
    const funil = listaFunis.find((f) => f.id === localizacao.funilId);
    const card = funil?.colunas
      .flatMap((coluna) => coluna.cards)
      .find((c) => c.nome === contato.nome);
    itens.push({
      id: `hist-etapa-${contato.id}`,
      tipo: "sistema",
      texto: `Entrou na etapa "${localizacao.etapa}" do funil ${funil?.nome ?? ""}${
        card ? ` · há ${card.dias}` : ""
      }`,
      quando: card?.data ?? "—",
    });

    if (localizacao.etapa.toLowerCase().includes("fechado")) {
      itens.push({
        id: `hist-fechou-${contato.id}`,
        tipo: "sistema",
        texto: `Fechou negócio${card ? ` · valor ${card.valor}` : ""}`,
        quando: card?.data ?? "—",
      });
    }
  } else {
    itens.push({
      id: `hist-sem-funil-${contato.id}`,
      tipo: "sistema",
      texto: "Ainda não entrou em nenhum funil",
      quando: "—",
    });
  }

  return itens;
}

export default function ConversasPage() {
  return (
    <Suspense fallback={null}>
      <ConversasPageInner />
    </Suspense>
  );
}

function ConversasPageInner() {
  const searchParams = useSearchParams();
  const { funis, atribuirContatoAoFunil } = useFunis();
  const { contatos, salvarDadosContato, atribuirAtendente } = useContatos();
  const { automacoesDeEntradaAtivas } = useAutomacoes();
  const { simularNovaMensagem } = useNotificacoes();
  const [toasts, setToasts] = useState<{ id: string; texto: string }[]>([]);
  const proximoToastId = useRef(0);

  function avisarAutomacao(texto: string) {
    const id = `toast-${proximoToastId.current++}`;
    setToasts((prev) => [...prev, { id, texto }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }
  const [selectedId, setSelectedId] = useState(() => {
    const nomeContato = searchParams.get("contato");
    const encontrada = nomeContato
      ? conversas.find((c) => c.nome === nomeContato)
      : null;
    return (encontrada ?? conversas[0]).id;
  });
  const [infoAberto, setInfoAberto] = useState(false);
  const [buscaConversa, setBuscaConversa] = useState("");
  const [filtroConversa, setFiltroConversa] = useState<FiltroConversa>("tudo");

  const conversasFiltradas = conversas.filter((c) => {
    if (filtroConversa === "nao-lidas" && !c.naoLidas) return false;
    if (filtroConversa === "favoritas" && !c.favorita) return false;
    if (!buscaConversa.trim()) return true;
    const termo = buscaConversa.trim().toLowerCase();
    const ultima = c.mensagens[c.mensagens.length - 1];
    return (
      c.nome.toLowerCase().includes(termo) ||
      ultima.texto.toLowerCase().includes(termo)
    );
  });

  const aberta = conversas.find((c) => c.id === selectedId) ?? conversas[0];
  const { tarefa } = aberta;
  const localizacao = localizarNoFunil(funis, aberta.nome);

  const contatoDaConversa = contatos.find((c) => c.nome === aberta.nome) ?? null;

  function etapaPadraoPara(funilId: string) {
    const f = funis.find((x) => x.id === funilId);
    return localizacao && localizacao.funilId === funilId
      ? localizacao.etapa
      : f?.colunas[0]?.titulo ?? "";
  }

  // Troca o funil/etapa/atendente/dados selecionados toda vez que a conversa
  // aberta muda, pra sempre abrir já mostrando as atribuições desse contato
  // (ajuste de estado a partir de uma mudança de prop — ver docs do React).
  const [funilSelecionadoId, setFunilSelecionadoId] = useState(
    () => localizacao?.funilId ?? funis[0]?.id ?? "",
  );
  const [etapaSelecionada, setEtapaSelecionada] = useState(() =>
    etapaPadraoPara(localizacao?.funilId ?? funis[0]?.id ?? ""),
  );
  const [atendenteSelecionado, setAtendenteSelecionado] = useState(
    aberta.atendenteSelecionado,
  );
  const [emailContato, setEmailContato] = useState(contatoDaConversa?.email ?? "");
  const [whatsappContato, setWhatsappContato] = useState(
    contatoDaConversa?.whatsapp ?? "",
  );
  const [nascimentoContato, setNascimentoContato] = useState(
    contatoDaConversa?.nascimento ?? "",
  );
  const [enderecoContato, setEnderecoContato] = useState(
    contatoDaConversa?.endereco ?? "",
  );
  const [abertaIdAnterior, setAbertaIdAnterior] = useState(aberta.id);
  const [mensagensCurtidas, setMensagensCurtidas] = useState<Set<number>>(
    () => new Set(),
  );
  const [coracaoAnimando, setCoracaoAnimando] = useState<number | null>(null);
  const [tarefaAberta, setTarefaAberta] = useState(false);
  const [emailsEnviados, setEmailsEnviados] = useState<
    {
      id: string;
      contato: string;
      para: string;
      assunto: string;
      enviadoEm: string;
      aberto: boolean;
      abertoEm?: string;
    }[]
  >([]);
  const [emailModalAberto, setEmailModalAberto] = useState(false);
  const [emailPara, setEmailPara] = useState("");
  const [emailAssunto, setEmailAssunto] = useState("");
  const emailCorpoRef = useRef<HTMLDivElement>(null);
  const [historicoPorContato, setHistoricoPorContato] = useState<
    Record<string, HistoricoItem[]>
  >({});
  const [notaTexto, setNotaTexto] = useState("");

  if (aberta.id !== abertaIdAnterior) {
    setAbertaIdAnterior(aberta.id);
    const funilId = localizacao?.funilId ?? funis[0]?.id ?? "";
    setFunilSelecionadoId(funilId);
    setEtapaSelecionada(etapaPadraoPara(funilId));
    setAtendenteSelecionado(aberta.atendenteSelecionado);
    setEmailContato(contatoDaConversa?.email ?? "");
    setWhatsappContato(contatoDaConversa?.whatsapp ?? "");
    setNascimentoContato(contatoDaConversa?.nascimento ?? "");
    setEnderecoContato(contatoDaConversa?.endereco ?? "");
    setMensagensCurtidas(new Set());
    setCoracaoAnimando(null);
    setTarefaAberta(false);
    setEmailModalAberto(false);
    setNotaTexto("");
  }
  if (!historicoPorContato[aberta.nome]) {
    setHistoricoPorContato((prev) => ({
      ...prev,
      [aberta.nome]: historicoInicialDoContato(funis, aberta),
    }));
  }

  const emailsDaConversa = emailsEnviados.filter((e) => e.contato === aberta.nome);
  const historico = historicoPorContato[aberta.nome] ?? [];

  function adicionarHistorico(tipo: HistoricoItem["tipo"], texto: string) {
    setHistoricoPorContato((prev) => ({
      ...prev,
      [aberta.nome]: [
        ...(prev[aberta.nome] ?? historicoInicialDoContato(funis, aberta)),
        { id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, tipo, texto, quando: "agora" },
      ],
    }));
  }

  function salvarAnotacao() {
    const texto = notaTexto.trim();
    if (!texto) return;
    adicionarHistorico("anotacao", texto);
    setNotaTexto("");
  }

  function abrirEmailModal() {
    setEmailPara(emailContato || contatoDaConversa?.email || "");
    setEmailAssunto("");
    setEmailModalAberto(true);
  }

  function fecharEmailModal() {
    setEmailModalAberto(false);
  }

  function enviarEmail() {
    const para = emailPara.trim();
    const assunto = emailAssunto.trim();
    if (!para || !assunto) return;
    const id = `email-${Date.now()}`;
    setEmailsEnviados((prev) => [
      ...prev,
      {
        id,
        contato: aberta.nome,
        para,
        assunto,
        enviadoEm: "agora",
        aberto: false,
      },
    ]);
    setEmailModalAberto(false);
    adicionarHistorico("email", `E-mail disparado pra ${para} · assunto "${assunto}"`);
    setTimeout(() => {
      const agora = new Date();
      const hora = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
      setEmailsEnviados((prev) =>
        prev.map((e) => (e.id === id ? { ...e, aberto: true, abertoEm: hora } : e)),
      );
      adicionarHistorico("email", `E-mail "${assunto}" foi lido às ${hora}`);
      avisarAutomacao(`${aberta.nome} abriu o e-mail "${assunto}"`);
    }, 6000);
  }

  function curtirMensagem(indice: number) {
    setMensagensCurtidas((prev) => {
      const next = new Set(prev);
      if (next.has(indice)) next.delete(indice);
      else next.add(indice);
      return next;
    });
    setCoracaoAnimando(indice);
    setTimeout(() => {
      setCoracaoAnimando((atual) => (atual === indice ? null : atual));
    }, 700);
  }

  const funilSelecionado =
    funis.find((f) => f.id === funilSelecionadoId) ?? funis[0];

  function trocarFunilSelecionado(novoFunilId: string) {
    setFunilSelecionadoId(novoFunilId);
    setEtapaSelecionada(etapaPadraoPara(novoFunilId));
  }

  function salvarDados() {
    salvarDadosContato(aberta.nome, {
      email: emailContato.trim() || undefined,
      whatsapp: whatsappContato.trim() || undefined,
      nascimento: nascimentoContato.trim() || undefined,
      endereco: enderecoContato.trim() || undefined,
    });
  }

  function salvarAtribuicao() {
    atribuirAtendente(aberta.nome, atendenteSelecionado);
    if (funilSelecionado && etapaSelecionada) {
      const cardExistente = funilSelecionado.colunas
        .flatMap((c) => c.cards)
        .find((c) => c.nome === aberta.nome);
      const novoCard: Omit<NegocioCard, "id"> & { id?: string } = {
        id: cardExistente?.id,
        nome: aberta.nome,
        valor: cardExistente?.valor ?? "—",
        origem: cardExistente?.origem ?? aberta.origem,
        dias: cardExistente?.dias ?? "Hoje",
        data: cardExistente?.data ?? HOJE_ISO,
      };
      const mudouDeEtapa =
        localizacao?.funilId !== funilSelecionado.id ||
        localizacao?.etapa !== etapaSelecionada;
      atribuirContatoAoFunil(funilSelecionado.id, etapaSelecionada, novoCard);

      if (mudouDeEtapa) {
        adicionarHistorico(
          "sistema",
          `Moveu pra etapa "${etapaSelecionada}" do funil ${funilSelecionado.nome}`,
        );
      }

      // Igual arrastar o card no Funil: entrar numa etapa com gatilho
      // "entrou" ativo dispara a automação daquela etapa também por aqui.
      if (mudouDeEtapa) {
        const etapaDestino = funilSelecionado.colunas.find(
          (c) => c.titulo === etapaSelecionada,
        );
        if (etapaDestino) {
          const disparadas = automacoesDeEntradaAtivas(
            funilSelecionado.id,
            etapaDestino.id,
          );
          for (const automacao of disparadas) {
            avisarAutomacao(
              `Automação "${automacao.titulo}" disparada pra ${aberta.nome} (entrou em "${etapaDestino.titulo}")`,
            );
          }
        }
      }
    }
  }

  return (
    <>
      <Topbar
        title="WhatsApp"
        sub="WhatsApp, Instagram e TikTok — todas as conversas num só lugar"
        actions={
          <>
            <button
              type="button"
              className="btn ghost"
              onClick={() => simularNovaMensagem(aberta.nome)}
            >
              🔔 Simular mensagem nova
            </button>
            <span className="fsel">Atendente: Todos ▾</span>
            <span className="fsel">Canal: Todos ▾</span>
          </>
        }
      />

      <div className="content wa-content wa-whatsapp">
        <aside className="wa-list">
          <div className="wa-list-search">
            <label className="search wa-search">
              <IconSearch />
              <input
                placeholder="Pesquisar ou começar uma nova conversa"
                aria-label="Pesquisar conversa"
                value={buscaConversa}
                onChange={(e) => setBuscaConversa(e.target.value)}
              />
            </label>
          </div>
          <div className="wa-list-filters">
            {FILTROS_CONVERSA.map((f) => (
              <button
                type="button"
                key={f.valor}
                className={`wa-filter-chip${filtroConversa === f.valor ? " active" : ""}`}
                aria-pressed={filtroConversa === f.valor}
                onClick={() => setFiltroConversa(f.valor)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {conversasFiltradas.length === 0 ? (
            <p className="hint" style={{ padding: 20 }}>
              Nenhuma conversa encontrada.
            </p>
          ) : (
            conversasFiltradas.map((c) => {
              const active = c.id === aberta.id;
              const last = c.mensagens[c.mensagens.length - 1];
              return (
                <button
                  type="button"
                  key={c.id}
                  className={`wa-row${active ? " active" : ""}`}
                  aria-pressed={active}
                  onClick={() => setSelectedId(c.id)}
                >
                  <span className="cr1">
                    <span className="avatar">
                      {c.initials}
                      <CanalBadge canal={c.canal} />
                    </span>
                    <span className="cname">
                      {c.nome}
                      {c.favorita ? <span className="wa-fav-star">★</span> : null}
                    </span>
                    <span className="ctime">{c.tempo}</span>
                  </span>
                  <span className="cmsg">
                    {last.tipo === "out" ? "Você: " : ""}
                    {last.texto}
                    {c.naoLidas ? (
                      <span className="wa-unread-badge">{c.naoLidas}</span>
                    ) : null}
                  </span>
                  <span className="cr3">
                    <span className="tag">{c.status}</span>
                    <span className={`tag ${classeOrigem(c.origem)}`}>
                      {c.origem}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </aside>

        <section className="wa-main">
          <div className="open-conv-h">
            <div className="avatar">{aberta.initials}</div>
            <div>
              <p className="n">{aberta.nome}</p>
              <p className="s">
                {aberta.canal} · {aberta.contato}
              </p>
            </div>
            <button
              type="button"
              className={`gear-btn wa-main-gear${infoAberto ? " active" : ""}`}
              aria-pressed={infoAberto}
              aria-label="Ver atributos do contato"
              onClick={() => setInfoAberto((v) => !v)}
            >
              <IconConfiguracoes />
            </button>
          </div>

          <div className="chat-body">
            {aberta.mensagens.map((msg, i) => (
              <div
                className={`bubble ${msg.tipo}`}
                key={i}
                onDoubleClick={() => {
                  if (msg.tipo === "in") curtirMensagem(i);
                }}
                style={msg.tipo === "in" ? { cursor: "pointer" } : undefined}
                title={msg.tipo === "in" ? "Dois cliques pra curtir" : undefined}
              >
                {msg.texto}
                {msg.hora ? <span className="tm">{msg.hora}</span> : null}
                {mensagensCurtidas.has(i) ? (
                  <span className="bubble-reacao">❤️</span>
                ) : null}
                {coracaoAnimando === i ? (
                  <span className="bubble-coracao-anim">❤️</span>
                ) : null}
              </div>
            ))}
          </div>
          <div className="chat-input">
            <div className="box">Escrever mensagem…</div>
            <button
              type="button"
              className="chat-mic-btn"
              aria-label="Gravar áudio"
              title="Gravar áudio"
            >
              <IconMic />
            </button>
          </div>
        </section>

        {infoAberto ? (
        <aside className="wa-info">
          <div className="panel-h">
            <h4>Atribuir ao funil</h4>
          </div>
          <div className="field">
            <label>Funil</label>
            <select
              className="input"
              style={{ width: "100%", cursor: "pointer" }}
              value={funilSelecionado?.id}
              onChange={(e) => trocarFunilSelecionado(e.target.value)}
            >
              {funis.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>
          {funilSelecionado ? (
            <RadioList
              key={`funil-${aberta.id}-${funilSelecionado.id}`}
              options={funilSelecionado.colunas.map((coluna) => ({
                nome: coluna.titulo,
                descricao: `${coluna.total} contatos nessa etapa`,
              }))}
              initial={etapaSelecionada}
              onChange={setEtapaSelecionada}
            />
          ) : null}
          <div className="section-foot">
            <button
              type="button"
              className="btn primary block"
              onClick={salvarAtribuicao}
            >
              Salvar atribuição ao funil
            </button>
          </div>

          <div className="panel-h divided">
            <h4>Dados do contato</h4>
          </div>
          <div className="field">
            <label>Nome</label>
            <div className="input">{aberta.nome}</div>
          </div>
          <div className="field">
            <label>E-mail</label>
            <input
              className="input"
              style={{ width: "100%" }}
              type="email"
              value={emailContato}
              onChange={(e) => setEmailContato(e.target.value)}
              placeholder="Peça e preencha aqui"
            />
          </div>
          <div className="field">
            <label>Número do WhatsApp</label>
            <input
              className="input"
              style={{ width: "100%" }}
              type="text"
              value={whatsappContato}
              onChange={(e) => setWhatsappContato(e.target.value)}
              placeholder="Ex.: (62) 9XXXX-XXXX"
            />
          </div>
          <div className="field">
            <label>Data de aniversário</label>
            <input
              className="input"
              style={{ width: "100%" }}
              type="text"
              value={nascimentoContato}
              onChange={(e) => setNascimentoContato(e.target.value)}
              placeholder="Ex.: 14/03/1990"
            />
          </div>
          <div className="field">
            <label>Endereço</label>
            <input
              className="input"
              style={{ width: "100%" }}
              type="text"
              value={enderecoContato}
              onChange={(e) => setEnderecoContato(e.target.value)}
              placeholder="Onde ele mora"
            />
          </div>
          <div className="section-foot">
            <button
              type="button"
              className="btn ghost block"
              onClick={salvarDados}
            >
              Salvar dados do contato
            </button>
          </div>

          <div className="panel-h divided">
            <h4>Adicionar</h4>
          </div>
          <div style={{ display: "flex", gap: 8, padding: "14px 17px" }}>
            <button
              type="button"
              className="btn ghost"
              style={{ flex: 1 }}
              onClick={() => setTarefaAberta((v) => !v)}
            >
              {tarefaAberta ? "Fechar tarefa" : "+ Adicionar tarefa"}
            </button>
            <button
              type="button"
              className="btn ghost"
              style={{ flex: 1 }}
              onClick={abrirEmailModal}
            >
              ✉ Disparar e-mail
            </button>
          </div>

          {tarefaAberta ? (
            <>
              <div className="panel-h divided">
                <h4>Tarefa</h4>
              </div>
              <div className="field">
                <label>Data da tarefa</label>
                <div className="input">{tarefa.data}</div>
              </div>
              <div className="field">
                <label>O que fazer</label>
                <div className="input">{tarefa.oQueFazer}</div>
              </div>
              <div className="field">
                <label>Valor combinado</label>
                <div className="input">{tarefa.valor}</div>
              </div>
              {tarefa.anexo ? (
                <div className="field">
                  <label>Anexo</label>
                  <div className="attach-chip">
                    <IconDoc />
                    <span className="fn">{tarefa.anexo.arquivo}</span>
                    <span className="fs">{tarefa.anexo.detalhe}</span>
                  </div>
                  <button type="button" className="btn ghost block mt14">
                    + Anexar outro documento
                  </button>
                </div>
              ) : (
                <div className="field">
                  <label>Anexo</label>
                  <button type="button" className="btn ghost block">
                    + Anexar documento
                  </button>
                </div>
              )}
              <div className="field">
                <label>Atribuir tarefa para</label>
                <div className="input">{tarefa.responsavel}</div>
              </div>

              <div className="toggle-row">
                <span className="tl">Avisar por WhatsApp perto do vencimento</span>
                <Toggle defaultOn label="Avisar por WhatsApp perto do vencimento" />
              </div>
              <div className="toggle-row">
                <span className="tl">Mostrar essa tarefa no portal do cliente</span>
                <Toggle defaultOn label="Mostrar essa tarefa no portal do cliente" />
              </div>

              <div className="section-foot">
                <button
                  type="button"
                  className="btn primary block"
                  onClick={salvarAtribuicao}
                >
                  Salvar tarefa
                </button>
              </div>
            </>
          ) : null}

          {emailsDaConversa.length > 0 ? (
            <>
              <div className="panel-h divided">
                <h4>E-mails enviados</h4>
              </div>
              {emailsDaConversa.map((email) => (
                <div className="stat-row" key={email.id}>
                  <span className="sl">{email.assunto}</span>
                  <span
                    className={`sv${email.aberto ? " wa-email-lido" : ""}`}
                  >
                    {email.aberto ? `Lido às ${email.abertoEm}` : "Enviado, ainda não lido"}
                  </span>
                </div>
              ))}
            </>
          ) : null}

          <div className="panel-h divided">
            <h4>Histórico e anotações</h4>
          </div>
          <div style={{ padding: "0 17px 14px" }}>
            <textarea
              className="input"
              style={{ width: "100%", minHeight: 60, resize: "vertical" }}
              placeholder="Anotar o que foi conversado por telefone, por exemplo…"
              value={notaTexto}
              onChange={(e) => setNotaTexto(e.target.value)}
            />
            <button
              type="button"
              className="btn ghost block mt14"
              onClick={salvarAnotacao}
              disabled={!notaTexto.trim()}
            >
              + Salvar anotação
            </button>
          </div>
          <div className="wa-historico">
            {[...historico].reverse().map((item) => (
              <div className="wa-historico-item" key={item.id}>
                <span className={`wa-historico-tipo wa-historico-${item.tipo}`}>
                  {item.tipo === "anotacao"
                    ? "📝 Anotação"
                    : item.tipo === "email"
                      ? "✉ E-mail"
                      : "● Sistema"}
                </span>
                <p className="wa-historico-texto">{item.texto}</p>
                <span className="wa-historico-quando">{item.quando}</span>
              </div>
            ))}
          </div>
        </aside>
        ) : null}
      </div>

      {emailModalAberto ? (
        <div className="form-preview-overlay" onClick={fecharEmailModal}>
          <div
            className="wa-email-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="open-conv-h" style={{ padding: 0, marginBottom: 14 }}>
              <div>
                <p className="n">Novo e-mail</p>
                <p className="s">Pra {aberta.nome}</p>
              </div>
              <span className="close" style={{ cursor: "pointer" }} onClick={fecharEmailModal}>
                Fechar ✕
              </span>
            </div>
            <div className="field" style={{ padding: "10px 0" }}>
              <label>Para</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="email"
                value={emailPara}
                onChange={(e) => setEmailPara(e.target.value)}
                placeholder="cliente@email.com"
              />
            </div>
            <div className="field" style={{ padding: "10px 0" }}>
              <label>Assunto</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="text"
                value={emailAssunto}
                onChange={(e) => setEmailAssunto(e.target.value)}
                placeholder="Ex.: Sobre sua consulta"
              />
            </div>
            <div className="field" style={{ padding: "10px 0" }}>
              <label>Mensagem</label>
              <div className="wa-email-toolbar">
                <button
                  type="button"
                  className="btn ghost"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    document.execCommand("bold");
                  }}
                >
                  <b>N</b>
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    document.execCommand("italic");
                  }}
                >
                  <i>I</i>
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    document.execCommand("underline");
                  }}
                >
                  <u>S</u>
                </button>
                <select
                  className="input"
                  style={{ width: "auto", cursor: "pointer" }}
                  defaultValue="3"
                  onChange={(e) => {
                    document.execCommand("fontSize", false, e.target.value);
                  }}
                >
                  <option value="2">Pequeno</option>
                  <option value="3">Médio</option>
                  <option value="5">Grande</option>
                </select>
              </div>
              <div
                ref={emailCorpoRef}
                className="input wa-email-corpo"
                contentEditable
                suppressContentEditableWarning
              />
            </div>
            <div className="section-foot">
              <button
                type="button"
                className="btn primary block"
                onClick={enviarEmail}
                disabled={!emailPara.trim() || !emailAssunto.trim()}
              >
                Disparar e-mail
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toasts.length > 0 ? (
        <div className="toast-stack">
          {toasts.map((toast) => (
            <div className="toast" key={toast.id}>
              <IconAutomacoes width={14} height={14} />
              {toast.texto}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
