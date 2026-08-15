"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";

import { useAutomationFlows } from "@/lib/automation-flow-context";
import { useFunis } from "@/lib/funis-context";
import { BLOCOS_DISPONIVEIS } from "@/lib/automation-flow/blocos";
import { resumoNo } from "@/lib/automation-flow/resumo";
import { useFloatingPosition, type AnchorRect } from "@/lib/use-floating-position";
import type {
  CanalMensagem,
  FlowNodeType,
  FluxoAutomacao,
  RegistroExecucao,
} from "@/lib/automation-flow/types";
import type { Funil } from "@/lib/data";
import { IconAutomacoes, IconClose, IconSearch } from "@/components/icons";
import { FloatingDropdown, Toggle, Topbar } from "@/components/ui";
import { VisualizarFluxo } from "@/components/automation-flow/VisualizarFluxo";

/* -------------------------------------------------------------------------- */
/* Derivações a partir de `FluxoAutomacao` / `RegistroExecucao`              */
/* -------------------------------------------------------------------------- */

function noGatilhoDoFluxo(fluxo: FluxoAutomacao) {
  return fluxo.nodes.find((n) => n.category === "gatilho");
}

function labelGatilho(tipo: FlowNodeType): string {
  return BLOCOS_DISPONIVEIS.find((b) => b.tipo === tipo)?.label ?? tipo;
}

/** "Lead entrou na etapa — Funil: x · Etapa: y" — rótulo do bloco + o resumo de uma linha que o próprio motor usa no canvas. */
function resumoGatilhoFluxo(fluxo: FluxoAutomacao, funis: Funil[]): string {
  const no = noGatilhoDoFluxo(fluxo);
  if (!no) return "Sem gatilho definido";
  const detalhe = resumoNo(no, funis);
  return detalhe && detalhe !== "Sem configuração adicional"
    ? `${labelGatilho(no.type)} — ${detalhe}`
    : labelGatilho(no.type);
}

/** Status pesquisáveis na barra de filtros — "com_erro" e "arquivada" são derivados/reais, não decorativos (ver `statusBate`). */
type StatusFiltro = "rascunho" | "publicado" | "ativa" | "pausada" | "com_erro" | "arquivada";

const STATUS_FILTROS: { valor: StatusFiltro; label: string }[] = [
  { valor: "rascunho", label: "Rascunho" },
  { valor: "publicado", label: "Publicado" },
  { valor: "ativa", label: "Ativa" },
  { valor: "pausada", label: "Pausada" },
  { valor: "com_erro", label: "Com erro" },
  { valor: "arquivada", label: "Arquivada" },
];

function temExecucaoComErro(fluxo: FluxoAutomacao, execucoesDoFluxo: (id: string) => RegistroExecucao[]): boolean {
  return execucoesDoFluxo(fluxo.id).some((e) => e.situacao === "erro");
}

function statusBate(
  fluxo: FluxoAutomacao,
  filtro: StatusFiltro,
  execucoesDoFluxo: (id: string) => RegistroExecucao[],
): boolean {
  switch (filtro) {
    case "rascunho":
      return fluxo.status === "rascunho";
    case "publicado":
      return fluxo.status === "publicado";
    case "ativa":
      return fluxo.status === "publicado" && fluxo.ativa && !fluxo.arquivada;
    case "pausada":
      return fluxo.status === "publicado" && !fluxo.ativa && !fluxo.arquivada;
    case "com_erro":
      return temExecucaoComErro(fluxo, execucoesDoFluxo);
    case "arquivada":
      return !!fluxo.arquivada;
    default:
      return true;
  }
}

/** A pill de "Arquivada" tem precedência sobre ativa/pausada — arquivar é um estado à parte. */
function statusPill(fluxo: FluxoAutomacao): { label: string; on: boolean } {
  if (fluxo.arquivada) return { label: "Arquivada", on: false };
  if (fluxo.status === "rascunho") return { label: "Rascunho", on: false };
  if (fluxo.ativa) return { label: "Ativa", on: true };
  return { label: "Pausada", on: false };
}

/**
 * "Mais recentes" cobre tanto a leitura de marketing quanto a técnica
 * (`atualizadoEm` desc) — a brief citava "Atualizadas recentemente" como um
 * rótulo possivelmente separado, mas como o comportamento seria idêntico a
 * "Mais recentes", optei por manter só uma opção canônica pra esse critério
 * em vez de duas entradas redundantes na lista.
 */
type Ordenacao =
  | "recentes"
  | "antigas"
  | "nome_az"
  | "nome_za"
  | "execucoes_desc"
  | "execucoes_asc"
  | "ativas_primeiro"
  | "erro_primeiro";

const ORDENACOES: { valor: Ordenacao; label: string }[] = [
  { valor: "recentes", label: "Mais recentes" },
  { valor: "antigas", label: "Mais antigas" },
  { valor: "nome_az", label: "Nome de A a Z" },
  { valor: "nome_za", label: "Nome de Z a A" },
  { valor: "execucoes_desc", label: "Mais executadas" },
  { valor: "execucoes_asc", label: "Menos executadas" },
  { valor: "ativas_primeiro", label: "Ativas primeiro" },
  { valor: "erro_primeiro", label: "Com erro primeiro" },
];

