"use client";

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { createPortal } from "react-dom";

import { classeOrigem, type NegocioCard } from "@/lib/data";
import { PainelConversa } from "@/components/conversas/PainelConversa";
import { HOJE_ISO } from "@/lib/agenda-context";
import { useAutomacoes } from "@/lib/automacoes-context";
import { useAutomationFlows } from "@/lib/automation-flow-context";
import { useFunis } from "@/lib/funis-context";
import { useContatos } from "@/lib/contatos-context";
import { useConversas } from "@/lib/conversas-context";
import { useEquipe } from "@/lib/equipe-context";
import { useFloatingPosition, type AnchorRect } from "@/lib/use-floating-position";
import { useMotivosPerda } from "@/lib/motivos-perda";
import { IconAutomacoes } from "@/components/icons";
import { IconConfiguracoes } from "@/components/icons";
import { ChipFilters, FloatingDropdown, Topbar } from "@/components/ui";
import { IconCheck, IconClose, IconErro } from "@/components/icons";
import { TransferirNegocio } from "@/components/funil/TransferirNegocio";
import { SeletorDeData } from "@/components/seletor-de-data";

const ORIGENS_NEGOCIO: NegocioCard["origem"][] = [
  "Instagram",
  "TikTok",
  "Meta Ads",
  "Google Ads",
  "Indicação",
];

/** Formata um telefone salvo cru (só dígitos, com DDI — ex.: "5562982041013") pra leitura —
 * "+55 62 98204-1013". Sem DDI reconhecido (não é BR, ou veio incompleto) devolve só com "+" na
 * frente, ainda melhor que uma sequência crua de números. */
function formatarTelefoneExibicao(numero: string | null | undefined): string | null {
  if (!numero) return null;
  const digitos = numero.replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13)) {
    const ddd = digitos.slice(2, 4);
    const resto = digitos.slice(4);
    const meio = resto.length === 9 ? resto.slice(0, 5) : resto.slice(0, 4);
    const fim = resto.length === 9 ? resto.slice(5) : resto.slice(4);
    return `+55 ${ddd} ${meio}-${fim}`;
  }
  return `+${digitos}`;
}

export default function FunilPage() {
  return (
    <Suspense fallback={null}>
      <FunilPageInner />
    </Suspense>
  );
}

function FunilPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    funis,
    setFunis,
    funilAtivoId,
    setFunilAtivoId,
    excluirFunil,
    atribuirContatoAoFunil,
    moverNegocio,
    criarFunilPersistido,
    criarEtapaPersistida,
    erroSincronizacao,
    limparErroSincronizacao,
  } = useFunis();
  const { automacoesDaEtapa, automacoesDeEntradaAtivas, excluirAutomacoesDaEtapa, excluirAutomacoesDoFunil } =
    useAutomacoes();
  const { dispararEvento } = useAutomationFlows();
  const { salvarDadosContato, atribuirAtendente, contatos } = useContatos();
  const { conversas } = useConversas();
  const { membros: equipe } = useEquipe();
  const motivosPerda = useMotivosPerda();
  const [configAberto, setConfigAberto] = useState(false);
  /** Negócio sendo transferido — a janela é a mesma usada no painel do funil e nas conversas. */
  const [transferindo, setTransferindo] = useState<{ id: string; nome: string; responsavel?: string } | null>(null);
  const [configAnchorRect, setConfigAnchorRect] = useState<AnchorRect | null>(null);
  const { ref: configPopRef, posicao: configPos } = useFloatingPosition(configAnchorRect, configAberto, 8, () => setConfigAberto(false));
  const [toasts, setToasts] = useState<{ id: string; texto: string }[]>([]);
  const proximoToastId = useRef(0);

  /** Popup de resposta rápida — lê/grava na MESMA conversa que o WhatsApp usa (ver
   * src/lib/mensagens-extra-context.tsx): Funil e WhatsApp falam com o mesmo contato, então uma
   * mensagem mandada de um lugar aparece no outro. */
  const [respostaRapidaContato, setRespostaRapidaContato] = useState<string | null>(null);

  const [importando, setImportando] = useState(false);

  /**
   * Traz pro funil as conversas que ainda não viraram negócio.
   *
   * Só quem escreve pela primeira vez entra no funil sozinho — o que é certo pro dia a dia (mandar
   * mensagem de novo não pode mexer na etapa em que o vendedor deixou a pessoa), mas deixa de fora
   * quem já era contato antes. Este botão é a porta de entrada em massa: quem começa com a caixa
   * cheia puxa tudo de uma vez, e quem perdeu cards recupera sem abrir conversa por conversa.
   */
  async function importarConversas() {
    setImportando(true);
    try {
      const resposta = await fetch("/api/funis/importar-conversas", { method: "POST" });
      const dados = (await resposta.json()) as { criados?: number; erro?: string };
      if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível trazer as conversas.");
      avisarAutomacao(
        dados.criados
          ? `${dados.criados} ${dados.criados === 1 ? "conversa trazida" : "conversas trazidas"} pro funil.`
          : "Todas as conversas já estão no funil.",
      );
      // Recarrega do servidor — os cards novos foram criados lá, não aqui; sem isso a tela só
      // mostraria a mudança no próximo F5.
      const atualizados = await fetch("/api/funis").then((r) => r.json());
      setFunis(atualizados);
    } catch (erro) {
      avisarAutomacao(erro instanceof Error ? erro.message : "Não foi possível trazer as conversas.");
    } finally {
      setImportando(false);
    }
  }

  function abrirRespostaRapida(nomeContato: string) {
    setRespostaRapidaContato(nomeContato);
  }


  const conversaDoContatoRapido = respostaRapidaContato
    ? conversas.find((c) => c.nome === respostaRapidaContato)
    : undefined;
  const iniciaisContatoRapido =
    conversaDoContatoRapido?.initials ??
    (respostaRapidaContato
      ? respostaRapidaContato
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((p) => p[0]?.toUpperCase())
          .join("")
      : "");

  function avisarAutomacao(texto: string) {
    const id = `toast-${proximoToastId.current++}`;
    setToasts((prev) => [...prev, { id, texto }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }

  const [novoFunilAberto, setNovoFunilAberto] = useState(false);
  const [atendenteNovoFunil, setAtendenteNovoFunil] = useState(
    equipe[0]?.nome ?? "",
  );
  const [novoNegocioAberto, setNovoNegocioAberto] = useState(
    () => searchParams.get("criarNegocio") === "1",
  );
  const [nomeNegocio, setNomeNegocio] = useState("");
  const [valorNegocio, setValorNegocio] = useState("");
  const [origemNegocio, setOrigemNegocio] = useState<NegocioCard["origem"]>(
    ORIGENS_NEGOCIO[0],
  );
  const [origensFiltro, setOrigensFiltro] = useState<Set<string>>(new Set());
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [arrastando, setArrastando] = useState<{
    coluna: number;
    card: number;
  } | null>(null);
  const [novaEtapaAberta, setNovaEtapaAberta] = useState(false);
  const [nomeNovaEtapa, setNomeNovaEtapa] = useState("");
  const [colunaRenomeando, setColunaRenomeando] = useState<number | null>(null);
  const [nomeRenomeando, setNomeRenomeando] = useState("");
  const [colunaArrastando, setColunaArrastando] = useState<number | null>(null);

  // Menu "Marcar como ganho/perdido" — abre por card (⋮), grava statusFechamento/motivoPerda/
  // dataFechamento de verdade no NegocioCard (persiste via o mesmo PUT /api/funis que já sincroniza
  // o resto do kanban).
  const [desfechoMenu, setDesfechoMenu] = useState<{ coluna: number; card: number; rect: DOMRect } | null>(null);
  const [motivoEscolhido, setMotivoEscolhido] = useState("");

  const funilAtivo = funis.find((f) => f.id === funilAtivoId) ?? funis[0];

  function marcarDesfecho(coluna: number, card: number, statusFechamento: "ganho" | "perdido", motivoPerda?: string) {
    if (!funilAtivo) return;
    setFunis((prev) =>
      prev.map((f) => {
        if (f.id !== funilAtivo.id) return f;
        const colunas = f.colunas.map((c, i) => {
          if (i !== coluna) return c;
          return {
            ...c,
            cards: c.cards.map((cd, j) =>
              j !== card
                ? cd
                : { ...cd, statusFechamento, motivoPerda: motivoPerda ?? null, dataFechamento: HOJE_ISO },
            ),
          };
        });
        return { ...f, colunas };
      }),
    );
    setDesfechoMenu(null);
    setMotivoEscolhido("");
  }

  function reabrirNegocio(coluna: number, card: number) {
    if (!funilAtivo) return;
    setFunis((prev) =>
      prev.map((f) => {
        if (f.id !== funilAtivo.id) return f;
        const colunas = f.colunas.map((c, i) => {
          if (i !== coluna) return c;
          return {
            ...c,
            cards: c.cards.map((cd, j) =>
              j !== card ? cd : { ...cd, statusFechamento: null, motivoPerda: null, dataFechamento: null },
            ),
          };
        });
        return { ...f, colunas };
      }),
    );
    setDesfechoMenu(null);
  }

  function passaNoFiltro(card: { origem: string; data: string }) {
    if (origensFiltro.size > 0 && !origensFiltro.has(card.origem)) {
      return false;
    }
    if (dataDe && card.data < dataDe) return false;
    if (dataAte && card.data > dataAte) return false;
    return true;
  }

  function alternarOrigemFiltro(origem: string) {
    setOrigensFiltro((prev) => {
      const next = new Set(prev);
      if (next.has(origem)) next.delete(origem);
      else next.add(origem);
      return next;
    });
  }

  const filtroAtivo = origensFiltro.size > 0 || dataDe !== "" || dataAte !== "";

  const totalVisivel =
    funilAtivo?.colunas.reduce((soma, coluna) => {
      const cards = filtroAtivo
        ? coluna.cards.filter(passaNoFiltro)
        : coluna.cards;
      return soma + (filtroAtivo ? cards.length : coluna.total);
    }, 0) ?? 0;

  function criarFunil() {
    const responsavel = atendenteNovoFunil.trim();
    if (!responsavel) return;
    const carimbo = Date.now();
    const novo = {
      id: `funil-${carimbo}`,
      nome: `Funil - ${responsavel}`,
      responsavel,
      colunas: [
        { id: `novo-${carimbo}`, titulo: "Novo", total: 0, cards: [] },
        { id: `qualificado-${carimbo}`, titulo: "Qualificado", total: 0, cards: [] },
        { id: `proposta-${carimbo}`, titulo: "Proposta", total: 0, cards: [] },
        { id: `fechado-${carimbo}`, titulo: "Fechado", total: 0, cards: [] },
      ],
    };
    void criarFunilPersistido(novo).then(({ ok }) => {
      if (!ok) return;
      setFunilAtivoId(novo.id);
      setAtendenteNovoFunil(equipe[0]?.nome ?? "");
      setNovoFunilAberto(false);
    });
  }

  function criarNegocio() {
    const nome = nomeNegocio.trim();
    if (!nome || !funilAtivo) return;
    const novoCard: NegocioCard = {
      id: `negocio-${Date.now()}`,
      nome,
      valor: valorNegocio.trim() || "—",
      origem: origemNegocio,
      dias: "Hoje",
      data: HOJE_ISO,
    };
    setFunis((prev) =>
      prev.map((f) => {
        if (f.id !== funilAtivo.id) return f;
        const colunas = f.colunas.map((c) => ({ ...c, cards: [...c.cards] }));
        colunas[0].cards.push(novoCard);
        colunas[0].total += 1;
        return { ...f, colunas };
      }),
    );
    setNomeNegocio("");
    setValorNegocio("");
    setOrigemNegocio(ORIGENS_NEGOCIO[0]);
    setNovoNegocioAberto(false);
  }

  function moverCard(colunaDestino: number) {
    if (!arrastando || !funilAtivo) return;
    const { coluna: colunaOrigem, card: indiceCard } = arrastando;
    setArrastando(null);
    if (colunaOrigem === colunaDestino) return;

    const cardMovido = funilAtivo.colunas[colunaOrigem]?.cards[indiceCard];
    const etapaDestino = funilAtivo.colunas[colunaDestino];

    setFunis((prev) =>
      prev.map((f) => {
        if (f.id !== funilAtivo.id) return f;
        const colunas = f.colunas.map((c) => ({ ...c, cards: [...c.cards] }));
        const [card] = colunas[colunaOrigem].cards.splice(indiceCard, 1);
        if (!card) return f;
        colunas[colunaOrigem].total = Math.max(0, colunas[colunaOrigem].total - 1);
        colunas[colunaDestino].cards.push(card);
        colunas[colunaDestino].total += 1;
        return { ...f, colunas };
      }),
    );

    if (cardMovido && etapaDestino) {
      // Grava na hora e CONFERE o resultado. Antes a chamada era disparada e esquecida: se o banco
      // recusasse, o card ficava na etapa nova só na tela e voltava no F5 seguinte — sem erro em
      // lugar nenhum. Agora, se a gravação falhar, `moverNegocio` relê o funil do banco e a tela
      // volta ao que realmente está salvo.
      void moverNegocio({ cardId: cardMovido.id, etapaId: etapaDestino.id });

      const disparadas = automacoesDeEntradaAtivas(funilAtivo.id, etapaDestino.id);
      for (const automacao of disparadas) {
        avisarAutomacao(
          `Automação "${automacao.titulo}" disparada pra ${cardMovido.nome} (entrou em "${etapaDestino.titulo}")`,
        );
      }

      // Motor de fluxos de verdade — roda em cima do mesmo evento, mas com
      // ações reais (tags/etapa/responsável mutam funis/contatos via ligações,
      // não só um toast). Não é recursivo: `moverEtapa`/`salvarContato` abaixo
      // só chamam `atribuirContatoAoFunil`/`salvarDadosContato`, nunca `dispararEvento` de novo.
      dispararEvento(
        {
          tipo: "lead_entrou_etapa",
          funilId: funilAtivo.id,
          etapaId: etapaDestino.id,
          contatoNome: cardMovido.nome,
        },
        {
          contato: {
            nome: cardMovido.nome,
            etiquetas: cardMovido.etiquetas ?? [],
            origem: cardMovido.origem,
            funilId: funilAtivo.id,
            etapaTitulo: etapaDestino.titulo,
          },
        },
        {
          moverEtapa: (funilId, etapaTitulo, contato) =>
            atribuirContatoAoFunil(funilId, etapaTitulo, contato as Omit<NegocioCard, "id"> & { id?: string }),
          salvarContato: (nome, dados) => salvarDadosContato(nome, dados),
          atribuirAtendente: (nome, atendente) => atribuirAtendente(nome, atendente),
          registrarMensagemSimulada: (info) =>
            avisarAutomacao(`Mensagem (${info.canal}) simulada: "${info.conteudo}"`),
          registrarWebhookSimulado: (info) => avisarAutomacao(`Webhook simulado → ${info.url}`),
        },
      );
    }
  }

  async function criarEtapa() {
    const titulo = nomeNovaEtapa.trim();
    if (!titulo || !funilAtivo) return;
    // Grava ANTES de aparecer na tela. Antes a etapa entrava no estado e dependia do sync geral do
    // funil pra ser salva — quando aquele sync falhava, ela sumia no F5 sem nenhum aviso.
    const { ok } = await criarEtapaPersistida(funilAtivo.id, { id: `etapa-${Date.now()}`, titulo });
    if (!ok) return;
    setNomeNovaEtapa("");
    setNovaEtapaAberta(false);
  }

  function renomearEtapa(colIndex: number) {
    const titulo = nomeRenomeando.trim();
    if (!titulo || !funilAtivo) {
      setColunaRenomeando(null);
      return;
    }
    setFunis((prev) =>
      prev.map((f) => {
        if (f.id !== funilAtivo.id) return f;
        const colunas = f.colunas.map((c, i) =>
          i === colIndex ? { ...c, titulo } : c,
        );
        return { ...f, colunas };
      }),
    );
    setColunaRenomeando(null);
  }

  function reordenarEtapa(origem: number, destino: number) {
    setColunaArrastando(null);
    if (!funilAtivo || origem === destino) return;
    setFunis((prev) =>
      prev.map((f) => {
        if (f.id !== funilAtivo.id) return f;
        const colunas = [...f.colunas];
        const [movida] = colunas.splice(origem, 1);
        if (!movida) return f;
        colunas.splice(destino, 0, movida);
        return { ...f, colunas };
      }),
    );
  }

  function excluirEtapa(colIndex: number) {
    if (!funilAtivo) return;
    const etapa = funilAtivo.colunas[colIndex];
    setFunis((prev) =>
      prev.map((f) => {
        if (f.id !== funilAtivo.id) return f;
        return { ...f, colunas: f.colunas.filter((_, i) => i !== colIndex) };
      }),
    );
    if (etapa) excluirAutomacoesDaEtapa(funilAtivo.id, etapa.id);
  }

  return (
    <>
      {/* Gravação recusada pelo banco. Aparece porque o pior comportamento possível aqui é a tela
          mostrar uma mudança que não existe: a pessoa arrasta o lead, vê ele na etapa nova, e só
          descobre no dia seguinte que ele nunca saiu do lugar. */}
      {transferindo ? (
        <TransferirNegocio
          cardId={transferindo.id}
          nomeDoNegocio={transferindo.nome}
          responsavelAtual={transferindo.responsavel}
          aoFechar={() => setTransferindo(null)}
        />
      ) : null}

      {erroSincronizacao ? (
        <div className="funil-erro-sync" role="alert">
          <span>{erroSincronizacao}</span>
          <button type="button" onClick={limparErroSincronizacao} aria-label="Fechar aviso">
            ×
          </button>
        </div>
      ) : null}
      <Topbar
        title="Funil"
        sub={`${funilAtivo?.nome ?? ""} · ${totalVisivel} ${totalVisivel === 1 ? "negócio" : "negócios"} ${filtroAtivo ? (totalVisivel === 1 ? "encontrado" : "encontrados") : "no funil"}`}
        actions={
          <>
            {/* Ação de apoio — usada de vez em quando, não deve competir com criar funil/etapa. */}
            <button
              type="button"
              className="btn terciario"
              disabled={importando}
              title="Cria um negócio para cada conversa que ainda não tem um"
              onClick={() => void importarConversas()}
            >
              {importando ? "Trazendo…" : "+ Trazer conversas"}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setNovaEtapaAberta((v) => !v)}
            >
              {novaEtapaAberta ? "Cancelar" : "+ Criar nova etapa"}
            </button>
            {/* Ação principal da página. */}
            <button
              type="button"
              className="btn primary"
              onClick={() => setNovoFunilAberto((v) => !v)}
            >
              {novoFunilAberto ? "Cancelar" : "+ Novo funil"}
            </button>
            <button
              type="button"
              className={`btn ghost${filtroAberto || filtroAtivo ? " active" : ""}`}
              onClick={() => setFiltroAberto((v) => !v)}
            >
              {filtroAberto ? "Fechar filtro" : "+ Filtrar"}
            </button>
            {funilAtivo ? (
              <div className="dropdown-anchor">
                <button
                  type="button"
                  className="icon-btn subtle"
                  aria-label={`Configurações do funil ${funilAtivo.nome}`}
                  onClick={(e) => {
                    if (configAberto) {
                      setConfigAberto(false);
                    } else {
                      setConfigAnchorRect(e.currentTarget.getBoundingClientRect());
                      setConfigAberto(true);
                    }
                  }}
                >
                  <IconConfiguracoes width={14} height={14} />
                </button>
                {configAberto && configPos && typeof document !== "undefined"
                  ? createPortal(
                      <>
                        <div
                          onClick={() => setConfigAberto(false)}
                          style={{ position: "fixed", inset: 0, zIndex: 190 }}
                        />
                        <div
                          ref={configPopRef}
                          className="dropdown-pop"
                          style={{ position: "fixed", top: configPos.top, left: configPos.left, zIndex: 200 }}
                        >
                      <Link
                        href={`/automacoes?funil=${funilAtivo.id}`}
                        className="dropdown-item"
                        onClick={() => setConfigAberto(false)}
                      >
                        <span className="n">Ver automações desse funil</span>
                        <span className="r">
                          Abre o quadro de automações, uma por etapa
                        </span>
                      </Link>
                      <button
                        type="button"
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left" }}
                        disabled={funis.length <= 1}
                        onClick={() => {
                          if (funis.length <= 1) return;
                          if (
                            window.confirm(
                              `Excluir o funil "${funilAtivo.nome}"? Os negócios e as automações dele somem junto.`,
                            )
                          ) {
                            excluirFunil(funilAtivo.id);
                            excluirAutomacoesDoFunil(funilAtivo.id);
                          }
                          setConfigAberto(false);
                        }}
                      >
                        <span className="n">Excluir funil</span>
                        <span className="r">
                          {funis.length <= 1
                            ? "Precisa ter pelo menos um funil"
                            : "Remove esse funil e os negócios dele"}
                        </span>
                      </button>
                        </div>
                      </>,
                      document.body,
                    )
                  : null}
              </div>
            ) : null}
          </>
        }
      />

      <div className="content">
        {novaEtapaAberta ? (
          <section className="open-conv mb14">
            <div className="open-conv-h">
              <div>
                <p className="n">Nova etapa</p>
                <p className="s">
                  Entra como uma coluna nova no funil {funilAtivo?.nome}
                </p>
              </div>
              <span
                className="close"
                style={{ cursor: "pointer" }}
                onClick={() => setNovaEtapaAberta(false)}
              >
                Fechar <IconClose width={11} height={11} />
              </span>
            </div>
            <div className="field">
              <label>Nome da etapa</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="text"
                value={nomeNovaEtapa}
                onChange={(e) => setNomeNovaEtapa(e.target.value)}
                placeholder="Ex.: Retorno agendado"
                onKeyDown={(e) => {
                  if (e.key === "Enter") criarEtapa();
                }}
              />
            </div>
            <div className="section-foot">
              <button
                type="button"
                className="btn primary block"
                onClick={criarEtapa}
              >
                Criar etapa
              </button>
            </div>
          </section>
        ) : null}

        {novoFunilAberto ? (
          <section className="open-conv mb14">
            <div className="open-conv-h">
              <div>
                <p className="n">Novo funil</p>
                <p className="s">
                  Cada funil pertence a um atendente — as mensagens e tarefas
                  atribuídas a ele entram nesse funil. Já sai com o modelo
                  pronto: Novo, Qualificado, Proposta, Fechado.
                </p>
              </div>
              <span
                className="close"
                style={{ cursor: "pointer" }}
                onClick={() => setNovoFunilAberto(false)}
              >
                Fechar <IconClose width={11} height={11} />
              </span>
            </div>
            <div className="field">
              <label>Atendente responsável</label>
              <select
                className="input"
                style={{ width: "100%", cursor: "pointer" }}
                value={atendenteNovoFunil}
                onChange={(e) => setAtendenteNovoFunil(e.target.value)}
              >
                {equipe.map((m) => (
                  <option key={m.id} value={m.nome}>
                    {m.nome}
                  </option>
                ))}
              </select>
              <p className="hint" style={{ marginTop: 6 }}>
                Nome do funil: <strong>Funil - {atendenteNovoFunil}</strong>
              </p>
            </div>
            <div className="section-foot">
              <button
                type="button"
                className="btn primary block"
                onClick={criarFunil}
              >
                Criar funil
              </button>
            </div>
          </section>
        ) : null}

        {novoNegocioAberto ? (
          <section className="open-conv mb14">
            <div className="open-conv-h">
              <div>
                <p className="n">Criar negociação</p>
                <p className="s">
                  Entra na etapa &quot;{funilAtivo?.colunas[0]?.titulo}&quot; do
                  funil {funilAtivo?.nome}
                </p>
              </div>
              <span
                className="close"
                style={{ cursor: "pointer" }}
                onClick={() => setNovoNegocioAberto(false)}
              >
                Fechar <IconClose width={11} height={11} />
              </span>
            </div>
            <div className="field">
              <label>Nome do contato</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="text"
                value={nomeNegocio}
                onChange={(e) => setNomeNegocio(e.target.value)}
                placeholder="Ex.: Marina Costa"
              />
            </div>
            <div className="field">
              <label>Valor (opcional)</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="text"
                value={valorNegocio}
                onChange={(e) => setValorNegocio(e.target.value)}
                placeholder="Ex.: R$ 890"
              />
            </div>
            <div className="field">
              <label>Origem</label>
              <ChipFilters
                options={ORIGENS_NEGOCIO}
                initial={ORIGENS_NEGOCIO.indexOf(origemNegocio)}
                onChange={(o) => setOrigemNegocio(o as NegocioCard["origem"])}
              />
            </div>
            <div className="section-foot">
              <button
                type="button"
                className="btn primary block"
                onClick={criarNegocio}
              >
                Criar negociação
              </button>
            </div>
          </section>
        ) : null}

        {filtroAberto ? (
          <section className="card mb14">
            <div className="panel-h">
              <h4>Filtrar — qual origem e qual período</h4>
            </div>
            <div className="field">
              <label>Origem do lead — pode escolher mais de uma</label>
              <div className="filters-row">
                <button
                  type="button"
                  className={`fchip${origensFiltro.size === 0 ? " active" : ""}`}
                  aria-pressed={origensFiltro.size === 0}
                  onClick={() => setOrigensFiltro(new Set())}
                >
                  Todas as origens
                </button>
                {ORIGENS_NEGOCIO.map((origem) => (
                  <button
                    type="button"
                    key={origem}
                    className={`fchip${origensFiltro.has(origem) ? " active" : ""}`}
                    aria-pressed={origensFiltro.has(origem)}
                    onClick={() => alternarOrigemFiltro(origem)}
                  >
                    {origem}
                  </button>
                ))}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 14,
                padding: "0 17px 14px",
                flexWrap: "wrap",
                alignItems: "flex-end",
              }}
            >
              <div className="field" style={{ padding: 0, flex: "1 1 160px" }}>
                <label>De</label>
                <SeletorDeData valor={dataDe} onChange={setDataDe} />
              </div>
              <div className="field" style={{ padding: 0, flex: "1 1 160px" }}>
                <label>Até</label>
                <SeletorDeData valor={dataAte} onChange={setDataAte} />
              </div>
              {filtroAtivo ? (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setOrigensFiltro(new Set());
                    setDataDe("");
                    setDataAte("");
                  }}
                >
                  Limpar filtros
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        <div className="kanban">
          {funilAtivo?.colunas.map((coluna, colIndex) => {
            const cardsComIndice = coluna.cards.map((card, cardIndex) => ({
              card,
              cardIndex,
            }));
            const cardsVisiveis = filtroAtivo
              ? cardsComIndice.filter(({ card }) => passaNoFiltro(card))
              : cardsComIndice;

            const automacoesEtapa = funilAtivo
              ? automacoesDaEtapa(funilAtivo.id, coluna.id)
              : [];

            return (
              <div
                key={coluna.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (colunaArrastando !== null) {
                    reordenarEtapa(colunaArrastando, colIndex);
                  } else {
                    moverCard(colIndex);
                  }
                }}
                style={{
                  minHeight: 60,
                  opacity: colunaArrastando === colIndex ? 0.5 : 1,
                }}
              >
                <div className="kcol-h">
                  <span
                    className="kcol-drag-handle"
                    draggable
                    onDragStart={() => setColunaArrastando(colIndex)}
                    onDragEnd={() => setColunaArrastando(null)}
                    title="Arraste pra reordenar a etapa"
                  >
                    ⠿
                  </span>
                  {colunaRenomeando === colIndex ? (
                    <input
                      className="input"
                      autoFocus
                      style={{ flex: 1, marginRight: 8 }}
                      value={nomeRenomeando}
                      onChange={(e) => setNomeRenomeando(e.target.value)}
                      onBlur={() => renomearEtapa(colIndex)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") renomearEtapa(colIndex);
                        if (e.key === "Escape") setColunaRenomeando(null);
                      }}
                    />
                  ) : (
                    <span
                      className="t"
                      style={{ cursor: "pointer" }}
                      title="Clique pra renomear"
                      onClick={() => {
                        setColunaRenomeando(colIndex);
                        setNomeRenomeando(coluna.titulo);
                      }}
                    >
                      <span className="dot" />
                      {coluna.titulo}
                    </span>
                  )}
                  <span style={{ display: "flex", alignItems: "center", gap: 6, flex: "0 0 auto" }}>
                    <span className="c">
                      {filtroAtivo ? cardsVisiveis.length : coluna.total}
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Excluir etapa ${coluna.titulo}`}
                      title="Excluir etapa"
                      style={{ cursor: "pointer", color: "var(--text-faint)" }}
                      onClick={() => excluirEtapa(colIndex)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          excluirEtapa(colIndex);
                        }
                      }}
                    >
                      <IconClose width={11} height={11} />
                    </span>
                  </span>
                </div>
                {funilAtivo ? (
                  <Link
                    href={`/automacoes?funil=${funilAtivo.id}&etapa=${coluna.id}${automacoesEtapa.length === 0 ? "&criar=1" : ""}`}
                    className="kcol-auto-link"
                    title="Ver/criar automações dessa etapa"
                  >
                    <IconAutomacoes width={12} height={12} />
                    {automacoesEtapa.length > 0
                      ? `${automacoesEtapa.length} ${automacoesEtapa.length > 1 ? "automações" : "automação"}`
                      : "+ Automação"}
                  </Link>
                ) : null}
                {cardsVisiveis.map(({ card, cardIndex }) => {
                  const conversaDoCard = conversas.find((c) => c.nome === card.nome);
                  const temMensagemNova = (conversaDoCard?.naoLidas ?? 0) > 0;
                  // "AD" — lead veio de anúncio (Meta/Google Ads), não de contato direto/indicação.
                  const veioDeAnuncio = card.origem === "Meta Ads" || card.origem === "Google Ads";
                  return (
                    <button
                      type="button"
                      className="lead-card"
                      key={card.id}
                      draggable
                      onDragStart={() =>
                        setArrastando({ coluna: colIndex, card: cardIndex })
                      }
                      onDragEnd={() => setArrastando(null)}
                      onDoubleClick={() =>
                        router.push(
                          `/conversas?contato=${encodeURIComponent(card.nome)}`,
                        )
                      }
                      title="Clique duas vezes pra abrir a conversa no WhatsApp"
                      style={{ cursor: "grab" }}
                    >
                      <span className="lr1">
                        <span
                          className="lname lname-com-msg"
                          title="Clique pra responder rapidinho"
                          draggable={false}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirRespostaRapida(card.nome);
                          }}
                        >
          {temMensagemNova ? <span className="msg-dot" aria-label="Mensagem nova" /> : null}
                          {(() => {
                            const contato = contatos.find((c) => c.nome === card.nome);
                            return contato?.fotoUrl ? (
                              <>
                                <img
                                  src={contato.fotoUrl}
                                  alt=""
                                  style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: "50%",
                                    marginRight: 6,
                                    objectFit: "cover",
                                    verticalAlign: "middle",
                                  }}
                                />
                                {card.nome}
                              </>
                            ) : (
                              card.nome
                            );
                          })()}
                          {veioDeAnuncio ? (
                            <span className="lead-card-ad-badge" title={card.origem}>
                              AD
                            </span>
                          ) : null}
                        </span>
                        <span className="lval">{card.valor}</span>
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label="Marcar desfecho do negócio"
                          title="Marcar como ganho/perdido"
                          className="lead-card-menu-btn"
                          draggable={false}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            setMotivoEscolhido("");
                            setDesfechoMenu({
                              coluna: colIndex,
                              card: cardIndex,
                              rect: e.currentTarget.getBoundingClientRect(),
                            });
                          }}
                        >
                          ⋮
                        </span>
                      </span>
                      {formatarTelefoneExibicao(conversaDoCard?.contato) ? (
                        <span className="lead-card-telefone">
                          {formatarTelefoneExibicao(conversaDoCard?.contato)}
                        </span>
                      ) : null}
                      <span className="lr2">
                        <span className={`tag ${classeOrigem(card.origem)}`}>
                          {card.origem}
                        </span>
                        <span className="days">{card.dias}</span>
                        {card.statusFechamento === "ganho" ? (
                          <span className="stage-tag won" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><IconCheck width={11} height={11} /> Ganho</span>
                        ) : card.statusFechamento === "perdido" ? (
                          <span className="stage-tag" title={card.motivoPerda ?? undefined} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <IconErro width={11} height={11} /> Perdido
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {desfechoMenu ? (
        <FloatingDropdown anchorRect={desfechoMenu.rect} onClose={() => setDesfechoMenu(null)} width={260}>
          {(() => {
            const cardAtual = funilAtivo?.colunas[desfechoMenu.coluna]?.cards[desfechoMenu.card];
            if (!cardAtual) return null;
            if (cardAtual.statusFechamento) {
              return (
                <div style={{ padding: 12 }}>
                  <p className="hint" style={{ margin: "0 0 10px" }}>
                    {cardAtual.statusFechamento === "ganho" ? "Marcado como ganho." : `Marcado como perdido${cardAtual.motivoPerda ? ` — ${cardAtual.motivoPerda}` : ""}.`}
                  </p>
                  <button
                    type="button"
                    className="btn ghost block"
                    onClick={() => reabrirNegocio(desfechoMenu.coluna, desfechoMenu.card)}
                  >
                    ↺ Reabrir negócio
                  </button>
                </div>
              );
            }
            return (
              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Transferir vem primeiro: mover o lead é o que se faz todo dia; marcar ganho ou
                    perdido acontece uma vez por negócio, no fim. */}
                <button
                  type="button"
                  className="btn ghost block"
                  onClick={() => {
                    setTransferindo({ id: cardAtual.id, nome: cardAtual.nome, responsavel: cardAtual.responsavel });
                    setDesfechoMenu(null);
                  }}
                >
                  Transferir de funil
                </button>
                <button
                  type="button"
                  className="btn primary block"
                  onClick={() => marcarDesfecho(desfechoMenu.coluna, desfechoMenu.card, "ganho")}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <IconCheck width={13} height={13} /> Marcar como ganho
                </button>
                <div className="field" style={{ margin: 0 }}>
                  <label>Motivo da perda</label>
                  <select className="input" value={motivoEscolhido} onChange={(e) => setMotivoEscolhido(e.target.value)}>
                    <option value="">Selecione…</option>
                    {motivosPerda.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn danger block"
                  disabled={!motivoEscolhido}
                  onClick={() => marcarDesfecho(desfechoMenu.coluna, desfechoMenu.card, "perdido", motivoEscolhido)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <IconErro width={13} height={13} /> Marcar como perdido
                </button>
              </div>
            );
          })()}
        </FloatingDropdown>
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

      {respostaRapidaContato ? (
        <PainelConversa
          contatoNome={respostaRapidaContato}
          canal={conversaDoContatoRapido?.canal}
          initials={iniciaisContatoRapido}
          etapaAtual={
            funilAtivo?.colunas.find((coluna) =>
              coluna.cards.some((card) => card.nome === respostaRapidaContato),
            )?.titulo
          }
          fotoUrl={conversaDoContatoRapido?.fotoUrl}
          aoFechar={() => setRespostaRapidaContato(null)}
        />
      ) : null}
    </>
  );
}
