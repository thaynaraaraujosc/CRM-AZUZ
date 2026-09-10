"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { createPortal } from "react-dom";

import { classeOrigem, type NegocioCard } from "@/lib/data";
import { HOJE_ISO } from "@/lib/agenda-context";
import { useAutomationFlows } from "@/lib/automation-flow-context";
import { useFunis } from "@/lib/funis-context";
import { useContatos } from "@/lib/contatos-context";
import { chaveDeContato } from "@/lib/contatos/chave-nome";
import { useConversas } from "@/lib/conversas-context";
import { rotuloDeAtividade } from "@/lib/funis/atividade";
import { VAZIO, ehVazio } from "@/lib/vazio";
import { useEquipe } from "@/lib/equipe-context";
import { useFloatingPosition, type AnchorRect } from "@/lib/use-floating-position";
import { useMotivosPerda } from "@/lib/motivos-perda";
import { IconAutomacoes } from "@/components/icons";
import { AutomacaoDoFunil } from "@/components/funil/AutomacaoDoFunil";
import { PainelConversa } from "@/components/conversas/PainelConversa";
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

/** Formata um telefone salvo cru (só dígitos, com DDI: ex.: "5562982041013") pra leitura:
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
  const searchParams = useSearchParams();
  const {
    funis,
    setFunis,
    funilAtivoId,
    setFunilAtivoId,
    excluirFunil,
    moverNegocio,
    criarFunilPersistido,
    criarEtapaPersistida,
    recarregar: recarregarFunis,
    erroSincronizacao,
    limparErroSincronizacao,
  } = useFunis();
  const { fluxos } = useAutomationFlows();
  const { contatos } = useContatos();
  const { conversas } = useConversas();

  /**
   * Última movimentação por contato: é o que o card mostra no canto e o que dá sentido ao botão
   * "Mensagens recentes no topo". Antes o card exibia `NegocioCard.dias`, uma string gravada como
   * "Hoje" quando ele nasceu e nunca mais tocada: o funil inteiro dizia "Hoje", inclusive card de
   * semanas atrás.
   */
  const atividadePorNome = useMemo(
    // `ultimaMensagemEm` e não `atualizadoEm`: o segundo sobe por qualquer escrita na conversa, e
    // uma importação de contatos encostava em todas de uma vez. Deixando o funil inteiro com cara
    // de recente.
    //
    // A chave é o nome NORMALIZADO (ver `chaveDeContato`), não o nome cru. O mesmo contato chega
    // com o nome escrito de jeitos diferentes conforme o caminho, e comparar texto com texto fazia
    // o card não achar a própria conversa: sem telefone, sem data, e a pessoa concluindo que a
    // mensagem não tinha chegado.
    () => new Map(conversas.map((c) => [chaveDeContato(c.nome), c.ultimaMensagemEm ?? null])),
    [conversas],
  );

  /** A conversa daquele negócio, achada pelo nome normalizado. Ver `atividadePorNome`. */
  const conversaPorNome = useMemo(
    () => new Map(conversas.map((c) => [chaveDeContato(c.nome), c])),
    [conversas],
  );
  const { membros: equipe } = useEquipe();
  const motivosPerda = useMotivosPerda();
  const [configAberto, setConfigAberto] = useState(false);
  /** Negócio sendo transferido: a janela é a mesma usada no painel do funil e nas conversas. */
  const [transferindo, setTransferindo] = useState<{ id: string; nome: string; responsavel?: string } | null>(null);
  const [configAnchorRect, setConfigAnchorRect] = useState<AnchorRect | null>(null);
  const { ref: configPopRef, posicao: configPos } = useFloatingPosition(configAnchorRect, configAberto, 8, () => setConfigAberto(false));
  const [toasts, setToasts] = useState<{ id: string; texto: string }[]>([]);
  const proximoToastId = useRef(0);

  /** Popup de resposta rápida: lê/grava na MESMA conversa que o WhatsApp usa (ver
   * src/lib/mensagens-extra-context.tsx): Funil e WhatsApp falam com o mesmo contato, então uma
   * mensagem mandada de um lugar aparece no outro. */

  const [importando, setImportando] = useState(false);
  const [reordenando, setReordenando] = useState(false);

  /**
   * Traz pro funil as conversas que ainda não viraram negócio.
   *
   * Só quem escreve pela primeira vez entra no funil sozinho. O que é certo pro dia a dia (mandar
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
      // Recarrega do servidor: os cards novos foram criados lá, não aqui; sem isso a tela só
      // mostraria a mudança no próximo F5. Por `recarregar` (e não `setFunis`) pra tela não
      // devolver num PUT o funil inteiro que o servidor acabou de escrever.
      await recarregarFunis();
    } catch (erro) {
      avisarAutomacao(erro instanceof Error ? erro.message : "Não foi possível trazer as conversas.");
    } finally {
      setImportando(false);
    }
  }

  /**
   * Correção de uma vez pro acúmulo antigo: até a mudança que passou a colocar lead novo no topo,
   * todo card entrava pelo FIM da coluna. Então quem chegou primeiro ficava em cima e o lead
   * recente ficava enterrado. Daqui pra frente o funil já nasce certo; este botão arruma o que
   * ficou pra trás, sem mudar card de etapa.
   */
  async function reordenarPorAtividade() {
    setReordenando(true);
    try {
      const resposta = await fetch("/api/funis/reordenar-por-atividade", { method: "POST" });
      const dados = (await resposta.json()) as { reordenados?: number; erro?: string };
      if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível reordenar.");
      avisarAutomacao(
        dados.reordenados
          ? `${dados.reordenados} ${dados.reordenados === 1 ? "card reordenado" : "cards reordenados"}: quem falou por último ficou no topo.`
          : "As colunas já estavam na ordem das mensagens mais recentes.",
      );
      await recarregarFunis();
    } catch (erro) {
      avisarAutomacao(erro instanceof Error ? erro.message : "Não foi possível reordenar.");
    } finally {
      setReordenando(false);
    }
  }



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
  const [modoAutomatizar, setModoAutomatizar] = useState(false);
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
  const kanbanRef = useRef<HTMLDivElement | null>(null);

  // Menu "Marcar como ganho/perdido": abre por card (⋮), grava statusFechamento/motivoPerda/
  // dataFechamento de verdade no NegocioCard (persiste via o mesmo PUT /api/funis que já sincroniza
  // o resto do kanban).
  /** Conversa aberta em popup, sem sair do funil. Ver o clique no card. */
  const [conversaAberta, setConversaAberta] = useState<string | null>(null);
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
      valor: valorNegocio.trim() || "-",
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
        // No TOPO, não no fim: espelha o que o servidor grava (ver /api/funis/mover). Sem isso a
        // tela mostraria o card embaixo até o próximo carregamento, e ele saltaria de lugar sozinho.
        colunas[colunaDestino].cards.unshift(card);
        colunas[colunaDestino].total += 1;
        return { ...f, colunas };
      }),
    );

    if (cardMovido && etapaDestino) {
      // Grava na hora e CONFERE o resultado. Antes a chamada era disparada e esquecida: se o banco
      // recusasse, o card ficava na etapa nova só na tela e voltava no F5 seguinte. Sem erro em
      // lugar nenhum. Agora, se a gravação falhar, `moverNegocio` relê o funil do banco e a tela
      // volta ao que realmente está salvo.
      void moverNegocio({ cardId: cardMovido.id, etapaId: etapaDestino.id });

      // O gatilho "entrou na etapa" NÃO roda mais aqui. Ele acontece no servidor, dentro de
      // `/api/funis/mover`: assim a automação vale pra qualquer caminho que mova o card
      // (importação, webhook, outra aba) e não só pra quem estava com esta tela aberta.
    }
  }

  async function criarEtapa() {
    const titulo = nomeNovaEtapa.trim();
    if (!titulo || !funilAtivo) return;
    // Grava ANTES de aparecer na tela. Antes a etapa entrava no estado e dependia do sync geral do
    // funil pra ser salva: quando aquele sync falhava, ela sumia no F5 sem nenhum aviso.
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

  /** Distância da borda em que o quadro começa a rolar, e o passo de cada quadro de animação. */
  const MARGEM_ROLAGEM = 90;
  const PASSO_ROLAGEM = 18;

  function rolarQuadroNaBorda(e: React.DragEvent<HTMLDivElement>) {
    const quadro = kanbanRef.current;
    if (!quadro) return;
    const caixa = quadro.getBoundingClientRect();
    const daEsquerda = e.clientX - caixa.left;
    const daDireita = caixa.right - e.clientX;
    if (daDireita < MARGEM_ROLAGEM) quadro.scrollLeft += PASSO_ROLAGEM;
    else if (daEsquerda < MARGEM_ROLAGEM) quadro.scrollLeft -= PASSO_ROLAGEM;
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
    setFunis((prev) =>
      prev.map((f) => {
        if (f.id !== funilAtivo.id) return f;
        return { ...f, colunas: f.colunas.filter((_, i) => i !== colIndex) };
      }),
    );
    // Os gatilhos da etapa somem junto pelo BANCO: `GatilhoEtapa.etapa` tem `onDelete: Cascade`.
    // Aqui havia uma chamada a `excluirAutomacoesDaEtapa`, do contexto de automações, que mexia
    // num array de exemplo em memória e não tocava em nada real. Parecia que limpava.
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
        title="Funil comercial"
        sub={`${funilAtivo?.nome ?? ""} · ${totalVisivel} ${totalVisivel === 1 ? "negócio" : "negócios"} ${filtroAtivo ? (totalVisivel === 1 ? "encontrado" : "encontrados") : "no funil"}`}
        actions={
          <>
            {/* Ação de apoio: usada de vez em quando, não deve competir com criar funil/etapa. */}
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
              className="btn terciario"
              disabled={reordenando}
              title="Coloca quem mandou mensagem mais recentemente no topo de cada coluna, sem mudar ninguém de etapa"
              onClick={() => void reordenarPorAtividade()}
            >
              {reordenando ? "Reordenando…" : "↑ Mensagens recentes no topo"}
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
            {/* Troca o quadro de negócios pelo quadro de AUTOMAÇÃO: as mesmas colunas, mostrando
                o que cada etapa dispara sozinha em vez dos cards. */}
            <button
              type="button"
              className={`btn ghost${modoAutomatizar ? " active" : ""}`}
              onClick={() => setModoAutomatizar((v) => !v)}
              title="Ver e configurar o que cada etapa dispara sozinha"
            >
              {modoAutomatizar ? "Ver negócios" : "Automatizar"}
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
                            // Etapas e gatilhos caem por cascade no banco (Funil → FunilEtapa →
                            // GatilhoEtapa), então o aviso acima é verdade. A chamada que existia
                            // aqui só limpava um array de exemplo no navegador.
                            excluirFunil(funilAtivo.id);
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
                  Cada funil pertence a um atendente. As mensagens e tarefas
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
              <h4>Filtrar: qual origem e qual período</h4>
            </div>
            <div className="field">
              <label>Origem do lead: pode escolher mais de uma</label>
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

        {modoAutomatizar && funilAtivo ? (
          <AutomacaoDoFunil
            funilId={funilAtivo.id}
            funilNome={funilAtivo.nome}
            colunas={funilAtivo.colunas.map((c) => ({ id: c.id, titulo: c.titulo, total: c.total }))}
            onFechar={() => setModoAutomatizar(false)}
          />
        ) : (
        <div
          className="kanban"
          ref={kanbanRef}
          /* O quadro rola na horizontal, e o arraste nativo do HTML não rola sozinho: a etapa (ou
             o card) que está fora da tela à direita era simplesmente inalcançável. Daí a sensação
             de que só dava pra arrastar pra esquerda. Perto de qualquer uma das bordas, o quadro
             passa a rolar enquanto o ponteiro estiver ali. */
          onDragOver={rolarQuadroNaBorda}
        >
          {funilAtivo?.colunas.map((coluna, colIndex) => {
            const cardsComIndice = coluna.cards.map((card, cardIndex) => ({
              card,
              cardIndex,
            }));
            const cardsVisiveis = filtroAtivo
              ? cardsComIndice.filter(({ card }) => passaNoFiltro(card))
              : cardsComIndice;

            // Conta os fluxos REAIS ligados a esta etapa. Antes vinha de um catálogo em memória que
            // nunca era gravado e nunca rodava. A etapa anunciava "2 automações" que não existiam.
            const automacoesEtapa = funilAtivo
              ? fluxos.filter(
                  (f) => f.funilId === funilAtivo.id && f.etapaId === coluna.id && f.status === "publicado" && !f.arquivada,
                )
              : [];

            return (
              <div
                key={coluna.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
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
                <div className="kcol-topo">
                  <div className="kcol-h">
                    <span
                      className="kcol-drag-handle"
                      draggable
                      onDragStart={(e) => {
                        setColunaArrastando(colIndex);
                        // O Safari só inicia um arraste se o `dataTransfer` receber algum dado.
                        // Sem isto o arraste até começa visualmente em alguns casos, mas o `drop`
                        // nunca chega ao destino: era por isso que reordenar etapa funcionava de
                        // um jeito e falhava de outro.
                        e.dataTransfer.setData("text/plain", String(colIndex));
                        e.dataTransfer.effectAllowed = "move";
                      }}
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
                      title={
                        automacoesEtapa.length > 0
                          ? "Ver as automações que rodam quando o lead entra nesta etapa"
                          : "Criar uma automação que roda quando o lead entrar nesta etapa"
                      }
                    >
                      <IconAutomacoes width={12} height={12} />
                      {automacoesEtapa.length > 0
                        ? `${automacoesEtapa.length} ${automacoesEtapa.length > 1 ? "automações" : "automação"}`
                        : "+ Quando entrar aqui…"}
                    </Link>
                  ) : null}
                </div>
                {/* Área de rolagem própria da etapa. Sem ela, uma etapa com 30 negócios
                    esticava a coluna e a PÁGINA inteira crescia junto: pra ver o topo da etapa
                    do lado era preciso subir a tela toda. Agora cada etapa rola por dentro e o
                    cabeçalho fica onde está. */}
                <div className="kcol-cards">
                  {cardsVisiveis.map(({ card, cardIndex }) => {
                    const conversaDoCard = conversaPorNome.get(chaveDeContato(card.nome));
                    const temMensagemNova = (conversaDoCard?.naoLidas ?? 0) > 0;
                    // "AD": lead veio de anúncio (Meta/Google Ads), não de contato direto/indicação.
                    const veioDeAnuncio = card.origem === "Meta Ads" || card.origem === "Google Ads";
                    return (
                      <button
                        type="button"
                        className="lead-card"
                        key={card.id}
                        draggable
                        onDragStart={(e) => {
                          setArrastando({ coluna: colIndex, card: cardIndex });
                          e.dataTransfer.setData("text/plain", card.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => setArrastando(null)}
                        // Um clique em QUALQUER ponto do card abre a conversa, aqui mesmo.
                        //
                        // Antes era clique duplo pra ir pra tela de Conversas, e só o nome abria o
                        // popup com um clique. O card inteiro parecia clicável, quase todo ele não
                        // era, e o gesto que funcionava não estava escrito em lugar nenhum.
                        //
                        // Abre o popup, e não a outra tela, porque o dia a dia é olhar o funil,
                        // atender e voltar a arrastar: trocar de tela a cada card quebra isso.
                        // Arrastar continua intacto, porque arrastar dispara `dragstart`, não
                        // `click`.
                        // Abre pelo nome da CONVERSA quando ela existe, não pelo nome do card. Os
                        // dois são a mesma pessoa mas nem sempre a mesma string, e as mensagens
                        // estão guardadas sob o nome da conversa: abrir pelo do card mostrava o
                        // popup vazio.
                        onClick={() => setConversaAberta(conversaDoCard?.nome ?? card.nome)}
                        title="Abrir a conversa deste lead"
                        style={{ cursor: "grab" }}
                      >
                        <span className="lr1">
                          {/* Sem clique próprio: o nome faz o mesmo que o resto do card, que é
                              abrir a conversa. Ter um comportamento no nome e outro dois
                              milímetros ao lado era a razão de ninguém achar a conversa. */}
                          <span className="lname lname-com-msg" draggable={false}>
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
                          <span className="lval">{ehVazio(card.valor) ? VAZIO : card.valor}</span>
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
                          {/* Só mostra data quando ela é REAL.
                              `card.data` é uma string gravada quando o negócio nasceu ("Hoje",
                              "Ontem") e nunca mais tocada: um card criado ontem seguia dizendo
                              "Ontem" pra sempre, e amanhã continuaria. Data errada é pior que data
                              nenhuma num lugar onde a pessoa decide a quem ligar primeiro. Quando a
                              conversa existe, a data vem da última mensagem e está sempre certa. */}
                          {atividadePorNome.get(chaveDeContato(card.nome)) ? (
                            <span className="days" title="Última mensagem deste contato">
                              {rotuloDeAtividade(atividadePorNome.get(chaveDeContato(card.nome)))}
                            </span>
                          ) : (
                            <span className="days" title="Ainda não há mensagem deste contato no CRM">
                              sem conversa
                            </span>
                          )}
                          {/* Diz o que o clique faz. Card clicável sem nada escrito é card que
                              ninguém clica. */}
                          <span className="lead-card-chat" aria-hidden="true">
                            chat
                          </span>
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
              </div>
            );
          })}
        </div>
        )}
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
                    {cardAtual.statusFechamento === "ganho" ? "Marcado como ganho." : `Marcado como perdido${cardAtual.motivoPerda ? `: ${cardAtual.motivoPerda}` : ""}.`}
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

      {conversaAberta ? (
        <PainelConversa
          contatoNome={conversaAberta}
          canal={conversaPorNome.get(chaveDeContato(conversaAberta))?.canal}
          initials={
            conversaPorNome.get(chaveDeContato(conversaAberta))?.initials ??
            conversaAberta
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase())
              .join("")
          }
          etapaAtual={
            funilAtivo?.colunas.find((coluna) =>
              coluna.cards.some((card) => chaveDeContato(card.nome) === chaveDeContato(conversaAberta)),
            )?.titulo
          }
          fotoUrl={
            conversaPorNome.get(chaveDeContato(conversaAberta))?.fotoUrl ??
            contatos.find((c) => chaveDeContato(c.nome) === chaveDeContato(conversaAberta))?.fotoUrl
          }
          aoFechar={() => setConversaAberta(null)}
        />
      ) : null}
    </>
  );
}
