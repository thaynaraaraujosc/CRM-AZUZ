"use client";

import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";

import {
  classeOrigem,
  type Canal,
  type Contato,
  type ConvMensagem,
  type Funil,
  type NegocioCard,
  type StatusMensagem,
} from "@/lib/data";
import { ehLinkDeMidia } from "@/lib/conversas/midia-mensagem";
import { iniciaisExibidas, nomeExibido } from "@/lib/conversas/exibicao";
import { BotoesConectarWhatsApp } from "@/components/configuracoes/BotoesConectarWhatsApp";
import { useAutomacoes } from "@/lib/automacoes-context";
import { useAutomationFlows } from "@/lib/automation-flow-context";
import { executarFluxo } from "@/lib/automation-flow/motor";
import { useContatos } from "@/lib/contatos-context";
import { useConversas, type ConversaReal } from "@/lib/conversas-context";
import { useEquipe } from "@/lib/equipe-context";
import { useTarefas } from "@/lib/tarefas-context";
import { useMotivosPerda } from "@/lib/motivos-perda";
import { formatarTempoRelativoReal } from "@/lib/datas";
import { estimarMinutosAtras, gerarLinhaDoTempo, type Evento } from "@/lib/timeline";
import { useFloatingPosition, type AnchorRect } from "@/lib/use-floating-position";
import { Timeline } from "@/components/timeline";
import { AudioBubblePlayer, AudioWaveformBars } from "@/components/audio-player";
import {
  useBibliotecaDocumentos,
  CATEGORIAS_DOCUMENTO,
} from "@/lib/biblioteca-documentos-context";
import { HOJE_ISO } from "@/lib/agenda-context";
import { useFunis } from "@/lib/funis-context";
import { useMensagensExtra } from "@/lib/mensagens-extra-context";
import { normalizarTelefoneParaComparacao } from "@/lib/telefone";
import {
  useConfigConversas,
  SONS_DISPONIVEIS,
  CONFIG_PADRAO,
  type ConfigConversas,
  type FundoConversa,
} from "@/lib/conversas-config-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { useIntegracaoNaoOficial } from "@/components/configuracoes/useIntegracaoNaoOficial";
import {
  CanalBadge,
  IconAlvo,
  IconAutomacoes,
  IconCalendar,
  IconCheck,
  IconCheckDuplo,
  IconClose,
  IconConfiguracoes,
  IconContatos,
  IconConversas,
  IconCopy,
  IconCut,
  IconDoc,
  IconDownload,
  IconEmail,
  IconEmoji,
  IconEncaminhar,
  IconEnviar,
  IconErro,
  IconEtiqueta,
  IconImage,
  IconLixeira,
  IconLocalizacao,
  IconMic,
  IconMudo,
  IconPause,
  IconEquipe,
  IconPin,
  IconPlay,
  IconProibido,
  IconRefresh,
  IconRelogio,
  IconRespostaRapida,
  IconSalvar,
  IconSearch,
  IconStar,
  IconTelefone,
  IconVideoCam,
  IconVolume,
} from "@/components/icons";
import { FloatingDropdown, RadioList, Toggle, Topbar } from "@/components/ui";

const FILTROS_CONVERSA = [
  { valor: "tudo", label: "Tudo" },
  { valor: "nao-lidas", label: "Não lidas" },
  { valor: "favoritas", label: "Favoritas" },
] as const;

/**
 * Filtro por canal, separado dos filtros de situação acima porque são coisas independentes: dá pra
 * querer "não lidas do Instagram". Com WhatsApp e Instagram ligados ao mesmo tempo, a lista mistura
 * os dois e fica difícil saber por onde a pessoa está falando.
 *
 * TikTok aparece desativado de propósito: o canal está anunciado no produto mas ainda não recebe
 * mensagem, e esconder a aba faria parecer que ele não existe.
 */
const CANAIS_CONVERSA = [
  { valor: "todos", label: "Todos os canais", emBreve: false },
  { valor: "WhatsApp", label: "WhatsApp", emBreve: false },
  { valor: "Instagram", label: "Instagram", emBreve: false },
  { valor: "TikTok", label: "TikTok", emBreve: true },
] as const;

const FORMATOS_IMAGEM = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const TAMANHO_MAX_IMAGEM = 16 * 1024 * 1024;
const FORMATOS_VIDEO = ["video/mp4", "video/webm", "video/quicktime", "video/3gpp"];
const TAMANHO_MAX_VIDEO = 64 * 1024 * 1024;
const DURACAO_MAX_VIDEO_SEG = 180;
const TAMANHO_MAX_DOCUMENTO = 32 * 1024 * 1024;

function formatarTamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function estiloFundoConversa(
  fundo: FundoConversa,
  opacidade: number,
): CSSProperties {
  const alfa = Math.max(0, Math.min(100, opacidade)) / 100;
  if (fundo.tipo === "cor") {
    return { backgroundColor: fundo.cor, opacity: undefined, ["--wa-fundo-alfa" as string]: alfa };
  }
  if (fundo.tipo === "imagem") {
    return {
      backgroundImage: `linear-gradient(rgba(0,0,0,${1 - alfa}), rgba(0,0,0,${1 - alfa})), url(${fundo.url})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  // Qualquer outro valor (inclusive um fundo "pronto" salvo antes deles deixarem de existir) cai
  // no padrão: fundo branco, sem estilo nenhum aplicado por cima.
  return {};
}

function gerarIdMensagem() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Faz o status de uma mensagem enviada avançar pendente → enviado → entregue
 * → (às vezes) lido, com tempos realistas e aleatórios — nunca ajustável
 * manualmente. Fica fora do componente (só recebe o "setter" já amarrado ao
 * contato/id certos) pra não misturar código com efeito colateral agendado
 * dentro do corpo do componente.
 */
function agendarSimulacaoDeEntrega(
  atualizar: (patch: Partial<ConvMensagem>) => void,
) {
  const tEnviado = 450 + Math.random() * 350;
  const tEntregue = tEnviado + 900 + Math.random() * 1100;
  const tLido = tEntregue + 1800 + Math.random() * 4000;
  setTimeout(() => atualizar({ status: "enviado" }), tEnviado);
  setTimeout(() => atualizar({ status: "entregue" }), tEntregue);
  if (Math.random() < 0.82) {
    setTimeout(() => atualizar({ status: "lido" }), tLido);
  }
}

/** Aplica um fundo no rascunho de configurações — "todas" grava no padrão, "atual" só nessa conversa. */
function aplicarFundoRascunho(
  config: ConfigConversas,
  fundo: FundoConversa,
  escopo: "todas" | "atual",
  conversaId: string,
): ConfigConversas {
  if (escopo === "atual") {
    return {
      ...config,
      fundoPorConversa: { ...config.fundoPorConversa, [conversaId]: fundo },
    };
  }
  return { ...config, fundo };
}

function lerComoDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result as string);
    leitor.onerror = () => reject(new Error("Falha ao ler o arquivo"));
    leitor.readAsDataURL(file);
  });
}

const REGEX_URL = /(https?:\/\/[^\s]+)/g;

/** Detecta link (http/https) dentro do texto de uma mensagem e transforma em `<a>` clicável, que
 * abre numa aba nova — sem isso, um link mandado ou recebido na conversa era só texto plano, sem
 * como abrir de dentro do CRM. */
function renderizarTextoComLinks(texto: string): ReactNode[] {
  // `String.split` com um grupo de captura intercala os pedaços não casados com os casados — índice
  // ímpar é sempre a URL capturada, par é texto comum. Mais seguro que re-testar a regex global (que
  // mantém `lastIndex` entre chamadas e dá resultado errado se reusada assim).
  const partes = texto.split(REGEX_URL);
  return partes.map((parte, i) =>
    i % 2 === 1 ? (
      <a key={i} href={parte} target="_blank" rel="noopener noreferrer" className="wa-link-mensagem">
        {parte}
      </a>
    ) : (
      <span key={i}>{parte}</span>
    ),
  );
}

/** Ícone + rótulo + descrição de acessibilidade do estado real de uma mensagem enviada. */
function StatusMensagemIcone({
  status,
  onTentarNovamente,
}: {
  status?: StatusMensagem;
  onTentarNovamente?: () => void;
}) {
  if (!status) return null;
  if (status === "erro") {
    return (
      <span className="msg-status msg-status-erro">
        <span
          className="msg-status-icone"
          title="Não enviada — toque para tentar de novo"
          aria-label="Mensagem não enviada"
        >
          <IconErro width={13} height={13} />
        </span>
        {onTentarNovamente ? (
          <button
            type="button"
            className="msg-status-retry"
            onClick={onTentarNovamente}
          >
            Tentar novamente
          </button>
        ) : null}
      </span>
    );
  }
  const mapa: Record<
    Exclude<StatusMensagem, "erro">,
    { icone: ReactNode; titulo: string; classe: string }
  > = {
    pendente: {
      icone: <IconRelogio width={12} height={12} />,
      titulo: "Aguardando envio",
      classe: "",
    },
    enviado: {
      icone: <IconCheck width={13} height={13} />,
      titulo: "Enviada",
      classe: "",
    },
    entregue: {
      icone: <IconCheckDuplo width={14} height={14} />,
      titulo: "Entregue no aparelho do lead",
      classe: "",
    },
    lido: {
      icone: <IconCheckDuplo width={14} height={14} />,
      titulo: "Lida pelo lead",
      classe: "lido",
    },
    reproduzido: {
      icone: <IconMic width={12} height={12} />,
      titulo: "Áudio reproduzido pelo lead",
      classe: "reproduzido",
    },
  };
  const info = mapa[status];
  return (
    <span
      className={`msg-status-icone ${info.classe}`}
      title={info.titulo}
      aria-label={info.titulo}
      role="img"
    >
      {info.icone}
    </span>
  );
}

type FiltroConversa = (typeof FILTROS_CONVERSA)[number]["valor"];

const EMOJI_CATEGORIAS = [
  {
    titulo: "Sorrisos",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🙂", "🙃",
      "😉", "😊", "😇", "😍", "🤩", "😘", "😗", "😚", "😙", "😋",
      "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "😐",
      "😑", "😶", "😏", "😒", "🙄", "😬", "🤥", "😌", "😔", "😪",
      "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🥵", "🥶", "😵",
      "🤯", "🥳", "😎", "🤓", "🧐", "😕", "😟", "🙁", "😮", "😯",
      "😲", "😳", "🥺", "😦", "😧", "😨", "😰", "😥", "😢", "😭",
      "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡",
      "😠", "🤬",
    ],
  },
  {
    titulo: "Gestos e pessoas",
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞",
      "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍",
      "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🙏",
      "✍️", "💅", "🤳", "💪", "🦵", "🦶", "👂", "👃", "🧠", "👀",
      "👁️", "👅", "👄", "👶", "🧒", "👦", "👧", "🧑", "👱", "👨",
      "👩", "🧓", "👴", "👵", "🙋", "🙆", "🙅", "💁", "🙇", "🤦",
      "🤷",
    ],
  },
  {
    titulo: "Corações e símbolos",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
      "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "☮️",
      "✝️", "☪️", "🕉️", "☸️", "✡️", "🔯", "🕎", "☯️", "☦️", "🛐",
      "⭐", "🌟", "✨", "⚡", "🔥", "💥", "☀️", "🌈", "✅", "❌",
      "❗", "❓", "‼️", "⁉️", "💯", "🔞", "📌", "📍", "🕐", "🔔",
    ],
  },
  {
    titulo: "Animais e natureza",
    emojis: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯",
      "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🐤", "🦆",
      "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🐛", "🦋",
      "🐌", "🐞", "🐢", "🐍", "🦎", "🐙", "🦀", "🐠", "🐬", "🐳",
      "🌵", "🌲", "🌳", "🌴", "🌱", "🌿", "☘️", "🍀", "🍁", "🌸",
      "🌹", "🌻", "🌼", "🌷", "🌎", "🌙", "☁️", "🌧️", "❄️", "☃️",
    ],
  },
  {
    titulo: "Comida e bebida",
    emojis: [
      "🍏", "🍎", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🍈", "🍒",
      "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🥦", "🥕",
      "🌽", "🌶️", "🍞", "🥐", "🥯", "🧀", "🥚", "🍳", "🥞", "🍗",
      "🍖", "🍔", "🍟", "🍕", "🌭", "🌮", "🌯", "🥗", "🍿", "🍩",
      "🍪", "🎂", "🍰", "🍫", "🍬", "🍭", "🍦", "☕", "🍵", "🥤",
      "🍺", "🍷", "🥂", "🍾",
    ],
  },
  {
    titulo: "Atividades e objetos",
    emojis: [
      "⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🏓", "🎯", "🎮", "🎲",
      "🎸", "🎧", "🎤", "🎬", "📷", "📱", "💻", "⌚", "🖥️", "🖨️",
      "☎️", "📞", "📧", "📨", "📦", "📅", "📎", "📌", "🔒", "🔑",
      "🔨", "🛠️", "💰", "💳", "💡", "🔦", "🧾", "📊", "📈", "📉",
      "🗓️", "🗑️", "🚗", "🚕", "🚌", "🚀", "✈️", "🚢", "⛽", "🏠",
      "🏢", "🏥", "🏦", "🎉", "🎁", "🏆", "🥇",
    ],
  },
] as const;

/**
 * Placeholder seguro pra quando ainda não existe nenhuma conversa real (workspace novo, ou
 * ainda carregando) — em vez de deixar `aberta` ser `undefined` (o que quebraria os dezenas de
 * `useState`/cálculos que assumem uma conversa selecionada, declarados antes de qualquer retorno
 * condicional possível, por causa das Regras de Hooks), usa esse objeto vazio. A tela de fato
 * mostra "nenhuma conversa" naturalmente: a lista lateral fica vazia (`conversas.length === 0`) e
 * o painel principal não tem nada de real pra exibir (sem nome, sem mensagem).
 */
const CONVERSA_VAZIA: ConversaReal = {
  id: "__vazio__",
  workspaceId: "",
  contatoId: null,
  nome: "",
  initials: "?",
  canal: "WhatsApp",
  contato: null,
  origem: "Direto",
  status: "Não respondido",
  naoLidas: 0,
  favorita: false,
  arquivada: false,
  atendenteSelecionado: null,
  ehGrupo: false,
  participantesGrupo: null,
  fotoUrl: null,
  descricaoGrupo: null,
  criacaoGrupo: null,
  criadoEm: new Date(0).toISOString(),
  atualizadoEm: new Date(0).toISOString(),
};

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
  contato: { id: string; nome: string },
  primeiraMensagemHora?: string,
): HistoricoItem[] {
  const localizacao = localizarNoFunil(listaFunis, contato.nome);
  const itens: HistoricoItem[] = [];

  const primeiraHora = primeiraMensagemHora;
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

/** Fecha um popup flutuante ao clicar fora dele — usado pelos popups menores (mídias, conectar, detalhe do contato). */
function useFecharAoClicarFora(
  ref: React.RefObject<HTMLElement | null>,
  ativo: boolean,
  aoFechar: () => void,
) {
  useEffect(() => {
    if (!ativo) return;
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) aoFechar();
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);
}

function ConversasPageInner() {
  const searchParams = useSearchParams();
  const { funis, setFunis, atribuirContatoAoFunil } = useFunis();

  /** Etapa do funil onde esse contato está agora (procura em todos os funis, não só o principal) —
   * `null` quando ele ainda não é um negócio em nenhum funil (ex.: grupo, ou lead que nunca entrou). */
  function etapaAtualDoContato(nomeContato: string): string | null {
    for (const f of funis) {
      for (const c of f.colunas) {
        if (c.cards.some((card) => card.nome === nomeContato)) return c.titulo;
      }
    }
    return null;
  }
  const {
    contatos,
    salvarDadosContato,
    atribuirAtendente,
    adicionarEtiqueta,
    removerEtiqueta,
    criarContato,
  } = useContatos();
  const {
    conversas,
    carregando: carregandoConversas,
    marcarComoLida: marcarConversaLida,
    alternarFavorita: alternarFavoritaConversa,
    alternarArquivada: alternarArquivadaConversa,
    atualizarStatus: atualizarStatusConversa,
    atribuirAtendente: atribuirAtendenteConversa,
    atualizarFoto: atualizarFotoConversa,
    criarConversaIndividual,
    recarregar: recarregarConversas,
    excluirConversa,
  } = useConversas();
  const { membros: membrosEquipe } = useEquipe();
  const motivosPerdaBase = useMotivosPerda();
  const { colunas: tarefas } = useTarefas();
  const { automacoes, automacoesDeEntradaAtivas } = useAutomacoes();
  const { fluxos, dispararEvento, registrarExecucao } = useAutomationFlows();
  const { config, atualizarConfig, fundoDaConversa } = useConfigConversas();
  const [configConversasAberto, setConfigConversasAberto] = useState(false);
  const [configAba, setConfigAba] = useState<
    "aparencia" | "privacidade" | "notificacoes" | "preferencias"
  >("aparencia");
  const [configRascunho, setConfigRascunho] = useState<ConfigConversas>(config);
  const [configStatusSalvar, setConfigStatusSalvar] = useState<
    "ocioso" | "salvando" | "sucesso" | "erro"
  >("ocioso");
  const [configConfirmarFechar, setConfigConfirmarFechar] = useState(false);
  const [configPermissaoNotificacao, setConfigPermissaoNotificacao] = useState<
    NotificationPermission | "indisponivel"
  >(() =>
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "indisponivel",
  );
  const configAlterado = JSON.stringify(configRascunho) !== JSON.stringify(config);
  const [fundoEscopoForm, setFundoEscopoForm] = useState<"todas" | "atual">("todas");
  const [erroFundoImagem, setErroFundoImagem] = useState<string | null>(null);
  const fundoUploadInputRef = useRef<HTMLInputElement>(null);
  const fundoCorInputRef = useRef<HTMLInputElement>(null);

  function abrirConfigConversas() {
    setConfigRascunho(config);
    setFundoEscopoForm("todas");
    setConfigAba("aparencia");
    setConfigStatusSalvar("ocioso");
    setConfigConfirmarFechar(false);
    setConfigConversasAberto(true);
  }

  function pedirFecharConfig() {
    if (configAlterado) {
      setConfigConfirmarFechar(true);
      return;
    }
    setConfigConversasAberto(false);
  }

  function descartarEFecharConfig() {
    setConfigRascunho(config);
    setConfigConfirmarFechar(false);
    setConfigConversasAberto(false);
  }

  function restaurarPadraoRascunho() {
    setConfigRascunho(CONFIG_PADRAO);
  }

  async function salvarConfigConversas() {
    setConfigStatusSalvar("salvando");
    try {
      // `atualizarConfig` já persiste de verdade (ver configuracoes-context.tsx) — o delay aqui é
      // só pra dar a sensação de salvamento antes de fechar o painel.
      await new Promise((resolve) => setTimeout(resolve, 450));
      atualizarConfig(configRascunho);
      setConfigStatusSalvar("sucesso");
      setTimeout(() => {
        setConfigConversasAberto(false);
        setConfigStatusSalvar("ocioso");
      }, 700);
    } catch {
      setConfigStatusSalvar("erro");
    }
  }

  function pedirPermissaoNotificacaoNavegador() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setConfigPermissaoNotificacao("indisponivel");
      return;
    }
    Notification.requestPermission().then((permissao) => {
      setConfigPermissaoNotificacao(permissao);
      if (permissao === "granted") {
        setConfigRascunho((prev) => ({ ...prev, notificacaoNavegador: true }));
      }
    });
  }

  function testarSomNotificacao() {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value =
        configRascunho.somEscolhido === "suave"
          ? 660
          : configRascunho.somEscolhido === "alerta"
            ? 880
            : 740;
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
      osc.onended = () => ctx.close();
    } catch {
      // Web Audio indisponível nesse navegador — sem prévia sonora.
    }
  }

  const [toasts, setToasts] = useState<{ id: string; texto: string }[]>([]);
  const proximoToastId = useRef(0);

  function avisarAutomacao(texto: string) {
    const id = `toast-${proximoToastId.current++}`;
    setToasts((prev) => [...prev, { id, texto }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }
  // `conversas` só chega depois do fetch no mount do ConversasProvider — a inicialização
  // preguiçosa de `useState` não serve aqui (ela rodaria antes da lista existir). Em vez de
  // useEffect, ajusta durante a renderização (padrão já usado nesta página, ver `abertaIdAnterior`
  // mais abaixo): só seta uma vez, na primeira renderização em que a lista deixa de estar vazia.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIdInicializado, setSelectedIdInicializado] = useState(false);
  if (!selectedIdInicializado && conversas.length > 0) {
    const nomeContato = searchParams.get("contato");
    const encontrada = nomeContato ? conversas.find((c) => c.nome === nomeContato) : null;
    setSelectedId((encontrada ?? conversas[0]).id);
    setSelectedIdInicializado(true);
  }
  const [infoAberto, setInfoAberto] = useState(false);
  const [abaInfo, setAbaInfo] = useState<
    "resumo" | "contato" | "negociacao" | "atividades" | "historico"
  >("resumo");
  const [resultadoMenuAberto, setResultadoMenuAberto] = useState(false);
  const [resultadoMenuRect, setResultadoMenuRect] = useState<DOMRect | null>(null);
  const [formResultado, setFormResultado] = useState<
    "venda" | "perda" | "adiada" | "cancelada" | null
  >(null);
  const [vendaProduto, setVendaProduto] = useState("");
  const [vendaValor, setVendaValor] = useState("");
  const [vendaFormaPagamento, setVendaFormaPagamento] = useState("Pix");
  const [vendaObservacao, setVendaObservacao] = useState("");
  const [adiadaData, setAdiadaData] = useState("");
  const [adiadaObservacao, setAdiadaObservacao] = useState("");
  const [canceladaMotivo, setCanceladaMotivo] = useState("");
  const [registrandoResultado, setRegistrandoResultado] = useState(false);
  const [buscaConversa, setBuscaConversa] = useState("");
  const [filtroConversa, setFiltroConversa] = useState<FiltroConversa>("tudo");
  const [canalAba, setCanalAba] = useState<string>("todos");
  const [lidas, setLidas] = useState<Set<string>>(() => new Set());
  const [fixadas, setFixadas] = useState<Set<string>>(() => new Set());
  const [silenciadas, setSilenciadas] = useState<Set<string>>(() => new Set());
  const [favoritasOverride, setFavoritasOverride] = useState<Record<string, boolean>>({});
  const [encerradas, setEncerradas] = useState<Set<string>>(() => new Set());
  const [rowMenuAberto, setRowMenuAberto] = useState<string | null>(null);
  const [rowMenuRect, setRowMenuRect] = useState<DOMRect | null>(null);
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false);

  function ehFavorita(c: { id: string; favorita?: boolean }) {
    return favoritasOverride[c.id] ?? c.favorita ?? false;
  }

  function alternarFixada(id: string) {
    setFixadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setRowMenuAberto(null);
  }

  function marcarComoNaoLida(id: string) {
    setLidas((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setRowMenuAberto(null);
  }

  function alternarFavorita(id: string) {
    const c = conversas.find((c) => c.id === id);
    const proximo = !(favoritasOverride[id] ?? c?.favorita ?? false);
    setFavoritasOverride((prev) => ({ ...prev, [id]: proximo }));
    alternarFavoritaConversa(id, proximo);
    setRowMenuAberto(null);
  }

  function alternarSilenciada(id: string) {
    setSilenciadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setRowMenuAberto(null);
  }

  function alternarArquivada(id: string, jaArquivada: boolean) {
    alternarArquivadaConversa(id, !jaArquivada);
    setRowMenuAberto(null);
  }

  function encerrarAtendimento(id: string) {
    setEncerradas((prev) => new Set(prev).add(id));
    atualizarStatusConversa(id, "Finalizado");
    setRowMenuAberto(null);
  }
  const [midiasAberto, setMidiasAberto] = useState(false);
  const [midiasPos, setMidiasPos] = useState<{ x: number; y: number } | null>(null);
  const midiasRef = useRef<HTMLDivElement>(null);
  const [participantesAberto, setParticipantesAberto] = useState(false);
  const [participantesPos, setParticipantesPos] = useState<{ x: number; y: number } | null>(null);
  const participantesRef = useRef<HTMLDivElement>(null);
  const [dadosGrupoAberto, setDadosGrupoAberto] = useState(false);
  const [dadosGrupoPos, setDadosGrupoPos] = useState<{ x: number; y: number } | null>(null);
  const dadosGrupoRef = useRef<HTMLDivElement>(null);
  // Participante clicado dentro do painel de Participantes — abre um popup próprio (foto buscada
  // sob demanda, nome, telefone, "Enviar mensagem"), igual clicar num contato dentro de um grupo no
  // WhatsApp de verdade.
  const [participanteAberto, setParticipanteAberto] = useState<{ nome: string; telefone: string } | null>(null);
  const [fotoParticipante, setFotoParticipante] = useState<string | null>(null);
  const [carregandoFotoParticipante, setCarregandoFotoParticipante] = useState(false);
  const [criandoConversaParticipante, setCriandoConversaParticipante] = useState(false);
  const participanteRef = useRef<HTMLDivElement>(null);
  const naoOficial = useIntegracaoNaoOficial();
  // Status da API oficial (Meta) — sem hook compartilhado com polling (o `useIntegracaoMeta` só
  // busca uma vez); polling próprio aqui porque a conversa some/reaparece conforme o canal
  // conecta/desconecta, então precisa saber o estado atual, não só o do primeiro carregamento.
  const [metaWhatsappConectado, setMetaWhatsappConectado] = useState(false);
  const [statusMetaCarregado, setStatusMetaCarregado] = useState(false);
  useEffect(() => {
    function verificarMeta() {
      fetch("/api/integracoes/meta?provedor=meta_whatsapp")
        .then((r) => r.json())
        .then((dados: { status?: string }) => {
          setMetaWhatsappConectado(dados.status === "conectado");
          setStatusMetaCarregado(true);
        })
        .catch(() => setStatusMetaCarregado(true));
    }
    verificarMeta();
    const intervalo = setInterval(verificarMeta, 5000);
    return () => clearInterval(intervalo);
  }, []);
  // Só passa a filtrar depois que os dois status (Meta e Baileys) já responderam pelo menos uma
  // vez — sem essa guarda, a lista de conversas do WhatsApp pisca "vazia" por um instante em toda
  // carga de página, mesmo com um canal já conectado.
  const statusWhatsappPronto = statusMetaCarregado && naoOficial.estado !== null;
  const whatsappConectado = metaWhatsappConectado || naoOficial.estado?.status === "conectado";
  const [contatoDetalhePos, setContatoDetalhePos] = useState<{ x: number; y: number } | null>(null);
  const contatoDetalheRef = useRef<HTMLDivElement>(null);
  const [contatoDetalheAberto, setContatoDetalheAberto] = useState<{
    nome: string;
    initials: string;
    whatsapp?: string;
    telefoneFixo?: string;
    email?: string;
    empresa?: string;
    cargo?: string;
  } | null>(null);
  const [infoWidth, setInfoWidth] = useState(320);
  const [sincronizando, setSincronizando] = useState(false);

  useFecharAoClicarFora(midiasRef, midiasAberto, () => setMidiasAberto(false));
  useFecharAoClicarFora(participantesRef, participantesAberto, () => setParticipantesAberto(false));
  useFecharAoClicarFora(dadosGrupoRef, dadosGrupoAberto, () => setDadosGrupoAberto(false));
  useFecharAoClicarFora(participanteRef, !!participanteAberto, () => setParticipanteAberto(null));

  // Reseta o estado da foto assim que o participante clicado muda — ajusta durante a renderização
  // (não num `useEffect`), mesmo padrão já usado no resto do arquivo pra "resetar estado derivado
  // de uma prop que mudou" sem passar por uma cascata extra de render.
  const participanteAnteriorRef = useRef(participanteAberto);
  if (participanteAberto !== participanteAnteriorRef.current) {
    participanteAnteriorRef.current = participanteAberto;
    if (participanteAberto) {
      setFotoParticipante(null);
      setCarregandoFotoParticipante(true);
    }
  }

  // Busca a foto do participante clicado sob demanda (não vem já pronta na lista de 384 pessoas).
  useEffect(() => {
    if (!participanteAberto) return;
    fetch(`/api/integracoes/whatsapp-nao-oficial/foto-perfil?numero=${encodeURIComponent(participanteAberto.telefone)}`)
      .then((r) => r.json())
      .then((dados: { fotoUrl?: string | null }) => setFotoParticipante(dados.fotoUrl ?? null))
      .catch(() => setFotoParticipante(null))
      .finally(() => setCarregandoFotoParticipante(false));
  }, [participanteAberto]);

  useFecharAoClicarFora(contatoDetalheRef, !!contatoDetalheAberto, () => setContatoDetalheAberto(null));

  /** Busca conversas e mensagens de novo AGORA, sem esperar o próximo ciclo do polling de 5s — não
   * "conecta o WhatsApp" (isso é feito em Configurações), só traz o que já chegou no servidor mais
   * rápido pra tela. Não força a Evolution a reenviar nada. */
  function sincronizarConversas() {
    if (sincronizando) return;
    setSincronizando(true);
    Promise.allSettled([recarregarConversas(), recarregarMensagens()]).finally(() =>
      setSincronizando(false),
    );
  }

  const [atendenteTopAberto, setAtendenteTopAberto] = useState(false);
  const [atendenteTopRect, setAtendenteTopRect] = useState<DOMRect | null>(null);
  const [atendenteTopFiltro, setAtendenteTopFiltro] = useState("Todos");

  const [canalTopAberto, setCanalTopAberto] = useState(false);
  const [canalTopRect, setCanalTopRect] = useState<DOMRect | null>(null);
  const [canalTopFiltro, setCanalTopFiltro] = useState("Todos");

  // Movido pra antes de `conversasFiltradas` (que chama `conversaUsaWhatsappNaoOficial`, definida
  // mais abaixo mas que fecha sobre esta variável) — como é `const`, ficava numa "zona morta
  // temporal" até esta linha rodar; `conversasFiltradas` é calculado direto no corpo do
  // componente, então rodava ANTES desta declaração (quando ela vinha depois), lançando
  // `ReferenceError: Cannot access before initialization` — só na hora, porque só nesse caso
  // (WhatsApp conectado + conversa do canal WhatsApp na lista) o filtro chega a chamar a função
  // que usa essa variável. Bug real que derrubava a tela de Conversas (e, por ela abrir de novo a
  // cada navegação, o app inteiro) só depois de conectar o WhatsApp.
  const {
    mensagensExtraPorContato,
    setMensagensExtraPorContato,
    recarregar: recarregarMensagens,
  } = useMensagensExtra();

  const atendentesDisponiveis = membrosEquipe.map((m) => m.nome);
  const canaisDisponiveis = Array.from(new Set(conversas.map((c) => c.origem)));

  const naoOficialConectado = naoOficial.estado?.status === "conectado";

  // Conversa de WhatsApp sem nenhum canal conectado (nem Meta, nem QR Code) some da lista — volta a
  // aparecer sozinha quando reconectar (não apaga nada do banco, só deixa de mostrar; ver pedido
  // explícito: ao desconectar, nem a conversa aberta no momento pode continuar visível). Com só UMA
  // das duas integrações ativa, mostra só as conversas dessa integração (uma conta só tem uma
  // conexão de WhatsApp por vez, então misturar não faz sentido) — a "origem" de cada conversa vem
  // da última mensagem com canal marcado (ver `conversaUsaWhatsappNaoOficial`); sem nenhuma
  // mensagem com canal marcado, conta como Meta (comportamento antigo, de antes da integração não
  // oficial existir).
  function conversaEscondidaPeloWhatsapp(c: ConversaReal): boolean {
    if (c.canal !== "WhatsApp") return false;
    if (statusWhatsappPronto && !whatsappConectado) return true;
    if (statusWhatsappPronto && metaWhatsappConectado && !naoOficialConectado && conversaUsaWhatsappNaoOficial(c.nome)) {
      return true;
    }
    if (statusWhatsappPronto && naoOficialConectado && !metaWhatsappConectado && !conversaUsaWhatsappNaoOficial(c.nome)) {
      return true;
    }
    return false;
  }

  const conversasFiltradas = conversas
    .filter((c) => {
      if (conversaEscondidaPeloWhatsapp(c)) return false;
      if (!mostrarArquivadas && c.arquivada) return false;
      if (mostrarArquivadas) return c.arquivada;
      if (filtroConversa === "nao-lidas" && (!c.naoLidas || lidas.has(c.id))) return false;
      if (filtroConversa === "favoritas" && !ehFavorita(c)) return false;
      if (canalAba !== "todos" && c.canal !== canalAba) return false;
      if (atendenteTopFiltro !== "Todos" && c.atendenteSelecionado !== atendenteTopFiltro)
        return false;
      if (canalTopFiltro !== "Todos" && c.origem !== canalTopFiltro) return false;
      if (!buscaConversa.trim()) return true;
      const termo = buscaConversa.trim().toLowerCase();
      return c.nome.toLowerCase().includes(termo);
    })
    .sort((a, b) => Number(fixadas.has(b.id)) - Number(fixadas.has(a.id)));

  const abertaCandidata = conversas.find((c) => c.id === selectedId) ?? conversas[0];
  const aberta =
    abertaCandidata && !conversaEscondidaPeloWhatsapp(abertaCandidata) ? abertaCandidata : CONVERSA_VAZIA;

  // Busca a foto de TODAS as conversas de WhatsApp sem uma salva ainda — não só a aberta. Sem isso
  // a foto só aparecia (e sumia de novo, ao trocar de conversa e voltar) porque cada abertura
  // buscava de novo em vez de ficar resolvido pra sempre; rodando uma vez pra lista inteira aqui,
  // qualquer conversa já chega com a foto pronta assim que a lista carrega. `tentadasRef` evita
  // tentar de novo a mesma conversa write nesta sessão (WhatsApp sem foto definida é normal, não
  // precisa martelar a Evolution de novo a cada render).
  const fotosTentadasRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const pendentes = conversas.filter(
      (c) => !c.fotoUrl && c.canal === "WhatsApp" && c.contato && !fotosTentadasRef.current.has(c.id),
    );
    if (!pendentes.length) return;
    let cancelado = false;
    (async () => {
      for (const c of pendentes) {
        if (cancelado) return;
        fotosTentadasRef.current.add(c.id);
        try {
          const r = await fetch(`/api/integracoes/whatsapp-nao-oficial/foto-perfil?numero=${encodeURIComponent(c.contato!)}`);
          const dados = (await r.json()) as { fotoUrl?: string | null };
          if (dados.fotoUrl) atualizarFotoConversa(c.id, dados.fotoUrl);
        } catch {
          // segue pra próxima — uma falha isolada não deve travar o resto da lista
        }
        // Pausa curta entre chamadas — não é urgente, e evita virar uma rajada de dezenas de
        // chamadas simultâneas pra Evolution assim que a lista de conversas carrega.
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [conversas, atualizarFotoConversa]);

  // Renderizar de uma vez o histórico inteiro de um contato com muita mensagem trava a tela (DOM
  // gigante, cada bolha com menu/portal próprio) — mostra só as últimas por padrão, com botão pra
  // carregar mais sob demanda. Reseta pro padrão sempre que troca de conversa.
  const [limiteMensagensVisiveis, setLimiteMensagensVisiveis] = useState(200);
  // Mensagem de texto muito longa (mais comum em grupo grande, tipo aviso de condomínio) tomava a
  // tela inteira de rolagem — trunca com "Ler mais/menos", igual qualquer app de mensagem faz.
  const [mensagensExpandidas, setMensagensExpandidas] = useState<Set<string>>(() => new Set());
  // Ids de mensagem com o botão "Carregar áudio" em andamento — evita clique duplo enquanto busca.
  const [midiasCarregando, setMidiasCarregando] = useState<Set<string>>(() => new Set());
  const idConversaAnteriorRef = useRef(aberta.id);
  if (idConversaAnteriorRef.current !== aberta.id) {
    idConversaAnteriorRef.current = aberta.id;
    setLimiteMensagensVisiveis(200);
  }
  // `Conversa` real não carrega mais uma "tarefa vinculada" embutida (ver plano) — placeholder
  // vazio mantém `tarefa.*` funcionando em todo o resto do arquivo, mostrando "sem tarefa" sempre.
  const tarefa = {
    data: "",
    oQueFazer: "",
    valor: "—",
    responsavel: "",
    anexo: null as { arquivo: string; detalhe: string } | null,
  };
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
    aberta.atendenteSelecionado ?? "",
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
  const [sobrenomeContato, setSobrenomeContato] = useState(
    contatoDaConversa?.sobrenome ?? "",
  );
  const [empresaContato, setEmpresaContato] = useState(
    contatoDaConversa?.empresa ?? "",
  );
  const [cargoContato, setCargoContato] = useState(contatoDaConversa?.cargo ?? "");
  const [cidadeContato, setCidadeContato] = useState(contatoDaConversa?.cidade ?? "");
  const [estadoContato, setEstadoContato] = useState(contatoDaConversa?.estado ?? "");
  const [paisContato, setPaisContato] = useState(contatoDaConversa?.pais ?? "");
  const [canalPreferidoContato, setCanalPreferidoContato] = useState(
    contatoDaConversa?.canalPreferido ?? (aberta.canal as Canal),
  );
  const [melhorHorarioContato, setMelhorHorarioContato] = useState(
    contatoDaConversa?.melhorHorario ?? "",
  );
  const [editandoContato, setEditandoContato] = useState(false);
  const [statusSalvarContato, setStatusSalvarContato] = useState<
    "ocioso" | "salvando" | "sucesso" | "erro"
  >("ocioso");
  const [novaEtiquetaTexto, setNovaEtiquetaTexto] = useState("");
  const [trocandoResponsavel, setTrocandoResponsavel] = useState(false);
  const [abertaIdAnterior, setAbertaIdAnterior] = useState(aberta.id);
  // Chave da mensagem cujo coração acabou de aparecer — só pra tocar a animação uma vez. A curtida
  // em si NÃO mora aqui: ela vem da própria mensagem (`reacaoMinha`/`reacaoContato`), porque
  // precisa sobreviver a recarregar a página e ser a mesma pra qualquer pessoa da equipe.
  const [coracaoAnimando, setCoracaoAnimando] = useState<string | null>(null);
  const [erroCurtir, setErroCurtir] = useState<string | null>(null);
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
  const [emailPos, setEmailPos] = useState<{ x: number; y: number } | null>(null);
  const emailArrasteRef = useRef<{ dx: number; dy: number } | null>(null);
  const emailCorpoRef = useRef<HTMLDivElement>(null);
  const proximoEmailId = useRef(0);
  const [historicoPorContato, setHistoricoPorContato] = useState<
    Record<string, HistoricoItem[]>
  >({});
  const [notaTexto, setNotaTexto] = useState("");
  const [mensagemTexto, setMensagemTexto] = useState("");

  /* ---------------------------------------------------------------------- */
  /* Áudio — gravação real (getUserMedia + MediaRecorder), prévia e player   */
  /* ---------------------------------------------------------------------- */
  const [gravandoAudio, setGravandoAudio] = useState(false);
  const [audioPausado, setAudioPausado] = useState(false);
  const [audioSegundos, setAudioSegundos] = useState(0);
  const [audioNiveis, setAudioNiveis] = useState<number[]>([]);
  const [audioPermissaoErro, setAudioPermissaoErro] = useState<string | null>(null);
  const [audioSolicitandoPermissao, setAudioSolicitandoPermissao] = useState(false);
  const [audioPreview, setAudioPreview] = useState<{
    blob: Blob;
    url: string;
    duracao: number;
    waveform: number[];
  } | null>(null);
  const [audioPreviewTocando, setAudioPreviewTocando] = useState(false);
  const [audioPreviewProgresso, setAudioPreviewProgresso] = useState(0);
  const [audioEnviando, setAudioEnviando] = useState(false);
  const [audioConfirmarDescarte, setAudioConfirmarDescarte] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioAnimFrameRef = useRef<number | null>(null);
  const audioPreviewElRef = useRef<HTMLAudioElement>(null);

  const [anexoAberto, setAnexoAberto] = useState(false);
  const [anexoAnchorRect, setAnexoAnchorRect] = useState<AnchorRect | null>(null);
  const [anexoPosManual, setAnexoPosManual] = useState<{ x: number; y: number } | null>(null);
  const { ref: anexoMenuRef, posicao: anexoPosicaoAuto } = useFloatingPosition(anexoAnchorRect, anexoAberto, 8, () => setAnexoAberto(false));
  const anexoPos = anexoPosManual ?? (anexoPosicaoAuto ? { x: anexoPosicaoAuto.left, y: anexoPosicaoAuto.top } : null);
  const anexoArrasteRef = useRef<{ dx: number; dy: number } | null>(null);
  const [emojiAberto, setEmojiAberto] = useState(false);
  const [emojiRect, setEmojiRect] = useState<DOMRect | null>(null);
  /* ---------------------------------------------------------------------- */
  /* Enviar contato — abas CRM/Criar, busca+filtros, seleção múltipla,       */
  /* prévia antes de enviar                                                  */
  /* ---------------------------------------------------------------------- */
  const [contatoPickerAberto, setContatoPickerAberto] = useState(false);
  const [contatoPickerAba, setContatoPickerAba] = useState<"crm" | "criar">("crm");
  const [contatoPickerEtapa, setContatoPickerEtapa] = useState<"lista" | "previa">("lista");
  const [buscaContatoPicker, setBuscaContatoPicker] = useState("");
  const [filtroEmpresaPicker, setFiltroEmpresaPicker] = useState("");
  const [filtroEtiquetaPicker, setFiltroEtiquetaPicker] = useState("");
  const [filtroResponsavelPicker, setFiltroResponsavelPicker] = useState("");
  const [somenteFavoritosPicker, setSomenteFavoritosPicker] = useState(false);
  const [contatosSelecionadosPicker, setContatosSelecionadosPicker] = useState<Contato[]>([]);
  const [previaCampos, setPreviaCampos] = useState({
    telefonePrincipal: true,
    telefoneAlternativo: false,
    email: true,
    empresa: true,
    cargo: true,
  });
  const [contatoPickerEnviando, setContatoPickerEnviando] = useState(false);
  const [contatoPickerErro, setContatoPickerErro] = useState<string | null>(null);

  // Aba "Criar contato"
  const [novoContatoNome, setNovoContatoNome] = useState("");
  const [novoContatoSobrenome, setNovoContatoSobrenome] = useState("");
  const [novoContatoEmpresa, setNovoContatoEmpresa] = useState("");
  const [novoContatoCargo, setNovoContatoCargo] = useState("");
  const [novoContatoTelefone, setNovoContatoTelefone] = useState("");
  const [novoContatoEmail, setNovoContatoEmail] = useState("");
  const [novoContatoObservacao, setNovoContatoObservacao] = useState("");
  const [novoContatoErros, setNovoContatoErros] = useState<{ telefone?: string; email?: string }>(
    {},
  );
  const [novoContatoSalvando, setNovoContatoSalvando] = useState(false);
  const [novoContatoSucesso, setNovoContatoSucesso] = useState(false);
  const [respostasGerenciarAberto, setRespostasGerenciarAberto] = useState(false);
  const [respostasPos, setRespostasPos] = useState<{ x: number; y: number } | null>(null);
  const respostasArrasteRef = useRef<{ dx: number; dy: number } | null>(null);
  const respostasModalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!respostasGerenciarAberto) return;
    function aoClicarFora(e: MouseEvent) {
      if (
        respostasModalRef.current &&
        !respostasModalRef.current.contains(e.target as Node)
      ) {
        setRespostasGerenciarAberto(false);
      }
    }
    const id = setTimeout(
      () => document.addEventListener("mousedown", aoClicarFora),
      0,
    );
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", aoClicarFora);
    };
  }, [respostasGerenciarAberto]);
  const [novaRespostaTitulo, setNovaRespostaTitulo] = useState("");
  const [novaRespostaTexto, setNovaRespostaTexto] = useState("");
  const [respostasRapidasPorFunil, setRespostasRapidasPorFunil] = useState<
    Record<string, { id: string; titulo: string; texto: string }[]>
  >({});
  const mensagemInputRef = useRef<HTMLTextAreaElement>(null);
  const [respondendoMensagem, setRespondendoMensagem] = useState<{
    autor: string;
    texto: string;
    /** Id da mensagem citada — vai junto no envio pro Instagram, pra citação existir dos dois lados. */
    mid?: string;
  } | null>(null);

  /* ---------------------------------------------------------------------- */
  /* Menu de ações da mensagem — copiar/encaminhar/favoritar/detalhes/apagar */
  /* ---------------------------------------------------------------------- */
  const [msgMenuAberto, setMsgMenuAberto] = useState<{ chave: string; rect: DOMRect } | null>(
    null,
  );
  const [encaminharAberto, setEncaminharAberto] = useState<{
    chave: string;
    rect: DOMRect;
    msg: ConvMensagem;
  } | null>(null);
  const [mensagensApagadasPorContato, setMensagensApagadasPorContato] = useState<
    Record<string, Set<string>>
  >({});
  const [mensagensFavoritasPorContato, setMensagensFavoritasPorContato] = useState<
    Record<string, Set<string>>
  >({});
  const [confirmarApagar, setConfirmarApagar] = useState<{
    chave: string;
    tipoExclusao: "para_mim" | "para_todos";
    elegivel: boolean;
    motivoIndisponivel?: string;
  } | null>(null);
  const [detalhesMensagem, setDetalhesMensagem] = useState<{ msg: ConvMensagem; chave: string } | null>(
    null,
  );

  const mensagensApagadas = mensagensApagadasPorContato[aberta.nome] ?? new Set<string>();
  const mensagensFavoritas = mensagensFavoritasPorContato[aberta.nome] ?? new Set<string>();

  function abrirMenuMensagem(chave: string, rect: DOMRect) {
    setMsgMenuAberto((prev) => (prev?.chave === chave ? null : { chave, rect }));
  }

  function estrelaFavorita(chave: string) {
    if (!mensagensFavoritas.has(chave)) return null;
    return (
      <span className="wa-msg-favorita" title="Favoritada">
        <IconStar width={11} height={11} fill="currentColor" />
      </span>
    );
  }

  /** Botão "⋮" reaproveitado em todos os tipos de bolha (não é componente à parte de propósito — evita remontar). */
  function botaoMenuMensagem(chave: string) {
    return (
      <button
        type="button"
        className="wa-msg-menu-btn"
        aria-label="Mais ações dessa mensagem"
        title="Mais ações"
        onClick={(e) => {
          e.stopPropagation();
          abrirMenuMensagem(chave, e.currentTarget.getBoundingClientRect());
        }}
      >
        ⋮
      </button>
    );
  }

  /** Acha a mensagem original (semente ou extra) a partir da mesma "chave" usada nos mapas de apagadas/favoritas. */
  function encontrarMensagemPorChave(chave: string): ConvMensagem | null {
    const extras = mensagensExtraPorContato[aberta.nome] ?? [];
    return extras.find((m, i) => (m.id ?? `extra-${i}`) === chave) ?? null;
  }

  function copiarMensagem(texto: string) {
    setMsgMenuAberto(null);
    if (!texto) return;
    navigator.clipboard?.writeText(texto).then(
      () => avisarAutomacao("Mensagem copiada"),
      () => avisarAutomacao("Não deu pra copiar — copie manualmente"),
    );
  }

  function alternarFavoritoMensagem(chave: string) {
    setMsgMenuAberto(null);
    setMensagensFavoritasPorContato((prev) => {
      const atual = new Set(prev[aberta.nome] ?? []);
      if (atual.has(chave)) atual.delete(chave);
      else atual.add(chave);
      return { ...prev, [aberta.nome]: atual };
    });
  }

  function abrirDetalhesMensagem(msg: ConvMensagem, chave: string) {
    setMsgMenuAberto(null);
    setDetalhesMensagem({ msg, chave });
  }

  function baixarAnexoMensagem(msg: ConvMensagem) {
    setMsgMenuAberto(null);
    const anexo = msg.imagens?.[0] ?? msg.video ?? msg.documento ?? msg.audio;
    if (!anexo || !("url" in anexo)) return;
    const a = document.createElement("a");
    a.href = anexo.url;
    a.download = "nome" in anexo ? anexo.nome : "anexo";
    a.click();
  }

  function pedirApagar(chave: string, msg: ConvMensagem, tipoExclusao: "para_mim" | "para_todos") {
    setMsgMenuAberto(null);
    if (tipoExclusao === "para_mim") {
      setConfirmarApagar({ chave, tipoExclusao, elegivel: true });
      return;
    }
    if (msg.tipo !== "out") {
      setConfirmarApagar({
        chave,
        tipoExclusao,
        elegivel: false,
        motivoIndisponivel: "Essa mensagem foi enviada por outra pessoa.",
      });
      return;
    }
    const idadeMinutos = msg.criadoEm ? (Date.now() - msg.criadoEm) / 60000 : Infinity;
    if (idadeMinutos > 15) {
      setConfirmarApagar({
        chave,
        tipoExclusao,
        elegivel: false,
        motivoIndisponivel: "O prazo pra apagar essa mensagem pra todos já expirou.",
      });
      return;
    }
    setConfirmarApagar({ chave, tipoExclusao, elegivel: true });
  }

  function confirmarApagarParaMim() {
    if (!confirmarApagar) return;
    const { chave } = confirmarApagar;
    setMensagensApagadasPorContato((prev) => {
      const atual = new Set(prev[aberta.nome] ?? []);
      atual.add(chave);
      return { ...prev, [aberta.nome]: atual };
    });
    setConfirmarApagar(null);
  }

  function confirmarApagarParaTodos() {
    if (!confirmarApagar) return;
    const { chave } = confirmarApagar;
    // Grava de verdade em MensagemExtra.apagadaParaTodos (via o mesmo PUT sincronizado que
    // qualquer outra mudança de mensagem usa) — some do balão pra qualquer sessão que reabrir essa
    // conversa, não só localmente. Vale só dentro do CRM: nenhuma integração hoje (Meta/Baileys)
    // expõe um jeito de recolher a mensagem do lado do destinatário no WhatsApp.
    atualizarMensagem(aberta.nome, chave, { apagadaParaTodos: true });
    setConfirmarApagar(null);
  }

  function encaminharPara(destinoNome: string, msg: ConvMensagem) {
    setEncaminharAberto(null);
    setMensagensExtraPorContato((prev) => ({
      ...prev,
      [destinoNome]: [
        ...(prev[destinoNome] ?? []),
        {
          ...msg,
          id: gerarIdMensagem(),
          tipo: "out",
          hora: horaAgora(),
          criadoEm: Date.now(),
          status: "pendente",
          respondendoA: undefined,
        },
      ],
    }));
    avisarAutomacao(`Encaminhado pra ${destinoNome}`);
  }

  const imagemInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentoInputRef = useRef<HTMLInputElement>(null);

  /* ---------------------------------------------------------------------- */
  /* Anexos reais — imagem, vídeo, documento                                */
  /* ---------------------------------------------------------------------- */

  const [arrastandoArquivo, setArrastandoArquivo] = useState(false);
  const [erroAnexo, setErroAnexo] = useState<string | null>(null);
  const [localizacaoBuscando, setLocalizacaoBuscando] = useState(false);
  const [localizacaoErro, setLocalizacaoErro] = useState<string | null>(null);

  // Imagem: seleção múltipla + pré-visualização + edição real (recorte/rotação).
  const [imagensSelecionadas, setImagensSelecionadas] = useState<
    { id: string; original: string; atual: string; nome: string; tamanho: number }[]
  >([]);
  const [imagemPreviewAberto, setImagemPreviewAberto] = useState(false);
  const [imagemAtivaId, setImagemAtivaId] = useState<string | null>(null);
  const [legendaImagem, setLegendaImagem] = useState("");
  const [, setImagemHistorico] = useState<
    Record<string, { pilha: string[]; indice: number }>
  >({});
  const [imagemModoCorte, setImagemModoCorte] = useState(false);
  const [imagemCorteRect, setImagemCorteRect] = useState({
    x: 10,
    y: 10,
    w: 80,
    h: 80,
  });
  const [enviandoImagens, setEnviandoImagens] = useState(false);

  // Lightbox — abrir imagem já enviada em tamanho maior, com navegação e zoom.
  const [lightbox, setLightbox] = useState<{
    urls: string[];
    indice: number;
    zoom: number;
  } | null>(null);

  // Mídias liberadas manualmente quando o download automático está desligado pra esse tipo.
  const [midiasLiberadas, setMidiasLiberadas] = useState<Set<string>>(() => new Set());

  function midiaLiberada(tipo: "imagem" | "video" | "documento", id?: string, url?: string) {
    // Mídia já embutida na mensagem (`data:`) não tem o que baixar — o arquivo veio junto. A trava
    // existe pra mídia que mora no servidor e só é buscada sob demanda; aqui ela só escondia o que
    // já estava em mãos, e a pessoa via "Baixar vídeo" no lugar da miniatura.
    if (url?.startsWith("data:")) return true;
    if (config.downloadAutomatico && config.tiposDownloadAutomatico.includes(tipo)) {
      return true;
    }
    return id ? midiasLiberadas.has(id) : false;
  }

  function liberarMidia(id?: string) {
    if (!id) return;
    setMidiasLiberadas((prev) => new Set(prev).add(id));
  }

  // Vídeo: preview com corte real (in/out) e mudo, processado antes do envio.
  const [videoSelecionado, setVideoSelecionado] = useState<{
    original: File;
    url: string;
    duracao: number;
    nome: string;
    tamanho: number;
  } | null>(null);
  const [videoPreviewAberto, setVideoPreviewAberto] = useState(false);
  const [legendaVideo, setLegendaVideo] = useState("");
  const [videoInicio, setVideoInicio] = useState(0);
  const [videoFim, setVideoFim] = useState(0);
  const [videoMudo, setVideoMudo] = useState(false);
  const [videoProcessando, setVideoProcessando] = useState(false);
  const [videoErro, setVideoErro] = useState<string | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  // Documento: escolher origem (CRM ou computador), biblioteca e pré-visualização.
  const [documentoOrigemAberto, setDocumentoOrigemAberto] = useState(false);
  const [bibliotecaAberta, setBibliotecaAberta] = useState(false);
  const [buscaBiblioteca, setBuscaBiblioteca] = useState("");
  const [categoriaBiblioteca, setCategoriaBiblioteca] = useState("Todas");
  const [documentosSelecionadosBiblioteca, setDocumentosSelecionadosBiblioteca] =
    useState<string[]>([]);
  const [documentoPreviewAberto, setDocumentoPreviewAberto] = useState<{
    nome: string;
    url: string;
    formato: string;
  } | null>(null);
  const [documentoComputador, setDocumentoComputador] = useState<{
    file: File;
    url: string;
    nome: string;
    tamanho: number;
    formato: string;
  } | null>(null);
  const [legendaDocumento, setLegendaDocumento] = useState("");
  const [enviandoDocumento, setEnviandoDocumento] = useState(false);

  const { documentos: bibliotecaDocumentos } = useBibliotecaDocumentos();

  useEffect(() => {
    if (!gravandoAudio || audioPausado) return;
    const intervalo = setInterval(() => setAudioSegundos((s) => s + 1), 1000);
    return () => clearInterval(intervalo);
  }, [gravandoAudio, audioPausado]);

  useEffect(() => {
    return () => {
      // Limpa microfone/contexto de áudio se o componente desmontar no meio de uma gravação.
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close().catch(() => {});
      if (audioAnimFrameRef.current) cancelAnimationFrame(audioAnimFrameRef.current);
    };
  }, []);

  function medirNivelMicrofone() {
    const analyser = audioAnalyserRef.current;
    if (!analyser) return;
    const dados = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(dados);
    let soma = 0;
    for (let i = 0; i < dados.length; i++) {
      const v = (dados[i] - 128) / 128;
      soma += v * v;
    }
    const rms = Math.sqrt(soma / dados.length);
    setAudioNiveis((prev) => [...prev.slice(-59), Math.min(1, rms * 4)]);
    audioAnimFrameRef.current = requestAnimationFrame(medirNivelMicrofone);
  }

  /** Decodifica o blob gravado pra tirar duração real e uma forma de onda estática (pra prévia e pro player final). */
  async function calcularWaveform(blob: Blob): Promise<{ duracao: number; waveform: number[] }> {
    try {
      const buffer = await blob.arrayBuffer();
      const AudioCtx =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const audioBuffer = await ctx.decodeAudioData(buffer);
      const dados = audioBuffer.getChannelData(0);
      const totalBarras = 46;
      const tamanhoBloco = Math.max(1, Math.floor(dados.length / totalBarras));
      const waveform: number[] = [];
      for (let i = 0; i < totalBarras; i++) {
        let pico = 0;
        const inicio = i * tamanhoBloco;
        for (let j = inicio; j < inicio + tamanhoBloco && j < dados.length; j++) {
          pico = Math.max(pico, Math.abs(dados[j]));
        }
        waveform.push(Math.min(1, pico * 1.4));
      }
      const duracao = audioBuffer.duration;
      ctx.close();
      return { duracao, waveform };
    } catch {
      // Formato não decodificável nesse navegador (raro) — usa a duração cronometrada e uma forma de onda plana.
      return { duracao: audioSegundos, waveform: new Array(46).fill(0.3) };
    }
  }

  async function iniciarGravacaoAudio() {
    setAudioPermissaoErro(null);
    setAudioSolicitandoPermissao(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioSolicitandoPermissao(false);
      mediaStreamRef.current = stream;
      const AudioCtx =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const fonte = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      fonte.connect(analyser);
      audioContextRef.current = ctx;
      audioAnalyserRef.current = analyser;

      const gravador = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      audioChunksRef.current = [];
      gravador.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      gravador.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        ctx.close().catch(() => {});
        if (audioAnimFrameRef.current) cancelAnimationFrame(audioAnimFrameRef.current);
        const { duracao, waveform } = await calcularWaveform(blob);
        const url = URL.createObjectURL(blob);
        setAudioPreview({ blob, url, duracao, waveform });
      };
      mediaRecorderRef.current = gravador;
      gravador.start();
      setAudioSegundos(0);
      setAudioNiveis([]);
      setAudioPausado(false);
      setGravandoAudio(true);
      medirNivelMicrofone();
    } catch {
      setAudioSolicitandoPermissao(false);
      setAudioPermissaoErro(
        "Não deu pra acessar o microfone. Verifique a permissão do navegador pra esse site e tente de novo.",
      );
    }
  }

  function pausarOuContinuarGravacao() {
    const gravador = mediaRecorderRef.current;
    if (!gravador) return;
    if (audioPausado) {
      gravador.resume();
      setAudioPausado(false);
      medirNivelMicrofone();
    } else {
      gravador.pause();
      setAudioPausado(true);
      if (audioAnimFrameRef.current) cancelAnimationFrame(audioAnimFrameRef.current);
    }
  }

  function concluirGravacao() {
    const gravador = mediaRecorderRef.current;
    if (!gravador) return;
    gravador.stop();
    setGravandoAudio(false);
    setAudioPausado(false);
  }

  function pedirDescartarGravacao() {
    if (audioSegundos >= 20) {
      setAudioConfirmarDescarte(true);
      return;
    }
    descartarGravacao();
  }

  /** Interrompe a gravação (se ainda estiver rolando), descarta o arquivo temporário e volta o campo de mensagem — nada é enviado. */
  function descartarGravacao() {
    const gravador = mediaRecorderRef.current;
    if (gravador && gravador.state !== "inactive") {
      gravador.onstop = null;
      gravador.stop();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close().catch(() => {});
    }
    if (audioAnimFrameRef.current) cancelAnimationFrame(audioAnimFrameRef.current);
    if (audioPreview) URL.revokeObjectURL(audioPreview.url);
    setGravandoAudio(false);
    setAudioPausado(false);
    setAudioSegundos(0);
    setAudioNiveis([]);
    setAudioPreview(null);
    setAudioPreviewTocando(false);
    setAudioPreviewProgresso(0);
    setAudioConfirmarDescarte(false);
  }

  function regravarAudio() {
    if (audioPreview) URL.revokeObjectURL(audioPreview.url);
    setAudioPreview(null);
    setAudioPreviewTocando(false);
    setAudioPreviewProgresso(0);
    iniciarGravacaoAudio();
  }

  function alternarPreviaAudio() {
    const el = audioPreviewElRef.current;
    if (!el) return;
    if (audioPreviewTocando) el.pause();
    else el.play();
  }

  async function enviarAudioGravado() {
    if (!audioPreview) return;
    setAudioEnviando(true);
    try {
      // Converte o blob gravado em base64 (mesmo padrão de imagem/documento — ver
      // `lerComoDataUrl`) antes de gravar a mensagem, pra persistir de verdade no banco (campo
      // `extras` de MensagemExtra) em vez de um blob: URL que só existe nesta aba do navegador.
      const url = await lerComoDataUrl(audioPreview.blob);
      URL.revokeObjectURL(audioPreview.url);
      const viaBaileys = contatoUsaWhatsappNaoOficial();
      adicionarMensagem({
        tipo: "out",
        texto: "",
        hora: horaAgora(),
        canal: viaBaileys ? "whatsapp_nao_oficial" : undefined,
        audio: {
          url,
          duracao: audioPreview.duracao,
          waveform: audioPreview.waveform,
        },
      });
      // Envio real do áudio — sem isso, a bolha aparecia na tela do CRM mas nunca saía de verdade
      // pro WhatsApp (bug real: gravar/mandar áudio não fazia nenhuma chamada de API, só guardava
      // localmente). Só a integração não oficial (Evolution) por enquanto — a oficial (Meta) exige
      // um fluxo de upload de mídia em duas etapas, ainda não implementado.
      const destinatarioAudio = contatoDaConversa?.whatsapp ?? aberta.contato;
      if (viaBaileys && destinatarioAudio) {
        const audioBase64 = url.split(",")[1] ?? url;
        fetch("/api/integracoes/whatsapp-nao-oficial/enviar", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ destinatario: destinatarioAudio, audioBase64 }),
        })
          .then(async (r) => {
            if (!r.ok) throw new Error(((await r.json()) as { erro?: string }).erro);
          })
          .catch((erro) => {
            const motivo = erro instanceof Error && erro.message ? erro.message : "motivo desconhecido";
            adicionarMensagem({ tipo: "system", texto: `⚠️ Falha ao enviar áudio: ${motivo}`, hora: horaAgora() });
          });
      } else if (!viaBaileys) {
        adicionarMensagem({
          tipo: "system",
          texto: "⚠️ Envio de áudio pela API oficial (Meta) ainda não é suportado — só pelo WhatsApp via QR Code.",
          hora: horaAgora(),
        });
      }
      setAudioPreview(null);
      setAudioSegundos(0);
      setAudioNiveis([]);
      setAudioPreviewTocando(false);
      setAudioPreviewProgresso(0);
    } catch {
      setAudioPermissaoErro("Não deu pra processar o áudio gravado. Tente gravar de novo.");
    } finally {
      setAudioEnviando(false);
    }
  }

  const [resultadoPorContato, setResultadoPorContato] = useState<
    Record<string, "venda" | "perda" | "andamento" | "adiada" | "cancelada">
  >({});
  const [motivoPerdaPorContato, setMotivoPerdaPorContato] = useState<
    Record<string, string>
  >({});
  const [motivosPerdaCustom, setMotivosPerdaCustom] = useState<string[]>([]);
  const [novoMotivoTexto, setNovoMotivoTexto] = useState("");
  const [escolhendoMotivo, setEscolhendoMotivo] = useState(false);

  if (aberta.id !== abertaIdAnterior) {
    setAbertaIdAnterior(aberta.id);
    setEscolhendoMotivo(false);
    const funilId = localizacao?.funilId ?? funis[0]?.id ?? "";
    setFunilSelecionadoId(funilId);
    setEtapaSelecionada(etapaPadraoPara(funilId));
    setAtendenteSelecionado(aberta.atendenteSelecionado ?? "");
    setEmailContato(contatoDaConversa?.email ?? "");
    setWhatsappContato(contatoDaConversa?.whatsapp ?? "");
    setNascimentoContato(contatoDaConversa?.nascimento ?? "");
    setEnderecoContato(contatoDaConversa?.endereco ?? "");
    setSobrenomeContato(contatoDaConversa?.sobrenome ?? "");
    setEmpresaContato(contatoDaConversa?.empresa ?? "");
    setCargoContato(contatoDaConversa?.cargo ?? "");
    setCidadeContato(contatoDaConversa?.cidade ?? "");
    setEstadoContato(contatoDaConversa?.estado ?? "");
    setPaisContato(contatoDaConversa?.pais ?? "");
    setCanalPreferidoContato(contatoDaConversa?.canalPreferido ?? (aberta.canal as Canal));
    setMelhorHorarioContato(contatoDaConversa?.melhorHorario ?? "");
    setEditandoContato(false);
    setStatusSalvarContato("ocioso");
    setTrocandoResponsavel(false);
    setCoracaoAnimando(null);
    setErroCurtir(null);
    setTarefaAberta(false);
    setEmailModalAberto(false);
    setNotaTexto("");
    setResultadoMenuAberto(false);
    setFormResultado(null);
  }
  if (!historicoPorContato[aberta.nome]) {
    setHistoricoPorContato((prev) => ({
      ...prev,
      [aberta.nome]: historicoInicialDoContato(
        funis,
        aberta,
        mensagensExtraPorContato[aberta.nome]?.[0]?.hora,
      ),
    }));
  }

  const emailsDaConversa = emailsEnviados.filter((e) => e.contato === aberta.nome);
  const historico = historicoPorContato[aberta.nome] ?? [];
  const resultadoAtual = resultadoPorContato[aberta.nome];
  const motivosDisponiveis = [
    ...motivosPerdaBase,
    ...motivosPerdaCustom,
  ];

  /**
   * Histórico e e-mails dessa conversa não têm fonte derivável em `data.ts`
   * ainda (nascem de ações do usuário direto no painel), então entram como
   * `extras` na linha do tempo unificada (seção 17 do pedido) em vez de
   * duplicar o componente. Ver `gerarLinhaDoTempo` em `src/lib/timeline.ts`.
   */
  const contatoIdParaTimeline = contatoDaConversa?.id ?? aberta.id;
  const eventosExtrasTimeline: Evento[] = [
    ...historico.map(
      (item): Evento => ({
        id: item.id,
        contatoId: contatoIdParaTimeline,
        tipo: item.tipo === "anotacao" ? "sistema" : item.tipo === "email" ? "sistema" : "sistema",
        titulo:
          item.tipo === "anotacao"
            ? "Anotação"
            : item.tipo === "email"
              ? "E-mail"
              : "Atualização",
        descricao: item.texto,
        quando: item.quando,
        minutosAtras: estimarMinutosAtras(item.quando),
      }),
    ),
    ...emailsDaConversa.map(
      (email): Evento => ({
        id: `timeline-email-${email.id}`,
        contatoId: contatoIdParaTimeline,
        tipo: "sistema",
        titulo: `E-mail · ${email.assunto}`,
        descricao: email.aberto ? `Lido às ${email.abertoEm}` : "Enviado, ainda não lido",
        quando: "—",
        minutosAtras: 0,
      }),
    ),
  ];
  const eventosTimelineContato: Evento[] = contatoDaConversa
    ? gerarLinhaDoTempo(
        contatoDaConversa.id,
        { contatos, conversas, mensagensPorContato: mensagensExtraPorContato, tarefas, funis },
        eventosExtrasTimeline,
      )
    : eventosExtrasTimeline.slice().sort((a, b) => a.minutosAtras - b.minutosAtras);

  function adicionarHistorico(tipo: HistoricoItem["tipo"], texto: string) {
    setHistoricoPorContato((prev) => ({
      ...prev,
      [aberta.nome]: [
        ...(prev[aberta.nome] ??
          historicoInicialDoContato(funis, aberta, mensagensExtraPorContato[aberta.nome]?.[0]?.hora)),
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

  function horaAgora() {
    return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function atualizarMensagem(
    contatoNome: string,
    id: string,
    patch: Partial<ConvMensagem>,
  ) {
    setMensagensExtraPorContato((prev) => ({
      ...prev,
      [contatoNome]: (prev[contatoNome] ?? []).map((m) =>
        m.id === id ? { ...m, ...patch } : m,
      ),
    }));
  }

  /** Busca o conteúdo real de uma mídia recebida (áudio, por enquanto) que só chegou como aviso —
   * chamado quando a pessoa clica pra carregar. Substitui `midiaPendente` pelo campo específico do
   * tipo (`audio`) assim que carrega, então na próxima render a bolha já mostra o player normal. */
  function carregarMidiaPendente(msg: ConvMensagem) {
    if (!msg.midiaPendente || !msg.id) return;
    const contatoNome = aberta.nome;
    setMidiasCarregando((prev) => new Set(prev).add(msg.id!));
    const { remoteJid, id, fromMe, tipo } = msg.midiaPendente;
    fetch(
      `/api/integracoes/whatsapp-nao-oficial/midia?remoteJid=${encodeURIComponent(remoteJid)}&id=${encodeURIComponent(id)}&fromMe=${fromMe}&tipo=${tipo}`,
    )
      .then((r) => r.json())
      .then((dados: { dataUrl?: string | null }) => {
        if (dados.dataUrl && tipo === "audio") {
          atualizarMensagem(contatoNome, msg.id!, {
            audio: { url: dados.dataUrl, duracao: 0, waveform: [] },
            midiaPendente: undefined,
          });
        } else if (dados.dataUrl && tipo === "imagem") {
          atualizarMensagem(contatoNome, msg.id!, {
            imagens: [{ url: dados.dataUrl, nome: "imagem.jpg", tamanho: 0 }],
            midiaPendente: undefined,
          });
        } else {
          atualizarMensagem(contatoNome, msg.id!, {
            texto:
              tipo === "audio"
                ? "⚠️ Não consegui carregar esse áudio — ouça no celular conectado."
                : "⚠️ Não consegui carregar essa imagem — veja no celular conectado.",
            midiaPendente: undefined,
          });
        }
      })
      .catch(() => {
        atualizarMensagem(contatoNome, msg.id!, {
          texto:
            tipo === "audio"
              ? "⚠️ Não consegui carregar esse áudio — ouça no celular conectado."
              : "⚠️ Não consegui carregar essa imagem — veja no celular conectado.",
          midiaPendente: undefined,
        });
      })
      .finally(() => {
        setMidiasCarregando((prev) => {
          const next = new Set(prev);
          next.delete(msg.id!);
          return next;
        });
      });
  }

  // Carrega mídia pendente (áudio recebido) automaticamente assim que ela aparece na conversa
  // aberta — o usuário só precisa clicar em play, igual no WhatsApp de verdade, sem precisar
  // clicar num botão "Carregar" antes.
  useEffect(() => {
    // `carregarMidiaPendente` chama `setMidiasCarregando` — adiado pro próximo tick pra não fazer
    // um `setState` síncrono dentro do corpo do efeito (o lint trava nisso, com razão: dispararia
    // uma cascata de renders ainda dentro do commit atual).
    const id = setTimeout(() => {
      const mensagens = mensagensExtraPorContato[aberta.nome] ?? [];
      for (const msg of mensagens) {
        if (msg.midiaPendente && msg.id && !midiasCarregando.has(msg.id)) {
          carregarMidiaPendente(msg);
        }
      }
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensagensExtraPorContato, aberta.nome]);

  /** Adiciona a mensagem já com id — mensagens "out" sem status ganham "pendente" e entram na simulação real de entrega. */
  function adicionarMensagem(msg: ConvMensagem) {
    const id = msg.id ?? gerarIdMensagem();
    const contatoNome = aberta.nome;
    const base: ConvMensagem = { ...msg, id, criadoEm: msg.criadoEm ?? Date.now() };
    const pronta: ConvMensagem =
      base.tipo === "out" && !base.status ? { ...base, status: "pendente" } : base;
    setMensagensExtraPorContato((prev) => ({
      ...prev,
      [contatoNome]: [...(prev[contatoNome] ?? []), pronta],
    }));
    if (pronta.tipo === "out" && pronta.status === "pendente") {
      agendarSimulacaoDeEntrega((patch) => atualizarMensagem(contatoNome, id, patch));
    }
    return id;
  }

  function tentarNovamenteMensagem(id: string) {
    const contatoNome = aberta.nome;
    atualizarMensagem(contatoNome, id, { status: "pendente", erro: undefined });
    agendarSimulacaoDeEntrega((patch) => atualizarMensagem(contatoNome, id, patch));
  }

  /** Conversa "pertence" ao canal WhatsApp via QR Code (não oficial) quando a última mensagem —
   * recebida OU mandada do celular conectado (espelhada) — veio por ele; sem nenhuma mensagem com
   * canal marcado, conta como API oficial (Meta), o comportamento antigo de antes dessa integração
   * existir. Usado tanto pra decidir pra onde a resposta do atendente deve sair (`aberta.nome`)
   * quanto pra filtrar a lista de conversas pela integração realmente conectada (ver
   * `conversasFiltradas`) — nesse segundo uso, olha qualquer contato, não só o aberto no momento. */
  function conversaUsaWhatsappNaoOficial(nomeContato: string): boolean {
    const extras = mensagensExtraPorContato[nomeContato] ?? [];
    for (let i = extras.length - 1; i >= 0; i--) {
      if (extras[i].canal) return extras[i].canal === "whatsapp_nao_oficial";
    }
    return false;
  }

  function contatoUsaWhatsappNaoOficial(): boolean {
    return conversaUsaWhatsappNaoOficial(aberta.nome);
  }

  /**
   * Manda um texto pelo canal da conversa aberta.
   *
   * Extraído de `enviarMensagemTexto` pra ser reaproveitado por quem também precisa entregar texto
   * — hoje o compartilhamento de localização, que vira um link de mapa. Duplicar esse if/else foi
   * a origem de mais de um "aparece no CRM mas não chega do outro lado": um caminho novo nascia
   * sem o ramo de algum canal.
   */
  function despacharTexto(texto: string, respondendoMid?: string) {
    const viaBaileys = contatoUsaWhatsappNaoOficial();
    // Erro fica registrado como mensagem de sistema DENTRO da conversa (não só um toast que some
    // sozinho em poucos segundos) — assim dá pra ver o motivo exato depois, sem precisar
    // screenshotar na hora certa.
    function avisarFalhaNaConversa(prefixo: string, erro: unknown) {
      const motivo = erro instanceof Error && erro.message ? erro.message : "motivo desconhecido";
      adicionarMensagem({ tipo: "system", texto: `⚠️ Falha ao enviar (${prefixo}): ${motivo}`, hora: horaAgora() });
      avisarAutomacao(`Falha ao enviar pelo ${prefixo} — veja o motivo na conversa.`);
    }

    if (viaBaileys && (contatoDaConversa?.whatsapp ?? aberta.contato)) {
      // Grupo não tem `Contato` vinculado (não é uma pessoa) — o destinatário nesse caso é o JID
      // do grupo, guardado direto em `aberta.contato` (ver `upsertConversaAoReceberMensagem`).
      fetch("/api/integracoes/whatsapp-nao-oficial/enviar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ destinatario: contatoDaConversa?.whatsapp ?? aberta.contato, texto }),
      })
        .then(async (r) => {
          if (!r.ok) throw new Error(((await r.json()) as { erro?: string }).erro);
        })
        .catch((erro) => avisarFalhaNaConversa("WhatsApp QR Code", erro));
    } else if (!viaBaileys && aberta.canal === "WhatsApp" && (aberta.contato || contatoDaConversa?.whatsapp)) {
      fetch("/api/integracoes/meta/whatsapp/enviar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ destinatario: aberta.contato ?? contatoDaConversa?.whatsapp, texto }),
      })
        .then(async (r) => {
          if (!r.ok) throw new Error(((await r.json()) as { erro?: string }).erro);
        })
        .catch((erro) => avisarFalhaNaConversa("WhatsApp Meta", erro));
    } else if (!viaBaileys && aberta.canal === "Instagram" && aberta.contato) {
      // Instagram tem rota própria: o destinatário é o id interno de quem escreveu (guardado em
      // `Conversa.contato`), não um telefone. Sem este ramo, conversa do Direct caía no aviso de
      // "sem número de WhatsApp" — o CRM recebia a mensagem e não deixava responder.
      fetch("/api/integracoes/instagram/enviar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // `respondendoMid` faz a citação aparecer no Instagram da pessoa também. Sem ele, o
        // vendedor via "Respondendo a…" aqui e a cliente recebia uma mensagem solta do outro lado.
        body: JSON.stringify({ destinatario: aberta.contato, texto, respondendoMid }),
      })
        .then(async (r) => {
          if (!r.ok) throw new Error(((await r.json()) as { erro?: string }).erro);
        })
        .catch((erro) => avisarFalhaNaConversa("Instagram", erro));
    } else if (!viaBaileys) {
      // Nenhum canal real bateu (sem número/contato associado à conversa) — sem isso, a mensagem
      // parecia "sumir": ficava só no estado local, sem nenhum aviso de que não tinha pra onde ir.
      adicionarMensagem({
        tipo: "system",
        texto: "⚠️ Não enviado: essa conversa não tem um canal de envio associado.",
        hora: horaAgora(),
      });
    }
  }

  function enviarMensagemTexto() {
    const texto = mensagemTexto.trim();
    if (!texto) return;
    const viaBaileys = contatoUsaWhatsappNaoOficial();
    adicionarMensagem({
      tipo: "out",
      texto,
      hora: horaAgora(),
      respondendoA: respondendoMensagem ?? undefined,
      canal: viaBaileys ? "whatsapp_nao_oficial" : undefined,
    });
    despacharTexto(texto, respondendoMensagem?.mid);
    setMensagemTexto("");
    setRespondendoMensagem(null);
  }

  /* ---------------------------------------------------------------------- */
  /* Imagem — seleção, drag&drop, colar, edição real e envio                */
  /* ---------------------------------------------------------------------- */

  function abrirUploadImagem() {
    setAnexoAberto(false);
    imagemInputRef.current?.click();
  }

  function validarImagem(file: File): string | null {
    if (!FORMATOS_IMAGEM.includes(file.type)) {
      return "Formato não aceito. Envie uma imagem em JPG, PNG ou WebP.";
    }
    if (file.size > TAMANHO_MAX_IMAGEM) {
      return `Imagem acima do limite permitido (máx. ${formatarTamanho(TAMANHO_MAX_IMAGEM)}).`;
    }
    return null;
  }

  async function adicionarImagens(files: FileList | File[]) {
    setErroAnexo(null);
    const lista = Array.from(files);
    const validas: {
      id: string;
      original: string;
      atual: string;
      nome: string;
      tamanho: number;
    }[] = [];
    for (const file of lista) {
      const erro = validarImagem(file);
      if (erro) {
        setErroAnexo(erro);
        continue;
      }
      try {
        const dataUrl = await lerComoDataUrl(file);
        const id = gerarIdMensagem();
        validas.push({
          id,
          original: dataUrl,
          atual: dataUrl,
          nome: file.name,
          tamanho: file.size,
        });
        setImagemHistorico((prev) => ({
          ...prev,
          [id]: { pilha: [dataUrl], indice: 0 },
        }));
      } catch {
        setErroAnexo("Falha ao processar a imagem. Tente novamente.");
      }
    }
    if (validas.length === 0) return;
    setImagensSelecionadas((prev) => [...prev, ...validas]);
    setImagemAtivaId((atual) => atual ?? validas[0].id);
    setImagemPreviewAberto(true);
  }

  function fecharPreviewImagem() {
    setImagemPreviewAberto(false);
    setImagensSelecionadas([]);
    setImagemAtivaId(null);
    setLegendaImagem("");
    setImagemHistorico({});
    setImagemModoCorte(false);
    setErroAnexo(null);
  }

  function removerImagemSelecionada(id: string) {
    setImagensSelecionadas((prev) => {
      const restante = prev.filter((img) => img.id !== id);
      if (restante.length === 0) {
        fecharPreviewImagem();
      } else if (imagemAtivaId === id) {
        setImagemAtivaId(restante[0].id);
      }
      return restante;
    });
  }

  function imagemAtiva() {
    return imagensSelecionadas.find((img) => img.id === imagemAtivaId) ?? null;
  }

  function aplicarEdicaoImagem(id: string, novoDataUrl: string) {
    setImagensSelecionadas((prev) =>
      prev.map((img) => (img.id === id ? { ...img, atual: novoDataUrl } : img)),
    );
    setImagemHistorico((prev) => {
      const atual = prev[id] ?? { pilha: [novoDataUrl], indice: -1 };
      const pilhaCortada = atual.pilha.slice(0, atual.indice + 1);
      return {
        ...prev,
        [id]: { pilha: [...pilhaCortada, novoDataUrl], indice: pilhaCortada.length },
      };
    });
  }

  function girarImagem90() {
    const img = imagemAtiva();
    if (!img) return;
    const elImg = new Image();
    elImg.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = elImg.height;
      canvas.height = elImg.width;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(elImg, -elImg.width / 2, -elImg.height / 2);
      aplicarEdicaoImagem(img.id, canvas.toDataURL("image/png"));
    };
    elImg.src = img.atual;
  }

  function aplicarCorteImagem() {
    const img = imagemAtiva();
    if (!img) return;
    const elImg = new Image();
    elImg.onload = () => {
      const canvas = document.createElement("canvas");
      const sx = (imagemCorteRect.x / 100) * elImg.width;
      const sy = (imagemCorteRect.y / 100) * elImg.height;
      const sw = (imagemCorteRect.w / 100) * elImg.width;
      const sh = (imagemCorteRect.h / 100) * elImg.height;
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(elImg, sx, sy, sw, sh, 0, 0, sw, sh);
      aplicarEdicaoImagem(img.id, canvas.toDataURL("image/png"));
      setImagemModoCorte(false);
      setImagemCorteRect({ x: 10, y: 10, w: 80, h: 80 });
    };
    elImg.src = img.atual;
  }

  function desfazerEdicaoImagem() {
    const img = imagemAtiva();
    if (!img) return;
    setImagemHistorico((prev) => {
      const h = prev[img.id];
      if (!h || h.indice <= 0) return prev;
      const novoIndice = h.indice - 1;
      setImagensSelecionadas((sels) =>
        sels.map((s) => (s.id === img.id ? { ...s, atual: h.pilha[novoIndice] } : s)),
      );
      return { ...prev, [img.id]: { ...h, indice: novoIndice } };
    });
  }

  function refazerEdicaoImagem() {
    const img = imagemAtiva();
    if (!img) return;
    setImagemHistorico((prev) => {
      const h = prev[img.id];
      if (!h || h.indice >= h.pilha.length - 1) return prev;
      const novoIndice = h.indice + 1;
      setImagensSelecionadas((sels) =>
        sels.map((s) => (s.id === img.id ? { ...s, atual: h.pilha[novoIndice] } : s)),
      );
      return { ...prev, [img.id]: { ...h, indice: novoIndice } };
    });
  }

  function restaurarImagemOriginal() {
    const img = imagemAtiva();
    if (!img) return;
    setImagensSelecionadas((sels) =>
      sels.map((s) => (s.id === img.id ? { ...s, atual: img.original } : s)),
    );
    setImagemHistorico((prev) => ({
      ...prev,
      [img.id]: { pilha: [img.original], indice: 0 },
    }));
  }

  /**
   * Anexo que o CRM ainda não sabe ENTREGAR no canal da conversa.
   *
   * Imagem, vídeo e documento hoje só viram bolha na tela: não existe caminho de envio pra nenhum
   * canal (o WhatsApp oficial exige upload de mídia em duas etapas, o Instagram exige um endereço
   * público do arquivo, e a via QR Code nunca foi ligada nesses tipos). Enquanto isso não existe,
   * a bolha não pode parecer entregue — foi assim que uma foto, um contato e um PDF "saíram" do
   * CRM sem nunca chegar do outro lado. Registrar a falha dentro da conversa é o mínimo: quem está
   * atendendo precisa saber na hora que aquele arquivo não foi, pra mandar por outro caminho.
   */
  function avisarAnexoNaoEnviado(oQue: string) {
    adicionarMensagem({
      tipo: "system",
      texto: `⚠️ ${oQue} não foi enviado: o CRM ainda não envia esse tipo de anexo por ${aberta.canal}. Ele ficou registrado aqui na conversa, mas a pessoa não recebeu.`,
      hora: horaAgora(),
    });
  }

  /**
   * Manda o anexo de verdade quando o canal sabe entregá-lo; avisa quando não sabe.
   *
   * Hoje só o Instagram tem esse caminho (ver `/api/integracoes/instagram/enviar-anexo`). Nos
   * outros canais o comportamento continua sendo dizer que não foi — que é melhor do que a bolha
   * silenciosa de antes, quando o vendedor achava que a proposta tinha chegado.
   *
   * `idBolha` é a mensagem que já apareceu na tela: ela nasce "pendente" e só vira entregue se a
   * Meta aceitar. Falhando, vira erro com o motivo — o duplo tique não pode aparecer num arquivo
   * que a pessoa não recebeu.
   */
  function enviarAnexoPeloCanal(params: {
    idBolha: string;
    oQue: string;
    tipo: "image" | "video" | "audio" | "file";
    dataUrl: string;
    nome: string;
  }) {
    const { idBolha, oQue, tipo, dataUrl, nome } = params;
    const contatoNome = aberta.nome;

    if (aberta.canal !== "Instagram" || !aberta.contato) {
      avisarAnexoNaoEnviado(oQue);
      atualizarMensagem(contatoNome, idBolha, {
        status: "erro",
        erro: `O CRM ainda não envia esse tipo de anexo por ${aberta.canal}.`,
      });
      return;
    }

    fetch("/api/integracoes/instagram/enviar-anexo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ destinatario: aberta.contato, dataUrl, nome, tipo }),
    })
      .then(async (r) => {
        const dados = (await r.json()) as { erro?: string; comoLink?: boolean };
        if (!r.ok) throw new Error(dados.erro);
        atualizarMensagem(contatoNome, idBolha, { status: "entregue", erro: undefined });
        // O Direct não aceita documento — ele vai como link no texto. Dizer isso evita a confusão
        // de o vendedor achar que a pessoa recebeu o arquivo anexado, e deixa claro que existe um
        // endereço em circulação com aquele conteúdo.
        if (dados.comoLink) {
          adicionarMensagem({
            tipo: "system",
            texto: `📎 ${oQue} foi enviado como link: o Instagram não aceita documento anexado na conversa. O link fica disponível por 30 dias.`,
            hora: horaAgora(),
          });
        }
      })
      .catch((erro) => {
        const motivo = erro instanceof Error && erro.message ? erro.message : "motivo desconhecido";
        atualizarMensagem(contatoNome, idBolha, { status: "erro", erro: motivo });
        adicionarMensagem({
          tipo: "system",
          texto: `⚠️ ${oQue} não chegou (Instagram): ${motivo}`,
          hora: horaAgora(),
        });
      });
  }

  async function enviarImagensSelecionadas() {
    if (imagensSelecionadas.length === 0) return;
    setEnviandoImagens(true);
    const idBolha = adicionarMensagem({
      tipo: "out",
      texto: "",
      hora: horaAgora(),
      imagens: imagensSelecionadas.map((img) => ({
        url: img.atual,
        nome: img.nome,
        tamanho: img.tamanho,
      })),
      legenda: legendaImagem.trim() || undefined,
      // "pendente" explícito desliga a simulação de entrega de `adicionarMensagem`: quem decide se
      // isso vira tique é a resposta da Meta, não um temporizador.
      status: "pendente",
    });
    // O Direct manda um anexo por mensagem: a primeira imagem vai como a mídia dessa bolha. Com
    // várias selecionadas, o que passar da primeira fica registrado aqui sem ter sido enviado — e
    // o aviso diz isso, em vez de deixar parecer que todas foram.
    enviarAnexoPeloCanal({
      idBolha,
      oQue: "A imagem",
      tipo: "image",
      dataUrl: imagensSelecionadas[0].atual,
      nome: imagensSelecionadas[0].nome,
    });
    if (imagensSelecionadas.length > 1 && aberta.canal === "Instagram") {
      avisarAnexoNaoEnviado(`As outras ${imagensSelecionadas.length - 1} imagens`);
    }
    setEnviandoImagens(false);
    fecharPreviewImagem();
  }

  function abrirLightbox(urls: string[], indice: number) {
    setLightbox({ urls, indice, zoom: 1 });
  }

  /* ---------------------------------------------------------------------- */
  /* Vídeo — seleção, corte real (in/out), mudo e envio                     */
  /* ---------------------------------------------------------------------- */

  function abrirUploadVideo() {
    setAnexoAberto(false);
    videoInputRef.current?.click();
  }

  function validarVideo(file: File): string | null {
    if (!FORMATOS_VIDEO.includes(file.type) && !file.type.startsWith("video/")) {
      return "Formato não aceito. Envie um vídeo em MP4, MOV ou WebM.";
    }
    if (file.size > TAMANHO_MAX_VIDEO) {
      return `Vídeo acima do limite permitido (máx. ${formatarTamanho(TAMANHO_MAX_VIDEO)}).`;
    }
    return null;
  }

  function adicionarVideo(file: File) {
    setErroAnexo(null);
    setVideoErro(null);
    const erro = validarVideo(file);
    if (erro) {
      setErroAnexo(erro);
      return;
    }
    const url = URL.createObjectURL(file);
    const elVideo = document.createElement("video");
    elVideo.preload = "metadata";
    elVideo.onloadedmetadata = () => {
      if (elVideo.duration > DURACAO_MAX_VIDEO_SEG) {
        setErroAnexo(
          `Vídeo acima da duração permitida (máx. ${DURACAO_MAX_VIDEO_SEG / 60} min).`,
        );
        URL.revokeObjectURL(url);
        return;
      }
      setVideoSelecionado({
        original: file,
        url,
        duracao: elVideo.duration,
        nome: file.name,
        tamanho: file.size,
      });
      setVideoInicio(0);
      setVideoFim(elVideo.duration);
      setVideoMudo(false);
      setLegendaVideo("");
      setVideoPreviewAberto(true);
    };
    elVideo.src = url;
  }

  function fecharPreviewVideo() {
    if (videoSelecionado) URL.revokeObjectURL(videoSelecionado.url);
    setVideoPreviewAberto(false);
    setVideoSelecionado(null);
    setVideoErro(null);
    setVideoProcessando(false);
  }

  /**
   * Corta de verdade o vídeo entre `videoInicio` e `videoFim` (e tira o áudio,
   * se `videoMudo`) reproduzindo o trecho e regravando os frames com
   * MediaRecorder — não é só um controle visual, o arquivo final muda.
   */
  async function processarEEnviarVideo(pularEdicao: boolean) {
    if (!videoSelecionado) return;
    setVideoProcessando(true);
    setVideoErro(null);
    try {
      const precisaCortar =
        !pularEdicao &&
        (videoInicio > 0.05 || videoFim < videoSelecionado.duracao - 0.05);
      const precisaMutar = !pularEdicao && videoMudo;

      let urlFinal = videoSelecionado.url;
      let tamanhoFinal = videoSelecionado.tamanho;
      let duracaoFinal = videoSelecionado.duracao;

      if (precisaCortar || precisaMutar) {
        const blob = await cortarVideoReal(
          videoSelecionado.url,
          videoInicio,
          videoFim,
          precisaMutar,
        );
        urlFinal = await lerComoDataUrl(blob);
        tamanhoFinal = blob.size;
        duracaoFinal = videoFim - videoInicio;
      } else {
        urlFinal = await lerComoDataUrl(videoSelecionado.original);
      }

      const idBolhaVideo = adicionarMensagem({
        tipo: "out",
        texto: "",
        hora: horaAgora(),
        video: {
          url: urlFinal,
          nome: videoSelecionado.nome,
          tamanho: tamanhoFinal,
          duracao: duracaoFinal,
          comAudio: !precisaMutar,
        },
        legenda: legendaVideo.trim() || undefined,
        status: "pendente",
      });
      enviarAnexoPeloCanal({
        idBolha: idBolhaVideo,
        oQue: "O vídeo",
        tipo: "video",
        dataUrl: urlFinal,
        nome: videoSelecionado.nome,
      });
      fecharPreviewVideo();
    } catch {
      setVideoErro("Não deu pra processar o vídeo. Tente enviar sem editar.");
    } finally {
      setVideoProcessando(false);
    }
  }

  function cortarVideoReal(
    url: string,
    inicio: number,
    fim: number,
    mutar: boolean,
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.src = url;
      video.muted = false;
      video.playsInline = true;
      video.onloadedmetadata = () => {
        video.currentTime = inicio;
      };
      video.onseeked = () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Sem contexto de canvas"));
          return;
        }
        const streamVideo = canvas.captureStream();
        let streamFinal: MediaStream = streamVideo;
        if (!mutar) {
          try {
            const streamAudio = (
              video as HTMLVideoElement & { captureStream?: () => MediaStream }
            ).captureStream?.();
            const trilhaAudio = streamAudio?.getAudioTracks()[0];
            if (trilhaAudio) streamVideo.addTrack(trilhaAudio);
            streamFinal = streamVideo;
          } catch {
            streamFinal = streamVideo;
          }
        }
        const gravador = new MediaRecorder(streamFinal, {
          mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
            ? "video/webm;codecs=vp9"
            : "video/webm",
        });
        const pedacos: BlobPart[] = [];
        gravador.ondataavailable = (e) => {
          if (e.data.size > 0) pedacos.push(e.data);
        };
        gravador.onstop = () => {
          resolve(new Blob(pedacos, { type: "video/webm" }));
        };
        gravador.onerror = () => reject(new Error("Falha ao gravar o corte"));

        let quadro: number;
        function desenhar() {
          if (video.currentTime >= fim || video.ended) {
            gravador.stop();
            video.pause();
            cancelAnimationFrame(quadro);
            return;
          }
          ctx!.drawImage(video, 0, 0, canvas.width, canvas.height);
          quadro = requestAnimationFrame(desenhar);
        }
        gravador.start();
        video.play().then(desenhar).catch(reject);
      };
      video.onerror = () => reject(new Error("Falha ao carregar o vídeo"));
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Documento — biblioteca do CRM ou computador                            */
  /* ---------------------------------------------------------------------- */

  function abrirUploadDocumento() {
    setAnexoAberto(false);
    setErroAnexo(null);
    setDocumentoOrigemAberto(true);
  }

  function abrirBibliotecaDocumentos() {
    setDocumentoOrigemAberto(false);
    setBuscaBiblioteca("");
    setCategoriaBiblioteca("Todas");
    setDocumentosSelecionadosBiblioteca([]);
    setBibliotecaAberta(true);
  }

  function abrirUploadDocumentoComputador() {
    setDocumentoOrigemAberto(false);
    documentoInputRef.current?.click();
  }

  function alternarDocumentoBiblioteca(id: string) {
    setDocumentosSelecionadosBiblioteca((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  }

  function enviarDocumentosBiblioteca() {
    const escolhidos = bibliotecaDocumentos.filter((d) =>
      documentosSelecionadosBiblioteca.includes(d.id),
    );
    for (const doc of escolhidos) {
      const idBolha = adicionarMensagem({
        tipo: "out",
        texto: "",
        hora: horaAgora(),
        documento: {
          url: doc.url,
          nome: doc.nome,
          tamanho: doc.tamanho,
          formato: doc.formato,
          origem: "crm",
        },
        status: "pendente",
      });
      enviarAnexoPeloCanal({
        idBolha,
        oQue: `O documento "${doc.nome}"`,
        tipo: "file",
        dataUrl: doc.url,
        nome: doc.nome,
      });
    }
    setBibliotecaAberta(false);
    setDocumentosSelecionadosBiblioteca([]);
  }

  function validarDocumento(file: File): string | null {
    if (file.size > TAMANHO_MAX_DOCUMENTO) {
      return `Documento acima do limite permitido (máx. ${formatarTamanho(TAMANHO_MAX_DOCUMENTO)}).`;
    }
    return null;
  }

  async function adicionarDocumentoComputador(file: File) {
    setErroAnexo(null);
    const erro = validarDocumento(file);
    if (erro) {
      setErroAnexo(erro);
      return;
    }
    const dataUrl = await lerComoDataUrl(file);
    const formato = file.name.split(".").pop()?.toUpperCase() ?? "ARQ";
    setDocumentoComputador({
      file,
      url: dataUrl,
      nome: file.name,
      tamanho: file.size,
      formato,
    });
    setLegendaDocumento("");
  }

  function enviarDocumentoComputador() {
    if (!documentoComputador) return;
    setEnviandoDocumento(true);
    const idBolhaDoc = adicionarMensagem({
      tipo: "out",
      texto: "",
      hora: horaAgora(),
      documento: {
        url: documentoComputador.url,
        nome: documentoComputador.nome,
        tamanho: documentoComputador.tamanho,
        formato: documentoComputador.formato,
        origem: "computador",
      },
      legenda: legendaDocumento.trim() || undefined,
      status: "pendente",
    });
    enviarAnexoPeloCanal({
      idBolha: idBolhaDoc,
      oQue: "O documento",
      tipo: "file",
      dataUrl: documentoComputador.url,
      nome: documentoComputador.nome,
    });
    setEnviandoDocumento(false);
    setDocumentoComputador(null);
    setLegendaDocumento("");
  }

  function abrirContatoPicker() {
    setAnexoAberto(false);
    setContatoPickerAba("crm");
    setContatoPickerEtapa("lista");
    setBuscaContatoPicker("");
    setFiltroEmpresaPicker("");
    setFiltroEtiquetaPicker("");
    setFiltroResponsavelPicker("");
    setSomenteFavoritosPicker(false);
    setContatosSelecionadosPicker([]);
    setContatoPickerErro(null);
    setNovoContatoNome("");
    setNovoContatoSobrenome("");
    setNovoContatoEmpresa("");
    setNovoContatoCargo("");
    setNovoContatoTelefone("");
    setNovoContatoEmail("");
    setNovoContatoObservacao("");
    setNovoContatoErros({});
    setNovoContatoSucesso(false);
    setContatoPickerAberto(true);
  }

  function fecharContatoPicker() {
    setContatoPickerAberto(false);
  }

  function alternarSelecaoContatoPicker(c: Contato) {
    setContatosSelecionadosPicker((prev) =>
      prev.some((s) => s.id === c.id) ? prev.filter((s) => s.id !== c.id) : [...prev, c],
    );
  }

  function removerSelecaoContatoPicker(id: string) {
    setContatosSelecionadosPicker((prev) => prev.filter((s) => s.id !== id));
  }

  async function confirmarEnvioContatos() {
    if (contatosSelecionadosPicker.length === 0) return;
    setContatoPickerEnviando(true);
    setContatoPickerErro(null);
    try {
      const viaBaileys = contatoUsaWhatsappNaoOficial();
      const destinatario = viaBaileys
        ? contatoDaConversa?.whatsapp
        : aberta.canal === "WhatsApp"
          ? aberta.contato ?? contatoDaConversa?.whatsapp
          : undefined;

      for (const c of contatosSelecionadosPicker) {
        const contatoPayload = {
          nome: c.nome,
          whatsapp: previaCampos.telefonePrincipal ? c.whatsapp : undefined,
          telefoneFixo: previaCampos.telefoneAlternativo ? c.telefoneFixo : undefined,
          email: previaCampos.email ? c.email : undefined,
          empresa: previaCampos.empresa ? c.empresa : undefined,
          cargo: previaCampos.cargo ? c.cargo : undefined,
        };
        adicionarMensagem({
          tipo: "out",
          texto: `👤 Contato compartilhado: ${c.nome}`,
          hora: horaAgora(),
          contatoCompartilhado: { ...contatoPayload, initials: c.initials },
        });

        if (aberta.canal === "Instagram") {
          // O cartão de contato é um vCard, formato do WhatsApp — o Direct não tem equivalente.
          // Sem esta parada, o envio ia pra rota do WhatsApp levando o id do Instagram como se
          // fosse telefone: falhava de um jeito confuso, em vez de dizer o que realmente acontece.
          avisarAnexoNaoEnviado(`O contato (${c.nome})`);
          continue;
        }

        if (!destinatario) {
          adicionarMensagem({
            tipo: "system",
            texto: "⚠️ Não enviado: essa conversa não tem um número de WhatsApp associado.",
            hora: horaAgora(),
          });
          continue;
        }

        // Envio real do cartão (vCard) pelo canal certo — mesmo padrão de `enviarMensagemTexto`:
        // a bolha já entrou na conversa acima, o envio roda em segundo plano e qualquer falha vira
        // uma mensagem de sistema, não um toast que some sozinho.
        const rota = viaBaileys ? "/api/integracoes/whatsapp-nao-oficial/enviar" : "/api/integracoes/meta/whatsapp/enviar";
        fetch(rota, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ destinatario, contato: contatoPayload }),
        })
          .then(async (r) => {
            if (!r.ok) throw new Error(((await r.json()) as { erro?: string }).erro);
          })
          .catch((erro) => {
            const motivo = erro instanceof Error && erro.message ? erro.message : "motivo desconhecido";
            adicionarMensagem({
              tipo: "system",
              texto: `⚠️ Falha ao enviar contato (${c.nome}): ${motivo}`,
              hora: horaAgora(),
            });
          });
      }
      fecharContatoPicker();
    } catch {
      setContatoPickerErro("Não deu pra enviar agora. Tente de novo.");
    } finally {
      setContatoPickerEnviando(false);
    }
  }

  function validarNovoContato() {
    const erros: { telefone?: string; email?: string } = {};
    if (novoContatoTelefone.trim() && !/^[\d()+\-.\s]{8,}$/.test(novoContatoTelefone.trim())) {
      erros.telefone = "Telefone inválido";
    }
    if (novoContatoEmail.trim() && !emailValido(novoContatoEmail)) {
      erros.email = "E-mail inválido";
    }
    setNovoContatoErros(erros);
    return Object.keys(erros).length === 0;
  }

  async function salvarNovoContato(enviarDepois: boolean) {
    if (!novoContatoNome.trim() || !validarNovoContato()) return;
    setNovoContatoSalvando(true);
    // `criarContato` já persiste de verdade (ver contatos-context.tsx) — o delay aqui é só pra dar
    // a sensação de salvamento antes de fechar o formulário.
    await new Promise((resolve) => setTimeout(resolve, 350));
    const criado = criarContato({
      nome: novoContatoNome.trim(),
      sobrenome: novoContatoSobrenome.trim() || undefined,
      empresa: novoContatoEmpresa.trim() || undefined,
      cargo: novoContatoCargo.trim() || undefined,
      whatsapp: novoContatoTelefone.trim() || undefined,
      email: novoContatoEmail.trim() || undefined,
    });
    setNovoContatoSalvando(false);
    setNovoContatoSucesso(true);
    if (enviarDepois) {
      setContatosSelecionadosPicker([criado]);
      setContatoPickerEtapa("previa");
      setContatoPickerAba("crm");
    }
  }

  function salvarContatoVcf(contato: { nome: string; whatsapp?: string }) {
    const vcf = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${contato.nome}`,
      contato.whatsapp ? `TEL;TYPE=CELL:${contato.whatsapp}` : "",
      "END:VCARD",
    ]
      .filter(Boolean)
      .join("\n");
    const blob = new Blob([vcf], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${contato.nome}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const empresasPicker = Array.from(
    new Set(contatos.map((c) => c.empresa).filter((v): v is string => Boolean(v))),
  );
  const etiquetasPicker = Array.from(new Set(contatos.flatMap((c) => c.etiquetas ?? [])));
  const responsaveisPicker = Array.from(new Set(contatos.map((c) => c.responsavel)));

  const contatosFiltradosPicker = contatos.filter((c) => {
    const termo = buscaContatoPicker.trim().toLowerCase();
    const bateBusca =
      !termo ||
      c.nome.toLowerCase().includes(termo) ||
      (c.whatsapp ?? "").toLowerCase().includes(termo) ||
      (c.email ?? "").toLowerCase().includes(termo) ||
      (c.empresa ?? "").toLowerCase().includes(termo);
    const bateEmpresa = !filtroEmpresaPicker || c.empresa === filtroEmpresaPicker;
    const bateEtiqueta = !filtroEtiquetaPicker || (c.etiquetas ?? []).includes(filtroEtiquetaPicker);
    const bateResponsavel = !filtroResponsavelPicker || c.responsavel === filtroResponsavelPicker;
    const bateFavorito = !somenteFavoritosPicker || c.favorito;
    return bateBusca && bateEmpresa && bateEtiqueta && bateResponsavel && bateFavorito;
  });

  function enviarLocalizacao(lat: number, lng: number, endereco?: string) {
    adicionarMensagem({
      tipo: "out",
      texto: "📍 Localização enviada",
      hora: horaAgora(),
      localizacao: { lat, lng, endereco },
    });
  }

  /**
   * Compartilha a localização REAL de quem está atendendo.
   *
   * Antes daqui saía um ponto fixo de Goiânia, inventado — a bolha aparecia com "Localização
   * enviada" e o endereço não era o de ninguém, além de nunca sair do CRM. Agora pede a posição ao
   * navegador e manda um link de mapa pelo canal da conversa, que é o que de fato chega do outro
   * lado (nem o Direct nem a via de texto têm um tipo "localização" próprio).
   */
  function compartilharLocalizacao() {
    setAnexoAberto(false);
    setLocalizacaoErro(null);

    if (!navigator.geolocation) {
      setLocalizacaoErro("Este navegador não sabe informar a localização.");
      return;
    }

    setLocalizacaoBuscando(true);
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        setLocalizacaoBuscando(false);
        const { latitude, longitude } = posicao.coords;
        enviarLocalizacao(latitude, longitude);
        // O link vai no texto porque é a única forma de a localização realmente chegar: abre o
        // mapa no aparelho de quem recebe, em qualquer canal.
        despacharTexto(`📍 Minha localização: https://www.google.com/maps?q=${latitude},${longitude}`);
      },
      (erro) => {
        setLocalizacaoBuscando(false);
        // Sem isto o clique simplesmente fechava o menu e nada acontecia — que foi exatamente o
        // que apareceu na tela quando a permissão não foi concedida.
        setLocalizacaoErro(
          erro.code === erro.PERMISSION_DENIED
            ? "Você precisa permitir o acesso à localização no navegador pra compartilhar."
            : "Não deu pra obter sua localização agora. Tente de novo.",
        );
      },
      // Sem `timeout`, `getCurrentPosition` pode ficar pendurado pra sempre — e a pessoa fica
      // olhando pra uma tela que não responde nem dá erro.
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  function inserirEmoji(emoji: string) {
    setMensagemTexto((prev) => prev + emoji);
  }

  const respostasDoFunil = respostasRapidasPorFunil[funilSelecionadoId] ?? [];

  function criarRespostaRapida() {
    const titulo = novaRespostaTitulo.trim();
    const texto = novaRespostaTexto.trim();
    if (!titulo || !texto) return;
    setRespostasRapidasPorFunil((prev) => ({
      ...prev,
      [funilSelecionadoId]: [
        ...(prev[funilSelecionadoId] ?? []),
        { id: `resp-${Date.now()}`, titulo, texto },
      ],
    }));
    setNovaRespostaTitulo("");
    setNovaRespostaTexto("");
  }

  function excluirRespostaRapida(id: string) {
    setRespostasRapidasPorFunil((prev) => ({
      ...prev,
      [funilSelecionadoId]: (prev[funilSelecionadoId] ?? []).filter((r) => r.id !== id),
    }));
  }

  function abrirRespostasGerenciar(rect: DOMRect) {
    const largura = 320;
    const alturaEstimada = 420;
    const margem = 12;
    let left = rect.left;
    let top = rect.top - alturaEstimada - 8;
    if (top < margem) top = rect.bottom + 8;
    if (left + largura > window.innerWidth - margem) {
      left = window.innerWidth - largura - margem;
    }
    if (left < margem) left = margem;
    setRespostasPos({ x: left, y: top });
    setRespostasGerenciarAberto(true);
  }

  function iniciarArrasteRespostas(e: React.MouseEvent) {
    const el = (e.currentTarget as HTMLElement).closest(
      ".wa-respostas-modal",
    ) as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    respostasArrasteRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    function mover(ev: MouseEvent) {
      if (!respostasArrasteRef.current) return;
      setRespostasPos({
        x: ev.clientX - respostasArrasteRef.current.dx,
        y: ev.clientY - respostasArrasteRef.current.dy,
      });
    }
    function soltar() {
      respostasArrasteRef.current = null;
      window.removeEventListener("mousemove", mover);
      window.removeEventListener("mouseup", soltar);
    }
    window.addEventListener("mousemove", mover);
    window.addEventListener("mouseup", soltar);
  }

  function usarRespostaRapida(texto: string) {
    setMensagemTexto(texto);
  }

  /** Acha, entre as conversas individuais já existentes, uma cujo telefone bate com o de um
   * participante do grupo (comparação normalizada — mesma regra usada no back, ver
   * `normalizarTelefoneParaComparacao`) — usado pelo "Enviar mensagem" no painel de participantes.
   * `null` quando ainda não existe conversa individual com essa pessoa (o CRM não cria uma do
   * zero aqui; ela nasce sozinha na primeira mensagem trocada fora do grupo, igual qualquer
   * outra). */
  function conversaIndividualDoParticipante(telefone: string): ConversaReal | null {
    const alvo = normalizarTelefoneParaComparacao(telefone);
    if (!alvo) return null;
    return (
      conversas.find(
        (c) => !c.ehGrupo && c.contato && normalizarTelefoneParaComparacao(c.contato) === alvo,
      ) ?? null
    );
  }

  /** Fábrica de handler de arrastar — usada pelos popups flutuantes menores (mídias, conectar, detalhe do contato). */
  function criarIniciarArraste(
    seletor: string,
    setPos: (p: { x: number; y: number }) => void,
  ) {
    return (e: React.MouseEvent) => {
      const el = (e.currentTarget as HTMLElement).closest(seletor) as HTMLElement | null;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const dx = e.clientX - rect.left;
      const dy = e.clientY - rect.top;
      function mover(ev: MouseEvent) {
        setPos({ x: ev.clientX - dx, y: ev.clientY - dy });
      }
      function soltar() {
        window.removeEventListener("mousemove", mover);
        window.removeEventListener("mouseup", soltar);
      }
      window.addEventListener("mousemove", mover);
      window.addEventListener("mouseup", soltar);
    };
  }

  const automacoesDoFunil = automacoes.filter((a) => a.funilId === funilSelecionadoId);

  /**
   * Botão "rodar automação" manual dentro da conversa. O fluxo migrado tem o
   * mesmo `id` da `Automacao` antiga (ver `migrarAutomacaoParaFluxo`), então dá
   * pra achar o `FluxoAutomacao` real por esse id e rodar `executarFluxo` de
   * verdade a partir do nó logo após o gatilho — assim tags/etapa/responsável
   * mudam de verdade (via as mesmas ligações do `dispararEvento`), em vez de só
   * empurrar texto de `acao.mensagem` pro chat. Chamado explicitamente pelo
   * usuário, então roda mesmo se o fluxo estiver pausado (`ativa: false`) —
   * diferente de `dispararEvento`, que só considera fluxos publicados e ativos.
   */
  function executarAutomacaoNaConversa(automacaoId: string) {
    const automacao = automacoesDoFunil.find((a) => a.id === automacaoId);
    if (!automacao) return;

    const fluxo = fluxos.find((f) => f.id === automacaoId);
    const noGatilho = fluxo?.nodes.find((n) => n.category === "gatilho");
    const primeiraAresta = noGatilho
      ? fluxo?.edges.find((e) => e.source === noGatilho.id)
      : undefined;

    if (fluxo && primeiraAresta) {
      const cardContato = funilSelecionado?.colunas
        .flatMap((c) => c.cards)
        .find((c) => c.nome === aberta.nome);

      const registro = executarFluxo(
        fluxo,
        primeiraAresta.target,
        {
          contato: {
            nome: aberta.nome,
            etiquetas: cardContato?.etiquetas ?? [],
            origem: aberta.origem,
            responsavel: atendenteSelecionado,
            funilId: funilSelecionado?.id,
            etapaTitulo: etapaSelecionada,
          },
        },
        {
          moverEtapa: (funilId, etapaTitulo, contato) =>
            atribuirContatoAoFunil(funilId, etapaTitulo, contato as Omit<NegocioCard, "id"> & { id?: string }),
          salvarContato: (nome, dados) => salvarDadosContato(nome, dados),
          atribuirAtendente: (nome, atendente) => atribuirAtendente(nome, atendente),
          registrarMensagemSimulada: (info) => {
            // Único caso em que "simulado" ainda aparece de verdade no log da
            // conversa — igual o código antigo já fazia com `acao.mensagem`.
            adicionarMensagem({ tipo: "out", texto: info.conteudo, hora: horaAgora() });
          },
          registrarWebhookSimulado: (info) => avisarAutomacao(`Webhook simulado → ${info.url}`),
        },
      );
      registrarExecucao(registro);
    } else {
      // Fallback defensivo — não deveria acontecer, já que todo `Automacao`
      // migrado vira um `FluxoAutomacao` com o mesmo id.
      for (const acao of automacao.acoes) {
        if (
          (acao.tipo === "mensagem" || acao.tipo === "mensagem_interativa") &&
          acao.mensagem
        ) {
          adicionarMensagem({ tipo: "out", texto: acao.mensagem, hora: horaAgora() });
        }
      }
    }

    adicionarHistorico("sistema", `Automação "${automacao.titulo}" executada`);
    avisarAutomacao(`Automação "${automacao.titulo}" executada`);
    setMensagemTexto("");
    setAnexoAberto(false);
  }

  const sugerirAutomacoes = mensagemTexto.startsWith("//");
  const sugerirRespostas = !sugerirAutomacoes && mensagemTexto.startsWith("/");

  /** Botão único "Registrar resultado" — abre o menu com as 5 opções (seção 14 do pedido). */
  function abrirMenuResultado(rect: DOMRect) {
    setResultadoMenuRect(rect);
    setResultadoMenuAberto(true);
  }

  /**
   * Marca venda/perda/reabertura de verdade no `NegocioCard` real (mesmo campo que o Funil usa —
   * ver `marcarDesfecho` em `funil/page.tsx`), em vez de só guardar em `resultadoPorContato` (que
   * é puramente local e se perde ao trocar de aba). Se o contato ainda não tiver negócio em
   * nenhum funil, entra na etapa selecionada do painel (mesmo caminho de `salvarAtribuicao`) antes
   * de marcar — não dá pra fechar um negócio que não existe.
   */
  function atualizarDesfechoNegocio(
    statusFechamento: "ganho" | "perdido" | null,
    motivoPerda: string | null,
    valorOverride?: string,
  ) {
    const nome = aberta.nome;
    const existente = funis
      .flatMap((f) => f.colunas.flatMap((c) => c.cards.map((card) => ({ card, funilId: f.id }))))
      .find((x) => x.card.nome === nome);

    if (!existente) {
      const funilDestino = funilSelecionado ?? funis[0];
      const etapaDestino = funilDestino?.colunas[0];
      if (!funilDestino || !etapaDestino) return;
      atribuirContatoAoFunil(funilDestino.id, etapaDestino.titulo, {
        nome,
        valor: valorOverride || "—",
        origem: (aberta.origem as NegocioCard["origem"]) ?? "Direto",
        dias: "Hoje",
        data: HOJE_ISO,
        statusFechamento,
        motivoPerda,
        dataFechamento: statusFechamento ? HOJE_ISO : null,
      });
      return;
    }

    setFunis((prev) =>
      prev.map((f) =>
        f.id !== existente.funilId
          ? f
          : {
              ...f,
              colunas: f.colunas.map((c) => ({
                ...c,
                cards: c.cards.map((cd) =>
                  cd.nome !== nome
                    ? cd
                    : {
                        ...cd,
                        statusFechamento,
                        motivoPerda,
                        dataFechamento: statusFechamento ? HOJE_ISO : null,
                        valor: valorOverride || cd.valor,
                      },
                ),
              })),
            },
      ),
    );
  }

  function escolherResultado(opcao: "venda" | "perda" | "andamento" | "adiada" | "cancelada") {
    setResultadoMenuAberto(false);
    if (opcao === "andamento") {
      atualizarDesfechoNegocio(null, null);
      setResultadoPorContato((prev) => {
        const next = { ...prev };
        delete next[aberta.nome];
        return next;
      });
      adicionarHistorico("sistema", "Negociação voltou a ficar em andamento");
      avisarAutomacao(`${aberta.nome} marcado como em andamento`);
      return;
    }
    setFormResultado(opcao);
    setVendaProduto("");
    setVendaValor("");
    setVendaFormaPagamento("Pix");
    setVendaObservacao("");
    setAdiadaData("");
    setAdiadaObservacao("");
    setCanceladaMotivo("");
  }

  async function confirmarVenda() {
    setRegistrandoResultado(true);
    atualizarDesfechoNegocio("ganho", null, vendaValor || undefined);
    // Feedback visual — a gravação em si (`setFunis`) já é síncrona; o delay é só pra dar
    // sensação de confirmação antes de fechar o formulário.
    await new Promise((resolve) => setTimeout(resolve, 500));
    setResultadoPorContato((prev) => ({ ...prev, [aberta.nome]: "venda" }));
    adicionarHistorico(
      "sistema",
      `Venda concluída ✅ · ${vendaProduto || "produto/serviço não informado"} · ${vendaValor || "valor não informado"} · ${vendaFormaPagamento}${vendaObservacao ? ` · ${vendaObservacao}` : ""}`,
    );
    avisarAutomacao(`${aberta.nome} marcado como venda`);
    setRegistrandoResultado(false);
    setFormResultado(null);
  }

  function marcarPerda(motivo: string) {
    atualizarDesfechoNegocio("perdido", motivo);
    setResultadoPorContato((prev) => ({ ...prev, [aberta.nome]: "perda" }));
    setMotivoPerdaPorContato((prev) => ({ ...prev, [aberta.nome]: motivo }));
    setEscolhendoMotivo(false);
    adicionarHistorico("sistema", `Negociação perdida · motivo: ${motivo}`);
    avisarAutomacao(`${aberta.nome} marcado como perda (${motivo})`);
    setFormResultado(null);
  }

  function adicionarMotivoCustom() {
    const texto = novoMotivoTexto.trim();
    if (!texto) return;
    setMotivosPerdaCustom((prev) => [...prev, texto]);
    setNovoMotivoTexto("");
  }

  function confirmarAdiada() {
    setResultadoPorContato((prev) => ({ ...prev, [aberta.nome]: "adiada" }));
    adicionarHistorico(
      "sistema",
      `Negociação adiada${adiadaData ? ` pra ${adiadaData}` : ""}${adiadaObservacao ? ` · ${adiadaObservacao}` : ""}`,
    );
    avisarAutomacao(`${aberta.nome} marcado como adiada`);
    setFormResultado(null);
  }

  function confirmarCancelada() {
    setResultadoPorContato((prev) => ({ ...prev, [aberta.nome]: "cancelada" }));
    adicionarHistorico(
      "sistema",
      `Negociação cancelada${canceladaMotivo ? ` · motivo: ${canceladaMotivo}` : ""}`,
    );
    avisarAutomacao(`${aberta.nome} marcado como cancelada`);
    setFormResultado(null);
  }

  function abrirEmailModal() {
    setEmailPara(emailContato || contatoDaConversa?.email || "");
    setEmailAssunto("");
    setEmailPos(null);
    setEmailModalAberto(true);
  }

  function fecharEmailModal() {
    setEmailModalAberto(false);
  }

  function abrirMenuAnexo(rect: DOMRect) {
    setAnexoPosManual(null);
    setAnexoAnchorRect(rect);
    setAnexoAberto(true);
  }

  useEffect(() => {
    if (!anexoAberto) return;
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setAnexoAberto(false);
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [anexoAberto]);

  useEffect(() => {
    if (!configConversasAberto) return;
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") pedirFecharConfig();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configConversasAberto, configAlterado]);

  useEffect(() => {
    if (!gravandoAudio && !audioPreview) return;
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") pedirDescartarGravacao();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gravandoAudio, audioPreview]);

  function iniciarArrasteAnexo(e: React.MouseEvent) {
    const menuEl = (e.currentTarget as HTMLElement).closest(
      ".wa-anexo-menu",
    ) as HTMLElement | null;
    if (!menuEl) return;
    const rect = menuEl.getBoundingClientRect();
    const margem = 8;
    anexoArrasteRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    function mover(ev: MouseEvent) {
      if (!anexoArrasteRef.current) return;
      const x = Math.min(
        Math.max(margem, ev.clientX - anexoArrasteRef.current.dx),
        window.innerWidth - rect.width - margem,
      );
      const y = Math.min(
        Math.max(margem, ev.clientY - anexoArrasteRef.current.dy),
        window.innerHeight - rect.height - margem,
      );
      setAnexoPosManual({ x, y });
    }
    function soltar() {
      anexoArrasteRef.current = null;
      window.removeEventListener("mousemove", mover);
      window.removeEventListener("mouseup", soltar);
    }
    window.addEventListener("mousemove", mover);
    window.addEventListener("mouseup", soltar);
  }

  function iniciarArrasteEmail(e: React.MouseEvent) {
    const modalEl = (e.currentTarget as HTMLElement).closest(
      ".wa-email-modal",
    ) as HTMLElement | null;
    if (!modalEl) return;
    const rect = modalEl.getBoundingClientRect();
    emailArrasteRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    function mover(ev: MouseEvent) {
      if (!emailArrasteRef.current) return;
      setEmailPos({
        x: ev.clientX - emailArrasteRef.current.dx,
        y: ev.clientY - emailArrasteRef.current.dy,
      });
    }
    function soltar() {
      emailArrasteRef.current = null;
      window.removeEventListener("mousemove", mover);
      window.removeEventListener("mouseup", soltar);
    }
    window.addEventListener("mousemove", mover);
    window.addEventListener("mouseup", soltar);
  }

  function iniciarRedimensionarInfo(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = infoWidth;
    function mover(ev: MouseEvent) {
      const delta = startX - ev.clientX;
      const novo = Math.min(680, Math.max(260, startWidth + delta));
      setInfoWidth(novo);
    }
    function soltar() {
      window.removeEventListener("mousemove", mover);
      window.removeEventListener("mouseup", soltar);
    }
    window.addEventListener("mousemove", mover);
    window.addEventListener("mouseup", soltar);
  }

  function enviarEmail() {
    const para = emailPara.trim();
    const assunto = emailAssunto.trim();
    if (!para || !assunto) return;
    const id = `email-${proximoEmailId.current++}`;
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
    adicionarHistorico("email", `E-mail disparado pra ${para} · assunto "${assunto}"`);
    avisarAutomacao(`✓ E-mail enviado pra ${para}`);
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

  function verificarRastreamento(email: {
    aberto: boolean;
    abertoEm?: string;
    assunto: string;
  }) {
    avisarAutomacao(
      email.aberto
        ? `"${email.assunto}" foi lido às ${email.abertoEm}`
        : `"${email.assunto}" ainda não foi aberto pelo destinatário`,
    );
  }

  /**
   * Duplo clique numa mensagem curte/descurte, igual ao Direct do Instagram.
   *
   * Só vale no Instagram: é onde a Meta aceita reagir a uma mensagem já enviada e devolve a reação
   * da outra pessoa pelo webhook. Nos outros canais o coração ficaria só na nossa tela, e a cliente
   * nunca saberia — por isso o duplo clique simplesmente não faz nada lá.
   *
   * A tela muda na hora (otimista) e volta atrás se a Meta recusar: esperar a ida e volta pra
   * pintar o coração faz o duplo clique parecer quebrado.
   */
  async function curtirMensagem(chave: string) {
    if (aberta.canal !== "Instagram") return;
    const mensagens = mensagensExtraPorContato[aberta.nome] ?? [];
    const alvo = mensagens.find((m, i) => (m.id ?? `extra-${i}`) === chave);
    if (!alvo?.id) return;

    const curtir = !alvo.reacaoMinha;
    const idAlvo = alvo.id;
    const aplicar = (valor: string | undefined) =>
      setMensagensExtraPorContato((prev) => ({
        ...prev,
        [aberta.nome]: (prev[aberta.nome] ?? []).map((m) =>
          m.id === idAlvo ? { ...m, reacaoMinha: valor } : m,
        ),
      }));

    setErroCurtir(null);
    aplicar(curtir ? "❤️" : undefined);
    if (curtir) {
      setCoracaoAnimando(chave);
      setTimeout(() => setCoracaoAnimando((atual) => (atual === chave ? null : atual)), 700);
    }

    try {
      const resposta = await fetch("/api/conversas/reagir", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mensagemId: idAlvo, curtir }),
      });
      if (!resposta.ok) {
        const dados = (await resposta.json().catch(() => ({}))) as { erro?: string };
        throw new Error(dados.erro ?? "Não foi possível curtir a mensagem.");
      }
    } catch (e) {
      aplicar(curtir ? undefined : "❤️");
      setErroCurtir(e instanceof Error ? e.message : "Não foi possível curtir a mensagem.");
    }
  }

  /** Coração colado no balão — o da cliente e o meu, quando existem — mais o coração grande que
   * estoura no meio da bolha no momento do duplo clique, como no Direct. */
  function reacaoNaMensagem(msg: ConvMensagem, chave: string) {
    const animando = coracaoAnimando === chave;
    if (!msg.reacaoContato && !msg.reacaoMinha) {
      return animando ? <span className="bubble-coracao-anim">❤️</span> : null;
    }
    return (
      <>
      {animando ? <span className="bubble-coracao-anim">❤️</span> : null}
      <span
        className={`wa-msg-reacao${animando ? " pulando" : ""}`}
        title={
          msg.reacaoContato && msg.reacaoMinha
            ? "Vocês dois curtiram"
            : msg.reacaoContato
              ? "Curtido pelo contato"
              : "Você curtiu"
        }
      >
        {msg.reacaoContato ?? msg.reacaoMinha}
        {msg.reacaoContato && msg.reacaoMinha ? <span className="wa-msg-reacao-2">❤️</span> : null}
      </span>
      </>
    );
  }

  const funilSelecionado =
    funis.find((f) => f.id === funilSelecionadoId) ?? funis[0];

  function trocarFunilSelecionado(novoFunilId: string) {
    setFunilSelecionadoId(novoFunilId);
    setEtapaSelecionada(etapaPadraoPara(novoFunilId));
  }

  function emailValido(valor: string) {
    return valor.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim());
  }

  async function salvarDados() {
    if (!emailValido(emailContato)) {
      setStatusSalvarContato("erro");
      return;
    }
    setStatusSalvarContato("salvando");
    try {
      // `salvarDadosContato` já persiste de verdade (ver contatos-context.tsx) — o delay aqui é só
      // pra dar a sensação de salvamento antes de fechar o formulário.
      await new Promise((resolve) => setTimeout(resolve, 450));
      salvarDadosContato(aberta.nome, {
        email: emailContato.trim() || undefined,
        whatsapp: whatsappContato.trim() || undefined,
        nascimento: nascimentoContato.trim() || undefined,
        endereco: enderecoContato.trim() || undefined,
        sobrenome: sobrenomeContato.trim() || undefined,
        empresa: empresaContato.trim() || undefined,
        cargo: cargoContato.trim() || undefined,
        cidade: cidadeContato.trim() || undefined,
        estado: estadoContato.trim() || undefined,
        pais: paisContato.trim() || undefined,
        canalPreferido: canalPreferidoContato,
        melhorHorario: melhorHorarioContato.trim() || undefined,
      });
      adicionarHistorico("sistema", "Dados do contato atualizados");
      setStatusSalvarContato("sucesso");
      setEditandoContato(false);
      setTimeout(() => setStatusSalvarContato("ocioso"), 2500);
    } catch {
      setStatusSalvarContato("erro");
    }
  }

  function cancelarEdicaoContato() {
    setEmailContato(contatoDaConversa?.email ?? "");
    setWhatsappContato(contatoDaConversa?.whatsapp ?? "");
    setNascimentoContato(contatoDaConversa?.nascimento ?? "");
    setEnderecoContato(contatoDaConversa?.endereco ?? "");
    setSobrenomeContato(contatoDaConversa?.sobrenome ?? "");
    setEmpresaContato(contatoDaConversa?.empresa ?? "");
    setCargoContato(contatoDaConversa?.cargo ?? "");
    setCidadeContato(contatoDaConversa?.cidade ?? "");
    setEstadoContato(contatoDaConversa?.estado ?? "");
    setPaisContato(contatoDaConversa?.pais ?? "");
    setCanalPreferidoContato(contatoDaConversa?.canalPreferido ?? (aberta.canal as Canal));
    setMelhorHorarioContato(contatoDaConversa?.melhorHorario ?? "");
    setStatusSalvarContato("ocioso");
    setEditandoContato(false);
  }

  function trocarResponsavelRapido(novoResponsavel: string) {
    atribuirAtendente(aberta.nome, novoResponsavel);
    if (aberta.id !== CONVERSA_VAZIA.id) atribuirAtendenteConversa(aberta.id, novoResponsavel);
    adicionarHistorico("sistema", `Responsável alterado pra ${novoResponsavel}`);
    avisarAutomacao(`${aberta.nome} agora é atendido por ${novoResponsavel}`);
    setTrocandoResponsavel(false);
  }

  function adicionarEtiquetaRapida() {
    const etiqueta = novaEtiquetaTexto.trim();
    if (!etiqueta) return;
    adicionarEtiqueta(aberta.nome, etiqueta);
    adicionarHistorico("sistema", `Etiqueta "${etiqueta}" adicionada`);
    setNovaEtiquetaTexto("");
  }

  function removerEtiquetaRapida(etiqueta: string) {
    removerEtiqueta(aberta.nome, etiqueta);
    adicionarHistorico("sistema", `Etiqueta "${etiqueta}" removida`);
  }

  function salvarAtribuicao() {
    atribuirAtendente(aberta.nome, atendenteSelecionado);
    if (aberta.id !== CONVERSA_VAZIA.id) atribuirAtendenteConversa(aberta.id, atendenteSelecionado);
    if (funilSelecionado && etapaSelecionada) {
      const cardExistente = funilSelecionado.colunas
        .flatMap((c) => c.cards)
        .find((c) => c.nome === aberta.nome);
      const novoCard: Omit<NegocioCard, "id"> & { id?: string } = {
        id: cardExistente?.id,
        nome: aberta.nome,
        valor: cardExistente?.valor ?? "—",
        origem: cardExistente?.origem ?? (aberta.origem as NegocioCard["origem"]),
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

          // Mesma coisa que arrastar o card no Funil: dispara o motor de
          // fluxos de verdade em cima do mesmo evento de entrada de etapa.
          dispararEvento(
            {
              tipo: "lead_entrou_etapa",
              funilId: funilSelecionado.id,
              etapaId: etapaDestino.id,
              contatoNome: aberta.nome,
            },
            {
              contato: {
                nome: aberta.nome,
                etiquetas: novoCard.etiquetas ?? [],
                origem: novoCard.origem,
                responsavel: atendenteSelecionado,
                funilId: funilSelecionado.id,
                etapaTitulo: etapaDestino.titulo,
              },
            },
            {
              moverEtapa: (funilId, etapaTitulo, contato) =>
                atribuirContatoAoFunil(funilId, etapaTitulo, contato as Omit<NegocioCard, "id"> & { id?: string }),
              salvarContato: (nome, dados) => salvarDadosContato(nome, dados),
              atribuirAtendente: (nome, atendente) => atribuirAtendente(nome, atendente),
              registrarMensagemSimulada: (info) => {
                adicionarMensagem({ tipo: "out", texto: info.conteudo, hora: horaAgora() });
              },
              registrarWebhookSimulado: (info) => avisarAutomacao(`Webhook simulado → ${info.url}`),
            },
          );
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
              className="fsel"
              onClick={(e) => {
                setAtendenteTopRect(e.currentTarget.getBoundingClientRect());
                setAtendenteTopAberto((v) => !v);
              }}
            >
              Atendente: {atendenteTopFiltro} ▾
            </button>
            <FloatingDropdown
              anchorRect={atendenteTopAberto ? atendenteTopRect : null}
              onClose={() => setAtendenteTopAberto(false)}
              width={220}
            >
              <button
                type="button"
                className="dropdown-item"
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => {
                  setAtendenteTopFiltro("Todos");
                  setAtendenteTopAberto(false);
                }}
              >
                <span className="n">Todos</span>
              </button>
              {atendentesDisponiveis.map((nome) => (
                <button
                  type="button"
                  key={nome}
                  className="dropdown-item"
                  style={{ width: "100%", textAlign: "left" }}
                  onClick={() => {
                    setAtendenteTopFiltro(nome);
                    setAtendenteTopAberto(false);
                  }}
                >
                  <span className="n">{nome}</span>
                </button>
              ))}
            </FloatingDropdown>

            <button
              type="button"
              className="fsel"
              onClick={(e) => {
                setCanalTopRect(e.currentTarget.getBoundingClientRect());
                setCanalTopAberto((v) => !v);
              }}
            >
              Canal: {canalTopFiltro} ▾
            </button>
            <FloatingDropdown
              anchorRect={canalTopAberto ? canalTopRect : null}
              onClose={() => setCanalTopAberto(false)}
              width={200}
            >
              <button
                type="button"
                className="dropdown-item"
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => {
                  setCanalTopFiltro("Todos");
                  setCanalTopAberto(false);
                }}
              >
                <span className="n">Todos</span>
              </button>
              {canaisDisponiveis.map((origem) => (
                <button
                  type="button"
                  key={origem}
                  className="dropdown-item"
                  style={{ width: "100%", textAlign: "left" }}
                  onClick={() => {
                    setCanalTopFiltro(origem);
                    setCanalTopAberto(false);
                  }}
                >
                  <span className="n">{origem}</span>
                </button>
              ))}
            </FloatingDropdown>
            {/* Conectar um número é a primeira coisa que se quer fazer numa tela de atendimento
                vazia — antes era preciso sair daqui e ir até Configurações → WhatsApp. */}
            <BotoesConectarWhatsApp />
          </>
        }
      />

      <div className="content wa-content wa-whatsapp">
        <aside className="wa-list">
          <div className="wa-list-head">
            <span>Conversas</span>
            <span className="wa-list-head-acoes">
              <button
                type="button"
                className={`wa-list-refresh${sincronizando ? " spinning" : ""}`}
                aria-label="Recarregar conversas"
                title="Recarregar conversas — use se as mensagens do celular conectado saírem de sincronia"
                onClick={sincronizarConversas}
              >
                <IconRefresh width={14} height={14} />
              </button>
              <button
                type="button"
                className="wa-list-config"
                aria-label="Configurações das conversas"
                title="Configurações das conversas"
                onClick={abrirConfigConversas}
              >
                <IconConfiguracoes width={15} height={15} />
              </button>
            </span>
          </div>
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
                className={`wa-filter-chip${!mostrarArquivadas && filtroConversa === f.valor ? " active" : ""}`}
                aria-pressed={!mostrarArquivadas && filtroConversa === f.valor}
                onClick={() => {
                  setFiltroConversa(f.valor);
                  setMostrarArquivadas(false);
                }}
              >
                {f.label}
              </button>
            ))}
            <button
              type="button"
              className={`wa-filter-chip${mostrarArquivadas ? " active" : ""}`}
              aria-pressed={mostrarArquivadas}
              onClick={() => setMostrarArquivadas((v) => !v)}
            >
              Arquivadas ({conversas.filter((c) => c.arquivada).length})
            </button>
          </div>

          <div className="wa-list-filters">
            {CANAIS_CONVERSA.map((canal) => {
              const quantidade =
                canal.valor === "todos"
                  ? conversas.length
                  : conversas.filter((c) => c.canal === canal.valor).length;
              return (
                <button
                  type="button"
                  key={canal.valor}
                  className={`wa-filter-chip${canalAba === canal.valor ? " active" : ""}`}
                  aria-pressed={canalAba === canal.valor}
                  disabled={canal.emBreve}
                  title={canal.emBreve ? "Ainda não disponível" : undefined}
                  onClick={() => setCanalAba(canal.valor)}
                >
                  {canal.label}
                  {canal.emBreve ? " · em breve" : quantidade > 0 ? ` (${quantidade})` : ""}
                </button>
              );
            })}
          </div>

          <div className="wa-list-rows">
          {conversasFiltradas.length === 0 ? (
            <p className="hint" style={{ padding: 20 }}>
              {carregandoConversas
                ? "Carregando conversas…"
                : conversas.length === 0
                  ? "Nenhuma conversa ainda — conecte um canal em Configurações para começar a receber mensagens de verdade."
                  : "Nenhuma conversa encontrada."}
            </p>
          ) : (
            conversasFiltradas.map((c) => {
              const active = c.id === aberta.id;
              const ultimaExtra = (mensagensExtraPorContato[c.nome] ?? []).at(-1);
              const iconeTipo = ultimaExtra?.imagens ? (
                <IconImage width={12} height={12} />
              ) : ultimaExtra?.video ? (
                <IconVideoCam width={12} height={12} />
              ) : ultimaExtra?.audio ? (
                <IconMic width={12} height={12} />
              ) : ultimaExtra?.documento ? (
                <IconDoc width={12} height={12} />
              ) : ultimaExtra?.localizacao ? (
                <IconLocalizacao width={12} height={12} />
              ) : ultimaExtra?.contatoCompartilhado ? (
                <IconContatos width={12} height={12} />
              ) : null;
              const previaTexto =
                ultimaExtra?.texto ||
                (ultimaExtra?.legenda ?? (iconeTipo ? "Anexo" : "Sem mensagens ainda"));
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  className={`wa-row${active ? " active" : ""}`}
                  aria-pressed={active}
                  onClick={() => {
                    setSelectedId(c.id);
                    setLidas((prev) => (prev.has(c.id) ? prev : new Set(prev).add(c.id)));
                    if (c.naoLidas > 0) marcarConversaLida(c.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedId(c.id);
                      setLidas((prev) => (prev.has(c.id) ? prev : new Set(prev).add(c.id)));
                    }
                  }}
                >
                  <span className="cr1">
                    <span className="avatar">
                      {c.fotoUrl ? <img src={c.fotoUrl} alt="" className="wa-avatar-foto" /> : iniciaisExibidas(c.nome, c.initials)}
                      <CanalBadge canal={c.canal as Canal} />
                    </span>
                    <span className="cname">
                      {fixadas.has(c.id) ? (
                        <span className="wa-pin-icone">
                          <IconPin width={11} height={11} />
                        </span>
                      ) : null}
                      {c.ehGrupo ? (
                        <span className="wa-pin-icone" title="Grupo do WhatsApp">
                          <IconEquipe width={11} height={11} />
                        </span>
                      ) : null}
                      {nomeExibido(c.nome)}
                      {ehFavorita(c) ? (
                        <span className="wa-fav-star">
                          <IconStar width={11} height={11} fill="currentColor" />
                        </span>
                      ) : null}
                      {silenciadas.has(c.id) ? (
                        <span className="wa-mute-icone" title="Silenciada">
                          <IconMudo width={11} height={11} />
                        </span>
                      ) : null}
                    </span>
                    <span className="ctime">{formatarTempoRelativoReal(new Date(c.atualizadoEm))}</span>
                  </span>
                  <span className="cmsg">
                    <span className="cmsg-texto">
                      {ultimaExtra?.tipo === "out" ? (
                        <>
                          Você:{" "}
                          <StatusMensagemIcone status={ultimaExtra.status} />{" "}
                        </>
                      ) : (
                        ""
                      )}
                      {iconeTipo}
                      {iconeTipo ? " " : null}
                      {previaTexto.replace(/\s+/g, " ").trim()}
                    </span>
                    {c.naoLidas && !lidas.has(c.id) ? (
                      <span className="wa-unread-badge">{c.naoLidas}</span>
                    ) : null}
                  </span>
                  <span className="cr3">
                    <span className="tag">
                      {encerradas.has(c.id) ? "Finalizado" : c.status}
                    </span>
                    <span className={`tag ${classeOrigem(c.origem as Parameters<typeof classeOrigem>[0])}`}>
                      {c.origem}
                    </span>
                    {!c.ehGrupo && etapaAtualDoContato(c.nome) ? (
                      <span className="tag wa-etapa-funil-tag" title="Etapa atual no funil">
                        {etapaAtualDoContato(c.nome)}
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className="wa-row-menu-btn"
                    aria-label={`Mais ações — ${c.nome}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setRowMenuRect(e.currentTarget.getBoundingClientRect());
                      setRowMenuAberto(rowMenuAberto === c.id ? null : c.id);
                    }}
                  >
                    ⋮
                  </button>
                  {rowMenuAberto === c.id ? (
                    <FloatingDropdown
                      anchorRect={rowMenuRect}
                      align="right"
                      width={220}
                      onClose={() => setRowMenuAberto(null)}
                    >
                      <button
                        type="button"
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left" }}
                        onClick={() => alternarFixada(c.id)}
                      >
                        <span className="n">
                          {fixadas.has(c.id) ? "Desafixar conversa" : "Fixar conversa"}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left" }}
                        onClick={() => marcarComoNaoLida(c.id)}
                      >
                        <span className="n">Marcar como não lida</span>
                      </button>
                      <button
                        type="button"
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left" }}
                        onClick={() => alternarFavorita(c.id)}
                      >
                        <span className="n">
                          {ehFavorita(c) ? "Remover dos favoritos" : "Favoritar"}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left" }}
                        onClick={() => alternarSilenciada(c.id)}
                      >
                        <span className="n">
                          {silenciadas.has(c.id) ? "Reativar som" : "Silenciar"}
                        </span>
                      </button>
                      <div className="dropdown-sep" />
                      <button
                        type="button"
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left" }}
                        onClick={() => alternarArquivada(c.id, c.arquivada)}
                      >
                        <span className="n">{c.arquivada ? "Desarquivar" : "Arquivar conversa"}</span>
                      </button>
                      <button
                        type="button"
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left" }}
                        onClick={() => encerrarAtendimento(c.id)}
                      >
                        <span className="n">Encerrar atendimento</span>
                      </button>
                      <div className="dropdown-sep" />
                      <button
                        type="button"
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left", color: "var(--danger)" }}
                        onClick={() => {
                          if (window.confirm(`Excluir a conversa com ${c.nome}? Isso apaga as mensagens dela também — não dá pra desfazer.`)) {
                            excluirConversa(c.id);
                          }
                          setRowMenuAberto(null);
                        }}
                      >
                        <span className="n">Excluir conversa</span>
                      </button>
                    </FloatingDropdown>
                  ) : null}
                </div>
              );
            })
          )}
          </div>
        </aside>

        <section className="wa-main">
          <div className="open-conv-h">
            <button
              type="button"
              className="wa-conv-titulo-btn"
              onClick={() => {
                if (aberta.ehGrupo) {
                  setDadosGrupoPos(null);
                  setDadosGrupoAberto(true);
                } else {
                  setMidiasPos(null);
                  setMidiasAberto(true);
                }
              }}
              title={aberta.ehGrupo ? "Ver dados do grupo" : "Ver mídias e arquivos trocados nessa conversa"}
            >
              <div className="avatar">
                {aberta.fotoUrl ? <img src={aberta.fotoUrl} alt="" className="wa-avatar-foto" /> : iniciaisExibidas(aberta.nome, aberta.initials)}
              </div>
              <div>
                <p className="n">
                  {aberta.ehGrupo ? <IconEquipe width={13} height={13} style={{ marginRight: 4, verticalAlign: -2 }} /> : null}
                  {nomeExibido(aberta.nome)}
                </p>
                <p className="s">
                  {aberta.ehGrupo
                    ? `Grupo · ${aberta.participantesGrupo?.length ?? 0} participantes`
                    : /* No Instagram, `contato` é o id interno da thread (algo como
                         "828654933601920") — número que não significa nada pra quem atende e que a
                         pessoa nem pode usar pra achar o perfil. O @ já é o nome exibido acima,
                         então aqui fica só o canal. No WhatsApp, `contato` É o telefone: aí vale. */
                      aberta.canal === "Instagram"
                      ? aberta.canal
                      : `${aberta.canal} · ${aberta.contato}`}
                </p>
              </div>
            </button>
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

          <div
            className={`chat-body wa-fonte-${config.tamanhoFonte}${arrastandoArquivo ? " wa-dragover" : ""}`}
            style={estiloFundoConversa(fundoDaConversa(aberta.id), config.fundoOpacidade)}
            // Um ouvinte só no container em vez de um por bolha: são dez formatos de balão
            // (texto, imagem, áudio, documento, localização...) e repetir o mesmo handler em cada
            // um é onde nasce a variante que ninguém lembrou de atualizar. `data-msg-chave` marca
            // qual mensagem recebeu o duplo clique.
            onDoubleClick={(e) => {
              const alvo = (e.target as HTMLElement).closest<HTMLElement>("[data-msg-chave]");
              const chave = alvo?.dataset.msgChave;
              if (chave) void curtirMensagem(chave);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (e.dataTransfer.types.includes("Files")) setArrastandoArquivo(true);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget === e.target) setArrastandoArquivo(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setArrastandoArquivo(false);
              const arquivos = Array.from(e.dataTransfer.files);
              const imgs = arquivos.filter((f) => f.type.startsWith("image/"));
              const vids = arquivos.filter((f) => f.type.startsWith("video/"));
              const docs = arquivos.filter(
                (f) => !f.type.startsWith("image/") && !f.type.startsWith("video/"),
              );
              if (imgs.length) adicionarImagens(imgs);
              if (vids.length) adicionarVideo(vids[0]);
              if (docs.length) adicionarDocumentoComputador(docs[0]);
            }}
          >
            {arrastandoArquivo ? (
              <div className="wa-dragover-aviso">Solte o arquivo pra anexar</div>
            ) : null}
            {/* A curtida já foi desfeita na tela quando isso aparece — o aviso existe pra explicar
                POR QUE o coração sumiu (janela de 24h vencida, conta desconectada), em vez de
                deixar parecer que o clique não funcionou. */}
            {localizacaoBuscando ? (
              <span className="hint" style={{ alignSelf: "center" }}>
                Obtendo sua localização…
              </span>
            ) : null}
            {localizacaoErro ? (
              <button
                type="button"
                className="wa-campo-erro"
                style={{ alignSelf: "center", background: "none", border: "none", cursor: "pointer" }}
                onClick={() => setLocalizacaoErro(null)}
                title="Dispensar"
              >
                ⚠ {localizacaoErro}
              </button>
            ) : null}
            {erroCurtir ? (
              <button
                type="button"
                className="wa-campo-erro"
                style={{ alignSelf: "center", background: "none", border: "none", cursor: "pointer" }}
                onClick={() => setErroCurtir(null)}
                title="Dispensar"
              >
                ⚠ {erroCurtir}
              </button>
            ) : null}
            {(() => {
              const todasDaConversa = mensagensExtraPorContato[aberta.nome] ?? [];
              const ocultas = todasDaConversa.length - limiteMensagensVisiveis;
              return ocultas > 0 ? (
                <button
                  type="button"
                  className="btn ghost"
                  style={{ display: "block", margin: "8px auto 16px" }}
                  onClick={() => setLimiteMensagensVisiveis((v) => v + 200)}
                >
                  Carregar {Math.min(ocultas, 200)} mensagens anteriores
                </button>
              ) : null;
            })()}
            {(mensagensExtraPorContato[aberta.nome] ?? []).slice(-limiteMensagensVisiveis).map((msg, iRelativo, arr) => {
              const i = (mensagensExtraPorContato[aberta.nome]?.length ?? arr.length) - arr.length + iRelativo;
              const chave = msg.id ?? `extra-${i}`;
              if (mensagensApagadas.has(chave)) return null;
              if (msg.apagadaParaTodos) {
                return (
                  <div className="bubble sistema-apagada" key={chave} data-msg-chave={chave}>
                    Esta mensagem foi apagada.
                  </div>
                );
              }
              return msg.localizacao ? (
                <div
                  key={chave} data-msg-chave={chave}
                  className={`bubble ${msg.tipo} bubble-localizacao`}
                >
                  {botaoMenuMensagem(chave)}
                  {estrelaFavorita(chave)}
                  {reacaoNaMensagem(msg, chave)}
                  <a
                    className="bubble-localizacao-link-area"
                    href={`https://www.google.com/maps?q=${msg.localizacao.lat},${msg.localizacao.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      className="bubble-localizacao-mapa"
                      src={`https://staticmap.openstreetmap.de/staticmap.php?center=${msg.localizacao.lat},${msg.localizacao.lng}&zoom=15&size=280x140&maptype=mapnik&markers=${msg.localizacao.lat},${msg.localizacao.lng},red-pushpin`}
                      alt="Mapa com a localização compartilhada"
                    />
                    <div className="bubble-localizacao-info">
                      <span className="bubble-localizacao-titulo" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <IconLocalizacao width={12} height={12} /> Localização compartilhada
                      </span>
                      {msg.localizacao.endereco ? (
                        <span className="bubble-localizacao-endereco">{msg.localizacao.endereco}</span>
                      ) : (
                        <span className="bubble-localizacao-endereco">
                          {msg.localizacao.lat.toFixed(5)}, {msg.localizacao.lng.toFixed(5)}
                        </span>
                      )}
                      <span className="bubble-localizacao-link">Abrir no mapa →</span>
                    </div>
                  </a>
                  <span className="tm">
                    {msg.hora}
                    {msg.tipo === "out" ? (
                      <StatusMensagemIcone
                        status={msg.status}
                        onTentarNovamente={
                          msg.status === "erro" && msg.id
                            ? () => tentarNovamenteMensagem(msg.id!)
                            : undefined
                        }
                      />
                    ) : null}
                  </span>
                </div>
              ) : msg.contatoCompartilhado ? (
                <div className={`bubble ${msg.tipo} bubble-contato`} key={chave} data-msg-chave={chave}>
                  {botaoMenuMensagem(chave)}
                  {estrelaFavorita(chave)}
                  {reacaoNaMensagem(msg, chave)}
                  <button
                    type="button"
                    className="bubble-contato-area"
                    onClick={() => {
                      setContatoDetalhePos(null);
                      setContatoDetalheAberto(msg.contatoCompartilhado!);
                    }}
                  >
                    <span className="avatar">{msg.contatoCompartilhado.initials}</span>
                    <div className="bubble-contato-info">
                      <span className="bubble-contato-nome">{msg.contatoCompartilhado.nome}</span>
                      {msg.contatoCompartilhado.whatsapp ? (
                        <span className="bubble-contato-numero">{msg.contatoCompartilhado.whatsapp}</span>
                      ) : null}
                    </div>
                  </button>
                  <span className="tm">
                    {msg.hora}
                    {msg.tipo === "out" ? (
                      <StatusMensagemIcone
                        status={msg.status}
                        onTentarNovamente={
                          msg.status === "erro" && msg.id
                            ? () => tentarNovamenteMensagem(msg.id!)
                            : undefined
                        }
                      />
                    ) : null}
                  </span>
                </div>
              ) : msg.imagens && msg.imagens.length > 0 ? (
                <div
                  className={`bubble ${msg.tipo} bubble-midia`}
                  key={chave} data-msg-chave={chave}
                >
                  {botaoMenuMensagem(chave)}
                  {estrelaFavorita(chave)}
                  {reacaoNaMensagem(msg, chave)}
                  {midiaLiberada("imagem", msg.id, msg.imagens?.[0]?.url) ? (
                    <div
                      className={`bubble-imagens${msg.imagens.length > 1 ? " grade" : ""}`}
                    >
                      {msg.imagens.map((img, ix) => (
                        <button
                          type="button"
                          key={`${msg.id}-img-${ix}`}
                          className="bubble-imagem-btn"
                          onClick={() =>
                            abrirLightbox(
                              msg.imagens!.map((im) => im.url),
                              ix,
                            )
                          }
                        >
                          <img src={img.url} alt={img.nome} loading="lazy" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="bubble-midia-bloqueada"
                      onClick={() => liberarMidia(msg.id)}
                    >
                      <IconImage width={18} height={18} />
                      Baixar {msg.imagens.length > 1 ? "imagens" : "imagem"}
                    </button>
                  )}
                  {msg.legenda ? (
                    <p className="bubble-legenda">{msg.legenda}</p>
                  ) : null}
                  <span className="tm">
                    {msg.hora}
                    {msg.tipo === "out" ? (
                      <StatusMensagemIcone
                        status={msg.status}
                        onTentarNovamente={
                          msg.status === "erro" && msg.id
                            ? () => tentarNovamenteMensagem(msg.id!)
                            : undefined
                        }
                      />
                    ) : null}
                  </span>
                </div>
              ) : msg.video ? (
                <div
                  className={`bubble ${msg.tipo} bubble-midia`}
                  key={chave} data-msg-chave={chave}
                >
                  {botaoMenuMensagem(chave)}
                  {estrelaFavorita(chave)}
                  {reacaoNaMensagem(msg, chave)}
                  {midiaLiberada("video", msg.id, msg.video?.url) ? (
                    <video
                      className="bubble-video"
                      src={msg.video.url}
                      controls
                      preload="metadata"
                      muted={!msg.video.comAudio}
                    />
                  ) : (
                    <button
                      type="button"
                      className="bubble-midia-bloqueada"
                      onClick={() => liberarMidia(msg.id)}
                    >
                      <IconVideoCam width={18} height={18} />
                      Baixar vídeo
                    </button>
                  )}
                  {msg.legenda ? (
                    <p className="bubble-legenda">{msg.legenda}</p>
                  ) : null}
                  <span className="tm">
                    {msg.hora}
                    {msg.tipo === "out" ? (
                      <StatusMensagemIcone
                        status={msg.status}
                        onTentarNovamente={
                          msg.status === "erro" && msg.id
                            ? () => tentarNovamenteMensagem(msg.id!)
                            : undefined
                        }
                      />
                    ) : null}
                  </span>
                </div>
              ) : msg.documento ? (
                <div
                  className={`bubble ${msg.tipo} bubble-documento`}
                  key={chave} data-msg-chave={chave}
                >
                  {botaoMenuMensagem(chave)}
                  {estrelaFavorita(chave)}
                  {reacaoNaMensagem(msg, chave)}
                  <a
                    className="bubble-documento-cartao"
                    href={msg.documento.url}
                    download={msg.documento.nome}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="bubble-documento-icone">
                      <IconDoc width={20} height={20} />
                    </span>
                    <span className="bubble-documento-info">
                      <span className="bubble-documento-nome">{msg.documento.nome}</span>
                      <span className="bubble-documento-meta">
                        {msg.documento.formato} · {formatarTamanho(msg.documento.tamanho)}
                      </span>
                    </span>
                  </a>
                  {msg.legenda ? (
                    <p className="bubble-legenda">{msg.legenda}</p>
                  ) : null}
                  <span className="tm">
                    {msg.hora}
                    {msg.tipo === "out" ? (
                      <StatusMensagemIcone
                        status={msg.status}
                        onTentarNovamente={
                          msg.status === "erro" && msg.id
                            ? () => tentarNovamenteMensagem(msg.id!)
                            : undefined
                        }
                      />
                    ) : null}
                  </span>
                </div>
              ) : msg.midiaPendente?.tipo === "audio" ? (
                <div className={`bubble ${msg.tipo}`} key={chave} data-msg-chave={chave}>
                  {botaoMenuMensagem(chave)}
                  {estrelaFavorita(chave)}
                  {reacaoNaMensagem(msg, chave)}
                  <span className="wa-carregar-midia">
                    <span className="wa-participante-foto-carregando" /> 🎤 Carregando áudio…
                  </span>
                  <span className="tm">{msg.hora}</span>
                </div>
              ) : msg.midiaPendente?.tipo === "imagem" ? (
                <div className={`bubble ${msg.tipo}`} key={chave} data-msg-chave={chave}>
                  {botaoMenuMensagem(chave)}
                  {estrelaFavorita(chave)}
                  {reacaoNaMensagem(msg, chave)}
                  <span className="wa-carregar-midia">
                    <span className="wa-participante-foto-carregando" /> 📷 Carregando imagem…
                  </span>
                  <span className="tm">{msg.hora}</span>
                </div>
              ) : msg.audio ? (
                <div
                  className={`bubble ${msg.tipo} bubble-audio`}
                  key={chave} data-msg-chave={chave}
                >
                  {botaoMenuMensagem(chave)}
                  {estrelaFavorita(chave)}
                  {reacaoNaMensagem(msg, chave)}
                  <AudioBubblePlayer
                    audio={msg.audio}
                    tipo={msg.tipo === "in" ? "in" : "out"}
                    velocidadeInicial={config.velocidadeAudioPadrao}
                  />
                  <span className="tm">
                    {msg.hora}
                    {msg.tipo === "out" ? (
                      <StatusMensagemIcone
                        status={msg.status}
                        onTentarNovamente={
                          msg.status === "erro" && msg.id
                            ? () => tentarNovamenteMensagem(msg.id!)
                            : undefined
                        }
                      />
                    ) : null}
                  </span>
                </div>
              ) : (
                <div className={`bubble ${msg.tipo}`} key={chave} data-msg-chave={chave}>
                  {botaoMenuMensagem(chave)}
                  {estrelaFavorita(chave)}
                  {reacaoNaMensagem(msg, chave)}
                  {aberta.ehGrupo && msg.tipo === "in" && msg.remetenteNome ? (
                    <span className="wa-remetente-grupo">{msg.remetenteNome}</span>
                  ) : null}
                  {msg.respondendoA ? (
                    <span className="wa-citacao">
                      <span className="wa-citacao-autor">{msg.respondendoA.autor}</span>
                      <span className="wa-citacao-texto">{msg.respondendoA.texto}</span>
                    </span>
                  ) : null}
                  {msg.texto.length > 500 && !mensagensExpandidas.has(chave) ? (
                    <>
                      {renderizarTextoComLinks(msg.texto.slice(0, 500))}…{" "}
                      <button
                        type="button"
                        className="wa-ler-mais"
                        onClick={() => setMensagensExpandidas((prev) => new Set(prev).add(chave))}
                      >
                        Ler mais
                      </button>
                    </>
                  ) : (
                    renderizarTextoComLinks(msg.texto)
                  )}
                  <span className="tm">
                    {msg.hora}
                    {msg.tipo === "out" ? (
                      <StatusMensagemIcone
                        status={msg.status}
                        onTentarNovamente={
                          msg.status === "erro" && msg.id
                            ? () => tentarNovamenteMensagem(msg.id!)
                            : undefined
                        }
                      />
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="chat-input">
            <button
              type="button"
              className="chat-attach-btn"
              aria-label="Anexar"
              title="Anexar"
              onClick={(e) => {
                if (anexoAberto) {
                  setAnexoAberto(false);
                } else {
                  abrirMenuAnexo(e.currentTarget.getBoundingClientRect());
                }
              }}
            >
              +
            </button>
            <div
              className="chat-input-wrap"
              onClick={() => mensagemInputRef.current?.focus()}
              onPaste={(e) => {
                const imagens = Array.from(e.clipboardData.items)
                  .filter((item) => item.type.startsWith("image/"))
                  .map((item) => item.getAsFile())
                  .filter((f): f is File => f !== null);
                if (imagens.length > 0) {
                  e.preventDefault();
                  adicionarImagens(imagens);
                }
              }}
            >
              {gravandoAudio ? (
                <div className="box chat-audio-gravando">
                  <span className={`chat-audio-rec-dot${audioPausado ? " pausado" : ""}`} aria-hidden="true" />
                  <span className="chat-audio-duracao">
                    {Math.floor(audioSegundos / 60)}:{String(audioSegundos % 60).padStart(2, "0")}
                  </span>
                  <div className="chat-audio-niveis" aria-hidden="true">
                    {(audioNiveis.length > 0 ? audioNiveis : [0.1]).slice(-40).map((n, i) => (
                      <span key={i} style={{ height: `${Math.max(10, n * 100)}%` }} />
                    ))}
                  </div>
                  <span className="chat-audio-status">
                    {audioPausado ? "Pausado" : "Gravando"}
                  </span>
                  <button
                    type="button"
                    className="chat-audio-btn chat-audio-btn-lixeira"
                    aria-label="Excluir gravação"
                    title="Excluir gravação"
                    onClick={pedirDescartarGravacao}
                  >
                    <IconLixeira width={14} height={14} />
                  </button>
                  <button
                    type="button"
                    className="chat-audio-btn"
                    aria-label={audioPausado ? "Continuar gravação" : "Pausar gravação"}
                    title={audioPausado ? "Continuar" : "Pausar"}
                    onClick={pausarOuContinuarGravacao}
                  >
                    {audioPausado ? <IconPlay width={13} height={13} /> : <IconPause width={13} height={13} />}
                  </button>
                  <button
                    type="button"
                    className="chat-audio-btn chat-audio-btn-concluir"
                    aria-label="Concluir gravação"
                    title="Concluir gravação"
                    onClick={concluirGravacao}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <IconCheck width={13} height={13} /> Concluir
                  </button>
                </div>
              ) : audioPreview ? (
                <div className="box chat-audio-previa">
                  <audio
                    ref={audioPreviewElRef}
                    src={audioPreview.url}
                    onPlay={() => setAudioPreviewTocando(true)}
                    onPause={() => setAudioPreviewTocando(false)}
                    onTimeUpdate={(e) => {
                      const el = e.currentTarget;
                      if (audioPreview.duracao) {
                        setAudioPreviewProgresso(el.currentTime / audioPreview.duracao);
                      }
                    }}
                    onEnded={() => {
                      setAudioPreviewTocando(false);
                      setAudioPreviewProgresso(0);
                    }}
                  />
                  <button
                    type="button"
                    className="chat-audio-btn"
                    aria-label={audioPreviewTocando ? "Pausar prévia" : "Ouvir prévia"}
                    title={audioPreviewTocando ? "Pausar" : "Ouvir"}
                    onClick={alternarPreviaAudio}
                  >
                    {audioPreviewTocando ? <IconPause width={13} height={13} /> : <IconPlay width={13} height={13} />}
                  </button>
                  <div className="chat-audio-previa-meio">
                    <AudioWaveformBars
                      waveform={audioPreview.waveform}
                      progresso={audioPreviewProgresso}
                      onSeek={(fracao) => {
                        const el = audioPreviewElRef.current;
                        if (!el) return;
                        el.currentTime = fracao * audioPreview.duracao;
                        setAudioPreviewProgresso(fracao);
                      }}
                    />
                    <span className="chat-audio-duracao">
                      {Math.floor(audioPreview.duracao / 60)}:
                      {String(Math.round(audioPreview.duracao) % 60).padStart(2, "0")}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="chat-audio-btn"
                    aria-label="Gravar de novo"
                    title="Gravar de novo"
                    onClick={regravarAudio}
                  >
                    ↺
                  </button>
                  <button
                    type="button"
                    className="chat-audio-btn chat-audio-btn-lixeira"
                    aria-label="Excluir áudio"
                    title="Excluir áudio"
                    onClick={pedirDescartarGravacao}
                  >
                    <IconLixeira width={14} height={14} />
                  </button>
                  <button
                    type="button"
                    className="chat-audio-btn chat-audio-btn-enviar"
                    aria-label="Enviar áudio"
                    title="Enviar áudio"
                    disabled={audioEnviando}
                    onClick={enviarAudioGravado}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    {audioEnviando ? "Enviando…" : <><IconEnviar width={13} height={13} /> Enviar</>}
                  </button>
                </div>
              ) : (
                <div className="chat-input-campo-coluna">
                  {audioPermissaoErro ? (
                    <div className="chat-audio-erro">
                      <span>{audioPermissaoErro}</span>
                      <button type="button" className="link" onClick={() => setAudioPermissaoErro(null)}>
                        Dispensar
                      </button>
                    </div>
                  ) : null}
                  {respondendoMensagem ? (
                    <div className="chat-respondendo">
                      <span className="chat-respondendo-barra" />
                      <span className="chat-respondendo-texto">
                        <span className="chat-respondendo-autor">
                          Respondendo a {respondendoMensagem.autor}
                        </span>
                        <span className="chat-respondendo-preview">
                          {respondendoMensagem.texto}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="chat-respondendo-fechar"
                        aria-label="Cancelar resposta"
                        onClick={() => setRespondendoMensagem(null)}
                      >
                        <IconClose width={11} height={11} />
                      </button>
                    </div>
                  ) : null}
                  <textarea
                    ref={mensagemInputRef}
                    className="box chat-input-campo"
                    rows={1}
                    placeholder="Digite uma mensagem... (/ para respostas rápidas, // para automações)"
                    value={mensagemTexto}
                    onChange={(e) => setMensagemTexto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      const quebrarLinha = config.teclaEnterEnvia
                        ? e.shiftKey
                        : !(e.ctrlKey || e.metaKey);
                      if (!quebrarLinha) {
                        e.preventDefault();
                        enviarMensagemTexto();
                        setRespondendoMensagem(null);
                      }
                    }}
                  />
                </div>
              )}
              {sugerirRespostas ? (
                <div className="chat-sugestoes">
                  {respostasDoFunil.length === 0 ? (
                    <p className="hint" style={{ padding: "8px 10px" }}>
                      Nenhuma resposta rápida salva pra esse funil ainda.
                    </p>
                  ) : (
                    respostasDoFunil.map((r) => (
                      <button
                        type="button"
                        key={r.id}
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left" }}
                        onClick={() => usarRespostaRapida(r.texto)}
                        title={r.texto}
                      >
                        <span className="n">{r.titulo}</span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
              {sugerirAutomacoes ? (
                <div className="chat-sugestoes">
                  {automacoesDoFunil.length === 0 ? (
                    <p className="hint" style={{ padding: "8px 10px" }}>
                      Nenhuma automação nesse funil ainda.
                    </p>
                  ) : (
                    automacoesDoFunil.map((a) => (
                      <button
                        type="button"
                        key={a.id}
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left" }}
                        onClick={() => executarAutomacaoNaConversa(a.id)}
                      >
                        <span className="n"><IconAutomacoes width={12} height={12} /> {a.titulo}</span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
            {gravandoAudio || audioPreview ? null : (
              <button
                type="button"
                className="chat-emoji-btn"
                aria-label="Emojis"
                title="Emojis"
                onClick={(e) => {
                  setEmojiRect(e.currentTarget.getBoundingClientRect());
                  setEmojiAberto((v) => !v);
                }}
              >
                <IconEmoji strokeWidth={1.4} />
              </button>
            )}
            {gravandoAudio || audioPreview ? null : mensagemTexto.trim() ? (
              <button
                type="button"
                className="chat-mic-btn chat-send-btn"
                aria-label="Enviar mensagem"
                title="Enviar mensagem"
                onClick={() => {
                  enviarMensagemTexto();
                  setRespondendoMensagem(null);
                }}
              >
                <IconEnviar />
              </button>
            ) : (
              <button
                type="button"
                className="chat-mic-btn"
                aria-label="Gravar áudio"
                title="Gravar áudio"
                disabled={audioSolicitandoPermissao}
                onClick={iniciarGravacaoAudio}
              >
                <IconMic />
              </button>
            )}
          </div>

          <input
            ref={imagemInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files?.length) adicionarImagens(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/3gpp"
            style={{ display: "none" }}
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) adicionarVideo(arquivo);
              e.target.value = "";
            }}
          />
          <input
            ref={documentoInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
            style={{ display: "none" }}
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) adicionarDocumentoComputador(arquivo);
              e.target.value = "";
            }}
          />

          {anexoAberto && anexoPos && typeof document !== "undefined"
            ? createPortal(
                <>
                  <div
                    onClick={() => setAnexoAberto(false)}
                    style={{ position: "fixed", inset: 0, zIndex: 190 }}
                  />
                  <div
                    ref={anexoMenuRef}
                    className="wa-anexo-menu wa-anexo-menu-grid"
                    style={{ left: anexoPos.x, top: anexoPos.y }}
                    role="menu"
                    aria-label="Anexar"
                  >
                    <div
                      className="wa-anexo-drag"
                      onMouseDown={iniciarArrasteAnexo}
                      title="Arraste pra mover"
                    >
                      ⠿⠿⠿
                    </div>
                    <div className="wa-anexo-grid">
                      <button
                        type="button"
                        role="menuitem"
                        className="wa-anexo-item"
                        onClick={abrirUploadImagem}
                      >
                        <span className="wa-anexo-icone wa-anexo-icone-imagem">
                          <IconImage width={19} height={19} />
                        </span>
                        <span className="wa-anexo-label">Fotos e imagens</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="wa-anexo-item"
                        onClick={abrirUploadVideo}
                      >
                        <span className="wa-anexo-icone wa-anexo-icone-video">
                          <IconVideoCam width={19} height={19} />
                        </span>
                        <span className="wa-anexo-label">Vídeos</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="wa-anexo-item"
                        onClick={abrirUploadDocumento}
                      >
                        <span className="wa-anexo-icone wa-anexo-icone-documento">
                          <IconDoc width={19} height={19} />
                        </span>
                        <span className="wa-anexo-label">Documentos</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="wa-anexo-item"
                        onClick={abrirContatoPicker}
                      >
                        <span className="wa-anexo-icone wa-anexo-icone-contato">
                          <IconContatos width={19} height={19} />
                        </span>
                        <span className="wa-anexo-label">Contatos</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="wa-anexo-item"
                        onClick={compartilharLocalizacao}
                      >
                        <span className="wa-anexo-icone wa-anexo-icone-localizacao">
                          <IconLocalizacao width={19} height={19} />
                        </span>
                        <span className="wa-anexo-label">Localização</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="wa-anexo-item"
                        onClick={() => {
                          setAnexoAberto(false);
                          setMensagemTexto("//");
                          mensagemInputRef.current?.focus();
                        }}
                      >
                        <span className="wa-anexo-icone wa-anexo-icone-automacao">
                          <IconAutomacoes width={19} height={19} />
                        </span>
                        <span className="wa-anexo-label">Executar automação</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="wa-anexo-item"
                        onClick={(e) => {
                          setAnexoAberto(false);
                          abrirRespostasGerenciar(e.currentTarget.getBoundingClientRect());
                        }}
                      >
                        <span className="wa-anexo-icone wa-anexo-icone-resposta">
                          <IconRespostaRapida width={19} height={19} />
                        </span>
                        <span className="wa-anexo-label">Respostas rápidas</span>
                      </button>
                    </div>
                    {erroAnexo ? (
                      <p className="wa-anexo-erro" role="alert">
                        {erroAnexo}
                      </p>
                    ) : null}
                  </div>
                </>,
                document.body,
              )
            : null}

          {imagemPreviewAberto && imagemAtiva() ? (
            <div className="form-preview-overlay" onClick={fecharPreviewImagem}>
              <div
                className="wa-midia-preview"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="open-conv-h" style={{ padding: 0, marginBottom: 10 }}>
                  <p className="n">
                    {imagensSelecionadas.length > 1
                      ? `${imagensSelecionadas.length} imagens selecionadas`
                      : "Enviar imagem"}
                  </p>
                  <button
                    type="button"
                    className="modal-close-btn"
                    aria-label="Cancelar"
                    onClick={fecharPreviewImagem}
                  >
                    <IconClose width={12} height={12} />
                  </button>
                </div>

                <div className="wa-midia-preview-palco">
                  <img
                    src={imagemAtiva()!.atual}
                    alt={imagemAtiva()!.nome}
                    className="wa-midia-preview-imagem"
                    style={
                      imagemModoCorte
                        ? { clipPath: "none" }
                        : undefined
                    }
                  />
                  {imagemModoCorte ? (
                    <div
                      className="wa-corte-rect"
                      style={{
                        left: `${imagemCorteRect.x}%`,
                        top: `${imagemCorteRect.y}%`,
                        width: `${imagemCorteRect.w}%`,
                        height: `${imagemCorteRect.h}%`,
                      }}
                    />
                  ) : null}
                </div>

                {imagemModoCorte ? (
                  <div className="wa-edicao-toolbar">
                    <label className="hint">
                      X
                      <input
                        type="range"
                        min={0}
                        max={90}
                        value={imagemCorteRect.x}
                        onChange={(e) =>
                          setImagemCorteRect((r) => ({ ...r, x: Number(e.target.value) }))
                        }
                      />
                    </label>
                    <label className="hint">
                      Y
                      <input
                        type="range"
                        min={0}
                        max={90}
                        value={imagemCorteRect.y}
                        onChange={(e) =>
                          setImagemCorteRect((r) => ({ ...r, y: Number(e.target.value) }))
                        }
                      />
                    </label>
                    <label className="hint">
                      Largura
                      <input
                        type="range"
                        min={10}
                        max={100}
                        value={imagemCorteRect.w}
                        onChange={(e) =>
                          setImagemCorteRect((r) => ({ ...r, w: Number(e.target.value) }))
                        }
                      />
                    </label>
                    <label className="hint">
                      Altura
                      <input
                        type="range"
                        min={10}
                        max={100}
                        value={imagemCorteRect.h}
                        onChange={(e) =>
                          setImagemCorteRect((r) => ({ ...r, h: Number(e.target.value) }))
                        }
                      />
                    </label>
                    <button type="button" className="btn primary" onClick={aplicarCorteImagem}>
                      Aplicar corte
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => setImagemModoCorte(false)}
                    >
                      Cancelar corte
                    </button>
                  </div>
                ) : (
                  <div className="wa-edicao-toolbar">
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => setImagemModoCorte(true)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <IconCut width={13} height={13} /> Cortar
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={girarImagem90}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <IconRefresh width={13} height={13} /> Girar
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={desfazerEdicaoImagem}
                    >
                      ↩ Desfazer
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={refazerEdicaoImagem}
                    >
                      ↪ Refazer
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={restaurarImagemOriginal}
                    >
                      Restaurar original
                    </button>
                  </div>
                )}

                {imagensSelecionadas.length > 1 ? (
                  <div className="wa-midia-miniaturas">
                    {imagensSelecionadas.map((img) => (
                      <div
                        key={img.id}
                        className={`wa-midia-miniatura${img.id === imagemAtivaId ? " active" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => setImagemAtivaId(img.id)}
                        >
                          <img src={img.atual} alt={img.nome} />
                        </button>
                        <button
                          type="button"
                          className="wa-midia-miniatura-remover"
                          aria-label={`Remover ${img.nome}`}
                          onClick={() => removerImagemSelecionada(img.id)}
                        >
                          <IconClose width={10} height={10} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="wa-midia-miniatura wa-midia-miniatura-add"
                      aria-label="Adicionar mais imagens"
                      onClick={() => imagemInputRef.current?.click()}
                    >
                      +
                    </button>
                  </div>
                ) : null}

                {erroAnexo ? (
                  <p className="wa-anexo-erro" role="alert">
                    {erroAnexo}
                  </p>
                ) : null}

                <input
                  className="input"
                  style={{ width: "100%", marginTop: 10 }}
                  placeholder="Adicionar legenda…"
                  value={legendaImagem}
                  onChange={(e) => setLegendaImagem(e.target.value)}
                />

                <div className="wa-contato-modal-rodape">
                  <button type="button" className="btn ghost" onClick={fecharPreviewImagem}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={enviandoImagens}
                    onClick={enviarImagensSelecionadas}
                  >
                    {enviandoImagens
                      ? "Enviando…"
                      : `Enviar${imagensSelecionadas.length > 1 ? ` (${imagensSelecionadas.length})` : ""}`}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {videoPreviewAberto && videoSelecionado ? (
            <div className="form-preview-overlay" onClick={fecharPreviewVideo}>
              <div className="wa-midia-preview" onClick={(e) => e.stopPropagation()}>
                <div className="open-conv-h" style={{ padding: 0, marginBottom: 10 }}>
                  <p className="n">Enviar vídeo</p>
                  <button
                    type="button"
                    className="modal-close-btn"
                    aria-label="Cancelar"
                    onClick={fecharPreviewVideo}
                  >
                    <IconClose width={12} height={12} />
                  </button>
                </div>

                <div className="wa-midia-preview-palco">
                  <video
                    ref={videoPreviewRef}
                    src={videoSelecionado.url}
                    controls
                    muted={videoMudo}
                    className="wa-midia-preview-video"
                  />
                </div>

                <div className="wa-video-trim">
                  <span className="hint">
                    Corte: {videoInicio.toFixed(1)}s até {videoFim.toFixed(1)}s de{" "}
                    {videoSelecionado.duracao.toFixed(1)}s
                  </span>
                  <div className="wa-video-trim-sliders">
                    <input
                      type="range"
                      min={0}
                      max={videoSelecionado.duracao}
                      step={0.1}
                      value={videoInicio}
                      onChange={(e) => {
                        const v = Math.min(Number(e.target.value), videoFim - 0.2);
                        setVideoInicio(Math.max(0, v));
                      }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={videoSelecionado.duracao}
                      step={0.1}
                      value={videoFim}
                      onChange={(e) => {
                        const v = Math.max(Number(e.target.value), videoInicio + 0.2);
                        setVideoFim(Math.min(videoSelecionado.duracao, v));
                      }}
                    />
                  </div>
                </div>

                <div className="wa-edicao-toolbar">
                  <button
                    type="button"
                    className={`btn ghost${videoMudo ? " active" : ""}`}
                    onClick={() => setVideoMudo((v) => !v)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    {videoMudo ? (
                      <>
                        <IconMudo width={13} height={13} /> Sem áudio
                      </>
                    ) : (
                      <>
                        <IconVolume width={13} height={13} /> Com áudio
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      setVideoInicio(0);
                      setVideoFim(videoSelecionado.duracao);
                      setVideoMudo(false);
                    }}
                  >
                    ↩ Desfazer edição
                  </button>
                </div>

                {videoErro ? (
                  <p className="wa-anexo-erro" role="alert">
                    {videoErro}
                  </p>
                ) : null}

                <input
                  className="input"
                  style={{ width: "100%", marginTop: 10 }}
                  placeholder="Adicionar legenda…"
                  value={legendaVideo}
                  onChange={(e) => setLegendaVideo(e.target.value)}
                />

                <div className="wa-contato-modal-rodape">
                  <button type="button" className="btn ghost" onClick={fecharPreviewVideo}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={videoProcessando}
                    onClick={() => processarEEnviarVideo(true)}
                  >
                    Enviar sem editar
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={videoProcessando}
                    onClick={() => processarEEnviarVideo(false)}
                  >
                    {videoProcessando ? "Processando…" : "Enviar"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {documentoOrigemAberto ? (
            <div
              className="form-preview-overlay"
              onClick={() => setDocumentoOrigemAberto(false)}
            >
              <div
                className="wa-email-modal wa-contato-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="open-conv-h" style={{ padding: 0, marginBottom: 4 }}>
                  <p className="n">Enviar documento</p>
                  <button
                    type="button"
                    className="modal-close-btn"
                    aria-label="Fechar"
                    onClick={() => setDocumentoOrigemAberto(false)}
                  >
                    <IconClose width={12} height={12} />
                  </button>
                </div>
                <p className="hint" style={{ marginBottom: 14 }}>
                  Escolha um documento já salvo no CRM ou envie um arquivo do computador.
                </p>
                <div className="wa-doc-origem-opcoes">
                  <button
                    type="button"
                    className="wa-doc-origem-opcao"
                    onClick={abrirBibliotecaDocumentos}
                  >
                    <span className="wa-anexo-icone wa-anexo-icone-documento">
                      <IconDoc width={20} height={20} />
                    </span>
                    <span>
                      <span className="n" style={{ display: "block" }}>
                        Escolher documento do CRM
                      </span>
                      <span className="hint">Biblioteca de documentos já salvos no sistema</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="wa-doc-origem-opcao"
                    onClick={abrirUploadDocumentoComputador}
                  >
                    <span className="wa-anexo-icone wa-anexo-icone-documento">
                      <IconDoc width={20} height={20} />
                    </span>
                    <span>
                      <span className="n" style={{ display: "block" }}>
                        Escolher documento do computador
                      </span>
                      <span className="hint">Enviar um arquivo do seu dispositivo</span>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {bibliotecaAberta ? (
            <div className="form-preview-overlay" onClick={() => setBibliotecaAberta(false)}>
              <div
                className="wa-email-modal wa-biblioteca-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="open-conv-h" style={{ padding: 0, marginBottom: 12 }}>
                  <p className="n">Documentos do CRM</p>
                  <button
                    type="button"
                    className="modal-close-btn"
                    aria-label="Fechar"
                    onClick={() => setBibliotecaAberta(false)}
                  >
                    <IconClose width={12} height={12} />
                  </button>
                </div>

                <input
                  className="input"
                  style={{ width: "100%" }}
                  placeholder="Pesquisar documento…"
                  value={buscaBiblioteca}
                  onChange={(e) => setBuscaBiblioteca(e.target.value)}
                />

                <div className="filters-row" style={{ marginTop: 10, marginBottom: 10 }}>
                  {["Todas", ...CATEGORIAS_DOCUMENTO].map((cat) => (
                    <button
                      type="button"
                      key={cat}
                      className={`fchip${categoriaBiblioteca === cat ? " active" : ""}`}
                      onClick={() => setCategoriaBiblioteca(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="wa-biblioteca-lista">
                  {bibliotecaDocumentos
                    .filter(
                      (d) =>
                        (d.tipoMidia ?? "documento") === "documento" &&
                        (categoriaBiblioteca === "Todas" || d.categoria === categoriaBiblioteca) &&
                        d.nome.toLowerCase().includes(buscaBiblioteca.trim().toLowerCase()),
                    )
                    .map((doc) => (
                      <div key={doc.id} className="wa-biblioteca-item">
                        <input
                          type="checkbox"
                          checked={documentosSelecionadosBiblioteca.includes(doc.id)}
                          onChange={() => alternarDocumentoBiblioteca(doc.id)}
                          aria-label={`Selecionar ${doc.nome}`}
                        />
                        <span className="wa-anexo-icone wa-anexo-icone-documento" style={{ width: 32, height: 32 }}>
                          <IconDoc width={16} height={16} />
                        </span>
                        <div className="wa-biblioteca-item-info">
                          <span className="n" style={{ display: "block" }}>{doc.nome}</span>
                          <span className="hint">
                            {doc.categoria} · {doc.formato} · {formatarTamanho(doc.tamanho)} ·{" "}
                            {doc.autor} · atualizado em{" "}
                            {new Date(doc.atualizadoEm).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() =>
                            setDocumentoPreviewAberto({
                              nome: doc.nome,
                              url: doc.url,
                              formato: doc.formato,
                            })
                          }
                        >
                          Visualizar
                        </button>
                      </div>
                    ))}
                  {bibliotecaDocumentos.filter(
                    (d) =>
                      (d.tipoMidia ?? "documento") === "documento" &&
                      (categoriaBiblioteca === "Todas" || d.categoria === categoriaBiblioteca) &&
                      d.nome.toLowerCase().includes(buscaBiblioteca.trim().toLowerCase()),
                  ).length === 0 ? (
                    <p className="hint" style={{ padding: 16 }}>
                      Nenhum documento encontrado.
                    </p>
                  ) : null}
                </div>

                <div className="wa-contato-modal-rodape">
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setBibliotecaAberta(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={documentosSelecionadosBiblioteca.length === 0}
                    onClick={enviarDocumentosBiblioteca}
                  >
                    Enviar
                    {documentosSelecionadosBiblioteca.length > 0
                      ? ` (${documentosSelecionadosBiblioteca.length})`
                      : ""}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {documentoPreviewAberto ? (
            <div
              className="form-preview-overlay"
              onClick={() => setDocumentoPreviewAberto(null)}
            >
              <div
                className="wa-doc-visualizador"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="open-conv-h" style={{ padding: 0, marginBottom: 10 }}>
                  <p className="n">{documentoPreviewAberto.nome}</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <a
                      className="btn ghost"
                      href={documentoPreviewAberto.url}
                      download={documentoPreviewAberto.nome}
                    >
                      Baixar
                    </a>
                    <button
                      type="button"
                      className="modal-close-btn"
                      aria-label="Fechar"
                      onClick={() => setDocumentoPreviewAberto(null)}
                    >
                      <IconClose width={12} height={12} />
                    </button>
                  </div>
                </div>
                <iframe
                  src={documentoPreviewAberto.url}
                  title={documentoPreviewAberto.nome}
                  className="wa-doc-visualizador-frame"
                />
              </div>
            </div>
          ) : null}

          {documentoComputador ? (
            <div
              className="form-preview-overlay"
              onClick={() => setDocumentoComputador(null)}
            >
              <div className="wa-email-modal wa-contato-modal" onClick={(e) => e.stopPropagation()}>
                <div className="open-conv-h" style={{ padding: 0, marginBottom: 14 }}>
                  <p className="n">Enviar documento</p>
                  <button
                    type="button"
                    className="modal-close-btn"
                    aria-label="Cancelar"
                    onClick={() => setDocumentoComputador(null)}
                  >
                    <IconClose width={12} height={12} />
                  </button>
                </div>
                <div className="wa-biblioteca-item" style={{ border: "1px solid var(--line)", borderRadius: 10 }}>
                  <span className="wa-anexo-icone wa-anexo-icone-documento">
                    <IconDoc width={18} height={18} />
                  </span>
                  <div className="wa-biblioteca-item-info">
                    <span className="n" style={{ display: "block" }}>{documentoComputador.nome}</span>
                    <span className="hint">
                      {documentoComputador.formato} · {formatarTamanho(documentoComputador.tamanho)}
                    </span>
                  </div>
                </div>
                {erroAnexo ? (
                  <p className="wa-anexo-erro" role="alert">
                    {erroAnexo}
                  </p>
                ) : null}
                <input
                  className="input"
                  style={{ width: "100%", marginTop: 10 }}
                  placeholder="Adicionar uma mensagem (opcional)…"
                  value={legendaDocumento}
                  onChange={(e) => setLegendaDocumento(e.target.value)}
                />
                <div className="wa-contato-modal-rodape">
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setDocumentoComputador(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => documentoInputRef.current?.click()}
                  >
                    Substituir arquivo
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={enviandoDocumento}
                    onClick={enviarDocumentoComputador}
                  >
                    {enviandoDocumento ? "Enviando…" : "Enviar"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {lightbox ? (
            <div
              className="wa-lightbox-overlay"
              onClick={() => setLightbox(null)}
            >
              <button
                type="button"
                className="wa-lightbox-fechar"
                aria-label="Fechar"
                onClick={() => setLightbox(null)}
              >
                <IconClose width={12} height={12} />
              </button>
              {lightbox.urls.length > 1 ? (
                <button
                  type="button"
                  className="wa-lightbox-nav wa-lightbox-nav-prev"
                  aria-label="Imagem anterior"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightbox((lb) =>
                      lb
                        ? {
                            ...lb,
                            indice: (lb.indice - 1 + lb.urls.length) % lb.urls.length,
                            zoom: 1,
                          }
                        : lb,
                    );
                  }}
                >
                  ‹
                </button>
              ) : null}
              <img
                src={lightbox.urls[lightbox.indice]}
                alt="Imagem em tamanho maior"
                className="wa-lightbox-imagem"
                style={{ transform: `scale(${lightbox.zoom})` }}
                onClick={(e) => e.stopPropagation()}
              />
              {lightbox.urls.length > 1 ? (
                <button
                  type="button"
                  className="wa-lightbox-nav wa-lightbox-nav-next"
                  aria-label="Próxima imagem"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightbox((lb) =>
                      lb ? { ...lb, indice: (lb.indice + 1) % lb.urls.length, zoom: 1 } : lb,
                    );
                  }}
                >
                  ›
                </button>
              ) : null}
              <div className="wa-lightbox-acoes" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() =>
                    setLightbox((lb) => (lb ? { ...lb, zoom: Math.max(1, lb.zoom - 0.25) } : lb))
                  }
                >
                  − Zoom
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() =>
                    setLightbox((lb) => (lb ? { ...lb, zoom: Math.min(3, lb.zoom + 0.25) } : lb))
                  }
                >
                  + Zoom
                </button>
                <a
                  className="btn ghost"
                  href={lightbox.urls[lightbox.indice]}
                  download={`imagem-${lightbox.indice + 1}`}
                >
                  Baixar
                </a>
              </div>
            </div>
          ) : null}

          {configConversasAberto ? (
            <div className="form-preview-overlay" onClick={pedirFecharConfig}>
              <div
                className="wa-config-modal-shell"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Configurações das conversas"
              >
                <div className="wa-modal-header">
                  <span className="wa-modal-header-icone" aria-hidden="true">
                    <IconConfiguracoes width={18} height={18} />
                  </span>
                  <span className="wa-modal-header-textos">
                    <p className="wa-modal-header-titulo">Configurações das conversas</p>
                    <p className="wa-modal-header-desc">
                      Personalize a aparência, a privacidade, os áudios e as notificações.
                    </p>
                  </span>
                  <button
                    type="button"
                    className="modal-close-btn"
                    aria-label="Fechar"
                    onClick={pedirFecharConfig}
                  >
                    <IconClose width={12} height={12} />
                  </button>
                </div>

                <div className="wa-config-tabs" role="tablist" aria-label="Categorias de configuração">
                  {(
                    [
                      { id: "aparencia", label: "Aparência" },
                      { id: "privacidade", label: "Privacidade" },
                      { id: "notificacoes", label: "Notificações" },
                      { id: "preferencias", label: "Preferências" },
                    ] as const
                  ).map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      role="tab"
                      aria-selected={configAba === t.id}
                      className={`wa-config-tab${configAba === t.id ? " on" : ""}`}
                      onClick={() => setConfigAba(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="wa-config-scroll">
                  {configAba === "aparencia" ? (
                    <div className="wa-config-secao">
                      <p className="int-group-h" style={{ padding: 0, marginBottom: 8 }}>
                        Fundo da conversa
                      </p>

                      <div
                        className="wa-config-fundo-preview"
                        style={estiloFundoConversa(
                          fundoEscopoForm === "atual"
                            ? (configRascunho.fundoPorConversa[aberta.id] ?? configRascunho.fundo)
                            : configRascunho.fundo,
                          configRascunho.fundoOpacidade,
                        )}
                      >
                        <span className="bubble in">
                          Oi! Vi o anúncio, ainda dá pra agendar essa semana?
                          <span className="tm">09:14</span>
                        </span>
                        <span className="bubble out">
                          Consigo sim, te encaixo quinta às 14h
                          <span className="tm">
                            09:16 <StatusMensagemIcone status="lido" />
                          </span>
                        </span>
                      </div>

                      <div className="filters-row" style={{ marginTop: 10, marginBottom: 6 }}>
                        <button
                          type="button"
                          className={`fchip${fundoEscopoForm === "todas" ? " active" : ""}`}
                          onClick={() => setFundoEscopoForm("todas")}
                        >
                          Aplicar em todas as conversas
                        </button>
                        <button
                          type="button"
                          className={`fchip${fundoEscopoForm === "atual" ? " active" : ""}`}
                          onClick={() => setFundoEscopoForm("atual")}
                        >
                          Só nessa conversa
                        </button>
                      </div>

                      <p className="hint" style={{ marginBottom: 8 }}>
                        Escolha o fundo
                      </p>
                      {(() => {
                        const fundoAtual =
                          fundoEscopoForm === "atual"
                            ? (configRascunho.fundoPorConversa[aberta.id] ?? configRascunho.fundo)
                            : configRascunho.fundo;
                        // Cor mostrada na amostra do cartão "Cor sólida": a escolhida, ou um cinza
                        // neutro enquanto nenhuma foi. Sem um valor aqui o `input[type=color]`
                        // assumiria preto sozinho, sugerindo uma escolha que ninguém fez.
                        const corEscolhida = fundoAtual.tipo === "cor" ? fundoAtual.cor : "#e6e8f0";
                        const aplicar = (fundo: FundoConversa) =>
                          setConfigRascunho((prev) =>
                            aplicarFundoRascunho(prev, fundo, fundoEscopoForm, aberta.id),
                          );
                        return (
                          <div className="wa-fundo-opcoes">
                            <button
                              type="button"
                              className={`wa-fundo-card${fundoAtual.tipo === "padrao" ? " sel" : ""}`}
                              aria-pressed={fundoAtual.tipo === "padrao"}
                              onClick={() => {
                                setErroFundoImagem(null);
                                aplicar({ tipo: "padrao" });
                              }}
                            >
                              <span className="wa-fundo-amostra wa-fundo-amostra-branco" />
                              <span className="wa-fundo-rotulo">Padrão</span>
                              <span className="wa-fundo-sub">Fundo branco</span>
                              {fundoAtual.tipo === "padrao" ? (
                                <span className="wa-fundo-check">
                                  <IconCheck width={12} height={12} />
                                </span>
                              ) : null}
                            </button>

                            <button
                              type="button"
                              className={`wa-fundo-card${fundoAtual.tipo === "imagem" ? " sel" : ""}`}
                              aria-pressed={fundoAtual.tipo === "imagem"}
                              onClick={() => fundoUploadInputRef.current?.click()}
                            >
                              <span
                                className={`wa-fundo-amostra${fundoAtual.tipo === "imagem" ? "" : " wa-fundo-amostra-vazia"}`}
                                style={
                                  fundoAtual.tipo === "imagem"
                                    ? {
                                        backgroundImage: `url(${fundoAtual.url})`,
                                        backgroundSize: "cover",
                                        backgroundPosition: "center",
                                      }
                                    : undefined
                                }
                              >
                                {fundoAtual.tipo === "imagem" ? null : "+"}
                              </span>
                              <span className="wa-fundo-rotulo">Imagem</span>
                              <span className="wa-fundo-sub">
                                {fundoAtual.tipo === "imagem" ? "Trocar imagem" : "Do computador"}
                              </span>
                              {fundoAtual.tipo === "imagem" ? (
                                <span className="wa-fundo-check">
                                  <IconCheck width={12} height={12} />
                                </span>
                              ) : null}
                            </button>

                            <button
                              type="button"
                              className={`wa-fundo-card${fundoAtual.tipo === "cor" ? " sel" : ""}`}
                              aria-pressed={fundoAtual.tipo === "cor"}
                              onClick={() => fundoCorInputRef.current?.click()}
                            >
                              <span className="wa-fundo-amostra" style={{ background: corEscolhida }} />
                              <span className="wa-fundo-rotulo">Cor sólida</span>
                              <span className="wa-fundo-sub">
                                {fundoAtual.tipo === "cor" ? corEscolhida.toUpperCase() : "Escolher cor"}
                              </span>
                              {fundoAtual.tipo === "cor" ? (
                                <span className="wa-fundo-check">
                                  <IconCheck width={12} height={12} />
                                </span>
                              ) : null}
                            </button>

                            {/* Os dois inputs ficam escondidos: quem abre o seletor é o cartão
                                inteiro, não um controle pequeno ao lado dele. */}
                            <input
                              ref={fundoCorInputRef}
                              type="color"
                              className="wa-fundo-input-oculto"
                              value={corEscolhida}
                              onChange={(e) => aplicar({ tipo: "cor", cor: e.target.value })}
                            />
                            <input
                              ref={fundoUploadInputRef}
                              type="file"
                              accept="image/*"
                              className="wa-fundo-input-oculto"
                              onChange={async (e) => {
                                const f = e.target.files?.[0];
                                e.target.value = "";
                                if (!f) return;
                                if (!f.type.startsWith("image/")) {
                                  setErroFundoImagem("Formato não aceito. Envie uma imagem JPG, PNG ou WebP.");
                                  return;
                                }
                                if (f.size > TAMANHO_MAX_IMAGEM) {
                                  setErroFundoImagem(
                                    `Imagem acima do limite permitido (máx. ${formatarTamanho(TAMANHO_MAX_IMAGEM)}).`,
                                  );
                                  return;
                                }
                                setErroFundoImagem(null);
                                const url = await lerComoDataUrl(f);
                                aplicar({ tipo: "imagem", url });
                              }}
                            />
                          </div>
                        );
                      })()}
                      {erroFundoImagem ? <p className="wa-campo-erro">{erroFundoImagem}</p> : null}

                      <label className="hint" style={{ display: "block", marginTop: 10 }}>
                        Intensidade do fundo · {configRascunho.fundoOpacidade}%
                        <input
                          type="range"
                          min={20}
                          max={100}
                          value={configRascunho.fundoOpacidade}
                          onChange={(e) =>
                            setConfigRascunho((prev) => ({
                              ...prev,
                              fundoOpacidade: Number(e.target.value),
                            }))
                          }
                          style={{ width: "100%", marginTop: 4 }}
                        />
                      </label>
                      <button
                        type="button"
                        className="link"
                        onClick={() =>
                          setConfigRascunho((prev) => ({ ...prev, fundoOpacidade: 100 }))
                        }
                      >
                        Restaurar intensidade padrão
                      </button>

                      <div className="field" style={{ marginTop: 14 }}>
                        <label>Tamanho da fonte da conversa</label>
                        <div className="filters-row">
                          {(
                            [
                              { valor: "pequena", label: "Pequena" },
                              { valor: "media", label: "Média" },
                              { valor: "grande", label: "Grande" },
                            ] as const
                          ).map((op) => (
                            <button
                              type="button"
                              key={op.valor}
                              className={`fchip${configRascunho.tamanhoFonte === op.valor ? " active" : ""}`}
                              onClick={() =>
                                setConfigRascunho((prev) => ({ ...prev, tamanhoFonte: op.valor }))
                              }
                            >
                              {op.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="field">
                        <label>Densidade das mensagens</label>
                        <div className="filters-row">
                          {(
                            [
                              { valor: "confortavel", label: "Confortável" },
                              { valor: "compacta", label: "Compacta" },
                            ] as const
                          ).map((op) => (
                            <button
                              type="button"
                              key={op.valor}
                              className={`fchip${configRascunho.densidadeMensagens === op.valor ? " active" : ""}`}
                              onClick={() =>
                                setConfigRascunho((prev) => ({ ...prev, densidadeMensagens: op.valor }))
                              }
                            >
                              {op.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="field">
                        <label>Tema</label>
                        <ThemeToggle />
                      </div>
                    </div>
                  ) : null}

                  {configAba === "privacidade" ? (
                    <div className="wa-config-secao">
                      <p className="int-group-h" style={{ padding: 0, marginBottom: 8 }}>
                        Confirmações de leitura
                      </p>
                      <div className="wa-config-radio-lista">
                        {(
                          [
                            { valor: "todos", label: "Ativar para todos os contatos" },
                            { valor: "salvos", label: "Ativar apenas para números salvos" },
                            { valor: "desativado", label: "Desativar" },
                          ] as const
                        ).map((op) => (
                          <button
                            type="button"
                            key={op.valor}
                            className="vendor-row bare"
                            aria-pressed={configRascunho.confirmacaoLeitura === op.valor}
                            onClick={() =>
                              setConfigRascunho((prev) => ({ ...prev, confirmacaoLeitura: op.valor }))
                            }
                          >
                            <span
                              className={`radio${configRascunho.confirmacaoLeitura === op.valor ? " sel" : ""}`}
                            />
                            <span className="body">
                              <span className="n" style={{ display: "block" }}>
                                {op.label}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                      <p className="hint" style={{ marginTop: 8, marginBottom: 14 }}>
                        As confirmações de entrega, leitura e reprodução dependem dos dados
                        fornecidos pelo canal conectado. O CRM não pode criar ou alterar
                        confirmações que não tenham sido recebidas pela integração.
                      </p>

                      <p className="int-group-h" style={{ padding: 0, marginBottom: 4 }}>
                        O que mostrar nas mensagens
                      </p>
                      {(
                        [
                          { chave: "mostrarEstadoEnvio", label: "Mostrar estado de envio" },
                          { chave: "mostrarEstadoEntrega", label: "Mostrar estado de entrega" },
                          { chave: "mostrarEstadoLeitura", label: "Mostrar estado de leitura" },
                          {
                            chave: "mostrarEstadoReproducao",
                            label: "Mostrar estado de reprodução de áudio",
                          },
                          {
                            chave: "mostrarUltimaAtividade",
                            label: "Mostrar horário da última atividade",
                          },
                          {
                            chave: "ocultarPreviaNotificacao",
                            label: "Ocultar prévia da mensagem em notificações",
                          },
                        ] as const
                      ).map((item) => (
                        <div className="toggle-row" key={item.chave}>
                          <span className="tl">{item.label}</span>
                          <Toggle
                            key={`${item.chave}-${configRascunho[item.chave]}`}
                            defaultOn={configRascunho[item.chave]}
                            label={item.label}
                            onToggle={(v) =>
                              setConfigRascunho((prev) => ({ ...prev, [item.chave]: v }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {configAba === "notificacoes" ? (
                    <div className="wa-config-secao">
                      {(
                        [
                          {
                            chave: "somNovaMensagem",
                            label: "Som de nova mensagem",
                            desc: "Toca um som curto sempre que uma mensagem chegar.",
                          },
                          {
                            chave: "notificacaoNovaConversa",
                            label: "Notificação de nova conversa",
                            desc: "Avisa quando um contato inédito escreve pela primeira vez.",
                          },
                          {
                            chave: "notificacaoMencao",
                            label: "Notificação de menção",
                            desc: "Avisa quando alguém da equipe te menciona numa anotação.",
                          },
                          {
                            chave: "notificacaoTarefa",
                            label: "Notificação de tarefa",
                            desc: "Avisa quando uma tarefa vinculada à conversa vence.",
                          },
                          {
                            chave: "previaMensagens",
                            label: "Prévia da mensagem",
                            desc: "Mostra o começo do texto na notificação.",
                          },
                          {
                            chave: "silenciarArquivadas",
                            label: "Silenciar conversas arquivadas",
                            desc: "Não notifica novas mensagens em conversas arquivadas.",
                          },
                          {
                            chave: "somSoSegundoPlano",
                            label: "Som somente quando a aba estiver em segundo plano",
                            desc: "Evita som repetido enquanto você está olhando a conversa.",
                          },
                        ] as const
                      ).map((item) => (
                        <div className="wa-config-notif-item" key={item.chave}>
                          <span className="wa-config-notif-textos">
                            <span className="wa-config-notif-titulo">{item.label}</span>
                            <span className="wa-config-notif-desc">{item.desc}</span>
                          </span>
                          <Toggle
                            key={`${item.chave}-${configRascunho[item.chave]}`}
                            defaultOn={configRascunho[item.chave]}
                            label={item.label}
                            onToggle={(v) =>
                              setConfigRascunho((prev) => ({ ...prev, [item.chave]: v }))
                            }
                          />
                        </div>
                      ))}

                      <div className="wa-config-notif-item">
                        <span className="wa-config-notif-textos">
                          <span className="wa-config-notif-titulo">Notificação do navegador</span>
                          <span className="wa-config-notif-desc">
                            {configPermissaoNotificacao === "granted"
                              ? "Permissão concedida — o navegador pode notificar."
                              : configPermissaoNotificacao === "denied"
                                ? "Bloqueada nas configurações do navegador. Libere o site pra ativar."
                                : configPermissaoNotificacao === "indisponivel"
                                  ? "Esse navegador não suporta notificações."
                                  : "Precisa de permissão do navegador."}
                          </span>
                        </span>
                        {configPermissaoNotificacao === "granted" ? (
                          <Toggle
                            key={`nav-${configRascunho.notificacaoNavegador}`}
                            defaultOn={configRascunho.notificacaoNavegador}
                            label="Notificação do navegador"
                            onToggle={(v) =>
                              setConfigRascunho((prev) => ({ ...prev, notificacaoNavegador: v }))
                            }
                          />
                        ) : (
                          <button
                            type="button"
                            className="btn ghost"
                            disabled={configPermissaoNotificacao === "indisponivel"}
                            onClick={pedirPermissaoNotificacaoNavegador}
                          >
                            {configPermissaoNotificacao === "denied" ? "Bloqueada" : "Permitir"}
                          </button>
                        )}
                      </div>

                      <div className="field" style={{ marginTop: 10 }}>
                        <label>Som das notificações</label>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <select
                            className="input"
                            style={{ flex: 1, cursor: "pointer" }}
                            value={configRascunho.somEscolhido}
                            onChange={(e) =>
                              setConfigRascunho((prev) => ({ ...prev, somEscolhido: e.target.value }))
                            }
                          >
                            {SONS_DISPONIVEIS.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="btn ghost"
                            disabled={configRascunho.somEscolhido === "nenhum"}
                            onClick={testarSomNotificacao}
                            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                          >
                            <IconVolume width={13} height={13} /> Testar som
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {configAba === "preferencias" ? (
                    <div className="wa-config-secao">
                      <div className="field">
                        <label>Tecla Enter</label>
                        <div className="wa-config-radio-lista">
                          <button
                            type="button"
                            className="vendor-row bare"
                            aria-pressed={configRascunho.teclaEnterEnvia}
                            onClick={() =>
                              setConfigRascunho((prev) => ({ ...prev, teclaEnterEnvia: true }))
                            }
                          >
                            <span className={`radio${configRascunho.teclaEnterEnvia ? " sel" : ""}`} />
                            <span className="body">
                              <span className="n" style={{ display: "block" }}>
                                Enter envia · Shift + Enter quebra a linha
                              </span>
                            </span>
                          </button>
                          <button
                            type="button"
                            className="vendor-row bare"
                            aria-pressed={!configRascunho.teclaEnterEnvia}
                            onClick={() =>
                              setConfigRascunho((prev) => ({ ...prev, teclaEnterEnvia: false }))
                            }
                          >
                            <span className={`radio${!configRascunho.teclaEnterEnvia ? " sel" : ""}`} />
                            <span className="body">
                              <span className="n" style={{ display: "block" }}>
                                Enter quebra a linha · Ctrl/Cmd + Enter envia
                              </span>
                            </span>
                          </button>
                        </div>
                      </div>

                      <div className="toggle-row">
                        <span className="tl">Download automático de mídias</span>
                        <Toggle
                          key={`download-${configRascunho.downloadAutomatico}`}
                          defaultOn={configRascunho.downloadAutomatico}
                          label="Download automático de mídias"
                          onToggle={(v) =>
                            setConfigRascunho((prev) => ({ ...prev, downloadAutomatico: v }))
                          }
                        />
                      </div>
                      {configRascunho.downloadAutomatico ? (
                        <div className="filters-row" style={{ marginTop: 4, marginBottom: 10 }}>
                          {["imagem", "video", "audio", "documento"].map((tipo) => (
                            <button
                              type="button"
                              key={tipo}
                              className={`fchip${configRascunho.tiposDownloadAutomatico.includes(tipo) ? " active" : ""}`}
                              onClick={() =>
                                setConfigRascunho((prev) => ({
                                  ...prev,
                                  tiposDownloadAutomatico: prev.tiposDownloadAutomatico.includes(tipo)
                                    ? prev.tiposDownloadAutomatico.filter((t) => t !== tipo)
                                    : [...prev.tiposDownloadAutomatico, tipo],
                                }))
                              }
                            >
                              {tipo === "imagem"
                                ? "Imagens"
                                : tipo === "video"
                                  ? "Vídeos"
                                  : tipo === "audio"
                                    ? "Áudios"
                                    : "Documentos"}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      <div className="toggle-row">
                        <span className="tl">Prévia de links</span>
                        <Toggle
                          key={`links-${configRascunho.previaLinks}`}
                          defaultOn={configRascunho.previaLinks}
                          label="Prévia de links"
                          onToggle={(v) => setConfigRascunho((prev) => ({ ...prev, previaLinks: v }))}
                        />
                      </div>
                      <div className="toggle-row">
                        <span className="tl">Reprodução automática de vídeos</span>
                        <Toggle
                          key={`autoplay-${configRascunho.autoplayVideos}`}
                          defaultOn={configRascunho.autoplayVideos}
                          label="Reprodução automática de vídeos"
                          onToggle={(v) => setConfigRascunho((prev) => ({ ...prev, autoplayVideos: v }))}
                        />
                      </div>
                      <div className="toggle-row">
                        <span className="tl">Manter painel do contato aberto ao trocar de conversa</span>
                        <Toggle
                          key={`painel-${configRascunho.manterPainelContatoAberto}`}
                          defaultOn={configRascunho.manterPainelContatoAberto}
                          label="Manter painel do contato aberto"
                          onToggle={(v) =>
                            setConfigRascunho((prev) => ({ ...prev, manterPainelContatoAberto: v }))
                          }
                        />
                      </div>

                      <div className="field">
                        <label>Velocidade padrão dos áudios</label>
                        <div className="filters-row">
                          {([1, 1.5, 2] as const).map((v) => (
                            <button
                              type="button"
                              key={v}
                              className={`fchip${configRascunho.velocidadeAudioPadrao === v ? " active" : ""}`}
                              onClick={() =>
                                setConfigRascunho((prev) => ({ ...prev, velocidadeAudioPadrao: v }))
                              }
                            >
                              {v}x
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                {configConfirmarFechar ? (
                  <div className="wa-config-confirmar-fechar">
                    <p>Existem alterações não salvas. O que deseja fazer?</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => setConfigConfirmarFechar(false)}
                      >
                        Continuar editando
                      </button>
                      <button type="button" className="btn ghost" onClick={descartarEFecharConfig}>
                        Descartar alterações
                      </button>
                      <button type="button" className="btn primary" onClick={salvarConfigConversas}>
                        Salvar e fechar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="wa-modal-footer">
                    <button type="button" className="btn ghost" onClick={pedirFecharConfig}>
                      Cancelar
                    </button>
                    <button type="button" className="btn ghost" onClick={restaurarPadraoRascunho}>
                      Restaurar padrões
                    </button>
                    <button
                      type="button"
                      className="btn primary"
                      disabled={!configAlterado || configStatusSalvar === "salvando"}
                      onClick={salvarConfigConversas}
                    >
                      {configStatusSalvar === "salvando" ? (
                        "Salvando…"
                      ) : configStatusSalvar === "sucesso" ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <IconCheck width={13} height={13} /> Salvo
                        </span>
                      ) : configStatusSalvar === "erro" ? (
                        "Tentar novamente"
                      ) : (
                        "Salvar alterações"
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {contatoPickerAberto ? (
            <div className="form-preview-overlay" onClick={fecharContatoPicker}>
              <div
                className="wa-config-modal-shell wa-contato-picker-shell"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Enviar contato"
              >
                <div className="wa-modal-header">
                  <span className="wa-modal-header-icone" aria-hidden="true">
                    <IconContatos width={18} height={18} />
                  </span>
                  <span className="wa-modal-header-textos">
                    <p className="wa-modal-header-titulo">Enviar contato</p>
                    <p className="wa-modal-header-desc">
                      Escolha um contato do CRM ou crie um novo para compartilhar nesta
                      conversa.
                    </p>
                  </span>
                  <button
                    type="button"
                    className="modal-close-btn"
                    aria-label="Fechar"
                    onClick={fecharContatoPicker}
                  >
                    <IconClose width={12} height={12} />
                  </button>
                </div>

                {contatoPickerEtapa === "lista" ? (
                  <>
                    <div className="wa-config-tabs" role="tablist" aria-label="Origem do contato">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={contatoPickerAba === "crm"}
                        className={`wa-config-tab${contatoPickerAba === "crm" ? " on" : ""}`}
                        onClick={() => setContatoPickerAba("crm")}
                      >
                        Contatos do CRM
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={contatoPickerAba === "criar"}
                        className={`wa-config-tab${contatoPickerAba === "criar" ? " on" : ""}`}
                        onClick={() => setContatoPickerAba("criar")}
                      >
                        Criar contato
                      </button>
                    </div>

                    <div className="wa-config-scroll">
                      {contatoPickerAba === "crm" ? (
                        <>
                          <input
                            autoFocus
                            className="input"
                            style={{ width: "100%" }}
                            placeholder="Buscar por nome, telefone, e-mail ou empresa…"
                            value={buscaContatoPicker}
                            onChange={(e) => setBuscaContatoPicker(e.target.value)}
                          />
                          <div className="filters-row" style={{ marginTop: 10, marginBottom: 4 }}>
                            <select
                              className="input"
                              style={{ width: "auto", cursor: "pointer" }}
                              value={filtroEmpresaPicker}
                              onChange={(e) => setFiltroEmpresaPicker(e.target.value)}
                            >
                              <option value="">Empresa: todas</option>
                              {empresasPicker.map((emp) => (
                                <option key={emp} value={emp}>
                                  {emp}
                                </option>
                              ))}
                            </select>
                            <select
                              className="input"
                              style={{ width: "auto", cursor: "pointer" }}
                              value={filtroEtiquetaPicker}
                              onChange={(e) => setFiltroEtiquetaPicker(e.target.value)}
                            >
                              <option value="">Etiqueta: todas</option>
                              {etiquetasPicker.map((et) => (
                                <option key={et} value={et}>
                                  {et}
                                </option>
                              ))}
                            </select>
                            <select
                              className="input"
                              style={{ width: "auto", cursor: "pointer" }}
                              value={filtroResponsavelPicker}
                              onChange={(e) => setFiltroResponsavelPicker(e.target.value)}
                            >
                              <option value="">Responsável: todos</option>
                              {responsaveisPicker.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className={`fchip${somenteFavoritosPicker ? " active" : ""}`}
                              onClick={() => setSomenteFavoritosPicker((v) => !v)}
                              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                            >
                              <IconStar width={12} height={12} fill={somenteFavoritosPicker ? "currentColor" : "none"} /> Favoritos
                            </button>
                          </div>

                          {contatosSelecionadosPicker.length > 0 ? (
                            <div className="wa-contato-picker-tray">
                              <div className="wa-contato-picker-tray-topo">
                                <span>{contatosSelecionadosPicker.length} selecionado(s)</span>
                                <button
                                  type="button"
                                  className="link"
                                  onClick={() => setContatosSelecionadosPicker([])}
                                >
                                  Limpar seleção
                                </button>
                              </div>
                              <div className="wa-contato-picker-tray-lista">
                                {contatosSelecionadosPicker.map((c) => (
                                  <span className="wa-contato-picker-tray-item" key={c.id}>
                                    <span className="avatar">{c.initials}</span>
                                    {c.nome}
                                    <button
                                      type="button"
                                      aria-label={`Remover ${c.nome} da seleção`}
                                      onClick={() => removerSelecaoContatoPicker(c.id)}
                                    >
                                      <IconClose width={10} height={10} />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          <div className="wa-contato-picker-lista" role="listbox" aria-multiselectable="true">
                            {contatosFiltradosPicker.length === 0 ? (
                              <p className="hint" style={{ padding: "16px 4px" }}>
                                Nenhum contato encontrado com esses filtros.
                              </p>
                            ) : (
                              contatosFiltradosPicker.map((c) => {
                                const selecionado = contatosSelecionadosPicker.some((s) => s.id === c.id);
                                return (
                                  <div
                                    key={c.id}
                                    role="option"
                                    aria-selected={selecionado}
                                    tabIndex={0}
                                    className={`wa-contato-picker-card${selecionado ? " sel" : ""}`}
                                    onClick={() => alternarSelecaoContatoPicker(c)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        alternarSelecaoContatoPicker(c);
                                      }
                                    }}
                                  >
                                    <span className="avatar">{c.initials}</span>
                                    <span className="wa-contato-picker-card-info">
                                      <span className="wa-contato-picker-card-nome">
                                        {c.nome}
                                        {c.favorito ? (
                                          <IconStar width={10} height={10} fill="currentColor" style={{ marginLeft: 4 }} />
                                        ) : null}
                                      </span>
                                      {c.empresa || c.cargo ? (
                                        <span className="wa-contato-picker-card-linha">
                                          {[c.empresa, c.cargo].filter(Boolean).join(" · ")}
                                        </span>
                                      ) : null}
                                      {c.whatsapp ? (
                                        <span className="wa-contato-picker-card-linha" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                          <IconTelefone width={11} height={11} /> {c.whatsapp}
                                        </span>
                                      ) : null}
                                      {c.email ? (
                                        <span className="wa-contato-picker-card-linha" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                          <IconEmail width={11} height={11} /> {c.email}
                                        </span>
                                      ) : null}
                                      {(c.etiquetas ?? []).length > 0 ? (
                                        <span className="wa-contato-picker-card-tags">
                                          {(c.etiquetas ?? []).map((et) => (
                                            <span className="tag" key={et}>
                                              {et}
                                            </span>
                                          ))}
                                        </span>
                                      ) : null}
                                    </span>
                                    <span className="wa-contato-picker-check" aria-hidden="true">
                                      {selecionado ? <IconCheck width={12} height={12} /> : ""}
                                    </span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="field">
                            <label>Nome *</label>
                            <input
                              className="input"
                              style={{ width: "100%" }}
                              value={novoContatoNome}
                              onChange={(e) => setNovoContatoNome(e.target.value)}
                              placeholder="Nome"
                            />
                          </div>
                          <div className="field">
                            <label>Sobrenome</label>
                            <input
                              className="input"
                              style={{ width: "100%" }}
                              value={novoContatoSobrenome}
                              onChange={(e) => setNovoContatoSobrenome(e.target.value)}
                            />
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <div className="field" style={{ flex: 1 }}>
                              <label>Empresa</label>
                              <input
                                className="input"
                                style={{ width: "100%" }}
                                value={novoContatoEmpresa}
                                onChange={(e) => setNovoContatoEmpresa(e.target.value)}
                              />
                            </div>
                            <div className="field" style={{ flex: 1 }}>
                              <label>Cargo</label>
                              <input
                                className="input"
                                style={{ width: "100%" }}
                                value={novoContatoCargo}
                                onChange={(e) => setNovoContatoCargo(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="field">
                            <label>Telefone</label>
                            <input
                              className={`input${novoContatoErros.telefone ? " wa-input-invalido" : ""}`}
                              style={{ width: "100%" }}
                              value={novoContatoTelefone}
                              onChange={(e) => setNovoContatoTelefone(e.target.value)}
                              placeholder="(00) 90000-0000"
                            />
                            {novoContatoErros.telefone ? (
                              <span className="wa-campo-erro">{novoContatoErros.telefone}</span>
                            ) : null}
                          </div>
                          <div className="field">
                            <label>E-mail</label>
                            <input
                              className={`input${novoContatoErros.email ? " wa-input-invalido" : ""}`}
                              style={{ width: "100%" }}
                              type="email"
                              value={novoContatoEmail}
                              onChange={(e) => setNovoContatoEmail(e.target.value)}
                              placeholder="nome@empresa.com"
                            />
                            {novoContatoErros.email ? (
                              <span className="wa-campo-erro">{novoContatoErros.email}</span>
                            ) : null}
                          </div>
                          <div className="field">
                            <label>Observação</label>
                            <textarea
                              className="input"
                              style={{ width: "100%", minHeight: 60, resize: "vertical" }}
                              value={novoContatoObservacao}
                              onChange={(e) => setNovoContatoObservacao(e.target.value)}
                            />
                          </div>
                          {novoContatoSucesso ? (
                            <p className="wa-status-inline wa-status-sucesso" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <IconCheck width={13} height={13} /> Contato salvo no CRM
                            </p>
                          ) : null}
                        </>
                      )}
                    </div>

                    <div className="wa-modal-footer">
                      <button type="button" className="btn ghost" onClick={fecharContatoPicker}>
                        Cancelar
                      </button>
                      {contatoPickerAba === "crm" ? (
                        <button
                          type="button"
                          className="btn primary"
                          disabled={contatosSelecionadosPicker.length === 0}
                          onClick={() => setContatoPickerEtapa("previa")}
                        >
                          Ver prévia e enviar{" "}
                          {contatosSelecionadosPicker.length > 0
                            ? `(${contatosSelecionadosPicker.length})`
                            : ""}
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn ghost"
                            disabled={!novoContatoNome.trim() || novoContatoSalvando}
                            onClick={() => salvarNovoContato(false)}
                          >
                            {novoContatoSalvando ? "Salvando…" : "Salvar no CRM"}
                          </button>
                          <button
                            type="button"
                            className="btn primary"
                            disabled={!novoContatoNome.trim() || novoContatoSalvando}
                            onClick={() => salvarNovoContato(true)}
                          >
                            {novoContatoSalvando ? "Salvando…" : "Salvar e enviar"}
                          </button>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="wa-config-scroll">
                      <p className="int-group-h" style={{ padding: 0, marginBottom: 8 }}>
                        Prévia — o que vai ser compartilhado
                      </p>
                      <div className="wa-contato-previa-lista">
                        {contatosSelecionadosPicker.map((c) => (
                          <div className="wa-contato-previa-card" key={c.id}>
                            <span className="avatar">{c.initials}</span>
                            <span className="wa-contato-previa-info">
                              <span className="n" style={{ display: "block" }}>
                                {c.nome}
                              </span>
                              {previaCampos.empresa && c.empresa ? <span>{c.empresa}</span> : null}
                              {previaCampos.cargo && c.cargo ? <span>{c.cargo}</span> : null}
                              {previaCampos.telefonePrincipal && c.whatsapp ? (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <IconTelefone width={11} height={11} /> {c.whatsapp}
                                </span>
                              ) : null}
                              {previaCampos.telefoneAlternativo && c.telefoneFixo ? (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <IconTelefone width={11} height={11} /> {c.telefoneFixo}
                                </span>
                              ) : null}
                              {previaCampos.email && c.email ? (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <IconEmail width={11} height={11} /> {c.email}
                                </span>
                              ) : null}
                            </span>
                          </div>
                        ))}
                      </div>

                      <p className="int-group-h" style={{ padding: 0, margin: "14px 0 8px" }}>
                        O que compartilhar
                      </p>
                      {(
                        [
                          { chave: "telefonePrincipal", label: "Telefone principal" },
                          { chave: "telefoneAlternativo", label: "Telefone alternativo" },
                          { chave: "email", label: "E-mail" },
                          { chave: "empresa", label: "Empresa" },
                          { chave: "cargo", label: "Cargo" },
                        ] as const
                      ).map((campo) => (
                        <div className="toggle-row" key={campo.chave}>
                          <span className="tl">{campo.label}</span>
                          <Toggle
                            key={`${campo.chave}-${previaCampos[campo.chave]}`}
                            defaultOn={previaCampos[campo.chave]}
                            label={campo.label}
                            onToggle={(v) =>
                              setPreviaCampos((prev) => ({ ...prev, [campo.chave]: v }))
                            }
                          />
                        </div>
                      ))}
                      {contatoPickerErro ? (
                        <p className="wa-campo-erro" style={{ marginTop: 10 }}>
                          {contatoPickerErro}
                        </p>
                      ) : null}
                    </div>
                    <div className="wa-modal-footer">
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => setContatoPickerEtapa("lista")}
                        disabled={contatoPickerEnviando}
                      >
                        Voltar
                      </button>
                      <button
                        type="button"
                        className="btn primary"
                        disabled={contatoPickerEnviando}
                        onClick={confirmarEnvioContatos}
                      >
                        {contatoPickerEnviando ? "Enviando…" : "Enviar contato"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}

          {msgMenuAberto ? (
            (() => {
              const msg = encontrarMensagemPorChave(msgMenuAberto.chave);
              if (!msg) return null;
              const chave = msgMenuAberto.chave;
              const temAnexo = Boolean(msg.imagens?.length || msg.video || msg.documento || msg.audio);
              return (
                <FloatingDropdown
                  anchorRect={msgMenuAberto.rect}
                  align="right"
                  width={220}
                  onClose={() => setMsgMenuAberto(null)}
                >
                  {/* No Instagram a citação só existe do lado da cliente se o CRM souber o id da
                      mensagem citada (`reply_to`). Sem id, responder mostraria "Respondendo a…"
                      aqui e mandaria uma mensagem solta lá — então a opção nem aparece, em vez de
                      dar a impressão de que a pessoa vai ver a citação. */}
                  {aberta.canal === "Instagram" && !msg.id ? null : (
                    <button
                      type="button"
                      className="dropdown-item"
                      style={{ width: "100%", textAlign: "left" }}
                      onClick={() => {
                        setMsgMenuAberto(null);
                        setRespondendoMensagem({
                          autor: msg.tipo === "in" ? aberta.nome : "Você",
                          texto: msg.texto || "Anexo",
                          mid: msg.id,
                        });
                        mensagemInputRef.current?.focus();
                      }}
                    >
                      <span className="n">↩ Responder</span>
                    </button>
                  )}
                  {msg.texto ? (
                    <button
                      type="button"
                      className="dropdown-item"
                      style={{ width: "100%", textAlign: "left" }}
                      onClick={() => copiarMensagem(msg.texto)}
                    >
                      <span className="n"><IconCopy width={12} height={12} /> Copiar</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="dropdown-item"
                    style={{ width: "100%", textAlign: "left" }}
                    onClick={(e) => {
                      setMsgMenuAberto(null);
                      setEncaminharAberto({ chave, rect: e.currentTarget.getBoundingClientRect(), msg });
                    }}
                  >
                    <span className="n"><IconEncaminhar width={12} height={12} /> Encaminhar</span>
                  </button>
                  <button
                    type="button"
                    className="dropdown-item"
                    style={{ width: "100%", textAlign: "left" }}
                    onClick={() => alternarFavoritoMensagem(chave)}
                  >
                    <span className="n">
                      {mensagensFavoritas.has(chave) ? (
                        <>
                          <IconStar width={12} height={12} fill="currentColor" /> Remover dos favoritos
                        </>
                      ) : (
                        <>
                          <IconStar width={12} height={12} fill="none" /> Favoritar
                        </>
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="dropdown-item"
                    style={{ width: "100%", textAlign: "left" }}
                    onClick={() => abrirDetalhesMensagem(msg, chave)}
                  >
                    <span className="n">ⓘ Ver detalhes</span>
                  </button>
                  {temAnexo ? (
                    <button
                      type="button"
                      className="dropdown-item"
                      style={{ width: "100%", textAlign: "left" }}
                      onClick={() => baixarAnexoMensagem(msg)}
                    >
                      <span className="n"><IconDownload width={12} height={12} /> Baixar</span>
                    </button>
                  ) : null}
                  <div className="dropdown-sep" />
                  <button
                    type="button"
                    className="dropdown-item"
                    style={{ width: "100%", textAlign: "left" }}
                    onClick={() => pedirApagar(chave, msg, "para_mim")}
                  >
                    <span className="n"><IconLixeira width={12} height={12} /> Apagar pra mim</span>
                  </button>
                  <button
                    type="button"
                    className="dropdown-item"
                    style={{ width: "100%", textAlign: "left" }}
                    onClick={() => pedirApagar(chave, msg, "para_todos")}
                  >
                    <span className="n"><IconLixeira width={12} height={12} /> Apagar pra todos</span>
                  </button>
                </FloatingDropdown>
              );
            })()
          ) : null}

          {encaminharAberto ? (
            <FloatingDropdown
              anchorRect={encaminharAberto.rect}
              align="right"
              width={260}
              onClose={() => setEncaminharAberto(null)}
            >
              <div className="wa-encaminhar-lista">
                <p className="hint" style={{ padding: "6px 10px" }}>
                  Encaminhar pra…
                </p>
                {conversas
                  .filter((c) => c.nome !== aberta.nome)
                  .map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      className="wa-encaminhar-item"
                      onClick={() => encaminharPara(c.nome, encaminharAberto.msg)}
                    >
                      <span className="avatar">{c.initials}</span>
                      <span>{c.nome}</span>
                    </button>
                  ))}
              </div>
            </FloatingDropdown>
          ) : null}

          {confirmarApagar ? (
            <div className="form-preview-overlay" onClick={() => setConfirmarApagar(null)}>
              <div className="wa-email-modal wa-contato-modal" onClick={(e) => e.stopPropagation()}>
                {confirmarApagar.tipoExclusao === "para_mim" ? (
                  <>
                    <div className="open-conv-h" style={{ padding: 0, marginBottom: 10 }}>
                      <p className="n">Apagar mensagem</p>
                    </div>
                    <p className="hint" style={{ marginBottom: 16 }}>
                      Apagar esta mensagem somente para você? As outras pessoas ainda poderão
                      visualizá-la.
                    </p>
                    <div className="section-foot">
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ flex: 1 }}
                        onClick={() => setConfirmarApagar(null)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="btn primary"
                        style={{ flex: 1 }}
                        onClick={confirmarApagarParaMim}
                      >
                        Apagar pra mim
                      </button>
                    </div>
                  </>
                ) : !confirmarApagar.elegivel ? (
                  <>
                    <div className="open-conv-h" style={{ padding: 0, marginBottom: 10 }}>
                      <p className="n">Não é possível apagar pra todos</p>
                    </div>
                    <p className="hint" style={{ marginBottom: 16 }}>
                      {confirmarApagar.motivoIndisponivel}
                    </p>
                    <div className="section-foot">
                      <button
                        type="button"
                        className="btn primary block"
                        onClick={() => setConfirmarApagar(null)}
                      >
                        Entendi
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="open-conv-h" style={{ padding: 0, marginBottom: 10 }}>
                      <p className="n">Apagar pra todos</p>
                    </div>
                    <p className="hint" style={{ marginBottom: 16 }}>
                      Apaga esta mensagem pra quem visualizar essa conversa no CRM. Não recolhe a
                      mensagem do lado do contato no WhatsApp — isso depende de um recurso que a
                      integração conectada ainda não oferece.
                    </p>
                    <div className="section-foot">
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ flex: 1 }}
                        onClick={() => setConfirmarApagar(null)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="btn primary"
                        style={{ flex: 1 }}
                        onClick={confirmarApagarParaTodos}
                      >
                        Apagar pra todos
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}

          {detalhesMensagem ? (
            <div className="form-preview-overlay" onClick={() => setDetalhesMensagem(null)}>
              <div className="wa-email-modal wa-contato-modal" onClick={(e) => e.stopPropagation()}>
                <div className="open-conv-h" style={{ padding: 0, marginBottom: 14 }}>
                  <p className="n">Detalhes da mensagem</p>
                  <button
                    type="button"
                    className="modal-close-btn"
                    aria-label="Fechar"
                    onClick={() => setDetalhesMensagem(null)}
                  >
                    <IconClose width={12} height={12} />
                  </button>
                </div>
                <div className="wa-msg-detalhes-lista">
                  <div className="wa-msg-detalhes-item">
                    <span className="rotulo">Identificador</span>
                    <span className="valor">{detalhesMensagem.msg.id ?? detalhesMensagem.chave}</span>
                  </div>
                  <div className="wa-msg-detalhes-item">
                    <span className="rotulo">Canal</span>
                    <span className="valor">{aberta.canal}</span>
                  </div>
                  {detalhesMensagem.msg.criadoEm ? (
                    <div className="wa-msg-detalhes-item">
                      <span className="rotulo">Criada</span>
                      <span className="valor">
                        {new Date(detalhesMensagem.msg.criadoEm).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  ) : null}
                  {detalhesMensagem.msg.tipo === "out" && detalhesMensagem.msg.status ? (
                    <div className="wa-msg-detalhes-item">
                      <span className="rotulo">Status</span>
                      <span className="valor">
                        {detalhesMensagem.msg.status === "pendente"
                          ? "Aguardando envio"
                          : detalhesMensagem.msg.status === "enviado"
                            ? "Enviada"
                            : detalhesMensagem.msg.status === "entregue"
                              ? "Entregue"
                              : detalhesMensagem.msg.status === "lido"
                                ? "Lida"
                                : detalhesMensagem.msg.status === "reproduzido"
                                  ? "Reproduzida"
                                  : "Erro no envio"}
                      </span>
                    </div>
                  ) : null}
                  {detalhesMensagem.msg.status === "erro" && detalhesMensagem.msg.erro ? (
                    <div className="wa-msg-detalhes-item">
                      <span className="rotulo">Motivo do erro</span>
                      <span className="valor">{detalhesMensagem.msg.erro}</span>
                    </div>
                  ) : null}
                  {detalhesMensagem.msg.apagadaParaTodos ? (
                    <div className="wa-msg-detalhes-item">
                      <span className="rotulo">Apagada</span>
                      <span className="valor">Pra todos</span>
                    </div>
                  ) : null}
                  <div className="wa-msg-detalhes-item">
                    <span className="rotulo">Hora exibida</span>
                    <span className="valor">{detalhesMensagem.msg.hora || "—"}</span>
                  </div>
                </div>
                <p className="hint" style={{ marginTop: 12 }}>
                  Etapas que o canal conectado não fornecer não aparecem aqui.
                </p>
              </div>
            </div>
          ) : null}

          {audioConfirmarDescarte ? (
            <div className="form-preview-overlay" onClick={() => setAudioConfirmarDescarte(false)}>
              <div className="wa-email-modal wa-contato-modal" onClick={(e) => e.stopPropagation()}>
                <div className="open-conv-h" style={{ padding: 0, marginBottom: 10 }}>
                  <p className="n">Excluir essa gravação?</p>
                </div>
                <p className="hint" style={{ marginBottom: 16 }}>
                  Essa gravação tem mais de 20 segundos. Ao excluir, o áudio não vai ser enviado
                  e não dá pra desfazer.
                </p>
                <div className="section-foot">
                  <button
                    type="button"
                    className="btn ghost"
                    style={{ flex: 1 }}
                    onClick={() => setAudioConfirmarDescarte(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    style={{ flex: 1 }}
                    onClick={descartarGravacao}
                  >
                    Excluir gravação
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {contatoDetalheAberto ? (
            <div
              ref={contatoDetalheRef}
              className="wa-email-modal wa-email-floating"
              style={
                contatoDetalhePos
                  ? { left: contatoDetalhePos.x, top: contatoDetalhePos.y, right: "auto", bottom: "auto" }
                  : undefined
              }
            >
              <div
                className="wa-email-drag"
                onMouseDown={criarIniciarArraste(".wa-email-modal", setContatoDetalhePos)}
              >
                <div>
                  <p className="n">{contatoDetalheAberto.nome}</p>
                  <p className="s">Contato compartilhado</p>
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  aria-label="Fechar"
                  onClick={() => setContatoDetalheAberto(null)}
                >
                  <IconClose width={12} height={12} />
                </button>
              </div>
              <div className="wa-contato-detalhe-corpo">
                <span className="avatar wa-contato-detalhe-avatar">{contatoDetalheAberto.initials}</span>
                <p className="n">{contatoDetalheAberto.nome}</p>
                {contatoDetalheAberto.empresa || contatoDetalheAberto.cargo ? (
                  <p className="hint">
                    {[contatoDetalheAberto.empresa, contatoDetalheAberto.cargo]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
                {contatoDetalheAberto.whatsapp ? (
                  <p className="wa-contato-picker-numero" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <IconTelefone width={11} height={11} /> {contatoDetalheAberto.whatsapp}
                  </p>
                ) : (
                  <p className="hint">Sem número de WhatsApp cadastrado</p>
                )}
                {contatoDetalheAberto.telefoneFixo ? (
                  <p className="wa-contato-picker-numero" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <IconTelefone width={11} height={11} /> {contatoDetalheAberto.telefoneFixo}
                  </p>
                ) : null}
                {contatoDetalheAberto.email ? (
                  <p className="wa-contato-picker-numero" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <IconEmail width={11} height={11} /> {contatoDetalheAberto.email}
                  </p>
                ) : null}
              </div>
              {contatoDetalheAberto.whatsapp ? (
                <a
                  className="btn primary block mb14"
                  href={`https://wa.me/${contatoDetalheAberto.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center", width: "100%" }}>
                    <IconConversas width={13} height={13} /> Conversar no WhatsApp
                  </span>
                </a>
              ) : null}
              <button
                type="button"
                className="btn ghost block"
                onClick={() => salvarContatoVcf(contatoDetalheAberto)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <IconSalvar width={13} height={13} /> Salvar contato
              </button>
            </div>
          ) : null}

          <FloatingDropdown
            anchorRect={emojiAberto ? emojiRect : null}
            onClose={() => setEmojiAberto(false)}
            align="right"
            width={300}
            maxHeight={340}
          >
            <div className="chat-emoji-picker">
              {EMOJI_CATEGORIAS.map((cat) => (
                <div key={cat.titulo}>
                  <p className="chat-emoji-categoria">{cat.titulo}</p>
                  <div className="chat-emoji-grid">
                    {cat.emojis.map((emoji, i) => (
                      <button
                        type="button"
                        key={`${cat.titulo}-${i}`}
                        className="chat-emoji-opcao"
                        onClick={() => inserirEmoji(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </FloatingDropdown>
        </section>

        {infoAberto ? (
        <>
        <div
          className="wa-resizer"
          onMouseDown={iniciarRedimensionarInfo}
          title="Arraste pra redimensionar"
        />
        <aside className="wa-info" style={{ width: infoWidth }}>
          <div className="wa-info-tabs" role="tablist" aria-label="Painel do contato">
            {(
              [
                { id: "resumo", label: "Resumo" },
                { id: "contato", label: "Contato" },
                { id: "negociacao", label: "Negociação" },
                { id: "atividades", label: "Atividades" },
                { id: "historico", label: "Histórico" },
              ] as const
            ).map((t) => (
              <button
                type="button"
                key={t.id}
                role="tab"
                aria-selected={abaInfo === t.id}
                className={`wa-info-tab${abaInfo === t.id ? " on" : ""}`}
                onClick={() => setAbaInfo(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

        <div className="wa-info-scroll">
          {abaInfo === "resumo" ? (
            <>
              <div className="wa-resumo-card">
                <span className="avatar wa-resumo-avatar">{iniciaisExibidas(aberta.nome, aberta.initials)}</span>
                <p className="wa-resumo-nome">{nomeExibido(aberta.nome)}</p>
                {empresaContato ? <p className="wa-resumo-empresa">{empresaContato}</p> : null}
                <div className="wa-resumo-grid">
                  <span className="wa-resumo-label">
                    {aberta.canal === "Instagram" ? "Instagram" : "Telefone"}
                  </span>
                  <span className="wa-resumo-valor">
                    {aberta.canal === "Instagram"
                      ? // O @ mora em `nome`. Enquanto ele não foi resolvido, a lista mostra um
                        // rótulo neutro (ver `nomeExibido`) — mas o id interno da thread continua
                        // existindo, e é AQUI que ele aparece: escondido da vitrine, à mão pra quem
                        // precisar dele num suporte.
                        aberta.nome.startsWith("@")
                        ? aberta.nome
                        : `sem @ · id ${aberta.nome}`
                      : whatsappContato || aberta.contato}
                  </span>
                  <span className="wa-resumo-label">E-mail</span>
                  <span className="wa-resumo-valor">{emailContato || "—"}</span>
                  <span className="wa-resumo-label">Responsável</span>
                  <span className="wa-resumo-valor">{aberta.atendenteSelecionado ?? "—"}</span>
                  <span className="wa-resumo-label">Funil · Etapa</span>
                  <span className="wa-resumo-valor">
                    {funilSelecionado ? `${funilSelecionado.nome} · ${etapaSelecionada}` : "—"}
                  </span>
                  <span className="wa-resumo-label">Origem</span>
                  <span className="wa-resumo-valor">{aberta.origem}</span>
                  <span className="wa-resumo-label">Última interação</span>
                  <span className="wa-resumo-valor">{formatarTempoRelativoReal(new Date(aberta.atualizadoEm))}</span>
                  <span className="wa-resumo-label">Situação</span>
                  <span className="wa-resumo-valor">{aberta.status}</span>
                  <span className="wa-resumo-label">Próxima atividade</span>
                  <span className="wa-resumo-valor">
                    {tarefaAberta || tarefa.oQueFazer ? `${tarefa.oQueFazer} · ${tarefa.data}` : "Nenhuma agendada"}
                  </span>
                </div>
                {(contatoDaConversa?.etiquetas ?? []).length > 0 ? (
                  <div className="wa-resumo-etiquetas">
                    {(contatoDaConversa?.etiquetas ?? []).map((et) => (
                      <span className="tag" key={et}>
                        {et}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="panel-h divided">
                <h4>Ações rápidas</h4>
              </div>
              <div className="wa-acoes-rapidas">
                <button
                  type="button"
                  className="wa-acao-rapida"
                  onClick={() => {
                    setAbaInfo("atividades");
                    setTarefaAberta(true);
                  }}
                >
                  <IconCheck width={13} height={13} /> Criar tarefa
                </button>
                <button
                  type="button"
                  className="wa-acao-rapida"
                  onClick={() => setAbaInfo("atividades")}
                >
                  <IconCalendar width={13} height={13} /> Registrar atividade
                </button>
                <button
                  type="button"
                  className="wa-acao-rapida"
                  onClick={() => {
                    setMensagemTexto("//");
                    mensagemInputRef.current?.focus();
                  }}
                >
                  <IconAutomacoes width={13} height={13} /> Executar automação
                </button>
                <button
                  type="button"
                  className="wa-acao-rapida"
                  onClick={() => setAbaInfo("contato")}
                >
                  <IconEtiqueta width={13} height={13} /> Adicionar etiqueta
                </button>
                <button
                  type="button"
                  className="wa-acao-rapida"
                  onClick={(e) => {
                    setTrocandoResponsavel((v) => !v);
                    e.currentTarget.scrollIntoView({ block: "nearest" });
                  }}
                >
                  <IconContatos width={13} height={13} /> Trocar responsável
                </button>
                <button
                  type="button"
                  className="wa-acao-rapida"
                  onClick={(e) => abrirMenuResultado(e.currentTarget.getBoundingClientRect())}
                >
                  <IconAlvo width={13} height={13} /> Registrar resultado
                </button>
              </div>

              {trocandoResponsavel ? (
                <div className="field">
                  <label>Novo responsável</label>
                  <select
                    className="input"
                    style={{ width: "100%", cursor: "pointer" }}
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) trocarResponsavelRapido(e.target.value);
                    }}
                  >
                    <option value="" disabled>
                      Escolha um atendente
                    </option>
                    {atendentesDisponiveis.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {resultadoAtual ? (
                <p
                  className={`wa-resultado-badge wa-resultado-${resultadoAtual}`}
                  style={{ margin: "0 17px 14px", display: "flex", alignItems: "center", gap: 6 }}
                >
                  {resultadoAtual === "venda" ? (
                    <>
                      <IconCheck width={12} height={12} /> Venda concluída
                    </>
                  ) : resultadoAtual === "perda" ? (
                    <>
                      <IconErro width={12} height={12} /> Perdida · {motivoPerdaPorContato[aberta.nome] ?? ""}
                    </>
                  ) : resultadoAtual === "adiada" ? (
                    <>
                      <IconRelogio width={12} height={12} /> Adiada
                    </>
                  ) : (
                    <>
                      <IconProibido width={12} height={12} /> Cancelada
                    </>
                  )}
                </p>
              ) : null}
            </>
          ) : null}

          {abaInfo === "contato" ? (
            <>
              <div className="panel-h">
                <h4>Dados do contato</h4>
                {!editandoContato ? (
                  <button
                    type="button"
                    className="link"
                    onClick={() => setEditandoContato(true)}
                  >
                    Editar
                  </button>
                ) : null}
              </div>

              <div className="field">
                <label>Nome</label>
                <div className="input">{aberta.nome}</div>
              </div>
              <div className="field">
                <label>Sobrenome</label>
                {editandoContato ? (
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    value={sobrenomeContato}
                    onChange={(e) => setSobrenomeContato(e.target.value)}
                    placeholder="Sobrenome do contato"
                  />
                ) : (
                  <div className="input">{sobrenomeContato || "Não informado"}</div>
                )}
              </div>
              <div className="field">
                <label>E-mail</label>
                {editandoContato ? (
                  <input
                    className={`input${!emailValido(emailContato) ? " wa-input-invalido" : ""}`}
                    style={{ width: "100%" }}
                    type="email"
                    value={emailContato}
                    onChange={(e) => setEmailContato(e.target.value)}
                    placeholder="nome@empresa.com"
                  />
                ) : (
                  <div className="input">{emailContato || "Não informado"}</div>
                )}
                {editandoContato && !emailValido(emailContato) ? (
                  <span className="wa-campo-erro">E-mail inválido</span>
                ) : null}
              </div>
              <div className="field">
                <label>WhatsApp</label>
                {editandoContato ? (
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    type="text"
                    value={whatsappContato}
                    onChange={(e) => setWhatsappContato(e.target.value)}
                    placeholder="(00) 90000-0000"
                  />
                ) : (
                  <div className="input">{whatsappContato || "Não informado"}</div>
                )}
              </div>
              <div className="field">
                <label>Empresa</label>
                {editandoContato ? (
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    value={empresaContato}
                    onChange={(e) => setEmpresaContato(e.target.value)}
                    placeholder="Nome da empresa (opcional pra B2C)"
                  />
                ) : (
                  <div className="input">{empresaContato || "Não informado"}</div>
                )}
              </div>
              <div className="field">
                <label>Cargo</label>
                {editandoContato ? (
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    value={cargoContato}
                    onChange={(e) => setCargoContato(e.target.value)}
                    placeholder="Cargo na empresa"
                  />
                ) : (
                  <div className="input">{cargoContato || "Não informado"}</div>
                )}
              </div>
              <div className="field">
                <label>Aniversário</label>
                {editandoContato ? (
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    value={nascimentoContato}
                    onChange={(e) => setNascimentoContato(e.target.value)}
                    placeholder="DD/MM/AAAA"
                  />
                ) : (
                  <div className="input">{nascimentoContato || "Não informado"}</div>
                )}
              </div>
              <div className="field">
                <label>Endereço</label>
                {editandoContato ? (
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    value={enderecoContato}
                    onChange={(e) => setEnderecoContato(e.target.value)}
                    placeholder="Rua, número, bairro"
                  />
                ) : (
                  <div className="input">{enderecoContato || "Não informado"}</div>
                )}
              </div>
              <div className="field">
                <label>Cidade / Estado / País</label>
                {editandoContato ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      className="input"
                      style={{ flex: 2 }}
                      value={cidadeContato}
                      onChange={(e) => setCidadeContato(e.target.value)}
                      placeholder="Cidade"
                    />
                    <input
                      className="input"
                      style={{ flex: 1 }}
                      value={estadoContato}
                      onChange={(e) => setEstadoContato(e.target.value)}
                      placeholder="UF"
                    />
                    <input
                      className="input"
                      style={{ flex: 2 }}
                      value={paisContato}
                      onChange={(e) => setPaisContato(e.target.value)}
                      placeholder="País"
                    />
                  </div>
                ) : (
                  <div className="input">
                    {[cidadeContato, estadoContato, paisContato].filter(Boolean).join(" · ") ||
                      "Não informado"}
                  </div>
                )}
              </div>
              <div className="field">
                <label>Canal preferido</label>
                {editandoContato ? (
                  <select
                    className="input"
                    style={{ width: "100%", cursor: "pointer" }}
                    value={canalPreferidoContato}
                    onChange={(e) => setCanalPreferidoContato(e.target.value as Canal)}
                  >
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Instagram">Instagram</option>
                    <option value="TikTok">TikTok</option>
                  </select>
                ) : (
                  <div className="input">{canalPreferidoContato}</div>
                )}
              </div>
              <div className="field">
                <label>Melhor horário pra contato</label>
                {editandoContato ? (
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    value={melhorHorarioContato}
                    onChange={(e) => setMelhorHorarioContato(e.target.value)}
                    placeholder="Ex.: Tardes, depois das 14h"
                  />
                ) : (
                  <div className="input">{melhorHorarioContato || "Não informado"}</div>
                )}
              </div>

              <div className="field">
                <label>Etiquetas</label>
                <div className="wa-etiquetas-lista">
                  {(contatoDaConversa?.etiquetas ?? []).length === 0 ? (
                    <span className="hint">Nenhuma etiqueta ainda.</span>
                  ) : (
                    (contatoDaConversa?.etiquetas ?? []).map((et) => (
                      <span className="wa-etiqueta-chip" key={et}>
                        {et}
                        <button
                          type="button"
                          aria-label={`Remover etiqueta ${et}`}
                          onClick={() => removerEtiquetaRapida(et)}
                        >
                          <IconClose width={10} height={10} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    placeholder="Nova etiqueta…"
                    value={novaEtiquetaTexto}
                    onChange={(e) => setNovaEtiquetaTexto(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && adicionarEtiquetaRapida()}
                  />
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={adicionarEtiquetaRapida}
                    disabled={!novaEtiquetaTexto.trim()}
                  >
                    + Adicionar
                  </button>
                </div>
              </div>

              {editandoContato ? (
                <div className="section-foot">
                  <button
                    type="button"
                    className="btn ghost"
                    style={{ flex: 1 }}
                    onClick={cancelarEdicaoContato}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    style={{ flex: 1 }}
                    onClick={salvarDados}
                    disabled={statusSalvarContato === "salvando" || !emailValido(emailContato)}
                  >
                    {statusSalvarContato === "salvando" ? "Salvando…" : "Salvar"}
                  </button>
                </div>
              ) : null}
              {statusSalvarContato === "sucesso" ? (
                <p className="wa-status-inline wa-status-sucesso" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <IconCheck width={13} height={13} /> Dados salvos
                </p>
              ) : statusSalvarContato === "erro" ? (
                <p className="wa-status-inline wa-status-erro" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <IconClose width={13} height={13} /> Não deu pra salvar — confira o e-mail
                </p>
              ) : null}
            </>
          ) : null}

          {abaInfo === "negociacao" ? (
            <>
              <div className="panel-h">
                <h4>Funil e etapa</h4>
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
                <h4>Resultado</h4>
              </div>
              <div style={{ padding: "0 17px 14px" }}>
                {resultadoAtual ? (
                  <p
                    className={`wa-resultado-badge wa-resultado-${resultadoAtual}`}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    {resultadoAtual === "venda" ? (
                      <>
                        <IconCheck width={12} height={12} /> Venda concluída
                      </>
                    ) : resultadoAtual === "perda" ? (
                      <>
                        <IconErro width={12} height={12} /> Perdida · {motivoPerdaPorContato[aberta.nome] ?? ""}
                      </>
                    ) : resultadoAtual === "adiada" ? (
                      <>
                        <IconRelogio width={12} height={12} /> Adiada
                      </>
                    ) : (
                      <>
                        <IconProibido width={12} height={12} /> Cancelada
                      </>
                    )}
                  </p>
                ) : (
                  <p className="hint" style={{ marginBottom: 10 }}>
                    Nenhum resultado registrado ainda — em andamento.
                  </p>
                )}
                <button
                  type="button"
                  className="btn primary block"
                  onClick={(e) => abrirMenuResultado(e.currentTarget.getBoundingClientRect())}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <IconAlvo width={13} height={13} /> Registrar resultado
                </button>
              </div>
            </>
          ) : null}

          {abaInfo === "atividades" ? (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "14px 17px 0" }}>
                <button
                  type="button"
                  className="btn ghost"
                  style={{ flex: "1 1 140px" }}
                  onClick={() => setTarefaAberta((v) => !v)}
                >
                  {tarefaAberta ? "Fechar tarefa" : "+ Adicionar tarefa"}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  style={{ flex: "1 1 140px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  onClick={abrirEmailModal}
                >
                  <IconEmail width={13} height={13} /> Disparar e-mail
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
                      <span className={`sv${email.aberto ? " wa-email-lido" : ""}`}>
                        {email.aberto ? `Lido às ${email.abertoEm}` : "Enviado, ainda não lido"}
                      </span>
                    </div>
                  ))}
                </>
              ) : null}
            </>
          ) : null}

          {abaInfo === "historico" ? (
            <>
              <div style={{ padding: "14px 17px 0" }}>
                <textarea
                  className="input"
                  style={{ width: "100%", minHeight: 60, resize: "vertical" }}
                  placeholder="Escreva uma anotação sobre esse contato…"
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
              <div style={{ padding: "14px 17px" }}>
                <Timeline eventos={eventosTimelineContato} />
              </div>
            </>
          ) : null}
        </div>
        </aside>
        </>
        ) : null}
      </div>

      {resultadoMenuAberto ? (
        <FloatingDropdown
          anchorRect={resultadoMenuRect}
          align="right"
          width={240}
          onClose={() => setResultadoMenuAberto(false)}
        >
          <button
            type="button"
            className="dropdown-item"
            style={{ width: "100%", textAlign: "left" }}
            onClick={() => escolherResultado("venda")}
          >
            <span className="n"><IconCheck width={12} height={12} /> Venda concluída</span>
          </button>
          <button
            type="button"
            className="dropdown-item"
            style={{ width: "100%", textAlign: "left" }}
            onClick={() => escolherResultado("perda")}
          >
            <span className="n"><IconErro width={12} height={12} /> Negociação perdida</span>
          </button>
          <button
            type="button"
            className="dropdown-item"
            style={{ width: "100%", textAlign: "left" }}
            onClick={() => escolherResultado("andamento")}
          >
            <span className="n"><IconRefresh width={12} height={12} /> Continua em andamento</span>
          </button>
          <button
            type="button"
            className="dropdown-item"
            style={{ width: "100%", textAlign: "left" }}
            onClick={() => escolherResultado("adiada")}
          >
            <span className="n"><IconRelogio width={12} height={12} /> Adiada</span>
          </button>
          <button
            type="button"
            className="dropdown-item"
            style={{ width: "100%", textAlign: "left" }}
            onClick={() => escolherResultado("cancelada")}
          >
            <span className="n"><IconProibido width={12} height={12} /> Cancelada</span>
          </button>
        </FloatingDropdown>
      ) : null}

      {formResultado === "venda" ? (
        <div className="form-preview-overlay" onClick={() => setFormResultado(null)}>
          <div className="wa-email-modal wa-contato-modal" onClick={(e) => e.stopPropagation()}>
            <div className="open-conv-h" style={{ padding: 0, marginBottom: 14 }}>
              <p className="n">Venda concluída</p>
              <button
                type="button"
                className="modal-close-btn"
                aria-label="Fechar"
                onClick={() => setFormResultado(null)}
              >
                <IconClose width={12} height={12} />
              </button>
            </div>
            <div className="field" style={{ padding: "0 0 10px" }}>
              <label>Produto/serviço</label>
              <input
                className="input"
                style={{ width: "100%" }}
                value={vendaProduto}
                onChange={(e) => setVendaProduto(e.target.value)}
                placeholder="Ex.: Plano premium"
              />
            </div>
            <div style={{ display: "flex", gap: 8, padding: "0 0 10px" }}>
              <div className="field" style={{ flex: 1, padding: 0 }}>
                <label>Valor</label>
                <input
                  className="input"
                  style={{ width: "100%" }}
                  value={vendaValor}
                  onChange={(e) => setVendaValor(e.target.value)}
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="field" style={{ flex: 1, padding: 0 }}>
                <label>Forma de pagamento</label>
                <select
                  className="input"
                  style={{ width: "100%", cursor: "pointer" }}
                  value={vendaFormaPagamento}
                  onChange={(e) => setVendaFormaPagamento(e.target.value)}
                >
                  <option value="Pix">Pix</option>
                  <option value="Cartão de crédito">Cartão de crédito</option>
                  <option value="Boleto">Boleto</option>
                  <option value="Dinheiro">Dinheiro</option>
                </select>
              </div>
            </div>
            <div className="field" style={{ padding: "0 0 10px" }}>
              <label>Observação</label>
              <textarea
                className="input"
                style={{ width: "100%", minHeight: 60, resize: "vertical" }}
                value={vendaObservacao}
                onChange={(e) => setVendaObservacao(e.target.value)}
                placeholder="Detalhes opcionais sobre a venda…"
              />
            </div>
            <div className="section-foot">
              <button
                type="button"
                className="btn ghost"
                style={{ flex: 1 }}
                onClick={() => setFormResultado(null)}
                disabled={registrandoResultado}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn primary"
                style={{ flex: 1 }}
                onClick={confirmarVenda}
                disabled={registrandoResultado}
              >
                {registrandoResultado ? "Registrando…" : "Confirmar venda"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {formResultado === "perda" ? (
        <div className="form-preview-overlay" onClick={() => setFormResultado(null)}>
          <div className="wa-email-modal wa-contato-modal" onClick={(e) => e.stopPropagation()}>
            <div className="open-conv-h" style={{ padding: 0, marginBottom: 14 }}>
              <p className="n">Negociação perdida</p>
              <button
                type="button"
                className="modal-close-btn"
                aria-label="Fechar"
                onClick={() => setFormResultado(null)}
              >
                <IconClose width={12} height={12} />
              </button>
            </div>
            <p className="hint" style={{ marginBottom: 10 }}>Escolha o motivo da perda:</p>
            <RadioList
              key={`motivo-${aberta.id}`}
              options={motivosDisponiveis.map((m) => ({ nome: m }))}
              initial=""
              onChange={(motivo) => marcarPerda(motivo)}
            />
            {!escolhendoMotivo ? (
              <button
                type="button"
                className="btn ghost block mt14"
                onClick={() => setEscolhendoMotivo(true)}
              >
                + Outro motivo
              </button>
            ) : (
              <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
                <input
                  className="input"
                  style={{ flex: 1 }}
                  placeholder="Descreva o motivo…"
                  value={novoMotivoTexto}
                  onChange={(e) => setNovoMotivoTexto(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && adicionarMotivoCustom()}
                />
                <button
                  type="button"
                  className="btn ghost"
                  onClick={adicionarMotivoCustom}
                  disabled={!novoMotivoTexto.trim()}
                >
                  + Adicionar
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {formResultado === "adiada" ? (
        <div className="form-preview-overlay" onClick={() => setFormResultado(null)}>
          <div className="wa-email-modal wa-contato-modal" onClick={(e) => e.stopPropagation()}>
            <div className="open-conv-h" style={{ padding: 0, marginBottom: 14 }}>
              <p className="n">Negociação adiada</p>
              <button
                type="button"
                className="modal-close-btn"
                aria-label="Fechar"
                onClick={() => setFormResultado(null)}
              >
                <IconClose width={12} height={12} />
              </button>
            </div>
            <div className="field" style={{ padding: "0 0 10px" }}>
              <label>Nova data prevista</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="date"
                value={adiadaData}
                onChange={(e) => setAdiadaData(e.target.value)}
              />
            </div>
            <div className="field" style={{ padding: "0 0 10px" }}>
              <label>Observação</label>
              <textarea
                className="input"
                style={{ width: "100%", minHeight: 60, resize: "vertical" }}
                value={adiadaObservacao}
                onChange={(e) => setAdiadaObservacao(e.target.value)}
                placeholder="Motivo do adiamento…"
              />
            </div>
            <div className="section-foot">
              <button
                type="button"
                className="btn ghost"
                style={{ flex: 1 }}
                onClick={() => setFormResultado(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn primary"
                style={{ flex: 1 }}
                onClick={confirmarAdiada}
              >
                Confirmar adiamento
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {formResultado === "cancelada" ? (
        <div className="form-preview-overlay" onClick={() => setFormResultado(null)}>
          <div className="wa-email-modal wa-contato-modal" onClick={(e) => e.stopPropagation()}>
            <div className="open-conv-h" style={{ padding: 0, marginBottom: 14 }}>
              <p className="n">Negociação cancelada</p>
              <button
                type="button"
                className="modal-close-btn"
                aria-label="Fechar"
                onClick={() => setFormResultado(null)}
              >
                <IconClose width={12} height={12} />
              </button>
            </div>
            <div className="field" style={{ padding: "0 0 10px" }}>
              <label>Motivo do cancelamento</label>
              <textarea
                className="input"
                style={{ width: "100%", minHeight: 60, resize: "vertical" }}
                value={canceladaMotivo}
                onChange={(e) => setCanceladaMotivo(e.target.value)}
                placeholder="Por que a negociação foi cancelada…"
              />
            </div>
            <div className="section-foot">
              <button
                type="button"
                className="btn ghost"
                style={{ flex: 1 }}
                onClick={() => setFormResultado(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn primary"
                style={{ flex: 1 }}
                onClick={confirmarCancelada}
              >
                Confirmar cancelamento
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {emailModalAberto ? (
        <div
          className="wa-email-modal wa-email-floating"
          style={
            emailPos
              ? { left: emailPos.x, top: emailPos.y, right: "auto", bottom: "auto" }
              : undefined
          }
        >
          <div className="wa-email-drag" onMouseDown={iniciarArrasteEmail}>
            <div>
              <p className="n">Novo e-mail</p>
              <p className="s">Pra {aberta.nome}</p>
            </div>
            <button
              type="button"
              className="modal-close-btn"
              aria-label="Fechar"
              onClick={fecharEmailModal}
            >
              <IconClose width={12} height={12} />
            </button>
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

            {emailsDaConversa.length > 0 ? (
              <>
                <div className="panel-h divided">
                  <h4>Rastreamento</h4>
                </div>
                {emailsDaConversa
                  .slice()
                  .reverse()
                  .map((email) => (
                    <div className="stat-row" key={email.id}>
                      <span className="sl">{email.assunto}</span>
                      <span
                        className={`sv${email.aberto ? " wa-email-lido" : ""}`}
                      >
                        {email.aberto ? `Lido às ${email.abertoEm}` : "Enviado, ainda não lido"}
                      </span>
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ padding: "4px 10px", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}
                        onClick={() => verificarRastreamento(email)}
                      >
                        <IconRefresh width={11} height={11} /> Verificar
                      </button>
                    </div>
                  ))}
              </>
            ) : null}
        </div>
      ) : null}

      {midiasAberto ? (
        <div
          ref={midiasRef}
          className="wa-email-modal wa-email-floating"
          style={
            midiasPos
              ? { left: midiasPos.x, top: midiasPos.y, right: "auto", bottom: "auto" }
              : undefined
          }
        >
          <div className="wa-email-drag" onMouseDown={criarIniciarArraste(".wa-email-modal", setMidiasPos)}>
            <div>
              <p className="n">Mídias e arquivos</p>
              <p className="s">Trocados com {aberta.nome}</p>
            </div>
            <button
              type="button"
              className="modal-close-btn"
              aria-label="Fechar"
              onClick={() => setMidiasAberto(false)}
            >
              <IconClose width={12} height={12} />
            </button>
          </div>
          {tarefa.anexo ? (
            <div className="field" style={{ padding: "10px 0" }}>
              <div className="attach-chip">
                <IconDoc />
                <span className="fn">{tarefa.anexo.arquivo}</span>
                <span className="fs">{tarefa.anexo.detalhe}</span>
              </div>
            </div>
          ) : (
            <p className="hint" style={{ padding: "10px 0" }}>
              Nenhuma mídia trocada nessa conversa ainda.
            </p>
          )}
        </div>
      ) : null}

      {dadosGrupoAberto ? (
        <div
          ref={dadosGrupoRef}
          className="wa-email-modal wa-email-floating wa-dados-grupo-modal"
          style={
            dadosGrupoPos
              ? { left: dadosGrupoPos.x, top: dadosGrupoPos.y, right: "auto", bottom: "auto" }
              : undefined
          }
        >
          <div className="wa-email-drag" onMouseDown={criarIniciarArraste(".wa-email-modal", setDadosGrupoPos)}>
            <div>
              <p className="n">Dados do grupo</p>
            </div>
            <button
              type="button"
              className="modal-close-btn"
              aria-label="Fechar"
              onClick={() => setDadosGrupoAberto(false)}
            >
              <IconClose width={12} height={12} />
            </button>
          </div>
          <div className="wa-dados-grupo-corpo">
            <div className="avatar wa-dados-grupo-avatar">
              {aberta.fotoUrl ? <img src={aberta.fotoUrl} alt="" className="wa-avatar-foto" /> : aberta.initials}
            </div>
            <p className="wa-dados-grupo-nome">{aberta.nome}</p>
            {aberta.descricaoGrupo ? (
              <p className="wa-dados-grupo-descricao">{aberta.descricaoGrupo}</p>
            ) : (
              <p className="wa-dados-grupo-descricao hint">Esse grupo ainda não tem descrição.</p>
            )}
            {aberta.criacaoGrupo ? (
              <p className="wa-dados-grupo-criado">
                Grupo criado em{" "}
                {new Date(aberta.criacaoGrupo).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            ) : null}
            <button
              type="button"
              className="wa-dados-grupo-membros-btn"
              onClick={() => {
                setDadosGrupoAberto(false);
                setParticipantesPos(dadosGrupoPos);
                setParticipantesAberto(true);
              }}
            >
              <span>
                <IconEquipe width={15} height={15} />
                Participantes
              </span>
              <span className="wa-dados-grupo-membros-count">{aberta.participantesGrupo?.length ?? 0} ›</span>
            </button>
          </div>
        </div>
      ) : null}

      {participantesAberto ? (
        <div
          ref={participantesRef}
          className="wa-email-modal wa-email-floating"
          style={
            participantesPos
              ? { left: participantesPos.x, top: participantesPos.y, right: "auto", bottom: "auto" }
              : undefined
          }
        >
          <div className="wa-email-drag" onMouseDown={criarIniciarArraste(".wa-email-modal", setParticipantesPos)}>
            <div>
              <p className="n">Participantes</p>
              <p className="s">{aberta.participantesGrupo?.length ?? 0} pessoas em {aberta.nome}</p>
            </div>
            <button
              type="button"
              className="modal-close-btn"
              aria-label="Fechar"
              onClick={() => setParticipantesAberto(false)}
            >
              <IconClose width={12} height={12} />
            </button>
          </div>
          {aberta.participantesGrupo?.length ? (
            <div className="wa-participantes-lista">
              {aberta.participantesGrupo.map((p) => (
                <button
                  type="button"
                  className="wa-participante-linha"
                  key={p.telefone}
                  onClick={() => {
                    setParticipantesAberto(false);
                    setParticipanteAberto(p);
                  }}
                >
                  <span className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                    {p.nome
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((parte) => parte[0])
                      .join("")
                      .toUpperCase() || "?"}
                  </span>
                  <div className="wa-participante-info">
                    <p className="n">{p.nome}</p>
                    <p className="s">{p.telefone}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="hint" style={{ padding: "10px 0" }}>
              Lista de participantes ainda não disponível.
            </p>
          )}
        </div>
      ) : null}

      {participanteAberto ? (
        <div ref={participanteRef} className="wa-email-modal wa-email-floating wa-participante-modal">
          <div className="wa-email-drag">
            <div>
              <p className="n">Contato</p>
            </div>
            <button
              type="button"
              className="modal-close-btn"
              aria-label="Fechar"
              onClick={() => setParticipanteAberto(null)}
            >
              <IconClose width={12} height={12} />
            </button>
          </div>
          <div className="wa-dados-grupo-corpo">
            <div className="avatar wa-dados-grupo-avatar">
              {carregandoFotoParticipante ? (
                <span className="wa-participante-foto-carregando" />
              ) : fotoParticipante ? (
                <img src={fotoParticipante} alt="" className="wa-avatar-foto" />
              ) : (
                participanteAberto.nome
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join("")
                  .toUpperCase() || "?"
              )}
            </div>
            <p className="wa-dados-grupo-nome">{participanteAberto.nome}</p>
            <p className="wa-dados-grupo-descricao hint">{participanteAberto.telefone}</p>
            {(() => {
              const conversaDele = conversaIndividualDoParticipante(participanteAberto.telefone);
              return (
                <button
                  type="button"
                  className="btn primary"
                  style={{ marginTop: 12, width: "100%" }}
                  disabled={criandoConversaParticipante}
                  title={
                    conversaDele
                      ? `Abrir conversa individual com ${participanteAberto.nome}`
                      : `Iniciar conversa com ${participanteAberto.nome}`
                  }
                  onClick={async () => {
                    if (conversaDele) {
                      setSelectedId(conversaDele.id);
                      setParticipanteAberto(null);
                      return;
                    }
                    setCriandoConversaParticipante(true);
                    try {
                      const nova = await criarConversaIndividual(
                        participanteAberto.nome,
                        participanteAberto.telefone,
                        "WhatsApp",
                      );
                      setSelectedId(nova.id);
                      setParticipanteAberto(null);
                    } catch (erro) {
                      console.error("Falha ao iniciar conversa com participante:", erro);
                    } finally {
                      setCriandoConversaParticipante(false);
                    }
                  }}
                >
                  {criandoConversaParticipante ? "Iniciando…" : "Enviar mensagem"}
                </button>
              );
            })()}
          </div>
        </div>
      ) : null}

      {respostasGerenciarAberto ? (
        <div
          ref={respostasModalRef}
          className="wa-respostas-modal"
          style={respostasPos ? { left: respostasPos.x, top: respostasPos.y } : undefined}
        >
          <div className="wa-email-drag" onMouseDown={iniciarArrasteRespostas}>
            <div>
              <p className="n">Respostas rápidas</p>
              <p className="s">Só valem pro funil &quot;{funilSelecionado.nome}&quot;</p>
            </div>
            <button
              type="button"
              className="modal-close-btn"
              aria-label="Fechar"
              onClick={() => setRespostasGerenciarAberto(false)}
            >
              <IconClose width={12} height={12} />
            </button>
          </div>

          <div className="panel-h" style={{ padding: "0 0 8px" }}>
            <h4>Nova resposta rápida</h4>
          </div>
          <div className="field" style={{ padding: "0 0 8px" }}>
            <label>Título</label>
            <input
              className="input"
              style={{ width: "100%" }}
              placeholder="Ex.: Boas-vindas"
              value={novaRespostaTitulo}
              onChange={(e) => setNovaRespostaTitulo(e.target.value)}
            />
          </div>
          <div className="field" style={{ padding: "0 0 10px" }}>
            <label>Texto</label>
            <textarea
              className="input"
              style={{ width: "100%", minHeight: 60, resize: "vertical" }}
              placeholder="Escreva a mensagem completa…"
              value={novaRespostaTexto}
              onChange={(e) => setNovaRespostaTexto(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn primary block"
            onClick={criarRespostaRapida}
            disabled={!novaRespostaTitulo.trim() || !novaRespostaTexto.trim()}
          >
            + Criar nova resposta rápida
          </button>

          <div className="panel-h" style={{ padding: "14px 0 8px" }}>
            <h4>Salvas</h4>
          </div>
          {respostasDoFunil.length === 0 ? (
            <p className="hint" style={{ padding: "0 0 10px" }}>
              Nenhuma resposta rápida salva pra esse funil ainda.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 4 }}>
              {respostasDoFunil.map((r) => (
                <div key={r.id} className="attach-chip" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <span className="fn" style={{ display: "block" }}>{r.titulo}</span>
                    <span className="fs" style={{ display: "block" }}>{r.texto}</span>
                  </div>
                  <span
                    className="close"
                    style={{ cursor: "pointer", flex: "0 0 auto" }}
                    onClick={() => excluirRespostaRapida(r.id)}
                  >
                    <IconClose width={11} height={11} />
                  </span>
                </div>
              ))}
            </div>
          )}
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
