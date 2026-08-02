"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  classeOrigem,
  conversas,
  motivosPerda,
  type ConvMensagem,
  type Funil,
  type NegocioCard,
} from "@/lib/data";
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
  IconRefresh,
  IconSearch,
} from "@/components/icons";
import { FloatingDropdown, RadioList, Toggle, Topbar } from "@/components/ui";

const FILTROS_CONVERSA = [
  { valor: "tudo", label: "Tudo" },
  { valor: "nao-lidas", label: "Não lidas" },
  { valor: "favoritas", label: "Favoritas" },
] as const;

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

function ConversasPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { funis, atribuirContatoAoFunil } = useFunis();
  const { contatos, salvarDadosContato, atribuirAtendente } = useContatos();
  const { automacoes, automacoesDeEntradaAtivas } = useAutomacoes();
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
  const [conectarAberto, setConectarAberto] = useState(false);
  const [conectarAba, setConectarAba] = useState<"qr" | "api">("qr");
  const [infoWidth, setInfoWidth] = useState(320);
  const [sincronizando, setSincronizando] = useState(false);

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
  >({});
  const [mensagemTexto, setMensagemTexto] = useState("");
  const [gravandoAudio, setGravandoAudio] = useState(false);
  const [audioSegundos, setAudioSegundos] = useState(0);
  const [anexoAberto, setAnexoAberto] = useState(false);
  const [anexoRect, setAnexoRect] = useState<DOMRect | null>(null);
  const [emojiAberto, setEmojiAberto] = useState(false);
  const [emojiRect, setEmojiRect] = useState<DOMRect | null>(null);
  const [respostasGerenciarAberto, setRespostasGerenciarAberto] = useState(false);
  const [novaRespostaTexto, setNovaRespostaTexto] = useState("");
  const [respostasRapidasPorFunil, setRespostasRapidasPorFunil] = useState<
    Record<string, { id: string; texto: string }[]>
  >({});
  const mensagemInputRef = useRef<HTMLInputElement>(null);
  const imagemInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentoInputRef = useRef<HTMLInputElement>(null);

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

  function adicionarMensagem(msg: ConvMensagem) {
    setMensagensExtraPorContato((prev) => ({
      ...prev,
      [aberta.nome]: [...(prev[aberta.nome] ?? []), msg],
    }));
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

  function anexarArquivo(rotulo: string, arquivo: File) {
    adicionarMensagem({ tipo: "out", texto: `${rotulo} · ${arquivo.name}`, hora: horaAgora() });
  }

  function abrirUploadImagem() {
    setAnexoAberto(false);
    imagemInputRef.current?.click();
  }

  function abrirUploadVideo() {
    setAnexoAberto(false);
    videoInputRef.current?.click();
  }

  function abrirUploadDocumento() {
    setAnexoAberto(false);
    documentoInputRef.current?.click();
  }

  function irParaContatos() {
    setAnexoAberto(false);
    router.push("/contatos");
  }

  function compartilharLocalizacao() {
    setAnexoAberto(false);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      adicionarMensagem({ tipo: "out", texto: "📍 Localização enviada", hora: horaAgora() });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        const { latitude, longitude } = posicao.coords;
        adicionarMensagem({
          tipo: "out",
          texto: `📍 Localização enviada · ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
          hora: horaAgora(),
        });
      },
      () => {
        adicionarMensagem({ tipo: "out", texto: "📍 Localização enviada", hora: horaAgora() });
      },
    );
  }

  function inserirEmoji(emoji: string) {
    setMensagemTexto((prev) => prev + emoji);
  }

  const respostasDoFunil = respostasRapidasPorFunil[funilSelecionadoId] ?? [];

  function criarRespostaRapida() {
    const texto = novaRespostaTexto.trim();
    if (!texto) return;
    setRespostasRapidasPorFunil((prev) => ({
      ...prev,
      [funilSelecionadoId]: [
        ...(prev[funilSelecionadoId] ?? []),
        { id: `resp-${Date.now()}`, texto },
      ],
    }));
    setNovaRespostaTexto("");
  }

  function excluirRespostaRapida(id: string) {
    setRespostasRapidasPorFunil((prev) => ({
      ...prev,
      [funilSelecionadoId]: (prev[funilSelecionadoId] ?? []).filter((r) => r.id !== id),
    }));
  }

  function usarRespostaRapida(texto: string) {
    setMensagemTexto(texto);
  }

  const automacoesDoFunil = automacoes.filter((a) => a.funilId === funilSelecionadoId);

  function executarAutomacaoNaConversa(automacaoId: string) {
    const automacao = automacoesDoFunil.find((a) => a.id === automacaoId);
    if (!automacao) return;
    for (const acao of automacao.acoes) {
      if (
        (acao.tipo === "mensagem" || acao.tipo === "mensagem_interativa") &&
        acao.mensagem
      ) {
        adicionarMensagem({ tipo: "out", texto: acao.mensagem, hora: horaAgora() });
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
              onClick={() => setConectarAberto(true)}
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
        </aside>

        <section className="wa-main">
          <div className="open-conv-h">
            <button
              type="button"
              className="wa-conv-titulo-btn"
              onClick={() => setMidiasAberto(true)}
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
            {(mensagensExtraPorContato[aberta.nome] ?? []).map((msg, i) => (
              <div className={`bubble ${msg.tipo}`} key={`extra-${i}`}>
                {msg.texto}
                {msg.hora ? <span className="tm">{msg.hora}</span> : null}
              </div>
            ))}
          </div>
          <div className="chat-input">
            <button
              type="button"
              className="chat-attach-btn"
              aria-label="Anexar"
              title="Anexar"
              onClick={(e) => {
                setAnexoRect(e.currentTarget.getBoundingClientRect());
                setAnexoAberto((v) => !v);
              }}
            >
              +
            </button>
            <div
              className="chat-input-wrap"
              onClick={() => mensagemInputRef.current?.focus()}
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
                      >
                        <span className="n">{r.texto}</span>
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
              😊
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
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) anexarArquivo("🖼️ Imagem enviada", arquivo);
              e.target.value = "";
            }}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) anexarArquivo("🎥 Vídeo enviado", arquivo);
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
              if (arquivo) anexarArquivo("📄 Documento enviado", arquivo);
              e.target.value = "";
            }}
          />

          <FloatingDropdown
            anchorRect={anexoAberto ? anexoRect : null}
            onClose={() => setAnexoAberto(false)}
            width={220}
          >
            <button
              type="button"
              className="dropdown-item"
              style={{ width: "100%", textAlign: "left" }}
              onClick={abrirUploadImagem}
            >
              <span className="n">Imagem</span>
            </button>
            <button
              type="button"
              className="dropdown-item"
              style={{ width: "100%", textAlign: "left" }}
              onClick={abrirUploadVideo}
            >
              <span className="n">Vídeo</span>
            </button>
            <button
              type="button"
              className="dropdown-item"
              style={{ width: "100%", textAlign: "left" }}
              onClick={abrirUploadDocumento}
            >
              <span className="n">Documento</span>
            </button>
            <button
              type="button"
              className="dropdown-item"
              style={{ width: "100%", textAlign: "left" }}
              onClick={irParaContatos}
            >
              <span className="n">Contato</span>
            </button>
            <button
              type="button"
              className="dropdown-item"
              style={{ width: "100%", textAlign: "left" }}
              onClick={compartilharLocalizacao}
            >
              <span className="n">Localização</span>
            </button>
            <div className="dropdown-sep" />
            <button
              type="button"
              className="dropdown-item"
              style={{ width: "100%", textAlign: "left", color: "var(--blue)" }}
              onClick={() => {
                setAnexoAberto(false);
                setMensagemTexto("//");
              }}
            >
              <span className="n">⚡ Executar Automação</span>
            </button>
            <button
              type="button"
              className="dropdown-item"
              style={{ width: "100%", textAlign: "left", color: "#7c3aed" }}
              onClick={() => {
                setAnexoAberto(false);
                setRespostasGerenciarAberto(true);
              }}
            >
              <span className="n">💬 Respostas Rápidas</span>
            </button>
            <div className="dropdown-sep" />
            <button
              type="button"
              className="dropdown-item"
              style={{ width: "100%", textAlign: "left", color: "#d64545" }}
              onClick={() => setAnexoAberto(false)}
            >
              <span className="n">✕ Fechar</span>
            </button>
          </FloatingDropdown>

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
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn primary"
                  style={{ flex: 1 }}
                  onClick={marcarVenda}
                >
                  ✅ Houve venda
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  style={{ flex: 1 }}
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
        <div className="form-preview-overlay" onClick={() => setMidiasAberto(false)}>
          <div className="wa-email-modal" onClick={(e) => e.stopPropagation()}>
            <div className="open-conv-h" style={{ padding: 0, marginBottom: 14 }}>
              <div>
                <p className="n">Mídias e arquivos</p>
                <p className="s">Trocados com {aberta.nome}</p>
              </div>
              <span
                className="close"
                style={{ cursor: "pointer" }}
                onClick={() => setMidiasAberto(false)}
              >
                Fechar ✕
              </span>
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
        </div>
      ) : null}

      {respostasGerenciarAberto ? (
        <div
          className="form-preview-overlay"
          onClick={() => setRespostasGerenciarAberto(false)}
        >
          <div className="wa-email-modal" onClick={(e) => e.stopPropagation()}>
            <div className="open-conv-h" style={{ padding: 0, marginBottom: 14 }}>
              <div>
                <p className="n">Respostas rápidas</p>
                <p className="s">Só valem pro funil &quot;{funilSelecionado.nome}&quot;</p>
              </div>
              <span
                className="close"
                style={{ cursor: "pointer" }}
                onClick={() => setRespostasGerenciarAberto(false)}
              >
                Fechar ✕
              </span>
            </div>
            <div className="field" style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                placeholder="Escreva uma resposta pra salvar…"
                value={novaRespostaTexto}
                onChange={(e) => setNovaRespostaTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") criarRespostaRapida();
                }}
              />
              <button type="button" className="btn primary" onClick={criarRespostaRapida}>
                Adicionar
              </button>
            </div>
            {respostasDoFunil.length === 0 ? (
              <p className="hint" style={{ padding: "10px 0" }}>
                Nenhuma resposta rápida salva pra esse funil ainda.
              </p>
            ) : (
              <div style={{ padding: "10px 0", display: "flex", flexDirection: "column", gap: 8 }}>
                {respostasDoFunil.map((r) => (
                  <div key={r.id} className="attach-chip" style={{ justifyContent: "space-between" }}>
                    <span className="fn">{r.texto}</span>
                    <span
                      className="close"
                      style={{ cursor: "pointer" }}
                      onClick={() => excluirRespostaRapida(r.id)}
                    >
                      ✕
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {conectarAberto ? (
        <div className="form-preview-overlay" onClick={() => setConectarAberto(false)}>
          <div className="wa-email-modal" onClick={(e) => e.stopPropagation()}>
            <div className="open-conv-h" style={{ padding: 0, marginBottom: 14 }}>
              <div>
                <p className="n">Conectar WhatsApp</p>
                <p className="s">Escolha como conectar o número da clínica</p>
              </div>
              <span
                className="close"
                style={{ cursor: "pointer" }}
                onClick={() => setConectarAberto(false)}
              >
                Fechar ✕
              </span>
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