function taxaSucesso(execucoes: RegistroExecucao[]): string {
  if (execucoes.length === 0) return "—";
  const concluidas = execucoes.filter((e) => e.situacao === "concluida").length;
  return `${Math.round((concluidas / execucoes.length) * 100)}%`;
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function ultimaExecucao(execucoes: RegistroExecucao[]): string {
  if (execucoes.length === 0) return "Nunca executada";
  const maisRecente = Math.max(...execucoes.map((e) => new Date(e.iniciadoEm).getTime()));
  return formatarData(new Date(maisRecente).toISOString());
}

/** Tipos de gatilho "de comentário" — usados só pra dar um atalho de filtro sem precisar escolher canal por canal. */
const TIPOS_GATILHO_COMENTARIO: FlowNodeType[] = ["comentario_instagram", "comentario_tiktok"];

const CANAL_LABELS: Record<CanalMensagem, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  tiktok: "TikTok",
  email: "E-mail",
  interno: "Interno",
};

/** Só os canais que de fato aparecem em algum nó de mensagem — ou que o gatilho de comentário já escopa (Insta/TikTok) mesmo sem nó de mensagem. */
function canaisDoFluxo(fluxo: FluxoAutomacao): Set<CanalMensagem> {
  const canais = new Set<CanalMensagem>();
  fluxo.nodes.forEach((n) => {
    if (n.category === "mensagem") {
      const data = n.data as { canal?: unknown };
      if (data && typeof data.canal === "string") {
        canais.add(data.canal as CanalMensagem);
      }
    }
  });
  const gatilho = noGatilhoDoFluxo(fluxo);
  if (gatilho?.type === "comentario_instagram") canais.add("instagram");
  if (gatilho?.type === "comentario_tiktok") canais.add("tiktok");
  return canais;
}

/** Busca casa nome, descrição, nome do funil, título da etapa e rótulo do gatilho — não só o nome do fluxo. */
function fluxoBateBusca(
  fluxo: FluxoAutomacao,
  termo: string,
  funis: ReturnType<typeof useFunis>["funis"],
): boolean {
  if (!termo) return true;
  if (fluxo.nome.toLowerCase().includes(termo)) return true;
  if (fluxo.descricao?.toLowerCase().includes(termo)) return true;

  const funil = funis.find((f) => f.id === fluxo.funilId);
  if (funil?.nome.toLowerCase().includes(termo)) return true;

  const etapa = funil?.colunas.find((c) => c.id === fluxo.etapaId);
  if (etapa?.titulo.toLowerCase().includes(termo)) return true;

  const no = noGatilhoDoFluxo(fluxo);
  if (no && labelGatilho(no.type).toLowerCase().includes(termo)) return true;

  return false;
}

/** Alterna um valor dentro de um Set guardado em estado (imutável). */
function alternarNoSet<T>(setEstado: Dispatch<SetStateAction<Set<T>>>, valor: T) {
  setEstado((prev) => {
    const next = new Set(prev);
    if (next.has(valor)) next.delete(valor);
    else next.add(valor);
    return next;
  });
}

const CHAVE_LOCALSTORAGE_FILTROS_ABERTOS = "automacoes:filtros-abertos";

/** Acima desse número de funis, mostra um campinho de busca dentro do popover pra não rolar uma lista gigante de chips. */
const LIMITE_FUNIS_PARA_BUSCA = 6;

/* -------------------------------------------------------------------------- */

export default function AutomacoesPage() {
  return (
    <Suspense fallback={null}>
      <AutomacoesPageInner />
    </Suspense>
  );
}

function AutomacoesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { funis } = useFunis();
  const {
    fluxos,
    execucoesDoFluxo,
    criarFluxo,
    duplicarFluxo,
    atualizarFluxo,
    arquivarFluxo,
    desarquivarFluxo,
    excluirFluxo,
    alternarAtivo,
  } = useAutomationFlows();

  const funilParam = searchParams.get("funil");
  const etapaParam = searchParams.get("etapa");
  const criarParam = searchParams.get("criar") === "1";

  useEffect(() => {
    if (criarParam) router.replace("/automacoes/editor/novo");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criarParam]);

  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<Set<StatusFiltro>>(new Set());
  const [funilFiltroIds, setFunilFiltroIds] = useState<Set<string>>(
    () => new Set(funilParam ? [funilParam] : []),
  );
  const [etapaFiltroIds, setEtapaFiltroIds] = useState<Set<string>>(
    () => new Set(etapaParam ? [etapaParam] : []),
  );
  const [gatilhoFiltro, setGatilhoFiltro] = useState<Set<string>>(new Set());
  const [canalFiltro, setCanalFiltro] = useState<Set<CanalMensagem>>(new Set());
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("recentes");
  const [buscaFunilPopover, setBuscaFunilPopover] = useState("");

  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  // Preferência secundária: mantém o popover de filtros aberto entre interações, persistida
  // por sessão/reload via localStorage. Lazy init guardado por `typeof window` porque
  // este componente é "use client" mas ainda passa por uma renderização inicial no servidor.
  const [manterFiltrosAbertos, setManterFiltrosAbertos] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(CHAVE_LOCALSTORAGE_FILTROS_ABERTOS) === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CHAVE_LOCALSTORAGE_FILTROS_ABERTOS, manterFiltrosAbertos ? "1" : "0");
  }, [manterFiltrosAbertos]);

  const filtrosPopoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!filtrosAbertos) return;
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setFiltrosAbertos(false);
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [filtrosAbertos]);

  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const [renomeandoId, setRenomeandoId] = useState<string | null>(null);
  const [renomeandoValor, setRenomeandoValor] = useState("");
  const [exclusaoAlvo, setExclusaoAlvo] = useState<FluxoAutomacao | null>(null);
  const [visualizarAlvo, setVisualizarAlvo] = useState<FluxoAutomacao | null>(null);
  const [ativarDemoAlvo, setAtivarDemoAlvo] = useState<FluxoAutomacao | null>(null);
  // O `Toggle` é não-controlado (flipa o próprio estado visual no clique antes
  // de qualquer confirmação) — incrementar esse nonce força o `key` do Toggle
  // a mudar e ele remontar de volta pro `defaultOn` real sempre que a gente
  // intercepta o clique pra mostrar a confirmação (aceita ou cancela).
  const [demoToggleResetNonce, setDemoToggleResetNonce] = useState(0);

  /* --------------------- "+ Nova automação" — popover ------------------- */
  const [novoAberto, setNovoAberto] = useState(false);
  const [novoAnchorRect, setNovoAnchorRect] = useState<AnchorRect | null>(null);
  const { ref: novoPopoverRef, posicao: novoPosicao } = useFloatingPosition(novoAnchorRect, novoAberto, 8, () => setNovoAberto(false));
  const [novoModoModelo, setNovoModoModelo] = useState(false);
  const [novoCarregando, setNovoCarregando] = useState(false);
  const [novoErro, setNovoErro] = useState<string | null>(null);

  const modelosDisponiveis = useMemo(
    () => fluxos.filter((f) => f.modeloDemonstracao),
    [fluxos],
  );

  function fecharPopoverNovo() {
    setNovoAberto(false);
    setNovoModoModelo(false);
    setNovoErro(null);
  }

  function comecarDoZero() {
    if (novoCarregando) return; // trava contra duplo clique
    setNovoErro(null);
    setNovoCarregando(true);
    try {
      const novo = criarFluxo({ nome: "Nova automação" });
      router.push(`/automacoes/editor/${novo.id}`);
      fecharPopoverNovo();
    } catch {
      setNovoErro("Não foi possível abrir o construtor agora. Tente novamente.");
    } finally {
      setNovoCarregando(false);
    }
  }

  function usarModelo(fluxo: FluxoAutomacao) {
    if (novoCarregando) return;
    setNovoErro(null);
    setNovoCarregando(true);
    try {
      const copia = duplicarFluxo(fluxo.id);
      if (!copia) throw new Error("Modelo não encontrado.");
      router.push(`/automacoes/editor/${copia.id}`);
      fecharPopoverNovo();
    } catch {
      setNovoErro("Não foi possível criar uma cópia desse modelo agora. Tente novamente.");
    } finally {
      setNovoCarregando(false);
    }
  }

  const gatilhosDisponiveis = useMemo(() => {
    const tipos = new Set<FlowNodeType>();
    fluxos.forEach((f) => {
      const no = noGatilhoDoFluxo(f);
      if (no) tipos.add(no.type);
    });
    return [...tipos]
      .map((tipo) => ({ tipo, label: labelGatilho(tipo) }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [fluxos]);

  const canaisDisponiveis = useMemo(() => {
    const canais = new Set<CanalMensagem>();
    fluxos.forEach((f) => canaisDoFluxo(f).forEach((c) => canais.add(c)));
    return [...canais].sort((a, b) => CANAL_LABELS[a].localeCompare(CANAL_LABELS[b], "pt-BR"));
  }, [fluxos]);

  /** Funis a considerar pras etapas do popover: os selecionados, ou todos se nenhum estiver selecionado (nunca fica "sem opções"). */
  const funisParaEtapas = useMemo(
    () => (funilFiltroIds.size > 0 ? funis.filter((f) => funilFiltroIds.has(f.id)) : funis),
    [funis, funilFiltroIds],
  );

  const funisFiltradosPopover = useMemo(() => {
    const termo = buscaFunilPopover.trim().toLowerCase();
    if (!termo) return funis;
    return funis.filter((f) => f.nome.toLowerCase().includes(termo));
  }, [funis, buscaFunilPopover]);

  const totalFiltrosAtivos =
    statusFiltro.size + funilFiltroIds.size + etapaFiltroIds.size + gatilhoFiltro.size + canalFiltro.size;
  const temAlgumFiltroOuBusca = totalFiltrosAtivos > 0 || busca.trim() !== "";

  function fecharPopoverSeNaoQuiserManter() {
    if (!manterFiltrosAbertos) setFiltrosAbertos(false);
  }

  function limparBuscaEFiltros() {
    setBusca("");
    setStatusFiltro(new Set());
    setFunilFiltroIds(new Set());
    setEtapaFiltroIds(new Set());
    setGatilhoFiltro(new Set());
    setCanalFiltro(new Set());
  }

  // "Limpar filtros" dentro do popover só reseta os facets do próprio popover — a busca
  // (que já mora fora do popover, na barra compacta) fica intacta. O botão "Limpar" da
  // barra compacta é que limpa tudo junto (busca + filtros), via `limparBuscaEFiltros`.
  function limparFacetsDoPopover() {
    setStatusFiltro(new Set());
    setFunilFiltroIds(new Set());
    setEtapaFiltroIds(new Set());
    setGatilhoFiltro(new Set());
    setCanalFiltro(new Set());
  }

  const fluxosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    let lista = fluxos.filter((f) => {
      // Arquivadas ficam fora da lista por padrão — só aparecem quando o chip
      // "Arquivada" é explicitamente selecionado (mesmo espírito de "Excluir": some da visão).
      if (f.arquivada && !statusFiltro.has("arquivada")) return false;

      if (!fluxoBateBusca(f, termo, funis)) return false;

      if (statusFiltro.size > 0 && ![...statusFiltro].some((s) => statusBate(f, s, execucoesDoFluxo))) {
        return false;
      }

      if (funilFiltroIds.size > 0 && !(f.funilId && funilFiltroIds.has(f.funilId))) return false;
      if (etapaFiltroIds.size > 0 && !(f.etapaId && etapaFiltroIds.has(f.etapaId))) return false;

      if (gatilhoFiltro.size > 0) {
        const no = noGatilhoDoFluxo(f);
        const bateGatilho = [...gatilhoFiltro].some((g) => {
          if (g === "__comentario__") return !!no && TIPOS_GATILHO_COMENTARIO.includes(no.type);
          return !!no && no.type === g;
        });
        if (!bateGatilho) return false;
      }

      if (canalFiltro.size > 0) {
        const canais = canaisDoFluxo(f);
        const bateCanal = [...canalFiltro].some((c) => canais.has(c));
        if (!bateCanal) return false;
      }

      return true;
    });

    lista = [...lista].sort((a, b) => {
      switch (ordenacao) {
        case "nome_az":
          return a.nome.localeCompare(b.nome, "pt-BR");
        case "nome_za":
          return b.nome.localeCompare(a.nome, "pt-BR");
        case "execucoes_desc":
          return b.execucoes - a.execucoes;
        case "execucoes_asc":
          return a.execucoes - b.execucoes;
        case "antigas":
          return new Date(a.atualizadoEm).getTime() - new Date(b.atualizadoEm).getTime();
        case "ativas_primeiro": {
          const aAtiva = a.status === "publicado" && a.ativa && !a.arquivada;
          const bAtiva = b.status === "publicado" && b.ativa && !b.arquivada;
          if (aAtiva !== bAtiva) return aAtiva ? -1 : 1;
          return new Date(b.atualizadoEm).getTime() - new Date(a.atualizadoEm).getTime();
        }
        case "erro_primeiro": {
          const aErro = temExecucaoComErro(a, execucoesDoFluxo);
          const bErro = temExecucaoComErro(b, execucoesDoFluxo);
          if (aErro !== bErro) return aErro ? -1 : 1;
          return new Date(b.atualizadoEm).getTime() - new Date(a.atualizadoEm).getTime();
        }
        case "recentes":
        default:
          return new Date(b.atualizadoEm).getTime() - new Date(a.atualizadoEm).getTime();
      }
    });

    return lista;
  }, [fluxos, busca, statusFiltro, funilFiltroIds, etapaFiltroIds, gatilhoFiltro, canalFiltro, ordenacao, execucoesDoFluxo, funis]);

  const totalAtivas = fluxos.filter((f) => f.status === "publicado" && f.ativa && !f.arquivada).length;

  function abrirMenu(id: string, rect: DOMRect) {
    setMenuAbertoId((atual) => (atual === id ? null : id));
    setMenuRect(rect);
  }

  function iniciarRenomeacao(fluxo: FluxoAutomacao) {
    setRenomeandoId(fluxo.id);
    setRenomeandoValor(fluxo.nome);
    setMenuAbertoId(null);
  }

  function confirmarRenomeacao() {
    if (!renomeandoId) return;
    const nome = renomeandoValor.trim();
    if (nome) atualizarFluxo(renomeandoId, { nome });
    setRenomeandoId(null);
  }

  function pedirExclusao(fluxo: FluxoAutomacao) {
    setExclusaoAlvo(fluxo);
    setMenuAbertoId(null);
  }

  function confirmarExclusao() {
    if (!exclusaoAlvo) return;
    excluirFluxo(exclusaoAlvo.id);
    setExclusaoAlvo(null);
  }

  function verExecucoes(fluxo: FluxoAutomacao) {
    // Ainda não existe uma UI dedicada de histórico de execuções (o `HistoricoVersoes.tsx`
    // do editor cobre versões, não execuções) — enquanto isso não existe, o atalho mais
    // honesto é abrir o construtor (que tem o Simulador) e deixar um rastro no console
    // pra quem for construir a tela de verdade depois.
    console.log(`Ver execuções de "${fluxo.nome}":`, execucoesDoFluxo(fluxo.id));
    setMenuAbertoId(null);
    router.push(`/automacoes/editor/${fluxo.id}`);
  }

  /* ---------------------------------------------------------------------- */
  /* Chips removíveis da linha "filtros ativos"                             */
  /* ---------------------------------------------------------------------- */

  type ChipAtivo = { chave: string; label: string; onRemove: () => void };

  const chipsAtivos: ChipAtivo[] = useMemo(() => {
    const chips: ChipAtivo[] = [];

    STATUS_FILTROS.forEach((s) => {
      if (statusFiltro.has(s.valor)) {
        chips.push({
          chave: `status-${s.valor}`,
          label: s.label,
          onRemove: () => alternarNoSet(setStatusFiltro, s.valor),
        });
      }
    });

    funis.forEach((f) => {
      if (funilFiltroIds.has(f.id)) {
        chips.push({
          chave: `funil-${f.id}`,
          label: `Funil: ${f.nome}`,
          onRemove: () => alternarNoSet(setFunilFiltroIds, f.id),
        });
      }
    });

    funis.forEach((f) => {
      f.colunas.forEach((c) => {
        if (etapaFiltroIds.has(c.id)) {
          chips.push({
            chave: `etapa-${c.id}`,
            label: `Etapa: ${c.titulo}`,
            onRemove: () => alternarNoSet(setEtapaFiltroIds, c.id),
          });
        }
      });
    });

    if (gatilhoFiltro.has("__comentario__")) {
      chips.push({
        chave: "gatilho-__comentario__",
        label: "Comentário (Insta/TikTok)",
        onRemove: () => alternarNoSet<string>(setGatilhoFiltro, "__comentario__"),
      });
    }
    gatilhosDisponiveis.forEach((g) => {
      if (gatilhoFiltro.has(g.tipo)) {
        chips.push({
          chave: `gatilho-${g.tipo}`,
          label: g.label,
          onRemove: () => alternarNoSet<string>(setGatilhoFiltro, g.tipo),
        });
      }
    });

    canalFiltro.forEach((c) => {
      chips.push({
        chave: `canal-${c}`,
        label: CANAL_LABELS[c],
        onRemove: () => alternarNoSet(setCanalFiltro, c),
      });
    });

    return chips;
  }, [statusFiltro, funilFiltroIds, etapaFiltroIds, gatilhoFiltro, canalFiltro, funis, gatilhosDisponiveis]);

  return (
    <>
      <Topbar
        title="Automações"
        sub={`${fluxos.length} automações · ${totalAtivas} ativas`}
        actions={
          <div className="dropdown-anchor">
            <button
              type="button"
              className="btn primary"
              disabled={novoCarregando}
              aria-haspopup="menu"
              aria-expanded={novoAberto}
              aria-controls="automacoes-novo-popover"
              aria-label={novoCarregando ? "Abrindo construtor de automação" : "Nova automação"}
              onClick={(e) => {
                if (novoAberto) {
                  setNovoAberto(false);
                } else {
                  setNovoAnchorRect(e.currentTarget.getBoundingClientRect());
                  setNovoAberto(true);
                }
              }}
            >
              {novoCarregando ? "Abrindo…" : "+ Nova automação"}
            </button>

            {novoAberto && novoPosicao && typeof document !== "undefined"
              ? createPortal(
                  <>
                    <div
                      onClick={fecharPopoverNovo}
                      style={{ position: "fixed", inset: 0, zIndex: 190 }}
                    />
                    <div
                      ref={novoPopoverRef}
                      id="automacoes-novo-popover"
                      className="flow-filtros-pop"
                      role="menu"
                      aria-label="Como criar a nova automação"
                      style={{ position: "fixed", top: novoPosicao.top, left: novoPosicao.left, zIndex: 200 }}
                    >
                  {novoErro ? (
                    <div className="flow-filtros-secao">
                      <p className="flow-problema erro">{novoErro}</p>
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ marginTop: 8 }}
                        onClick={() => (novoModoModelo ? setNovoErro(null) : comecarDoZero())}
                      >
                        Tentar novamente
                      </button>
                    </div>
                  ) : !novoModoModelo ? (
                    <div className="flow-filtros-secao" style={{ borderBottom: "none" }}>
                      <button
                        type="button"
                        role="menuitem"
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left" }}
                        disabled={novoCarregando}
                        aria-label="Começar do zero — abre o construtor vazio"
                        onClick={comecarDoZero}
                      >
                        <span className="n">Começar do zero</span>
                        <span className="r">Abre o construtor visual com um rascunho em branco</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left" }}
                        disabled={novoCarregando || modelosDisponiveis.length === 0}
                        aria-label="Usar um modelo pronto"
                        onClick={() => setNovoModoModelo(true)}
                      >
                        <span className="n">Usar um modelo</span>
                        <span className="r">
                          {modelosDisponiveis.length > 0
                            ? "Começa com um fluxo pronto de demonstração, editável"
                            : "Nenhum modelo disponível no momento"}
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div className="flow-filtros-secao" style={{ borderBottom: "none" }}>
                      <button
                        type="button"
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left" }}
                        aria-label="Voltar"
                        onClick={() => setNovoModoModelo(false)}
                      >
                        <span className="n">← Voltar</span>
                      </button>
                      {modelosDisponiveis.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          role="menuitem"
                          className="dropdown-item"
                          style={{ width: "100%", textAlign: "left" }}
                          disabled={novoCarregando}
                          aria-label={`Usar modelo: ${f.nome}`}
                          onClick={() => usarModelo(f)}
                        >
                          <span className="n">{f.nome}</span>
                          <span className="r">{f.descricao ?? "Sem descrição"}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                  </>,
                  document.body,
                )
              : null}
          </div>
        }
      />

      <div className="content">
        {/* -------------------------- Barra compacta -------------------------- */}
        <div className="automacoes-bar">
          <div className="automacoes-bar-group">
            <label className="automacoes-search" htmlFor="automacoes-busca">
              <IconSearch aria-hidden="true" />
              <input
                id="automacoes-busca"
                type="text"
                placeholder="Buscar automação, funil, etapa, gatilho…"
                aria-label="Buscar automações"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              {busca ? (
                <button
                  type="button"
                  className="automacoes-search-clear"
                  aria-label="Limpar busca"
                  onClick={() => setBusca("")}
                >
                  <IconClose width={11} height={11} />
                </button>
              ) : null}
            </label>

            <div className="dropdown-anchor">
              <button
                type="button"
                className={`automacoes-chip-btn${totalFiltrosAtivos > 0 ? " active" : ""}`}
                aria-expanded={filtrosAbertos}
                aria-controls="automacoes-filtros-popover"
                aria-label={`Filtros — ${totalFiltrosAtivos} ativos`}
                onClick={() => setFiltrosAbertos((v) => !v)}
              >
                Filtros
                {totalFiltrosAtivos > 0 ? (
                  <span className="automacoes-badge">{totalFiltrosAtivos}</span>
                ) : null}
              </button>

              {filtrosAbertos ? (
                <>
                  <div
                    onClick={() => setFiltrosAbertos(false)}
                    style={{ position: "fixed", inset: 0, zIndex: 50 }}
                  />
                  <div
                    id="automacoes-filtros-popover"
                    className="flow-filtros-pop"
                    role="dialog"
                    aria-label="Filtros de automações"
                    ref={filtrosPopoverRef}
                  >
                    <fieldset className="flow-filtros-secao">
                      <legend>Status</legend>
                      <div className="filters-row">
                        {STATUS_FILTROS.map((s) => (
                          <button
                            type="button"
                            key={s.valor}
                            className={`fchip${statusFiltro.has(s.valor) ? " active" : ""}`}
                            aria-pressed={statusFiltro.has(s.valor)}
                            onClick={() => alternarNoSet(setStatusFiltro, s.valor)}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </fieldset>

                    {funis.length > 1 ? (
                      <fieldset className="flow-filtros-secao">
                        <legend>Funil</legend>
                        {funis.length > LIMITE_FUNIS_PARA_BUSCA ? (
                          <input
                            className="input"
                            style={{ width: "100%", marginBottom: 8 }}
                            type="text"
                            placeholder="Buscar funil…"
                            aria-label="Buscar funil"
                            value={buscaFunilPopover}
                            onChange={(e) => setBuscaFunilPopover(e.target.value)}
                          />
                        ) : null}
                        <div className="filters-row">
                          {funisFiltradosPopover.map((f) => (
                            <button
                              type="button"
                              key={f.id}
                              className={`fchip${funilFiltroIds.has(f.id) ? " active" : ""}`}
                              aria-pressed={funilFiltroIds.has(f.id)}
                              onClick={() => alternarNoSet(setFunilFiltroIds, f.id)}
                            >
                              {f.nome}
                            </button>
                          ))}
                        </div>
                      </fieldset>
                    ) : null}

                    <fieldset className="flow-filtros-secao">
                      <legend>Etapa</legend>
                      {funisParaEtapas.map((f) => (
                        <div key={f.id}>
                          {funisParaEtapas.length > 1 ? (
                            <p className="flow-filtros-sub">{f.nome}</p>
                          ) : null}
                          <div className="filters-row">
                            {f.colunas.map((c) => (
                              <button
                                type="button"
                                key={c.id}
                                className={`fchip${etapaFiltroIds.has(c.id) ? " active" : ""}`}
                                aria-pressed={etapaFiltroIds.has(c.id)}
                                onClick={() => alternarNoSet(setEtapaFiltroIds, c.id)}
                              >
                                {c.titulo}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </fieldset>

                    <fieldset className="flow-filtros-secao">
                      <legend>Gatilho</legend>
                      <div className="filters-row">
                        <button
                          type="button"
                          className={`fchip${gatilhoFiltro.has("__comentario__") ? " active" : ""}`}
                          aria-pressed={gatilhoFiltro.has("__comentario__")}
                          onClick={() => alternarNoSet<string>(setGatilhoFiltro, "__comentario__")}
                        >
                          Comentário (Insta/TikTok)
                        </button>
                        {gatilhosDisponiveis
                          .filter((g) => !TIPOS_GATILHO_COMENTARIO.includes(g.tipo))
                          .map((g) => (
                            <button
                              type="button"
                              key={g.tipo}
                              className={`fchip${gatilhoFiltro.has(g.tipo) ? " active" : ""}`}
                              aria-pressed={gatilhoFiltro.has(g.tipo)}
                              onClick={() => alternarNoSet<string>(setGatilhoFiltro, g.tipo)}
                            >
                              {g.label}
                            </button>
                          ))}
                      </div>
                    </fieldset>

                    {canaisDisponiveis.length > 0 ? (
                      <fieldset className="flow-filtros-secao">
                        <legend>Canal</legend>
                        <div className="filters-row">
                          {canaisDisponiveis.map((c) => (
                            <button
                              type="button"
                              key={c}
                              className={`fchip${canalFiltro.has(c) ? " active" : ""}`}
                              aria-pressed={canalFiltro.has(c)}
                              onClick={() => alternarNoSet(setCanalFiltro, c)}
                            >
                              {CANAL_LABELS[c]}
                            </button>
                          ))}
                        </div>
                      </fieldset>
                    ) : null}

                    <div className="flow-filtros-foot">
                      <label className="flow-filtros-toggle">
                        <input
                          type="checkbox"
                          checked={manterFiltrosAbertos}
                          onChange={(e) => setManterFiltrosAbertos(e.target.checked)}
                        />
                        Manter filtros abertos
                      </label>
                      <span className="hint">{totalFiltrosAtivos} selecionados</span>
                    </div>
                    <div className="flow-filtros-foot">
                      <button type="button" className="btn ghost" onClick={limparFacetsDoPopover}>
                        Limpar filtros
                      </button>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className="btn ghost"
                          aria-label="Fechar filtros"
                          onClick={() => setFiltrosAbertos(false)}
                        >
                          <IconClose width={11} height={11} /> Fechar
                        </button>
                        <button
                          type="button"
                          className="btn primary"
                          onClick={fecharPopoverSeNaoQuiserManter}
                        >
                          Aplicar filtros
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <label className="automacoes-ordenar">
              <span className="hint" style={{ marginRight: 4 }}>
                Ordenar:
              </span>
              <select
                aria-label="Ordenar automações"
                value={ordenacao}
                onChange={(e) => setOrdenacao(e.target.value as Ordenacao)}
              >
                {ORDENACOES.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            {temAlgumFiltroOuBusca ? (
              <button type="button" className="automacoes-limpar" onClick={limparBuscaEFiltros}>
                Limpar
              </button>
            ) : null}

            <span className="automacoes-count">
              {fluxosFiltrados.length} {fluxosFiltrados.length === 1 ? "resultado" : "resultados"}
            </span>
          </div>
        </div>

        {chipsAtivos.length > 0 ? (
          <div className="automacoes-chips-row">
            {chipsAtivos.map((chip) => (
              <button
                type="button"
                key={chip.chave}
                className="automacoes-remchip"
                onClick={chip.onRemove}
                aria-label={`Remover filtro ${chip.label}`}
              >
                {chip.label} ×
              </button>
            ))}
          </div>
        ) : null}

        <div className="card">
          {fluxosFiltrados.length === 0 ? (
            <p className="hint" style={{ padding: 17 }}>
              {busca.trim()
                ? "Nenhuma automação encontrada para essa busca."
                : totalFiltrosAtivos > 0
                ? "Nenhuma automação encontrada com esses filtros."
                : "Nenhuma automação encontrada."}
            </p>
          ) : (
            fluxosFiltrados.map((fluxo) => {
              const pill = statusPill(fluxo);
              const execs = execucoesDoFluxo(fluxo.id);
              const funilDoFluxo = funis.find((f) => f.id === fluxo.funilId);

              return (
                <div className="int-row" key={fluxo.id}>
                  <div
                    className="int-logo"
                    style={{ cursor: "pointer" }}
                    onClick={() => router.push(`/automacoes/editor/${fluxo.id}`)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Editar automação ${fluxo.nome}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/automacoes/editor/${fluxo.id}`);
                      }
                    }}
                  >
                    <IconAutomacoes width={16} height={16} />
                  </div>

                  <div className="int-body">
                    {renomeandoId === fluxo.id ? (
                      <input
                        className="input"
                        autoFocus
                        style={{ width: "100%", marginBottom: 4 }}
                        value={renomeandoValor}
                        onChange={(e) => setRenomeandoValor(e.target.value)}
                        onBlur={confirmarRenomeacao}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmarRenomeacao();
                          if (e.key === "Escape") setRenomeandoId(null);
                        }}
                      />
                    ) : (
                      <p
                        className="int-title"
                        style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                        onClick={() => router.push(`/automacoes/editor/${fluxo.id}`)}
                      >
                        {fluxo.nome}
                        {fluxo.modeloDemonstracao ? (
                          <span className="pill secondary" title="Fluxo de exemplo pronto — edite ou duplique livremente">
                            Modelo de demonstração
                          </span>
                        ) : null}
                      </p>
                    )}
                    <p className="int-sub">
                      {resumoGatilhoFluxo(fluxo, funis)}
                      {funilDoFluxo ? ` · Funil: ${funilDoFluxo.nome}` : ""}
                      {` · ${fluxo.nodes.length} ${fluxo.nodes.length === 1 ? "bloco" : "blocos"}`}
                    </p>
                    <p className="hint" style={{ marginTop: 4 }}>
                      {fluxo.modeloDemonstracao && fluxo.execucoes === 0
                        ? "0 execuções — modelo de demonstração"
                        : `${fluxo.execucoes} ${fluxo.execucoes === 1 ? "execução" : "execuções"} · Sucesso: ${taxaSucesso(execs)} · ${ultimaExecucao(execs)}`}
                    </p>
                  </div>

                  <span className={`pill${pill.on ? " on" : ""}`}>{pill.label}</span>

                  {fluxo.status === "publicado" ? (
                    <span onClick={(e) => e.stopPropagation()}>
                      <Toggle
                        key={`${fluxo.id}-${fluxo.ativa}-${demoToggleResetNonce}`}
                        defaultOn={fluxo.ativa}
                        label={`Ativar automação ${fluxo.nome}`}
                        onToggle={() => {
                          if (fluxo.modeloDemonstracao && !fluxo.ativa) {
                            setAtivarDemoAlvo(fluxo);
                            setDemoToggleResetNonce((n) => n + 1);
                            return;
                          }
                          alternarAtivo(fluxo.id);
                        }}
                      />
                    </span>
                  ) : null}

                  <div className="dropdown-anchor">
                    <button
                      type="button"
                      className="icon-btn subtle"
                      aria-label={`Mais ações — ${fluxo.nome}`}
                      onClick={(e) => abrirMenu(fluxo.id, e.currentTarget.getBoundingClientRect())}
                    >
                      ⋯
                    </button>
                    {menuAbertoId === fluxo.id ? (
                      <FloatingDropdown
                        anchorRect={menuRect}
                        onClose={() => setMenuAbertoId(null)}
                        align="right"
                        width={320}
                      >
                          <button
                            type="button"
                            className="dropdown-item"
                            style={{ width: "100%", textAlign: "left" }}
                            onClick={() => {
                              setMenuAbertoId(null);
                              router.push(`/automacoes/editor/${fluxo.id}`);
                            }}
                          >
                            <span className="n">Editar</span>
                            <span className="r">Abre no construtor visual</span>
                          </button>
                          <button
                            type="button"
                            className="dropdown-item"
                            style={{ width: "100%", textAlign: "left" }}
                            onClick={() => {
                              setMenuAbertoId(null);
                              setVisualizarAlvo(fluxo);
                            }}
                          >
                            <span className="n">Visualizar fluxo</span>
                            <span className="r">Pré-visualização somente leitura, sem editar nada</span>
                          </button>
                          <button
                            type="button"
                            className="dropdown-item"
                            style={{ width: "100%", textAlign: "left" }}
                            onClick={() => {
                              setMenuAbertoId(null);
                              router.push(`/automacoes/editor/${fluxo.id}`);
                            }}
                          >
                            <span className="n">Testar</span>
                            <span className="r">Abre o construtor — o simulador de verdade fica lá</span>
                          </button>
                          <button
                            type="button"
                            className="dropdown-item"
                            style={{ width: "100%", textAlign: "left" }}
                            onClick={() => verExecucoes(fluxo)}
                          >
                            <span className="n">Ver execuções</span>
                            <span className="r">
                              Sem tela dedicada ainda — abre o construtor (registra no console por ora)
                            </span>
                          </button>
                          <button
                            type="button"
                            className="dropdown-item"
                            style={{ width: "100%", textAlign: "left" }}
                            onClick={() => {
                              setMenuAbertoId(null);
                              router.push(`/automacoes/editor/${fluxo.id}`);
                            }}
                          >
                            <span className="n">Histórico</span>
                            <span className="r">Abre o construtor — o histórico de versões fica lá</span>
                          </button>
                          <button
                            type="button"
                            className="dropdown-item"
                            style={{ width: "100%", textAlign: "left" }}
                            onClick={() => {
                              duplicarFluxo(fluxo.id);
                              setMenuAbertoId(null);
                            }}
                          >
                            <span className="n">Duplicar</span>
                            <span className="r">Cria uma cópia em rascunho</span>
                          </button>
                          <button
                            type="button"
                            className="dropdown-item"
                            style={{ width: "100%", textAlign: "left" }}
                            onClick={() => iniciarRenomeacao(fluxo)}
                          >
                            <span className="n">Renomear</span>
                          </button>
                          {fluxo.arquivada ? (
                            <button
                              type="button"
                              className="dropdown-item"
                              style={{ width: "100%", textAlign: "left" }}
                              onClick={() => {
                                desarquivarFluxo(fluxo.id);
                                setMenuAbertoId(null);
                              }}
                            >
                              <span className="n">Desarquivar</span>
                              <span className="r">Volta a aparecer na lista principal</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="dropdown-item"
                              style={{ width: "100%", textAlign: "left" }}
                              onClick={() => {
                                arquivarFluxo(fluxo.id);
                                setMenuAbertoId(null);
                              }}
                            >
                              <span className="n">Arquivar</span>
                              <span className="r">Pausa e tira a automação da lista principal</span>
                            </button>
                          )}
                          <div className="dropdown-sep" />
                          <button
                            type="button"
                            className="dropdown-item"
                            style={{ width: "100%", textAlign: "left" }}
                            onClick={() => pedirExclusao(fluxo)}
                          >
                            <span className="n">Excluir</span>
                            <span className="r">Apaga a automação e o histórico de execuções</span>
                          </button>
                      </FloatingDropdown>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {exclusaoAlvo ? (
        <div className="flow-side-overlay" role="dialog" aria-label="Confirmar exclusão" onClick={() => setExclusaoAlvo(null)}>
          <div className="flow-side-panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-h">
              <h4>Excluir automação</h4>
              <button
                type="button"
                className="icon-btn subtle"
                aria-label="Cancelar"
                onClick={() => setExclusaoAlvo(null)}
              >
                <IconClose width={11} height={11} />
              </button>
            </div>
            <div className="flow-side-body">
              <p className="n">&quot;{exclusaoAlvo.nome}&quot;</p>
              <p className="r" style={{ marginTop: 8 }}>
                Isso vai apagar a automação e todo o histórico de execuções ({execucoesDoFluxo(exclusaoAlvo.id).length}{" "}
                {execucoesDoFluxo(exclusaoAlvo.id).length === 1 ? "registro" : "registros"}). Essa ação não pode ser
                desfeita.
              </p>
            </div>
            <div className="section-foot">
              <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={() => setExclusaoAlvo(null)}>
                Cancelar
              </button>
              <button type="button" className="btn primary" style={{ flex: 1 }} onClick={confirmarExclusao}>
                Excluir mesmo assim
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {ativarDemoAlvo ? (
        <div
          className="flow-side-overlay"
          role="dialog"
          aria-label="Confirmar ativação de modelo de demonstração"
          onClick={() => setAtivarDemoAlvo(null)}
        >
          <div className="flow-side-panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-h">
              <h4>Ativar modelo de demonstração?</h4>
              <button
                type="button"
                className="icon-btn subtle"
                aria-label="Cancelar"
                onClick={() => setAtivarDemoAlvo(null)}
              >
                <IconClose width={11} height={11} />
              </button>
            </div>
            <div className="flow-side-body">
              <p className="n">&quot;{ativarDemoAlvo.nome}&quot;</p>
              <p className="r" style={{ marginTop: 8 }}>
                Esta é uma automação de demonstração. Quando o back-end estiver conectado, ativá-la fará com que ela
                execute ações reais (mensagens, tarefas, mudanças de etapa) de verdade. Deseja ativar mesmo assim?
              </p>
            </div>
            <div className="section-foot">
              <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={() => setAtivarDemoAlvo(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn primary"
                style={{ flex: 1 }}
                onClick={() => {
                  alternarAtivo(ativarDemoAlvo.id);
                  setAtivarDemoAlvo(null);
                }}
              >
                Ativar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {visualizarAlvo ? (
        <VisualizarFluxo fluxo={visualizarAlvo} onFechar={() => setVisualizarAlvo(null)} />
      ) : null}
    </>
  );
}
