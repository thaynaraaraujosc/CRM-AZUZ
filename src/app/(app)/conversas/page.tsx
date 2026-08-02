"use client";

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";

import {
  classeOrigem,
  conversas,
  motivosPerda,
  type ConvMensagem,
  type Funil,
  type NegocioCard,
  type StatusMensagem,
} from "@/lib/data";
import { useAutomacoes } from "@/lib/automacoes-context";
import { useAutomationFlows } from "@/lib/automation-flow-context";
import { executarFluxo } from "@/lib/automation-flow/motor";
import { useContatos } from "@/lib/contatos-context";
import {
  useBibliotecaDocumentos,
  CATEGORIAS_DOCUMENTO,
} from "@/lib/biblioteca-documentos-context";
import { useFunis } from "@/lib/funis-context";
import { useNotificacoes } from "@/lib/notificacoes-context";
import {
  CanalBadge,
  IconAutomacoes,
  IconCheck,
  IconCheckDuplo,
  IconConfiguracoes,
  IconContatos,
  IconDoc,
  IconEmoji,
  IconErro,
  IconImage,
  IconLocalizacao,
  IconMic,
  IconRefresh,
  IconRelogio,
  IconRespostaRapida,
  IconSearch,
  IconVideoCam,
} from "@/components/icons";
import { FloatingDropdown, RadioList, Toggle, Topbar } from "@/components/ui";

const FILTROS_CONVERSA = [
  { valor: "tudo", label: "Tudo" },
  { valor: "nao-lidas", label: "Não lidas" },
  { valor: "favoritas", label: "Favoritas" },
] as const;

/** Mesma chave usada em toda troca de página — as mensagens enviadas na conversa sobrevivem ao F5. */
const MENSAGENS_STORAGE_KEY = "azuz-crm-conversas-mensagens";

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

function lerComoDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result as string);
    leitor.onerror = () => reject(new Error("Falha ao ler o arquivo"));
    leitor.readAsDataURL(file);
  });
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
  const { funis, atribuirContatoAoFunil } = useFunis();
  const { contatos, salvarDadosContato, atribuirAtendente } = useContatos();
  const { automacoes, automacoesDeEntradaAtivas } = useAutomacoes();
  const { fluxos, dispararEvento, registrarExecucao } = useAutomationFlows();
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
  const [lidas, setLidas] = useState<Set<string>>(() => new Set());
  const [midiasAberto, setMidiasAberto] = useState(false);
  const [midiasPos, setMidiasPos] = useState<{ x: number; y: number } | null>(null);
  const midiasRef = useRef<HTMLDivElement>(null);
  const [conectarAberto, setConectarAberto] = useState(false);
  const [conectarAba, setConectarAba] = useState<"qr" | "api">("qr");
  const [conectarPos, setConectarPos] = useState<{ x: number; y: number } | null>(null);
  const conectarRef = useRef<HTMLDivElement>(null);
  const [contatoDetalhePos, setContatoDetalhePos] = useState<{ x: number; y: number } | null>(null);
  const contatoDetalheRef = useRef<HTMLDivElement>(null);
  const [contatoDetalheAberto, setContatoDetalheAberto] = useState<{
    nome: string;
    initials: string;
    whatsapp?: string;
  } | null>(null);
  const [infoWidth, setInfoWidth] = useState(320);
  const [sincronizando, setSincronizando] = useState(false);

  useFecharAoClicarFora(midiasRef, midiasAberto, () => setMidiasAberto(false));
  useFecharAoClicarFora(conectarRef, conectarAberto, () => setConectarAberto(false));
  useFecharAoClicarFora(contatoDetalheRef, !!contatoDetalheAberto, () => setContatoDetalheAberto(null));

  /** Força um recarregamento da lista — usado se as mensagens do celular conectado saírem de sincronia com o servidor. */
  function sincronizarConversas() {
    if (sincronizando) return;
    setSincronizando(true);
    setTimeout(() => setSincronizando(false), 900);
  }

  const [atendenteTopAberto, setAtendenteTopAberto] = useState(false);
  const [atendenteTopRect, setAtendenteTopRect] = useState<DOMRect | null>(null);
  const [atendenteTopFiltro, setAtendenteTopFiltro] = useState("Todos");

  const [canalTopAberto, setCanalTopAberto] = useState(false);
  const [canalTopRect, setCanalTopRect] = useState<DOMRect | null>(null);
  const [canalTopFiltro, setCanalTopFiltro] = useState("Todos");

  const atendentesDisponiveis = Array.from(
    new Set(conversas.map((c) => c.atendenteSelecionado)),
  );
  const canaisDisponiveis = Array.from(new Set(conversas.map((c) => c.origem)));

  const conversasFiltradas = conversas.filter((c) => {
    if (filtroConversa === "nao-lidas" && (!c.naoLidas || lidas.has(c.id))) return false;
    if (filtroConversa === "favoritas" && !c.favorita) return false;
    if (atendenteTopFiltro !== "Todos" && c.atendenteSelecionado !== atendenteTopFiltro)
      return false;
    if (canalTopFiltro !== "Todos" && c.origem !== canalTopFiltro) return false;
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
  const [emailPos, setEmailPos] = useState<{ x: number; y: number } | null>(null);
  const emailArrasteRef = useRef<{ dx: number; dy: number } | null>(null);
  const emailCorpoRef = useRef<HTMLDivElement>(null);
  const proximoEmailId = useRef(0);
  const [historicoPorContato, setHistoricoPorContato] = useState<
    Record<string, HistoricoItem[]>
  >({});
  const [notaTexto, setNotaTexto] = useState("");
  const [mensagensExtraPorContato, setMensagensExtraPorContato] = useState<
    Record<string, ConvMensagem[]>
  >(() => {
    if (typeof window === "undefined") return {};
    try {
      const salvo = localStorage.getItem(MENSAGENS_STORAGE_KEY);
      return salvo ? (JSON.parse(salvo) as Record<string, ConvMensagem[]>) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        MENSAGENS_STORAGE_KEY,
        JSON.stringify(mensagensExtraPorContato),
      );
    } catch {
      // localStorage indisponível (modo privado, por exemplo) ou anexo grande
      // demais pra caber na cota — a conversa segue funcionando só em memória.
    }
  }, [mensagensExtraPorContato]);
  const [mensagemTexto, setMensagemTexto] = useState("");
  const [gravandoAudio, setGravandoAudio] = useState(false);
  const [audioSegundos, setAudioSegundos] = useState(0);
  const [anexoAberto, setAnexoAberto] = useState(false);
  const [anexoPos, setAnexoPos] = useState<{ x: number; y: number } | null>(null);
  const anexoArrasteRef = useRef<{ dx: number; dy: number } | null>(null);
  const [emojiAberto, setEmojiAberto] = useState(false);
  const [emojiRect, setEmojiRect] = useState<DOMRect | null>(null);
  const [contatoPickerAberto, setContatoPickerAberto] = useState(false);
  const [buscaContatoPicker, setBuscaContatoPicker] = useState("");
  const [contatoSugestoesAberta, setContatoSugestoesAberta] = useState(false);
  const [contatoSelecionado, setContatoSelecionado] = useState<{
    nome: string;
    initials: string;
    whatsapp?: string;
  } | null>(null);
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
  const mensagemInputRef = useRef<HTMLInputElement>(null);
  const imagemInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentoInputRef = useRef<HTMLInputElement>(null);

  /* ---------------------------------------------------------------------- */
  /* Anexos reais — imagem, vídeo, documento                                */
  /* ---------------------------------------------------------------------- */

  const [arrastandoArquivo, setArrastandoArquivo] = useState(false);
  const [erroAnexo, setErroAnexo] = useState<string | null>(null);

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
    if (!gravandoAudio) return;
    const intervalo = setInterval(() => setAudioSegundos((s) => s + 1), 1000);
    return () => clearInterval(intervalo);
  }, [gravandoAudio]);
  const [resultadoPorContato, setResultadoPorContato] = useState<
    Record<string, "venda" | "perda">
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
  const resultadoAtual = resultadoPorContato[aberta.nome];
  const motivosDisponiveis = [
    ...motivosPerda.map((m) => m.motivo),
    ...motivosPerdaCustom,
  ];

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

  /** Adiciona a mensagem já com id — mensagens "out" sem status ganham "pendente" e entram na simulação real de entrega. */
  function adicionarMensagem(msg: ConvMensagem) {
    const id = msg.id ?? gerarIdMensagem();
    const contatoNome = aberta.nome;
    const pronta: ConvMensagem =
      msg.tipo === "out" && !msg.status
        ? { ...msg, id, status: "pendente" }
        : { ...msg, id };
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

  function enviarMensagemTexto() {
    const texto = mensagemTexto.trim();
    if (!texto) return;
    adicionarMensagem({ tipo: "out", texto, hora: horaAgora() });
    setMensagemTexto("");
  }

  function alternarGravacaoAudio() {
    if (gravandoAudio) {
      const min = Math.floor(audioSegundos / 60);
      const seg = audioSegundos % 60;
      setGravandoAudio(false);
      if (audioSegundos > 0) {
        adicionarMensagem({
          tipo: "out",
          texto: `🎤 Áudio · ${min}:${String(seg).padStart(2, "0")}`,
          hora: horaAgora(),
        });
      }
      setAudioSegundos(0);
    } else {
      setAudioSegundos(0);
      setGravandoAudio(true);
    }
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

  async function enviarImagensSelecionadas() {
    if (imagensSelecionadas.length === 0) return;
    setEnviandoImagens(true);
    adicionarMensagem({
      tipo: "out",
      texto: "",
      hora: horaAgora(),
      imagens: imagensSelecionadas.map((img) => ({
        url: img.atual,
        nome: img.nome,
        tamanho: img.tamanho,
      })),
      legenda: legendaImagem.trim() || undefined,
    });
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

      adicionarMensagem({
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
      adicionarMensagem({
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
    adicionarMensagem({
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
    });
    setEnviandoDocumento(false);
    setDocumentoComputador(null);
    setLegendaDocumento("");
  }

  function abrirContatoPicker() {
    setAnexoAberto(false);
    setBuscaContatoPicker("");
    setContatoSelecionado(null);
    setContatoSugestoesAberta(false);
    setContatoPickerAberto(true);
  }

  function fecharContatoPicker() {
    setContatoPickerAberto(false);
    setContatoSelecionado(null);
    setBuscaContatoPicker("");
  }

  function escolherContatoPicker(contato: { nome: string; initials: string; whatsapp?: string }) {
    setContatoSelecionado(contato);
    setBuscaContatoPicker("");
    setContatoSugestoesAberta(false);
  }

  function enviarContatoCompartilhado() {
    if (!contatoSelecionado) return;
    adicionarMensagem({
      tipo: "out",
      texto: `👤 Contato compartilhado: ${contatoSelecionado.nome}`,
      hora: horaAgora(),
      contatoCompartilhado: contatoSelecionado,
    });
    fecharContatoPicker();
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

  const contatosFiltradosPicker = contatos.filter((c) =>
    c.nome.toLowerCase().includes(buscaContatoPicker.trim().toLowerCase()),
  );

  function enviarLocalizacao(lat: number, lng: number, endereco?: string) {
    adicionarMensagem({
      tipo: "out",
      texto: "📍 Localização enviada",
      hora: horaAgora(),
      localizacao: { lat, lng, endereco },
    });
  }

  function compartilharLocalizacao() {
    setAnexoAberto(false);
    const FALLBACK = { lat: -16.6869, lng: -49.2648, endereco: "Clínica Vitta · Goiânia, GO" };
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      enviarLocalizacao(FALLBACK.lat, FALLBACK.lng, FALLBACK.endereco);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        enviarLocalizacao(posicao.coords.latitude, posicao.coords.longitude);
      },
      () => {
        enviarLocalizacao(FALLBACK.lat, FALLBACK.lng, FALLBACK.endereco);
      },
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

  function marcarVenda() {
    setResultadoPorContato((prev) => ({ ...prev, [aberta.nome]: "venda" }));
    setEscolhendoMotivo(false);
    adicionarHistorico("sistema", "Negociação marcada como venda ✅");
    avisarAutomacao(`${aberta.nome} marcado como venda`);
  }

  function marcarPerda(motivo: string) {
    setResultadoPorContato((prev) => ({ ...prev, [aberta.nome]: "perda" }));
    setMotivoPerdaPorContato((prev) => ({ ...prev, [aberta.nome]: motivo }));
    setEscolhendoMotivo(false);
    adicionarHistorico("sistema", `Negociação perdida · motivo: ${motivo}`);
    avisarAutomacao(`${aberta.nome} marcado como perda (${motivo})`);
  }

  function adicionarMotivoCustom() {
    const texto = novoMotivoTexto.trim();
    if (!texto) return;
    setMotivosPerdaCustom((prev) => [...prev, texto]);
    setNovoMotivoTexto("");
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
    const largura = 288;
    const alturaEstimada = 300;
    const margem = 12;
    let left = rect.left;
    // Abre acima do botão "+", como no WhatsApp — só desce se não couber em cima.
    let top = rect.top - alturaEstimada - 8;
    if (top < margem) top = rect.bottom + 8;
    if (left + largura > window.innerWidth - margem) {
      left = window.innerWidth - largura - margem;
    }
    if (left < margem) left = margem;
    setAnexoPos({ x: left, y: top });
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

  function iniciarArrasteAnexo(e: React.MouseEvent) {
    const menuEl = (e.currentTarget as HTMLElement).closest(
      ".wa-anexo-menu",
    ) as HTMLElement | null;
    if (!menuEl) return;
    const rect = menuEl.getBoundingClientRect();
    anexoArrasteRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    function mover(ev: MouseEvent) {
      if (!anexoArrasteRef.current) return;
      setAnexoPos({
        x: ev.clientX - anexoArrasteRef.current.dx,
        y: ev.clientY - anexoArrasteRef.current.dy,
      });
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
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setConectarPos(null);
                setConectarAberto(true);
              }}
            >
              🔗 Conectar WhatsApp
            </button>
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
          </>
        }
      />

      <div className="content wa-content wa-whatsapp">
        <aside className="wa-list">
          <div className="wa-list-head">
            <span>Conversas</span>
            <button
              type="button"
              className={`wa-list-refresh${sincronizando ? " spinning" : ""}`}
              aria-label="Recarregar conversas"
              title="Recarregar conversas — use se as mensagens do celular conectado saírem de sincronia"
              onClick={sincronizarConversas}
            >
              <IconRefresh width={14} height={14} />
            </button>
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
                className={`wa-filter-chip${filtroConversa === f.valor ? " active" : ""}`}
                aria-pressed={filtroConversa === f.valor}
                onClick={() => setFiltroConversa(f.valor)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="wa-list-rows">
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
                  onClick={() => {
                    setSelectedId(c.id);
                    setLidas((prev) => (prev.has(c.id) ? prev : new Set(prev).add(c.id)));
                  }}
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
                    {c.naoLidas && !lidas.has(c.id) ? (
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
          </div>
        </aside>

        <section className="wa-main">
          <div className="open-conv-h">
            <button
              type="button"
              className="wa-conv-titulo-btn"
              onClick={() => {
                setMidiasPos(null);
                setMidiasAberto(true);
              }}
              title="Ver mídias e arquivos trocados nessa conversa"
            >
              <div className="avatar">{aberta.initials}</div>
              <div>
                <p className="n">{aberta.nome}</p>
                <p className="s">
                  {aberta.canal} · {aberta.contato}
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
            className={`chat-body${arrastandoArquivo ? " wa-dragover" : ""}`}
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
            {(mensagensExtraPorContato[aberta.nome] ?? []).map((msg, i) =>
              msg.localizacao ? (
                <a
                  key={msg.id ?? `extra-${i}`}
                  className={`bubble ${msg.tipo} bubble-localizacao`}
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
                    <span className="bubble-localizacao-titulo">📍 Localização compartilhada</span>
                    {msg.localizacao.endereco ? (
                      <span className="bubble-localizacao-endereco">{msg.localizacao.endereco}</span>
                    ) : (
                      <span className="bubble-localizacao-endereco">
                        {msg.localizacao.lat.toFixed(5)}, {msg.localizacao.lng.toFixed(5)}
                      </span>
                    )}
                    <span className="bubble-localizacao-link">Abrir no mapa →</span>
                  </div>
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
                </a>
              ) : msg.contatoCompartilhado ? (
                <button
                  type="button"
                  className={`bubble ${msg.tipo} bubble-contato`}
                  key={msg.id ?? `extra-${i}`}
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
                </button>
              ) : msg.imagens && msg.imagens.length > 0 ? (
                <div
                  className={`bubble ${msg.tipo} bubble-midia`}
                  key={msg.id ?? `extra-${i}`}
                >
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
                  key={msg.id ?? `extra-${i}`}
                >
                  <video
                    className="bubble-video"
                    src={msg.video.url}
                    controls
                    preload="metadata"
                    muted={!msg.video.comAudio}
                  />
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
                  key={msg.id ?? `extra-${i}`}
                >
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
              ) : (
                <div className={`bubble ${msg.tipo}`} key={msg.id ?? `extra-${i}`}>
                  {msg.texto}
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
              ),
            )}
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
                <div className="box chat-input-gravando">
                  🔴 Gravando áudio · {Math.floor(audioSegundos / 60)}:
                  {String(audioSegundos % 60).padStart(2, "0")}
                </div>
              ) : (
                <input
                  ref={mensagemInputRef}
                  className="box chat-input-campo"
                  placeholder="Digite uma mensagem... (/ para respostas rápidas, // para automações)"
                  value={mensagemTexto}
                  onChange={(e) => setMensagemTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") enviarMensagemTexto();
                  }}
                />
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
                        <span className="n">⚡ {a.titulo}</span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
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
            <button
              type="button"
              className={`chat-mic-btn${gravandoAudio ? " active" : ""}`}
              aria-pressed={gravandoAudio}
              aria-label={gravandoAudio ? "Parar e enviar áudio" : "Gravar áudio"}
              title={gravandoAudio ? "Parar e enviar áudio" : "Gravar áudio"}
              onClick={alternarGravacaoAudio}
            >
              <IconMic />
            </button>
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
                    ✕
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
                    >
                      ✂️ Cortar
                    </button>
                    <button type="button" className="btn ghost" onClick={girarImagem90}>
                      🔄 Girar
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
                          ✕
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
                    ✕
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
                  >
                    {videoMudo ? "🔇 Sem áudio" : "🔊 Com áudio"}
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
                <div className="open-conv-h" style={{ padding: 0, marginBottom: 14 }}>
                  <p className="n">Enviar documento</p>
                  <button
                    type="button"
                    className="modal-close-btn"
                    aria-label="Fechar"
                    onClick={() => setDocumentoOrigemAberto(false)}
                  >
                    ✕
                  </button>
                </div>
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
                    ✕
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
                      ✕
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
                    ✕
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
                ✕
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

          {contatoPickerAberto ? (
            <div className="form-preview-overlay" onClick={fecharContatoPicker}>
              <div className="wa-email-modal wa-contato-modal" onClick={(e) => e.stopPropagation()}>
                <div className="open-conv-h" style={{ padding: 0, marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span aria-hidden="true">👤➕</span>
                    <p className="n">Enviar Contato</p>
                  </div>
                  <button
                    type="button"
                    className="modal-close-btn"
                    aria-label="Fechar"
                    onClick={fecharContatoPicker}
                  >
                    ✕
                  </button>
                </div>

                {contatoSelecionado ? (
                  <div className="wa-contato-selecionado">
                    <span className="avatar">{contatoSelecionado.initials}</span>
                    <span className="wa-contato-selecionado-info">
                      <span className="n" style={{ display: "block" }}>{contatoSelecionado.nome}</span>
                      {contatoSelecionado.whatsapp ? (
                        <span className="wa-contato-picker-numero">{contatoSelecionado.whatsapp}</span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      className="modal-close-btn"
                      aria-label="Remover seleção"
                      onClick={() => setContatoSelecionado(null)}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div style={{ position: "relative" }}>
                    <input
                      autoFocus
                      className="input"
                      style={{ width: "100%" }}
                      placeholder="Buscar lead por nome ou telefone…"
                      value={buscaContatoPicker}
                      onChange={(e) => {
                        setBuscaContatoPicker(e.target.value);
                        setContatoSugestoesAberta(true);
                      }}
                      onFocus={() => setContatoSugestoesAberta(true)}
                    />
                    {contatoSugestoesAberta && buscaContatoPicker.trim() ? (
                      <div className="wa-contato-sugestoes">
                        {contatosFiltradosPicker.length === 0 ? (
                          <p className="hint" style={{ padding: "10px 12px" }}>
                            Nenhum contato encontrado.
                          </p>
                        ) : (
                          contatosFiltradosPicker.map((c) => (
                            <button
                              type="button"
                              key={c.nome}
                              className="dropdown-item wa-contato-picker-item"
                              style={{ width: "100%", textAlign: "left" }}
                              onClick={() =>
                                escolherContatoPicker({
                                  nome: c.nome,
                                  initials: c.initials,
                                  whatsapp: c.whatsapp,
                                })
                              }
                            >
                              <span className="avatar">{c.initials}</span>
                              <span>
                                <span className="n" style={{ display: "block" }}>{c.nome}</span>
                                {c.whatsapp ? (
                                  <span className="wa-contato-picker-numero">📞 {c.whatsapp}</span>
                                ) : null}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="section-foot wa-contato-modal-rodape">
                  <button type="button" className="btn ghost" onClick={fecharContatoPicker}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={!contatoSelecionado}
                    onClick={enviarContatoCompartilhado}
                  >
                    Enviar
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
                  ✕
                </button>
              </div>
              <div className="wa-contato-detalhe-corpo">
                <span className="avatar wa-contato-detalhe-avatar">{contatoDetalheAberto.initials}</span>
                <p className="n">{contatoDetalheAberto.nome}</p>
                {contatoDetalheAberto.whatsapp ? (
                  <p className="wa-contato-picker-numero">📞 {contatoDetalheAberto.whatsapp}</p>
                ) : (
                  <p className="hint">Sem número de WhatsApp cadastrado</p>
                )}
              </div>
              {contatoDetalheAberto.whatsapp ? (
                <a
                  className="btn primary block mb14"
                  href={`https://wa.me/${contatoDetalheAberto.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  💬 Conversar no WhatsApp
                </a>
              ) : null}
              <button
                type="button"
                className="btn ghost block"
                onClick={() => salvarContatoVcf(contatoDetalheAberto)}
              >
                💾 Salvar contato
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
        <div className="wa-info-scroll">
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
            <h4>Resultado da negociação</h4>
          </div>
          <div style={{ padding: "0 17px 14px" }}>
            {resultadoAtual === "venda" ? (
              <p className="wa-resultado-badge wa-resultado-venda">
                ✅ Marcada como venda
              </p>
            ) : resultadoAtual === "perda" ? (
              <p className="wa-resultado-badge wa-resultado-perda">
                ❌ Perdida · {motivoPerdaPorContato[aberta.nome]}
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button
                  type="button"
                  className="btn primary"
                  style={{ flex: "1 1 130px" }}
                  onClick={marcarVenda}
                >
                  ✅ Houve venda
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  style={{ flex: "1 1 130px" }}
                  onClick={() => setEscolhendoMotivo((v) => !v)}
                >
                  ❌ Não houve venda
                </button>
              </div>
            )}

            {escolhendoMotivo && !resultadoAtual ? (
              <div className="wa-motivo-picker">
                {motivosDisponiveis.map((m) => (
                  <button
                    type="button"
                    key={m}
                    className="dropdown-item"
                    style={{ width: "100%", textAlign: "left" }}
                    onClick={() => marcarPerda(m)}
                  >
                    <span className="n">{m}</span>
                  </button>
                ))}
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    placeholder="Novo motivo…"
                    value={novoMotivoTexto}
                    onChange={(e) => setNovoMotivoTexto(e.target.value)}
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
              </div>
            ) : null}
          </div>

          <div className="panel-h divided">
            <h4>Adicionar</h4>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "14px 17px" }}>
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
              style={{ flex: "1 1 140px" }}
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
              placeholder="Escreva aqui…"
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
        </div>
        </aside>
        </>
        ) : null}
      </div>

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
              ✕
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
                        style={{ padding: "4px 10px", fontSize: 11 }}
                        onClick={() => verificarRastreamento(email)}
                      >
                        🔄 Verificar
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
              ✕
            </button>
          </div>
          {aberta.tarefa.anexo ? (
            <div className="field" style={{ padding: "10px 0" }}>
              <div className="attach-chip">
                <IconDoc />
                <span className="fn">{aberta.tarefa.anexo.arquivo}</span>
                <span className="fs">{aberta.tarefa.anexo.detalhe}</span>
              </div>
            </div>
          ) : (
            <p className="hint" style={{ padding: "10px 0" }}>
              Nenhuma mídia trocada nessa conversa ainda.
            </p>
          )}
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
              ✕
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
                    ✕
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {conectarAberto ? (
        <div
          ref={conectarRef}
          className="wa-email-modal wa-email-floating"
          style={
            conectarPos
              ? { left: conectarPos.x, top: conectarPos.y, right: "auto", bottom: "auto" }
              : undefined
          }
        >
          <div className="wa-email-drag" onMouseDown={criarIniciarArraste(".wa-email-modal", setConectarPos)}>
            <div>
              <p className="n">Conectar WhatsApp</p>
              <p className="s">Escolha como conectar o número da clínica</p>
            </div>
            <button
              type="button"
              className="modal-close-btn"
              aria-label="Fechar"
              onClick={() => setConectarAberto(false)}
            >
              ✕
            </button>
          </div>
          <div className="filters-row mb14">
            <button
              type="button"
              className={`fchip${conectarAba === "qr" ? " active" : ""}`}
              onClick={() => setConectarAba("qr")}
            >
              QR Code (não oficial)
            </button>
            <button
              type="button"
              className={`fchip${conectarAba === "api" ? " active" : ""}`}
              onClick={() => setConectarAba("api")}
            >
              API oficial (Meta)
            </button>
          </div>
          {conectarAba === "qr" ? (
            <div style={{ textAlign: "center", padding: "6px 0 14px" }}>
              <div className="wa-qr-box">📷</div>
              <p className="hint" style={{ marginTop: 10 }}>
                Abra o WhatsApp no celular da clínica → Aparelhos conectados →
                Conectar um aparelho, e escaneie esse código.
              </p>
              <p className="hint">Aguardando leitura do QR…</p>
            </div>
          ) : (
            <>
              <div className="field" style={{ padding: "10px 0" }}>
                <label>ID da conta comercial (Meta)</label>
                <input className="input" style={{ width: "100%" }} placeholder="Ex.: 123456789012345" />
              </div>
              <div className="field" style={{ padding: "10px 0" }}>
                <label>Token de acesso</label>
                <input className="input" style={{ width: "100%" }} type="password" placeholder="••••••••••••" />
              </div>
              <p className="hint">
                Conectando pela API oficial, as conversas, fotos e nomes de contato são
                importados automaticamente — só a organização no funil continua manual.
              </p>
            </>
          )}
          <div className="section-foot">
            <button
              type="button"
              className="btn primary block"
              onClick={() => {
                setConectarAberto(false);
                avisarAutomacao("WhatsApp conectado — conversas sendo importadas");
              }}
            >
              {conectarAba === "qr" ? "Simular leitura do QR" : "Conectar"}
            </button>
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
