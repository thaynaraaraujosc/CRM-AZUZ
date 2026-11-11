"use client";

import {
  Fragment,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
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
import { rotuloDoDiaEmBrasilia } from "@/lib/conversas/hora-da-mensagem";
import { ehLinkDeMidia } from "@/lib/conversas/midia-mensagem";
import {
  conexaoDaConversa,
  precisaDistinguirConexao,
  ROTULO_CONEXAO,
} from "@/lib/conversas/conexao-da-conversa";
import {
  canalDoNumero,
  conversaDoNumero,
  mapaDeEtiquetas,
  mapaDeNumeros,
  nomeDoNumeroDaConversa,
  precisaEscolherNumero,
  type NumeroConectado,
} from "@/lib/conversas/numeros-conectados";
import { canalDeSaida } from "@/lib/conversas/canal-de-saida";
import { iniciaisExibidas, nomeExibido } from "@/lib/conversas/exibicao";
import { valeBuscarNome } from "@/lib/conversas/nome-do-historico";
import type { TagDeOrigem } from "@/lib/rastreio/tag-de-origem";
import { chaveDeContato } from "@/lib/contatos/chave-nome";
import { BotoesConectarWhatsApp } from "@/components/configuracoes/BotoesConectarWhatsApp";
import { BolhaMensagem } from "@/components/conversas/BolhaMensagem";
import { traduzirRotuloDoSistema } from "@/lib/conversas/rotulos-do-sistema";
import { LimiteDeErro } from "@/components/limite-de-erro";
import { StatusMensagemIcone } from "@/components/conversas/StatusMensagem";
import { EnviarTemplateWhatsApp } from "@/components/conversas/EnviarTemplateWhatsApp";
import { useAutomationFlows } from "@/lib/automation-flow-context";
import { useContatos } from "@/lib/contatos-context";
import { useConversas, type ConversaReal } from "@/lib/conversas-context";
import { useEquipe } from "@/lib/equipe-context";
import { useMotivosPerda } from "@/lib/motivos-perda";
import { rotuloDeConversa } from "@/lib/datas";
import { estimarMinutosAtras, gerarLinhaDoTempo, type Evento } from "@/lib/timeline";
import { useFloatingPosition, type AnchorRect } from "@/lib/use-floating-position";
import { Timeline } from "@/components/timeline";
import { AudioBubblePlayer, AudioWaveformBars } from "@/components/audio-player";
import {
  useBibliotecaDocumentos,
  CATEGORIAS_DOCUMENTO,
} from "@/lib/biblioteca-documentos-context";
import { HOJE_ISO } from "@/lib/hoje";
import { useFunis } from "@/lib/funis-context";
import { numerosNaOrdemDosFunis } from "@/lib/funis/numero-do-funil";
import { useIdioma } from "@/lib/idioma-context";
import { useMensagensExtra } from "@/lib/mensagens-extra-context";
import { criarResolvedorDeMencao, filtrarParticipantes, inserirMencao, mencaoEmDigitacao } from "@/lib/conversas/mencoes";
import { identificarParticipante, nomesVistosNasMensagens } from "@/lib/conversas/participantes";
import { interpretarMensagem } from "@/lib/conversas/formatacao-mensagem";
import { renderizarTrechos } from "@/components/conversas/TextoDaMensagem";
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
import { FloatingDropdown, Modal, RadioList, Toggle, Topbar } from "@/components/ui";
import { DadosDoContato } from "@/components/contato/DadosDoContato";
import { SeletorDeData } from "@/components/seletor-de-data";

const FILTROS_CONVERSA = [
  { valor: "tudo", label: "Tudo" },
  { valor: "nao-lidas", label: "Não lidas"},
  { valor: "favoritas", label: "Favoritas" },
] as const;

/**
 * Filtro por canal, separado dos filtros de situação acima porque são coisas independentes: dá pra
 * querer "não lidas do Instagram". Com WhatsApp e Instagram ligados ao mesmo tempo, a lista mistura
 * os dois e fica difícil saber por onde a pessoa está falando.
 *
 * Instagram e TikTok saíram desta lista: o Instagram ganhou tela própria (Direct, story,
 * comentário e o perfil da pessoa ao lado, coisas que não existem no WhatsApp), e o TikTok não
 * recebe mensagem nenhuma. Um filtro por canal numa tela que atende um canal só é um controle que
 * não controla nada.
 */
const CANAIS_CONVERSA = [
  { valor: "todos", label: "Todas as conexões", emBreve: false },
  { valor: "WhatsApp", label: "WhatsApp", emBreve: false },
] as const;

/**
 * OS CINCO DESFECHOS DE UMA NEGOCIAÇÃO, numa lista só.
 *
 * Declarados uma vez porque aparecem em dois lugares com peso diferente: à mostra no painel de
 * Negociação, que é a aba cuja função É registrar o desfecho, e dentro de um menu nas ações
 * rápidas, onde há espaço pra uma linha. Duas cópias da mesma lista divergiriam no primeiro
 * desfecho novo — e o jeito de descobrir seria uma das telas não oferecer uma opção que a outra
 * oferece.
 */
const OPCOES_DE_RESULTADO = [
  { chave: "venda", rotulo: "Venda concluída", Icone: IconCheck },
  { chave: "perda", rotulo: "Negociação perdida", Icone: IconErro },
  { chave: "andamento", rotulo: "Continua em andamento", Icone: IconRefresh },
  { chave: "adiada", rotulo: "Adiada", Icone: IconRelogio },
  { chave: "cancelada", rotulo: "Cancelada", Icone: IconProibido },
] as const;

const FORMATOS_IMAGEM = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const TAMANHO_MAX_IMAGEM = 16 * 1024 * 1024;
const FORMATOS_VIDEO = ["video/mp4", "video/webm", "video/quicktime", "video/3gpp"];
const TAMANHO_MAX_VIDEO = 64 * 1024 * 1024;
const DURACAO_MAX_VIDEO_SEG = 180;
const TAMANHO_MAX_DOCUMENTO = 32 * 1024 * 1024;

/**
 * A aba das conversas que não dizem de qual número vieram.
 *
 * São as antigas, de antes de o CRM gravar a conexão em cada conversa. Valor próprio, e não `""`,
 * porque ele precisa conviver com as chaves de número reais sem se confundir com "nenhuma aba".
 */
const SEM_NUMERO = "__sem_numero__";

/*
 * OS DOIS NOMES DE CANAL, escritos aqui e não importados de `conta-canal`.
 *
 * Aquele módulo é de SERVIDOR: ele puxa o cache de conexões, que puxa o Prisma, que puxa `node:*`.
 * Importá-lo nesta página — que é client component — quebrava o build inteiro com "the chunking
 * context does not support external modules (request: node:module)", e o erro aparecia longe da
 * causa, como falha ao gerar o chunk da página.
 *
 * Duas constantes de texto não valem arrastar o servidor pra dentro do navegador. Elas são o valor
 * gravado em `MensagemExtra.canal` e não mudam sem migração de dados.
 */
const CANAL_NAO_OFICIAL = "whatsapp_nao_oficial";
const CANAL_OFICIAL = "meta_whatsapp";

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
 * → (às vezes) lido, com tempos realistas e aleatórios. Nunca ajustável
 * manualmente. Fica fora do componente (só recebe o "setter" já amarrado ao
 * contato/id certos) pra não misturar código com efeito colateral agendado
 * dentro do corpo do componente.
 */
/**
 * REMOVIDA: a simulação de entrega.
 *
 * Havia aqui uma função que, por temporizador, marcava toda mensagem enviada como "enviado",
 * depois "entregue" e: com 82% de chance, sorteada: "lido". Nada disso vinha do WhatsApp: os
 * dois tiquinhos azuis apareciam mesmo que a mensagem não tivesse saído do servidor.
 *
 * Isso é pior do que não mostrar status nenhum. Quem atende decide o que fazer olhando o tique: se
 * ele diz que o cliente leu, ninguém liga pra cobrar. E como o sorteio era aleatório, o mesmo envio
 * podia mostrar histórias diferentes a cada recarga da página.
 *
 * Agora o status vem de onde ele existe de verdade: "enviado" quando a Meta confirma o envio e
 * devolve o `wamid`, e "entregue"/"lido" quando o webhook de status chega (casado pelo `wamid`).
 * Canal que não informa entrega para em "enviado". Que é a verdade sobre o que sabemos.
 */

/** Aplica um fundo no rascunho de configurações. "todas" grava no padrão, "atual" só nessa conversa. */
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


/** Ícone + rótulo + descrição de acessibilidade do estado real de uma mensagem enviada. */
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
 * ainda carregando): em vez de deixar `aberta` ser `undefined` (o que quebraria os dezenas de
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
  contaCanal: null,
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
  primeiraMensagemHora: string | undefined,
  // Função pura, fora do componente: não pode chamar o hook do idioma.
  traduzir: (texto: string, valores?: Record<string, string | number>) => string,
): HistoricoItem[] {
  const localizacao = localizarNoFunil(listaFunis, contato.nome);
  const itens: HistoricoItem[] = [];

  const primeiraHora = primeiraMensagemHora;
  itens.push({
    id: `hist-inicio-${contato.id}`,
    tipo: "sistema",
    texto: primeiraHora
      ? traduzir("Primeira conversa registrada · {quando}", { quando: primeiraHora })
      : traduzir("Primeira conversa registrada"),
    quando: primeiraHora ?? "",
  });

  if (localizacao) {
    const funil = listaFunis.find((f) => f.id === localizacao.funilId);
    const card = funil?.colunas
      .flatMap((coluna) => coluna.cards)
      .find((c) => c.nome === contato.nome);
    itens.push({
      id: `hist-etapa-${contato.id}`,
      tipo: "sistema",
      // Nome da etapa e nome do funil são do CLIENTE: entram como estão, sem passar pelo
      // dicionário. O que traduz é a frase em volta.
      texto: card
        ? traduzir('Entrou na etapa "{etapa}" do funil {funil} · há {dias}', {
            etapa: localizacao.etapa,
            funil: funil?.nome ?? "",
            dias: card.dias,
          })
        : traduzir('Entrou na etapa "{etapa}" do funil {funil}', {
            etapa: localizacao.etapa,
            funil: funil?.nome ?? "",
          }),
      quando: card?.data ?? "",
    });

    if (localizacao.etapa.toLowerCase().includes("fechado")) {
      itens.push({
        id: `hist-fechou-${contato.id}`,
        tipo: "sistema",
        texto: card
          ? traduzir("Fechou negócio · valor {valor}", { valor: card.valor })
          : traduzir("Fechou negócio"),
        quando: card?.data ?? "",
      });
    }
  } else {
    itens.push({
      id: `hist-sem-funil-${contato.id}`,
      tipo: "sistema",
      texto: traduzir("Ainda não entrou em nenhum funil"),
      quando: "",
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

/** Fecha um popup flutuante ao clicar fora dele. Usado pelos popups menores (mídias, conectar, detalhe do contato). */
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
  // Tradução da interface (ver `idioma-context.tsx`). Frase sem tradução cadastrada sai em
  // português, então acrescentar idioma aqui nunca deixa a tela em branco.
  const { t: traduzir, localeNumero } = useIdioma();
  const searchParams = useSearchParams();
  const { funis, setFunis, atribuirContatoAoFunil } = useFunis();

  /** Etapa do funil onde esse contato está agora (procura em todos os funis, não só o principal):
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
  const { fluxos } = useAutomationFlows();
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
      // `atualizarConfig` já persiste de verdade (ver configuracoes-context.tsx): o delay aqui é
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
      // Web Audio indisponível nesse navegador. Sem prévia sonora.
    }
  }

  const [toasts, setToasts] = useState<{ id: string; texto: string }[]>([]);
  const proximoToastId = useRef(0);

  /**
   * NOMEAR UM NÚMERO, da própria aba.
   *
   * "Eu posso clicar e aí eu posso nomear esse número pra facilitar." O nome já existia nas
   * configurações; o que faltava era poder dá-lo onde ele se usa — a caixa de entrada é onde a
   * falta de nome incomoda, não a tela de conexões.
   *
   * A lista local é atualizada na hora e a gravação vai atrás: esperar a resposta pra trocar o
   * rótulo faz a aba piscar o nome velho por meio segundo. Se o servidor recusar (só
   * administrador pode), o nome volta e o motivo aparece — em vez de ficar na tela um nome que
   * não existe no banco.
   */
  async function salvarApelido(numero: NumeroConectado, valor: string) {
    setRenomeando(null);
    const apelido = valor.trim().slice(0, 60);
    if (apelido === (numero.apelido ?? "")) return;
    const antes = numerosConectados;
    setNumerosConectados((lista) =>
      lista.map((n) => (n.chave === numero.chave ? { ...n, apelido: apelido || null } : n)),
    );
    try {
      const r = await fetch("/api/integracoes/numeros", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provedor: numero.provedor, slot: numero.slot, apelido: apelido || null }),
      });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { erro?: string }).erro);
    } catch (erro) {
      setNumerosConectados(antes);
      avisarAutomacao(erro instanceof Error && erro.message ? erro.message : "Não deu pra renomear o número.");
    }
  }

  /**
   * BUSCA O NOME DAS CONVERSAS QUE JÁ ESTÃO COMO NÚMERO.
   *
   * O batismo automático acontece quando a mensagem chega, então ele conserta o futuro: quem já
   * está no CRM como "5511973935384" só muda quando aquela pessoa escrever de novo. Este botão é o
   * passado — ele lê o nome no histórico que o aparelho ainda guarda (só no QR Code; a API oficial
   * não tem de onde consultar).
   *
   * Em lotes, e repetindo enquanto sobrar: é uma chamada por conversa, e um lote que estoura no
   * meio sem dizer o que já fez é pior que três lotes que andam.
   */
  async function buscarNomesQueFaltam() {
    if (batizando) return;
    setBatizando(true);
    let total = 0;
    try {
      for (let rodada = 0; rodada < 20; rodada += 1) {
        const r = await fetch("/api/conversas/batizar-numeros", { method: "POST" });
        const dados = (await r.json().catch(() => ({}))) as {
          batizadas?: number;
          restam?: number;
          erro?: string;
        };
        if (!r.ok) throw new Error(dados.erro);
        total += dados.batizadas ?? 0;
        if (!dados.restam) break;
      }
      await recarregarConversas();
      avisarAutomacao(
        total
          ? `${total} ${total === 1 ? "conversa ganhou nome" : "conversas ganharam nome"}.`
          : "O WhatsApp não guardou o nome dessas pessoas. A próxima mensagem delas traz o nome, e aí a conversa é renomeada sozinha.",
      );
    } catch (erro) {
      avisarAutomacao(erro instanceof Error && erro.message ? erro.message : "Não deu pra buscar os nomes.");
    } finally {
      setBatizando(false);
    }
  }

  function avisarAutomacao(texto: string) {
    const id = `toast-${proximoToastId.current++}`;
    setToasts((prev) => [...prev, { id, texto }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }
  // `conversas` só chega depois do fetch no mount do ConversasProvider. A inicialização
  // preguiçosa de `useState` não serve aqui (ela rodaria antes da lista existir). Em vez de
  // useEffect, ajusta durante a renderização (padrão já usado nesta página, ver `abertaIdAnterior`
  // mais abaixo): só seta uma vez, na primeira renderização em que a lista deixa de estar vazia.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIdInicializado, setSelectedIdInicializado] = useState(false);
  if (!selectedIdInicializado && conversas.length > 0) {
    // Só conversas DESTA tela entram na escolha inicial. O Instagram tem tela própria, e a lista
    // daqui o exclui — mas a conversa ABERTA era resolvida na lista completa, então bastava o
    // primeiro item do banco ser do Direct (ou alguém chegar com `?contato=` de um perfil do
    // Instagram) pra tela do WhatsApp abrir uma conversa de Instagram do lado direito, com o
    // cabeçalho dizendo "Instagram" e os botões errados embaixo.
    const desta = conversas.filter((c) => c.canal !== "Instagram");
    if (desta.length > 0) {
      const nomeContato = searchParams.get("contato");
      const encontrada = nomeContato ? desta.find((c) => c.nome === nomeContato) : null;
      /**
       * PEDIU UMA PESSOA E ELA NÃO TEM CONVERSA: não abre a de outra.
       *
       * Caía em `desta[0]`, a primeira da lista. Quem clicava em "Enviar WhatsApp" na ficha de um
       * contato recém-salvo — que por definição ainda não tem conversa — aterrissava no chat de
       * OUTRA pessoa, com o campo de escrever pronto. É o tipo de erro que se descobre depois de
       * mandar a mensagem.
       *
       * Aqui não escolhe nada; quem abre a conversa é o efeito logo abaixo, que cria a conversa
       * com essa pessoa.
       */
      if (nomeContato && !encontrada) {
        setSelectedIdInicializado(true);
      } else {
        setSelectedId((encontrada ?? desta[0]).id);
        setSelectedIdInicializado(true);
      }
    }
  }
  /*
   * O PAINEL DO CONTATO NASCE ABERTO.
   *
   * Ele ficava atrás da engrenagem, e quem atende precisa do que está lá — responsável, origem,
   * valor, agendamento — enquanto lê a mensagem, não depois de dois cliques. Fechado por padrão
   * ele virava "aquela aba que ninguém sabe que existe".
   *
   * A engrenagem continua, pra fechar quando a conversa precisar de largura (uma imagem grande,
   * um texto longo).
   */
  const [infoAberto, setInfoAberto] = useState(true);
  const [abaInfo, setAbaInfo] = useState<
    "resumo" | "contato" | "negociacao" | "atividades" | "historico"
  >("contato");
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
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [filtroRect, setFiltroRect] = useState<DOMRect | null>(null);

  /* O que o botão de filtro mostra. "Tudo" + "Todas as conexões" é o estado neutro e não vira
     rótulo: só o que desvia do padrão aparece, pra a pessoa saber por que a lista está do jeito
     que está sem precisar abrir o menu. */
  const filtroAtivo = mostrarArquivadas || filtroConversa !== "tudo" || canalAba !== "todos";
  const resumoDoFiltro = [
    mostrarArquivadas
      ? traduzir("Arquivadas")
      : filtroConversa !== "tudo"
        ? traduzir(FILTROS_CONVERSA.find((f) => f.valor === filtroConversa)?.label ?? "")
        : null,
    canalAba !== "todos"
      ? traduzir(CANAIS_CONVERSA.find((c) => c.valor === canalAba)?.label ?? "")
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

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
  /*
   * GRUPO ABERTO SEM LISTA DE PARTICIPANTES: BUSCA AGORA.
   *
   * O conserto no webhook preenche a lista quando chega mensagem NOVA naquele grupo. Grupo parado —
   * que é a maioria, a qualquer momento — continuava mostrando "0 participantes" indefinidamente,
   * e não havia nada que a pessoa pudesse fazer além de esperar alguém escrever. Abrir o grupo é o
   * momento natural de perguntar.
   *
   * Uma vez por grupo por sessão: o `ref` segura os já tentados, pra uma busca que falhou (grupo do
   * qual o número saiu, Evolution fora do ar) não virar uma chamada a cada clique.
   */
  const gruposJaConsultados = useRef<Set<string>>(new Set());
  const [participantesAberto, setParticipantesAberto] = useState(false);
  const [atualizandoParticipantes, setAtualizandoParticipantes] = useState(false);
  const [erroParticipantes, setErroParticipantes] = useState<string | null>(null);
  const [participantesPos, setParticipantesPos] = useState<{ x: number; y: number } | null>(null);
  const participantesRef = useRef<HTMLDivElement>(null);
  const [dadosGrupoAberto, setDadosGrupoAberto] = useState(false);
  const [dadosGrupoPos, setDadosGrupoPos] = useState<{ x: number; y: number } | null>(null);
  const dadosGrupoRef = useRef<HTMLDivElement>(null);
  // Participante clicado dentro do painel de Participantes. Abre um popup próprio (foto buscada
  // sob demanda, nome, telefone, "Enviar mensagem"), igual clicar num contato dentro de um grupo no
  // WhatsApp de verdade.
  const [participanteAberto, setParticipanteAberto] = useState<{ nome: string; telefone: string } | null>(null);
  const [fotoParticipante, setFotoParticipante] = useState<string | null>(null);
  const [carregandoFotoParticipante, setCarregandoFotoParticipante] = useState(false);
  const [criandoConversaParticipante, setCriandoConversaParticipante] = useState(false);
  const naoOficial = useIntegracaoNaoOficial();
  // Status da API oficial (Meta). Sem hook compartilhado com polling (o `useIntegracaoMeta` só
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
    // 30 segundos, e não 5. Isto aqui só responde "o WhatsApp oficial está conectado?": uma
    // resposta que muda quando alguém conecta ou desconecta um canal, o que acontece algumas vezes
    // por ANO. A 5 segundos, uma aba aberta o dia inteiro fazia 17.280 consultas por dia pra ouvir
    // a mesma coisa, e cada uma atravessa a internet até o banco no Railway, que cobra por byte que
    // sai. A checagem de visibilidade evita gastar com a aba em segundo plano, que é como o CRM
    // passa a maior parte do tempo.
    const intervalo = setInterval(() => {
      if (document.visibilityState === "visible") verificarMeta();
    }, 30000);
    return () => clearInterval(intervalo);
  }, []);
  // Só passa a filtrar depois que os dois status (Meta e Baileys) já responderam pelo menos uma
  // vez: sem essa guarda, a lista de conversas do WhatsApp pisca "vazia" por um instante em toda
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
    fotoUrl?: string;
  } | null>(null);
  const [salvandoContato, setSalvandoContato] = useState(false);
  const [infoWidth, setInfoWidth] = useState(320);
  const [sincronizando, setSincronizando] = useState(false);

  useFecharAoClicarFora(midiasRef, midiasAberto, () => setMidiasAberto(false));
  useFecharAoClicarFora(participantesRef, participantesAberto, () => setParticipantesAberto(false));
  useFecharAoClicarFora(dadosGrupoRef, dadosGrupoAberto, () => setDadosGrupoAberto(false));

  // Reseta o estado da foto assim que o participante clicado muda. Ajusta durante a renderização
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

  /** Busca conversas e mensagens de novo AGORA, sem esperar o próximo ciclo do polling de 5s. Não
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

  /*
   * OS NÚMEROS DE WHATSAPP CONECTADOS.
   *
   * Com um só, nada disto aparece. Com vendedora e closer no mesmo CRM, a caixa de entrada vira
   * duas caixas no mesmo lugar, e quem atende precisa poder ver só a sua.
   *
   * Buscado uma vez ao abrir: conectar ou desconectar um número é coisa de algumas vezes na vida
   * da conta, e ficar perguntando de poucos em poucos segundos seria consulta sem ninguém olhando.
   */
  const [numerosConectados, setNumerosConectados] = useState<NumeroConectado[]>([]);
  /** Qual aba de número está com o campo de nome aberto. Duplo clique abre; Enter ou sair grava. */
  const [renomeando, setRenomeando] = useState<string | null>(null);
  /** Rodando a busca de nomes das conversas que ainda se chamam pelo número. */
  const [batizando, setBatizando] = useState(false);
  useEffect(() => {
    // OS DOIS CANAIS. A rota de QR Code só sabia dos celulares; quem tem a API oficial no número
    // principal e um vendedor no QR tem dois números recebendo, e o filtro precisa dos dois.
    fetch("/api/integracoes/numeros")
      .then((r) => r.json())
      .then((dados: { numeros?: NumeroConectado[] }) => setNumerosConectados(dados.numeros ?? []))
      .catch(() => setNumerosConectados([]));
  }, []);
  /** Qual número está sendo visto. `"Todos"` mistura os dois, que é como a tela sempre foi. */
  const [numeroTopFiltro, setNumeroTopFiltro] = useState("Todos");

  // Movido pra antes de `conversasFiltradas` (que chama `conversaUsaWhatsappNaoOficial`, definida
  // mais abaixo mas que fecha sobre esta variável). Como é `const`, ficava numa "zona morta
  // temporal" até esta linha rodar; `conversasFiltradas` é calculado direto no corpo do
  // componente, então rodava ANTES desta declaração (quando ela vinha depois), lançando
  // `ReferenceError: Cannot access before initialization`: só na hora, porque só nesse caso
  // (WhatsApp conectado + conversa do canal WhatsApp na lista) o filtro chega a chamar a função
  // que usa essa variável. Bug real que derrubava a tela de Conversas (e, por ela abrir de novo a
  // cada navegação, o app inteiro) só depois de conectar o WhatsApp.
  const {
    mensagensExtraPorContato,
    setMensagensExtraPorContato,
    recarregar: recarregarMensagens,
  } = useMensagensExtra();

  const atendentesDisponiveis = membrosEquipe.map((m) => m.nome);
  /* As duas conexões de WhatsApp na mesma lista? Então cada conversa precisa dizer de qual é.
     Sai da própria lista carregada, sem pedir nada a mais ao servidor. */
  const distinguirConexao = precisaDistinguirConexao(conversas);
  /* Com mais de um número de WhatsApp ligado, cada linha diz de QUAL número ela é, e a barra ganha
     o filtro. Com um só, as duas coisas somem: repetiriam a mesma informação em toda linha. */
  const variosNumeros = precisaEscolherNumero(numerosConectados);
  const nomesDosNumeros = mapaDeNumeros(numerosConectados);
  /* A linha da conversa leva a ETIQUETA (o apelido, ou o canal), e não o número: ver
     `etiquetaDoNumero`. O número cru ali se lê como o telefone do contato. */
  const etiquetasDosNumeros = mapaDeEtiquetas(numerosConectados);

  /*
   * QUAL ABA DE NÚMERO ESTÁ VALENDO.
   *
   * Sem "Todos", a lista é sempre a de UM número — e aí a escolha precisa de um padrão que exista:
   * o primeiro conectado. `numeroTopFiltro` guarda o que foi clicado; esta conta é quem decide o
   * que vale, pra não haver estado apontando pra uma aba que sumiu (um número desconectado, por
   * exemplo).
   *
   * COM UM NÚMERO SÓ, as abas não aparecem e aqui vale "Todos". Não é detalhe: filtrar por um
   * número numa conta que tem um faria sumir toda conversa SEM marca de número — as antigas, de
   * antes de o CRM gravar de qual conexão cada uma veio. Elas existem e precisam continuar
   * aparecendo.
   */
  /*
   * AS ABAS SEGUEM A ORDEM DOS FUNIS. "Se eu arrasto o funil da Azuz para cima, ele fica como
   * primeiro, e aí lá no chat do WhatsApp também ele fica como primeiro."
   *
   * A lista vinha na ordem em que as conexões foram criadas, que não quer dizer nada pra quem
   * atende — e como a primeira aba é a que abre, era ela que decidia qual caixa de entrada a
   * pessoa via ao entrar. Agora quem decide é a ordem que ela arrastou no menu: uma decisão, dois
   * lugares. Ver `numerosNaOrdemDosFunis`.
   */
  const numerosParaAba = numerosNaOrdemDosFunis(
    numerosConectados.filter((n) => n.status === "conectado" && n.chave),
    funis,
  );
  const numeroAtivo = !variosNumeros
    ? "Todos"
    : numerosParaAba.some((n) => n.chave === numeroTopFiltro) || numeroTopFiltro === SEM_NUMERO
      ? numeroTopFiltro
      : (numerosParaAba[0]?.chave ?? "Todos");

  /*
   * AS CONVERSAS SEM MARCA DE NÚMERO ganham aba só quando existem.
   *
   * São as antigas, de antes de o CRM gravar de qual conexão cada conversa veio. Com "Todos" elas
   * apareciam junto de tudo; sem "Todos", sumiriam da tela inteira — dado vivo escondido por uma
   * mudança de filtro é a pior forma de perder conversa. A aba só aparece quando há o que mostrar,
   * então quem não tem histórico antigo nunca a vê.
   */
  const temConversaSemNumero = conversas.some((c) => c.canal === "WhatsApp" && !c.contaCanal);

  /*
   * Quantas conversas ainda se chamam pelo número E NUNCA FORAM PROCURADAS.
   *
   * "Cliquei uma vez, cliquei duas, buscou — tem que sair daí, porque fica aparecendo bug." A
   * conta era de toda conversa chamada pelo número, e tem gente cujo nome o WhatsApp não guardou
   * em mensagem nenhuma: a busca rodava, não achava nada, e o aviso voltava igual. Um botão que
   * não resolve e não some é um defeito.
   *
   * `nomeBuscadoEm` é o carimbo de "já procuramos esta". Quem ainda batiza as que sobraram é a
   * mensagem seguinte: ela chega com o nome de perfil e a conversa é renomeada sozinha.
   */
  const conversasAindaComNumero = conversas.filter(valeBuscarNome).length;

  /*
   * DE ONDE VEIO CADA LEAD. Lido uma vez, por rota própria.
   *
   * "Preciso saber se o lead que entrou no meu chat veio de onde — do Instagram? do anúncio? (…)
   * Preciso que apareça uma tag." O CRM já guardava tudo (é o que alimenta a devolução de conversão
   * pro Google e pra Meta) e não mostrava em lugar nenhum da lista: a linha exibia `Conversa.origem`,
   * que o webhook grava como "Direto" pra todo mundo.
   *
   * Chave pelo nome NORMALIZADO, que é como conversa, contato e card se encontram no CRM inteiro.
   */
  const [origemPorContato, setOrigemPorContato] = useState<Record<string, TagDeOrigem>>({});

  useEffect(() => {
    let vivo = true;
    fetch("/api/rastreio/origem-dos-leads")
      .then((r) => (r.ok ? r.json() : null))
      .then((dados: { porContato?: Record<string, TagDeOrigem> } | null) => {
        // Falhar aqui não pode roubar a tela de quem veio atender: sem a etiqueta, a lista
        // continua inteira e funcionando.
        if (vivo && dados?.porContato) setOrigemPorContato(dados.porContato);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const canaisDisponiveis = Array.from(new Set(conversas.map((c) => c.origem)));

  const naoOficialConectado = naoOficial.estado?.status === "conectado";

  /**
   * O canal escolhido pra uma conversa que ainda não tem dono, quando os DOIS WhatsApp estão
   * conectados. Padrão no QR Code: é o que não tem janela de 24h nem modelo aprovado no caminho,
   * e é o que o servidor já assumia pra conversa sem dono.
   *
   * DECLARADO AQUI EM CIMA, E ESTE LUGAR É O CONSERTO DE UM DEFEITO — o segundo da mesma família
   * (ver o comentário logo acima, sobre `mensagensExtraPorContato`).
   *
   * `conversaUsaWhatsappNaoOficial` lê esta variável, e quem a chama é `conversasFiltradas`, que é
   * calculado no corpo do componente — ou seja, DURANTE a renderização. Com o `useState` lá
   * embaixo, perto do resto da tela de escrever, a leitura acontecia antes da declaração: um
   * `const` em zona morta temporal, que em produção aparece como "Cannot access 'nu' before
   * initialization" e derruba a tela inteira de Conversas (e, como ela reabre a cada navegação, o
   * app inteiro).
   *
   * E ele só aparecia numa combinação: WhatsApp OFICIAL conectado e QR Code desconectado — o
   * estado de quem acabou de trocar de celular. Nos outros casos o filtro nem chega a chamar a
   * função, e a tela abre normalmente. Por isso passou pelo build, pelos testes e por meses de uso.
   *
   * Qualquer coisa que `conversasFiltradas` leia, direta ou indiretamente, precisa nascer ANTES
   * dele.
   */
  const [canalEscolhido, setCanalEscolhido] = useState<"whatsapp_nao_oficial" | "whatsapp_oficial">(
    "whatsapp_nao_oficial",
  );

  /**
   * POR ONDE A CONVERSA SEM DONO VAI SAIR DE VERDADE.
   *
   * `canalEscolhido` é a PREFERÊNCIA, e ela só faz sentido quando existem dois caminhos. Com uma
   * conexão só, não há escolha a respeitar — há um fato. E era aí que estava o defeito: o padrão
   * era o QR Code, fixo, então com o QR Code DESCONECTADO e o oficial de pé (o estado de quem
   * trocou de celular) o CRM continuava achando que falaria pelo QR.
   *
   * O estrago não era só teórico. "Não consegui conversar com ninguém pela API oficial": como o
   * CRM se achava no QR Code, ele escondia o caminho do modelo aprovado — que é o ÚNICO jeito de
   * falar primeiro pelo oficial — e deixava escrever texto livre, que a Meta recusa. Ficava sem
   * saída e sem explicação.
   *
   * Com os dois ligados, a preferência vale e a pessoa escolhe. Com um só, é ele.
   */
  /**
   * O NÚMERO ESCOLHIDO PRA ESTA MENSAGEM, quando quem atende escolheu um.
   *
   * "Preciso da opção de escolher aqui o número que eu vou mandar mensagem, mesmo já tendo falado
   * com o contato por outro número." É o caso da closer que assume o lead que a vendedora abriu.
   *
   * `null` é o padrão e quer dizer "pelo número da conversa" — a regra de sempre, que continua
   * valendo pra quem não mexer em nada. A escolha vale por conversa e some ao trocar de conversa:
   * ela é sobre ESTA mensagem, não um modo que fica ligado.
   */
  const [escolhaDeNumero, setEscolhaDeNumero] = useState<{ conversa: string; chave: string } | null>(null);
  /** A linha de "enviar pelo número" foi pedida no menu do "+". Fechada por padrão: ver o comentário dela. */
  const [seletorDeNumeroAberto, setSeletorDeNumeroAberto] = useState(false);

  const canalEfetivo = canalDeSaida(canalEscolhido, {
    oficialConectado: metaWhatsappConectado,
    qrConectado: naoOficialConectado,
  });


  // Conversa de WhatsApp sem nenhum canal conectado (nem Meta, nem QR Code) some da lista. Volta a
  // aparecer sozinha quando reconectar (não apaga nada do banco, só deixa de mostrar; ver pedido
  // explícito: ao desconectar, nem a conversa aberta no momento pode continuar visível). Com só UMA
  // das duas integrações ativa, mostra só as conversas dessa integração (uma conta só tem uma
  // conexão de WhatsApp por vez, então misturar não faz sentido). A "origem" de cada conversa vem
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

  /**
   * QUANDO CADA CONVERSA TEVE ATIVIDADE, calculado UMA VEZ.
   *
   * O custo que isto corta: esta conta era feita DENTRO do comparador da ordenação, e lá ela
   * rodava O(n log n) vezes por render. Cada chamada varria todas as mensagens daquela conversa
   * de trás pra frente e, não achando, fazia `conversas.find` — uma varredura linear da lista
   * inteira. Com 150 conversas de 200 mensagens dá cerca de 370 mil operações, e a tela refaz
   * tudo a cada batida do polling (5s) e a cada tecla digitada na busca ou no campo de escrever.
   *
   * Era essa a lentidão ao trocar de conversa e de aba. Agora é um mapa montado uma vez, e só
   * refeito quando as mensagens ou as conversas mudam de verdade: a ordenação passa a consultar,
   * não a calcular.
   */
  const ultimaAtividadePorNome = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const [nomeContato, mensagens] of Object.entries(mensagensExtraPorContato)) {
      for (let i = mensagens.length - 1; i >= 0; i--) {
        const quando = mensagens[i].criadoEm;
        if (quando) {
          mapa.set(nomeContato, quando);
          break;
        }
      }
    }
    // Sem mensagem CARREGADA ainda, vale o que o servidor disse sobre a última mensagem. Devolver
    // zero aqui jogava pro fim da lista toda conversa cujas mensagens ainda não tinham chegado ao
    // navegador, e o que estava embaixo dependia da ordem em que as buscas terminaram.
    for (const c of conversas) {
      if (mapa.has(c.nome)) continue;
      const doServidor = c.ultimaMensagemEm ?? c.atualizadoEm;
      mapa.set(c.nome, doServidor ? new Date(doServidor).getTime() : 0);
    }
    return mapa;
  }, [mensagensExtraPorContato, conversas]);

  const conversasFiltradas = conversas
    .filter((c) => {
      if (conversaEscondidaPeloWhatsapp(c)) return false;
      // O Instagram tem tela própria agora, em /instagram: Direct, story e comentário, com o perfil
      // da pessoa ao lado. Deixá-lo aqui também faria a mesma conversa aparecer em dois lugares,
      // com dois conjuntos de ferramentas diferentes, e nenhum dos dois completo.
      if (c.canal === "Instagram") return false;
      if (!mostrarArquivadas && c.arquivada) return false;
      if (mostrarArquivadas) return c.arquivada;
      if (filtroConversa === "nao-lidas" && (!c.naoLidas || lidas.has(c.id))) return false;
      if (filtroConversa === "favoritas" && !ehFavorita(c)) return false;
      if (canalAba !== "todos" && c.canal !== canalAba) return false;
      if (atendenteTopFiltro !== "Todos" && c.atendenteSelecionado !== atendenteTopFiltro)
        return false;
      if (canalTopFiltro !== "Todos" && c.origem !== canalTopFiltro) return false;
      // Por qual NÚMERO a conversa fala. Ver `numeros-conectados.ts`.
      if (numeroAtivo === SEM_NUMERO) {
        if (c.contaCanal) return false;
      } else if (!conversaDoNumero(c.contaCanal, numeroAtivo)) return false;
      if (!buscaConversa.trim()) return true;
      const termo = buscaConversa.trim().toLowerCase();
      return c.nome.toLowerCase().includes(termo);
    })
    // Fixadas no topo; o resto pela atividade mais recente. Sem o segundo critério, a lista ficava
    // na ordem em que o banco devolveu. Uma conversa que acabou de receber mensagem podia ficar no
    // meio ou no fim, e a pessoa só descobria a mensagem nova rolando a lista inteira.
    .sort((a, b) => {
      const fixada = Number(fixadas.has(b.id)) - Number(fixadas.has(a.id));
      if (fixada !== 0) return fixada;
      return ultimaAtividadeDaConversa(b.nome) - ultimaAtividadeDaConversa(a.nome);
    });

  const [iniciandoConversa, setIniciandoConversa] = useState<string | null>(null);
  /** Já tentamos atender o `?contato=` desta visita? Sem isto, a criação da conversa mudaria a
   *  lista, o efeito rodaria de novo e criaria outra. */
  const contatoDaUrlAtendido = useRef(false);
  /** Quais canais de WhatsApp estão conectados agora. Só com os DOIS a escolha faz sentido: com um
   *  só, não há o que perguntar. */
  const [canaisWhats, setCanaisWhats] = useState<{ oficial: boolean; qr: boolean }>({ oficial: false, qr: false });

  useEffect(() => {
    let vivo = true;
    void fetch("/api/canais")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("falhou"))))
      .then((lista: { canal: string; conectado: boolean }[]) => {
        if (!vivo) return;
        setCanaisWhats({
          oficial: lista.some((c) => c.canal === "whatsapp_oficial" && c.conectado),
          qr: lista.some((c) => c.canal === "whatsapp_nao_oficial" && c.conectado),
        });
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  /**
   * Contatos que dá pra chamar e que ainda não têm conversa aberta.
   *
   * Só aparece com algo digitado na busca: listar a agenda inteira embaixo das conversas viraria
   * ruído permanente numa tela que é, antes de tudo, a caixa de entrada.
   */
  const contatosSemConversa = (() => {
    const termo = buscaConversa.trim().toLowerCase();
    if (termo.length < 2) return [];
    /*
     * "TEM CONVERSA?" É PELO TELEFONE, não pelo nome.
     *
     * Era pelo nome, e com isso um contato que trocou de número desaparecia desta lista: havia uma
     * conversa com o nome dele, do número ANTIGO, e o CRM concluía que não havia o que abrir. Era
     * o caminho que faltava pra "se eu quiser mandar para o número novo, ele tem que abrir uma
     * janela nova": a janela nova não tinha de onde ser aberta.
     *
     * Comparação normalizada (`+55`, 9º dígito) porque o mesmo número é salvo de formas
     * diferentes: "(62) 99999-0000" na ficha e "5562999990000" no webhook.
     */
    const numerosComConversa = new Set(
      conversas
        .filter((c) => !c.ehGrupo && c.contato)
        .map((c) => normalizarTelefoneParaComparacao(c.contato!))
        .filter(Boolean),
    );
    return contatos
      .filter((c) => Boolean(c.whatsapp))
      .filter((c) => !numerosComConversa.has(normalizarTelefoneParaComparacao(c.whatsapp!)))
      .filter((c) => c.nome.toLowerCase().includes(termo) || (c.whatsapp ?? "").includes(termo))
      .slice(0, 8);
  })();

  async function iniciarConversaCom(contato: { id: string; nome: string; whatsapp?: string | null }) {
    if (!contato.whatsapp) return;
    setIniciandoConversa(contato.id);
    try {
      /*
       * A JANELA NOVA NASCE COM DONO: o número escolhido na ficha, ou o da aba aberta.
       *
       * Sem isso ela nascia sem marca de conexão, e numa caixa de entrada dividida por número isso
       * quer dizer que ela só aparece na aba das conversas antigas — a pessoa cria a janela e não a
       * encontra. `?numero=` é a escolha que veio da ficha do contato ("ele vai me dar um botão
       * seletor"); sem ela, a aba em que a pessoa está é a resposta certa, porque é de lá que ela
       * está falando. "Todos" e a aba das sem-dono não endereçam nada: aí fica nulo, como antes.
       */
      const daUrl = searchParams.get("numero");
      const daAba = numeroAtivo === "Todos" || numeroAtivo === SEM_NUMERO ? null : numeroAtivo;
      const nova = await criarConversaIndividual(
        contato.nome,
        contato.whatsapp,
        "WhatsApp",
        daUrl || daAba,
      );
      setSelectedId(nova.id);
      setBuscaConversa("");
    } catch (erro) {
      console.error("Falha ao iniciar conversa:", erro);
    } finally {
      setIniciandoConversa(null);
    }
  }

  /**
   * "ENVIAR WHATSAPP" NA FICHA DO CONTATO ABRE A CONVERSA — criando-a quando ainda não existe.
   *
   * Um contato salvo à mão não tem conversa nenhuma: ninguém escreveu ainda. A tela recebia o
   * `?contato=` da ficha, não achava nada e abria a primeira conversa da lista — outra pessoa.
   *
   * Pelo WhatsApp do QR Code não há nada impedindo: dá pra escrever pra qualquer número, sem
   * janela de 24h e sem modelo aprovado. A conversa é criada vazia e fica pronta pra escrever.
   *
   * Pelo WhatsApp OFICIAL a conversa também abre, mas a primeira mensagem para quem nunca
   * escreveu precisa ser um modelo aprovado pela Meta — e quem diz isso é a tela de envio, onde a
   * pessoa está olhando na hora de mandar, não aqui.
   */
  useEffect(() => {
    if (contatoDaUrlAtendido.current || carregandoConversas) return;
    const nomeContato = searchParams.get("contato");
    if (!nomeContato) return;

    const contato = contatos.find((c) => c.nome === nomeContato);

    /*
     * A CONVERSA DESTE NÚMERO, e não "a conversa com este nome".
     *
     * "Eu peguei esse número no contato, selecionei pra mandar pela API oficial, e na hora que
     * enviou mandou pra um número antigo. (…) Se eu quiser mandar para o número novo, ele tem que
     * abrir uma janela nova."
     *
     * Era aqui que o número velho entrava: a busca era pelo NOME, então a ficha do contato — com o
     * telefone novo na tela, escolhido por ela — abria a thread antiga, do telefone antigo. Dali
     * pra frente tudo estava coerente com a thread errada: o cabeçalho, o histórico e o
     * destinatário do envio.
     *
     * Com o telefone do contato em mãos, a procura é por ele (normalizado: `+55` e 9º dígito, que é
     * como o mesmo número aparece escrito de formas diferentes). Não achando, cai no `criar` logo
     * abaixo e a janela nova nasce — é a rota de criação que escolhe um nome livre, ver
     * `nomeLivreParaConversa`.
     *
     * Sem telefone na ficha não há por onde comparar, e aí vale o nome, que é o que sempre valeu:
     * é o caso da conversa que nasceu pelo webhook antes de a pessoa virar contato.
     */
    const alvo = contato?.whatsapp ? normalizarTelefoneParaComparacao(contato.whatsapp) : "";
    const jaExiste = alvo
      ? conversas.find(
          (c) =>
            c.canal !== "Instagram" &&
            !c.ehGrupo &&
            c.contato &&
            normalizarTelefoneParaComparacao(c.contato) === alvo,
        )
      : conversas.find((c) => c.nome === nomeContato && c.canal !== "Instagram");
    if (jaExiste) {
      contatoDaUrlAtendido.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- abre a conversa pedida na URL uma vez só; a trava do `ref` impede que isto realimente o próprio efeito.
      setSelectedId(jaExiste.id);
      return;
    }

    if (!contato?.whatsapp) {
      // Sem número não há o que abrir. Marca como atendido pra não ficar tentando a cada render.
      contatoDaUrlAtendido.current = true;
      return;
    }
    contatoDaUrlAtendido.current = true;
    void iniciarConversaCom({ id: contato.id, nome: contato.nome, whatsapp: contato.whatsapp });
    // `iniciarConversaCom` e `conversas` mudam a cada render/busca; a trava do `ref` é o que
    // garante uma tentativa só, então não entram nas dependências.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregandoConversas, searchParams, contatos]);


  /** Quando a última mensagem dessa conversa chegou (ou saiu). Zero quando ainda não há nenhuma.
   * Conversa sem mensagem vai pro fim, não pro topo. */
  function ultimaAtividadeDaConversa(nomeContato: string): number {
    return ultimaAtividadePorNome.get(nomeContato) ?? 0;
  }

  // A mesma regra da lista, aplicada à conversa aberta: o que não é desta tela não abre aqui.
  const conversasDestaTela = conversas.filter((c) => c.canal !== "Instagram");
  const abertaCandidata =
    conversasDestaTela.find((c) => c.id === selectedId) ?? conversasDestaTela[0];
  const aberta =
    abertaCandidata && !conversaEscondidaPeloWhatsapp(abertaCandidata) ? abertaCandidata : CONVERSA_VAZIA;

  // Grupo aberto e ainda sem lista de participantes: pergunta à Evolution agora. Ver o comentário
  // de `gruposJaConsultados`, lá em cima, pro motivo de isto existir.
  useEffect(() => {
    const vazia = !aberta.participantesGrupo?.length;
    if (!aberta.ehGrupo || !vazia || gruposJaConsultados.current.has(aberta.id)) return;
    gruposJaConsultados.current.add(aberta.id);
    fetch(`/api/conversas/${encodeURIComponent(aberta.id)}/participantes`, { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((dados: { participantesGrupo?: unknown[] } | null) => {
        // Só recarrega quando veio gente: sem isso seria uma volta inteira na lista de conversas
        // pra não mudar nada na tela.
        if (dados?.participantesGrupo?.length) recarregarConversas();
      })
      .catch((erro) => console.error("Falha ao buscar participantes do grupo:", erro));
  }, [aberta.id, aberta.ehGrupo, aberta.participantesGrupo?.length, recarregarConversas]);

  // Busca a foto de TODAS as conversas de WhatsApp sem uma salva ainda. Não só a aberta. Sem isso
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
          // segue pra próxima: uma falha isolada não deve travar o resto da lista
        }
        // Pausa curta entre chamadas: não é urgente, e evita virar uma rajada de dezenas de
        // chamadas simultâneas pra Evolution assim que a lista de conversas carrega.
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [conversas, atualizarFotoConversa]);

  // Renderizar de uma vez o histórico inteiro de um contato com muita mensagem trava a tela (DOM
  // gigante, cada bolha com menu/portal próprio). Mostra só as últimas por padrão, com botão pra
  // carregar mais sob demanda. Reseta pro padrão sempre que troca de conversa.
  const [limiteMensagensVisiveis, setLimiteMensagensVisiveis] = useState(200);
  // Mensagem de texto muito longa (mais comum em grupo grande, tipo aviso de condomínio) tomava a
  // tela inteira de rolagem: trunca com "Ler mais/menos", igual qualquer app de mensagem faz.
  const [mensagensExpandidas, setMensagensExpandidas] = useState<Set<string>>(() => new Set());
  // Ids de mensagem com o botão "Carregar áudio" em andamento. Evita clique duplo enquanto busca.
  const [midiasCarregando, setMidiasCarregando] = useState<Set<string>>(() => new Set());
  const idConversaAnteriorRef = useRef(aberta.id);
  if (idConversaAnteriorRef.current !== aberta.id) {
    idConversaAnteriorRef.current = aberta.id;
    setLimiteMensagensVisiveis(200);
  }
  const localizacao = localizarNoFunil(funis, aberta.nome);

  /*
   * O CONTATO DESTA CONVERSA, pelo TELEFONE antes do nome.
   *
   * Era só pelo nome, e isso quebrava na janela aberta pra um número novo da mesma pessoa: ela
   * nasce chamada "Cássia (+55 …)" porque o nome é a chave da conversa (ver `nomeLivreParaConversa`),
   * e nenhum contato se chama assim. Sem contato, o painel lateral ficava vazio e o envio pela API
   * oficial perdia o telefone da ficha — que é justamente o endereço certo naquele canal.
   *
   * O telefone é a identidade estável; o nome é como está escrito. Comparação normalizada (`+55`,
   * 9º dígito) porque o mesmo número é salvo de formas diferentes. O nome fica como segunda opção:
   * é o que resolve a conversa que ainda não tem telefone gravado (grupo, Instagram).
   */
  const contatoDaConversa = (() => {
    const alvo = aberta.contato && !aberta.ehGrupo ? normalizarTelefoneParaComparacao(aberta.contato) : "";
    const porTelefone = alvo
      ? contatos.find((c) => c.whatsapp && normalizarTelefoneParaComparacao(c.whatsapp) === alvo)
      : undefined;
    return porTelefone ?? contatos.find((c) => c.nome === aberta.nome) ?? null;
  })();

  /*
   * De quem é cada menção: montado uma vez por desenho da tela e reusado em todas as mensagens.
   *
   * Sem `useMemo` de propósito. Este arquivo não usa nenhum, e enfiar o primeiro no meio de um
   * componente desta altura é convidar erro de ordem de hook por um ganho que não existe: o índice
   * é a agenda da empresa, algumas centenas de linhas, e custa microssegundos. O que importava
   * evitar — remontar o índice uma vez por MENSAGEM da conversa — já está evitado por ele ser
   * montado aqui, e não lá dentro.
   */
  const resolverMencao = criarResolvedorDeMencao(contatos, aberta.participantesGrupo);

  /*
   * Os nomes que as mensagens deste grupo já ensinaram.
   *
   * A lista de participantes que a API devolve costuma vir SEM nome nenhum desde que o WhatsApp
   * passou a endereçar participante por LID. Mas toda mensagem recebida num grupo traz o nome de
   * perfil de quem escreveu — então quem já falou aqui está identificado, sem depender de a API
   * resolver coisa nenhuma. É daqui que sai o nome no painel de participantes.
   */
  const nomesVistosNoGrupo = aberta.ehGrupo
    ? nomesVistosNasMensagens(mensagensExtraPorContato[aberta.nome] ?? [])
    : null;

  /** Um participante com o melhor nome que existe, e com telefone só quando há telefone de verdade. */
  const identificar = (p: { nome: string; telefone: string }) =>
    identificarParticipante(p, { nomesVistos: nomesVistosNoGrupo, contatos });

  function etapaPadraoPara(funilId: string) {
    const f = funis.find((x) => x.id === funilId);
    return localizacao && localizacao.funilId === funilId
      ? localizacao.etapa
      : f?.colunas[0]?.titulo ?? "";
  }

  // Troca o funil/etapa/atendente/dados selecionados toda vez que a conversa
  // aberta muda, pra sempre abrir já mostrando as atribuições desse contato
  // (ajuste de estado a partir de uma mudança de prop. Ver docs do React).
  const [funilSelecionadoId, setFunilSelecionadoId] = useState(
    () => localizacao?.funilId ?? funis[0]?.id ?? "",
  );
  const [etapaSelecionada, setEtapaSelecionada] = useState(() =>
    etapaPadraoPara(localizacao?.funilId ?? funis[0]?.id ?? ""),
  );
  const [atendenteSelecionado, setAtendenteSelecionado] = useState(
    aberta.atendenteSelecionado ?? "",
  );
  const [trocandoResponsavel, setTrocandoResponsavel] = useState(false);
  const [abertaIdAnterior, setAbertaIdAnterior] = useState(aberta.id);
  // Chave da mensagem cujo coração acabou de aparecer. Só pra tocar a animação uma vez. A curtida
  // em si NÃO mora aqui: ela vem da própria mensagem (`reacaoMinha`/`reacaoContato`), porque
  // precisa sobreviver a recarregar a página e ser a mesma pra qualquer pessoa da equipe.
  const [coracaoAnimando, setCoracaoAnimando] = useState<string | null>(null);
  const [erroCurtir, setErroCurtir] = useState<string | null>(null);
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
  // Onde está o cursor dentro da caixa. Guardado porque a menção depende da POSIÇÃO: `@` no meio da
  // frase é menção, dentro de um e-mail não é, e só o cursor distingue os dois.
  const [cursorMensagem, setCursorMensagem] = useState(0);

  /* ---------------------------------------------------------------------- */
  /* Áudio: gravação real (getUserMedia + MediaRecorder), prévia e player   */
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
  /* Enviar contato: abas CRM/Criar, busca+filtros, seleção múltipla,       */
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
  /** Seletor de modelo aprovado: o único caminho pra falar primeiro, ou depois das 24h. */
  const [templateAberto, setTemplateAberto] = useState(false);
  const [respondendoMensagem, setRespondendoMensagem] = useState<{
    autor: string;
    texto: string;
    /** Id da mensagem citada: vai junto no envio pro Instagram, pra citação existir dos dois lados. */
    mid?: string;
  } | null>(null);

  /* ---------------------------------------------------------------------- */
  /* Menu de ações da mensagem. Copiar/encaminhar/favoritar/detalhes/apagar */
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
      <span className="wa-msg-favorita" title={traduzir("Favoritada")}>
        <IconStar width={11} height={11} fill="currentColor" />
      </span>
    );
  }

  /** Botão "⋮" reaproveitado em todos os tipos de bolha (não é componente à parte de propósito. Evita remontar). */
  function botaoMenuMensagem(chave: string) {
    return (
      <button
        type="button"
        className="wa-msg-menu-btn"
        aria-label={traduzir("Mais ações dessa mensagem")}
        title={traduzir("Mais ações")}
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
      () => avisarAutomacao("Não deu pra copiar: copie manualmente"),
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
    // qualquer outra mudança de mensagem usa). Some do balão pra qualquer sessão que reabrir essa
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
  /* Anexos reais: imagem, vídeo, documento                                */
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

  // Lightbox: abrir imagem já enviada em tamanho maior, com navegação e zoom.
  const [lightbox, setLightbox] = useState<{
    urls: string[];
    indice: number;
    zoom: number;
  } | null>(null);

  // Mídias liberadas manualmente quando o download automático está desligado pra esse tipo.
  const [midiasLiberadas, setMidiasLiberadas] = useState<Set<string>>(() => new Set());

  /**
   * Abre a conversa já na última mensagem, e acompanha as que chegam depois.
   *
   * Sem isto a conversa abria no começo do histórico: pra ver o que acabou de chegar era preciso
   * rolar até o fim toda vez. E numa conversa com meses de atendimento isso é muito rolar. É o
   * comportamento que qualquer aplicativo de mensagem tem, e que o painel do Funil já tinha.
   *
   * `instant` na troca de conversa (aparecer no lugar certo de cara, sem animação de rolagem) e
   * suave quando chega mensagem nova durante a leitura.
   */
  const fimDasMensagensRef = useRef<HTMLDivElement>(null);
  const conversaAnteriorRef = useRef<string | null>(null);
  const quantidadeDeMensagens = (mensagensExtraPorContato[aberta.nome] ?? []).length;

  useEffect(() => {
    const trocouDeConversa = conversaAnteriorRef.current !== aberta.id;
    conversaAnteriorRef.current = aberta.id;
    fimDasMensagensRef.current?.scrollIntoView({
      block: "end",
      behavior: trocouDeConversa ? "instant" : "smooth",
    });
  }, [aberta.id, aberta.nome, quantidadeDeMensagens]);

  function midiaLiberada(tipo: "imagem" | "video" | "documento", id?: string, url?: string) {
    // Mídia que o CRM JÁ TEM não fica atrás de botão. Não há o que baixar, o arquivo existe.
    //
    // Isto cobria só o formato antigo (`data:`, arquivo embutido na mensagem). Desde que os anexos
    // passaram a morar no R2, eles chegam como um link nosso. E a exceção deixou de casar, então
    // foto e vídeo já guardados voltaram a aparecer como "Baixar vídeo". A trava existe pra mídia
    // que ainda precisa ser buscada, não pra esconder o que está em mãos.
    if (url?.startsWith("data:") || ehLinkDeMidia(url)) return true;
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
      // Formato não decodificável nesse navegador (raro). Usa a duração cronometrada e uma forma de onda plana.
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

  /** Interrompe a gravação (se ainda estiver rolando), descarta o arquivo temporário e volta o campo de mensagem. Nada é enviado. */
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
      // Converte o blob gravado em base64 (mesmo padrão de imagem/documento. Ver
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
      // Envio real do áudio: sem isso, a bolha aparecia na tela do CRM mas nunca saía de verdade
      // pro WhatsApp (bug real: gravar/mandar áudio não fazia nenhuma chamada de API, só guardava
      // localmente). Só a integração não oficial (Evolution) por enquanto. A oficial (Meta) exige
      // um fluxo de upload de mídia em duas etapas, ainda não implementado.
      const destinatarioAudio = contatoDaConversa?.whatsapp ?? aberta.contato;
      if (viaBaileys && destinatarioAudio) {
        const audioBase64 = url.split(",")[1] ?? url;
        fetch("/api/integracoes/whatsapp-nao-oficial/enviar", {
          method: "POST",
          headers: { "content-type": "application/json" },
          // `conversa` é o que diz por QUAL número conectado a resposta sai. Ver a rota.
          body: JSON.stringify({ destinatario: destinatarioAudio, audioBase64, conversa: aberta.nome }),
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
          texto: `⚠️ ${traduzir("Envio de áudio pela API oficial (Meta) ainda não é suportado. Só pelo WhatsApp via QR Code.")}`,
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
    setTrocandoResponsavel(false);
    setCoracaoAnimando(null);
    setErroCurtir(null);
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
        traduzir,
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
        quando: "",
        minutosAtras: 0,
      }),
    ),
  ];
  const eventosTimelineContato: Evento[] = contatoDaConversa
    ? gerarLinhaDoTempo(
        contatoDaConversa.id,
        { contatos, conversas, mensagensPorContato: mensagensExtraPorContato, funis },
        eventosExtrasTimeline,
      )
    : eventosExtrasTimeline.slice().sort((a, b) => a.minutosAtras - b.minutosAtras);

  function adicionarHistorico(tipo: HistoricoItem["tipo"], texto: string) {
    setHistoricoPorContato((prev) => ({
      ...prev,
      [aberta.nome]: [
        ...(prev[aberta.nome] ??
          historicoInicialDoContato(
            funis,
            aberta,
            mensagensExtraPorContato[aberta.nome]?.[0]?.hora,
            traduzir,
          )),
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
    return new Date().toLocaleTimeString(localeNumero, { hour: "2-digit", minute: "2-digit" });
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

  /** Busca o conteúdo real de uma mídia recebida (áudio, por enquanto) que só chegou como aviso.
   * Chamado quando a pessoa clica pra carregar. Substitui `midiaPendente` pelo campo específico do
   * tipo (`audio`) assim que carrega, então na próxima render a bolha já mostra o player normal. */
  function carregarMidiaPendente(msg: ConvMensagem) {
    if (!msg.midiaPendente || !msg.id) return;
    const contatoNome = aberta.nome;
    setMidiasCarregando((prev) => new Set(prev).add(msg.id!));
    const { remoteJid, id, fromMe, tipo, nome, mimetype } = msg.midiaPendente;
    /* A mensagem de falha fala do que a pessoa está esperando ver. "Não consegui carregar essa
       mídia" obriga quem lê a olhar a conversa pra descobrir o que era. */
    const avisoDeFalha =
      tipo === "audio"
        ? "⚠️ Não consegui carregar esse áudio. Ouça no celular conectado."
        : tipo === "imagem"
          ? "⚠️ Não consegui carregar essa imagem. Veja no celular conectado."
          : tipo === "figurinha"
            ? "⚠️ Não consegui carregar essa figurinha. Veja no celular conectado."
            : "⚠️ Não consegui carregar esse documento. Veja no celular conectado.";
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
        } else if (dados.dataUrl && tipo === "figurinha") {
          atualizarMensagem(contatoNome, msg.id!, {
            figurinha: { url: dados.dataUrl },
            // O texto era o aviso de reserva ("Figurinha (veja no celular conectado)"), que deixa
            // de fazer sentido no instante em que a figurinha aparece de verdade.
            texto: "",
            midiaPendente: undefined,
          });
        } else if (dados.dataUrl && tipo === "documento") {
          const nomeArquivo = nome ?? "arquivo";
          const extensao = nomeArquivo.includes(".")
            ? nomeArquivo.split(".").pop()!.toUpperCase()
            : (mimetype ?? "").split("/").pop()?.toUpperCase() || "ARQUIVO";
          atualizarMensagem(contatoNome, msg.id!, {
            documento: {
              url: dados.dataUrl,
              nome: nomeArquivo,
              // O tamanho real não vem na busca da mídia. Zero aqui faz a bolha mostrar só o
              // formato, em vez de inventar um número.
              tamanho: 0,
              formato: extensao,
              origem: "computador",
            },
            texto: "",
            midiaPendente: undefined,
          });
        } else {
          atualizarMensagem(contatoNome, msg.id!, { texto: avisoDeFalha, midiaPendente: undefined });
        }
      })
      .catch(() => {
        atualizarMensagem(contatoNome, msg.id!, { texto: avisoDeFalha, midiaPendente: undefined });
      })
      .finally(() => {
        setMidiasCarregando((prev) => {
          const next = new Set(prev);
          next.delete(msg.id!);
          return next;
        });
      });
  }

  /**
   * Reconstrói o bilhete de mídia das mensagens ANTIGAS.
   *
   * Figurinha e documento só passaram a deixar bilhete (`midiaPendente`) depois desta mudança. O
   * que já estava no banco ficou com o texto de reserva e mais nada — e continuaria como texto
   * para sempre, mesmo com o resto funcionando.
   *
   * Dá pra recuperar sem mexer no banco porque tudo que a busca precisa já existe: o `id` da
   * mensagem é a própria chave do WhatsApp, `fromMe` sai do tipo da bolha, e o `remoteJid` se monta
   * a partir do contato da conversa (em grupo ele já É o JID; fora de grupo é o telefone).
   */
  function bilheteDeMensagemAntiga(msg: ConvMensagem): ConvMensagem["midiaPendente"] | null {
    if (msg.midiaPendente || msg.figurinha || msg.documento || !msg.id) return null;
    const contato = aberta.contato;
    if (!contato) return null;
    const remoteJid = aberta.ehGrupo ? contato : `${contato.replace(/\D/g, "")}@s.whatsapp.net`;
    const base = { remoteJid, id: msg.id, fromMe: msg.tipo === "out" };

    if (msg.texto.startsWith("🩶 Figurinha") || msg.texto.startsWith("🤍 Figurinha")) {
      return { ...base, tipo: "figurinha" as const };
    }
    const doc = msg.texto.match(/^📄 Documento: (.+)$/);
    if (doc) return { ...base, tipo: "documento" as const, nome: doc[1] };
    return null;
  }

  // Carrega mídia pendente (áudio recebido) automaticamente assim que ela aparece na conversa
  // aberta: o usuário só precisa clicar em play, igual no WhatsApp de verdade, sem precisar
  // clicar num botão "Carregar" antes.
  useEffect(() => {
    // `carregarMidiaPendente` chama `setMidiasCarregando`: adiado pro próximo tick pra não fazer
    // um `setState` síncrono dentro do corpo do efeito (o lint trava nisso, com razão: dispararia
    // uma cascata de renders ainda dentro do commit atual).
    const id = setTimeout(() => {
      const mensagens = mensagensExtraPorContato[aberta.nome] ?? [];
      for (const msg of mensagens) {
        if (!msg.id || midiasCarregando.has(msg.id)) continue;
        if (msg.midiaPendente) {
          carregarMidiaPendente(msg);
          continue;
        }
        const recuperado = bilheteDeMensagemAntiga(msg);
        if (recuperado) carregarMidiaPendente({ ...msg, midiaPendente: recuperado });
      }
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensagensExtraPorContato, aberta.nome]);

  /** Adiciona a mensagem já com id. Mensagens "out" sem status ganham "pendente" e entram na simulação real de entrega. */
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
    return id;
  }

  function tentarNovamenteMensagem(id: string) {
    const contatoNome = aberta.nome;
    // Volta pra "pendente" e limpa o erro; quem manda de novo é o canal, e o status real vem de lá.
    atualizarMensagem(contatoNome, id, { status: "pendente", erro: undefined });
  }

  /** Conversa "pertence" ao canal WhatsApp via QR Code (não oficial) quando a última mensagem.
   * Recebida OU mandada do celular conectado (espelhada). Veio por ele; sem nenhuma mensagem com
   * canal marcado, conta como API oficial (Meta), o comportamento antigo de antes dessa integração
   * existir. Usado tanto pra decidir pra onde a resposta do atendente deve sair (`aberta.nome`)
   * quanto pra filtrar a lista de conversas pela integração realmente conectada (ver
   * `conversasFiltradas`): nesse segundo uso, olha qualquer contato, não só o aberto no momento. */
  /**
   * POR ONDE ESTA CONVERSA FALA.
   *
   * A regra continua sendo a mesma: vale o canal da última mensagem que teve canal — a conversa
   * pertence à conexão por onde ela veio, e mandar pela outra dá erro ou escreve do número errado.
   *
   * O QUE MUDOU É A CONVERSA SEM HISTÓRICO. Ela devolvia `false`, ou seja, API OFICIAL — e conversa
   * recém-criada (a que nasce ao salvar um contato e clicar em "Enviar WhatsApp") não tem mensagem
   * nenhuma. O CRM escolhia o canal mais restrito sozinho, e a pessoa caía na tela de modelo
   * aprovado sem ter pedido nada.
   *
   * Agora, sem histórico, vale o que estiver escolhido em `canalEscolhido` — e o padrão dele é o
   * QR Code, que é o que o SERVIDOR já fazia pra conversa sem dono (ver `enviar-pelo-canal.ts`).
   * Os dois lados estavam discordando.
   */
  function conversaUsaWhatsappNaoOficial(nomeContato: string): boolean {
    const extras = mensagensExtraPorContato[nomeContato] ?? [];
    for (let i = extras.length - 1; i >= 0; i--) {
      /* `whatsapp_baileys` é o nome ANTIGO desta conexão, e ele ainda está gravado em mensagem de
         automação (ver `registrar-saida.ts`). Lido como "não é QR Code", ele fazia a conversa
         inteira passar por oficial depois de uma resposta automática. */
      if (extras[i].canal) {
        return extras[i].canal === CANAL_NAO_OFICIAL || extras[i].canal === "whatsapp_baileys";
      }
    }
    /* Sem histórico, vale o canal EFETIVO e não a preferência: com uma conexão só, ela é o que
       está ligado. Ver `canalEfetivo`. */
    return canalEfetivo === "whatsapp_nao_oficial";
  }

  /**
   * PRA QUAL NÚMERO ESTA MENSAGEM VAI, pelo canal que vai levá-la.
   *
   * "Eu peguei esse número no contato, selecionei pra mandar pela API oficial, e na hora que
   * enviou mandou pra um número antigo."
   *
   * O endereço saía de `aberta.contato` — o destinatário gravado na CONVERSA. Ele é o endereço
   * certo pro canal que criou aquela thread, e nem sempre é um telefone: no QR Code pode ser um
   * identificador do WhatsApp (o LID, aqueles quinze dígitos que não são número de ninguém) ou um
   * número gravado antes de o contato trocar de telefone. Mandar isso pela Cloud API é mandar pro
   * lugar errado — e quando é um número velho que ainda existe, a mensagem CHEGA, na pessoa errada.
   *
   * Então o endereço passa a depender do canal:
   * - OFICIAL: vale o telefone do CONTATO, que é o que ela escolheu na ficha. É o número que ela
   *   está vendo na tela quando aperta enviar.
   * - QR CODE: vale o da conversa, porque ali o endereço da thread é o que o aparelho entende —
   *   inclusive grupo, que não tem contato nenhum atrás.
   */
  function destinatarioDoEnvio(viaBaileys: boolean): string {
    const daConversa = aberta.contato ?? "";
    const doContato = contatoDaConversa?.whatsapp ?? "";
    if (viaBaileys) return daConversa || doContato;
    return doContato || daConversa;
  }

  /** A conversa ainda não tem dono: nenhuma mensagem dela passou por um canal. É só nesse caso
   *  que dá pra escolher — depois da primeira, quem manda é o histórico. */
  function conversaSemDono(nomeContato: string): boolean {
    const extras = mensagensExtraPorContato[nomeContato] ?? [];
    return !extras.some((m) => m.canal);
  }

  function contatoUsaWhatsappNaoOficial(): boolean {
    /*
     * A ESCOLHA DA TELA GANHA DO HISTÓRICO — quando houve escolha.
     *
     * "Atualmente eu tenho uma conta oficial e uma QR Code." Então escolher o número não é só
     * escolher entre dois celulares: é escolher entre duas CONEXÕES, que falam por caminhos
     * diferentes (a Cloud API da Meta e o aparelho conectado por código). O seletor já listava as
     * duas; o envio é que continuava decidindo só pelo histórico da conversa, e por isso escolher
     * o oficial numa conversa que nasceu no QR Code não mudava nada.
     *
     * Sem escolha, nada muda: vale o histórico, que é a regra de sempre — a conversa pertence à
     * conexão por onde ela veio.
     */
    const escolhido = numeroEscolhidoDaConversa();
    if (escolhido) {
      return escolhido.startsWith("whatsapp_nao_oficial:") || escolhido.startsWith("whatsapp_baileys:");
    }
    return conversaUsaWhatsappNaoOficial(aberta.nome);
  }

  /**
   * Manda um texto pelo canal da conversa aberta.
   *
   * Extraído de `enviarMensagemTexto` pra ser reaproveitado por quem também precisa entregar texto
   *. Hoje o compartilhamento de localização, que vira um link de mapa. Duplicar esse if/else foi
   * a origem de mais de um "aparece no CRM mas não chega do outro lado": um caminho novo nascia
   * sem o ramo de algum canal.
   */
  /**
   * `idLocal` é o id da bolha que já está na tela. O envio é assíncrono e o status verdadeiro só
   * se conhece quando a Meta responde. Sem esse id, não havia como voltar e marcar a bolha certa,
   * e era essa lacuna que a simulação de entrega escondia.
   */
  /**
   * O NÚMERO ESCOLHIDO PRA ESTA CONVERSA, ou `null` quando vale o padrão.
   *
   * A escolha carrega o NOME da conversa junto, em vez de ser zerada por um efeito ao trocar de
   * conversa. Dois motivos: efeito que grava estado no meio da renderização faz o React refazer o
   * quadro em cascata, e — o que pesa mais — um efeito que zera "depois" deixa uma janela em que a
   * conversa já é outra e a escolha ainda é a antiga. Nessa janela, uma mensagem sairia do número
   * escolhido pro lead anterior. É o jeito mais silencioso de mandar do número errado.
   *
   * Comparando aqui, a escolha simplesmente não vale pra outra conversa. Não há janela.
   */
  function numeroEscolhidoDaConversa(): string | null {
    if (escolhaDeNumero && escolhaDeNumero.conversa === aberta.nome) return escolhaDeNumero.chave;
    /*
     * O NÚMERO ESCOLHIDO NA FICHA DO CONTATO chega pela URL.
     *
     * "Lá dentro da página de contatos, naquela pop-up, ao invés de me mandar direto pro chat, ele
     * vai me dar um botão seletor." A escolha é feita lá e precisa atravessar a navegação — e a
     * URL é o único lugar que atravessa, porque a tela de conversas é outra página.
     *
     * Só vale pro contato que veio no mesmo link: sem a conferência, o número escolhido pra um
     * lead ficaria valendo pra qualquer conversa aberta depois, que é o jeito mais silencioso de
     * mandar do número errado.
     */
    const daUrl = searchParams.get("numero");
    if (daUrl && searchParams.get("contato") === aberta.nome) return daUrl;
    return null;
  }

  function despacharTexto(texto: string, respondendoMid?: string, idLocal?: string) {
    const viaBaileys = contatoUsaWhatsappNaoOficial();
    // Erro fica registrado como mensagem de sistema DENTRO da conversa (não só um toast que some
    // sozinho em poucos segundos): assim dá pra ver o motivo exato depois, sem precisar
    // screenshotar na hora certa.
    function avisarFalhaNaConversa(prefixo: string, erro: unknown) {
      const motivo = erro instanceof Error && erro.message ? erro.message : "motivo desconhecido";
      adicionarMensagem({ tipo: "system", texto: `⚠️ Falha ao enviar (${prefixo}): ${motivo}`, hora: horaAgora() });
      avisarAutomacao(`Falha ao enviar pelo ${prefixo}. Veja o motivo na conversa.`);
    }

    if (viaBaileys && (contatoDaConversa?.whatsapp ?? aberta.contato)) {
      // Grupo não tem `Contato` vinculado (não é uma pessoa). O destinatário nesse caso é o JID
      // do grupo, guardado direto em `aberta.contato` (ver `upsertConversaAoReceberMensagem`).
      fetch("/api/integracoes/whatsapp-nao-oficial/enviar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          destinatario: destinatarioDoEnvio(true),
          texto,
          // Por qual número conectado esta resposta sai. Ver a rota de envio.
          conversa: aberta.nome,
          /* Só vai quando houve escolha explícita na tela. Sem ela, o servidor usa o número que
             recebeu a conversa, como sempre fez. */
          ...(numeroEscolhidoDaConversa() ? { conexao: numeroEscolhidoDaConversa() } : {}),
        }),
      })
        .then(async (r) => {
          if (!r.ok) throw new Error(((await r.json()) as { erro?: string }).erro);
          /*
            A MENSAGEM GUARDA POR ONDE SAIU, e é isto que faz a escolha PEGAR.
            
            "Depois que eu escolhi, tem que sumir daqui. Eu já escolhi, eu já estou mandando
            mensagem pra essa pessoa." Era verdade e a tela não sabia: nenhum dos dois caminhos de
            envio marcava o canal na bolha, então a conversa continuava "sem dono" depois de
            enviada — e os seletores continuavam perguntando uma coisa já respondida.
            
            Com a marca, a conversa passa a pertencer à conexão por onde ela falou, que é a regra
            que o resto do CRM já seguia pras mensagens RECEBIDAS.
          */
          // Esta conexão não informa entrega nem leitura, então o status honesto para em "enviado".
          if (idLocal) atualizarMensagem(aberta.nome, idLocal, { status: "enviado", canal: CANAL_NAO_OFICIAL });
        })
        .catch((erro) => {
          if (idLocal) atualizarMensagem(aberta.nome, idLocal, { status: "erro" });
          avisarFalhaNaConversa("WhatsApp QR Code", erro);
        });
    } else if (!viaBaileys && aberta.canal === "WhatsApp" && (aberta.contato || contatoDaConversa?.whatsapp)) {
      const nomeDaConversa = aberta.nome;
      fetch("/api/integracoes/meta/whatsapp/enviar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          destinatario: destinatarioDoEnvio(false),
          texto,
          // Sem `contatoNome` o servidor NÃO conseguia conferir a janela de 24h. A checagem existia
          // e nunca rodava. Fora da janela, o CRM tentava mandar mensagem livre e recebia um erro
          // técnico da Meta, em vez de dizer que ali só cabe modelo aprovado.
          contatoNome: nomeDaConversa,
        }),
      })
        .then(async (r) => {
          const dados = (await r.json()) as { erro?: string; wamid?: string; precisaTemplate?: boolean };
          if (!r.ok) {
            if (dados.precisaTemplate) {
              if (idLocal) atualizarMensagem(nomeDaConversa, idLocal, { status: "erro", erro: dados.erro });
              adicionarMensagem({
                tipo: "system",
                texto: `⚠️ ${dados.erro ?? "Fora da janela de 24h. Só com modelo aprovado."}`,
                hora: horaAgora(),
              });
              // Em vez de só avisar do impedimento, abre o caminho que funciona. Avisar e parar
              // deixava quem atende sem saída. A regra da Meta não tem contorno, mas o modelo tem.
              setTemplateAberto(true);
              return;
            }
            throw new Error(dados.erro);
          }
          // Guarda o id que a Meta devolveu: é por ele que os webhooks de entregue/lido vão
          // encontrar esta mensagem depois. E "enviado" aqui é fato, não temporizador.
          // Mesma marca do outro caminho: a conversa passa a ser da conexão por onde ela falou.
          if (idLocal)
            atualizarMensagem(nomeDaConversa, idLocal, {
              status: "enviado",
              wamid: dados.wamid,
              canal: CANAL_OFICIAL,
            });
        })
        .catch((erro) => {
          if (idLocal) atualizarMensagem(nomeDaConversa, idLocal, { status: "erro" });
          avisarFalhaNaConversa("WhatsApp Meta", erro);
        });
    } else if (!viaBaileys && aberta.canal === "Instagram" && aberta.contato) {
      // Instagram tem rota própria: o destinatário é o id interno de quem escreveu (guardado em
      // `Conversa.contato`), não um telefone. Sem este ramo, conversa do Direct caía no aviso de
      // "sem número de WhatsApp": o CRM recebia a mensagem e não deixava responder.
      fetch("/api/integracoes/instagram/enviar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // `respondendoMid` faz a citação aparecer no Instagram da pessoa também. Sem ele, o
        // vendedor via "Respondendo a…" aqui e a cliente recebia uma mensagem solta do outro lado.
        body: JSON.stringify({ destinatario: aberta.contato, texto, respondendoMid }),
      })
        .then(async (r) => {
          if (!r.ok) throw new Error(((await r.json()) as { erro?: string }).erro);
          // O Direct não devolve entrega nem leitura pra API. "enviado" é tudo que sabemos.
          if (idLocal) atualizarMensagem(aberta.nome, idLocal, { status: "enviado" });
        })
        .catch((erro) => {
          if (idLocal) atualizarMensagem(aberta.nome, idLocal, { status: "erro" });
          avisarFalhaNaConversa("Instagram", erro);
        });
    } else if (!viaBaileys) {
      // Nenhum canal real bateu (sem número/contato associado à conversa). Sem isso, a mensagem
      // parecia "sumir": ficava só no estado local, sem nenhum aviso de que não tinha pra onde ir.
      adicionarMensagem({
        tipo: "system",
        texto: `⚠️ ${traduzir("Não enviado: essa conversa não tem um canal de envio associado.")}`,
        hora: horaAgora(),
      });
    }
  }

  function enviarMensagemTexto() {
    const texto = mensagemTexto.trim();
    if (!texto) return;
    const viaBaileys = contatoUsaWhatsappNaoOficial();
    const idLocal = adicionarMensagem({
      tipo: "out",
      texto,
      hora: horaAgora(),
      respondendoA: respondendoMensagem ?? undefined,
      canal: viaBaileys ? "whatsapp_nao_oficial" : undefined,
    });
    despacharTexto(texto, respondendoMensagem?.mid, idLocal);
    setMensagemTexto("");
    setRespondendoMensagem(null);
  }

  /**
   * Clicou num botão que veio NA mensagem recebida (ver `mensagem-de-empresa.ts`).
   *
   * MANDA O TEXTO DO BOTÃO, e não uma resposta de botão de verdade. Essa limitação é da conexão,
   * não uma simplificação: o WhatsApp tem um formato próprio pra "cliquei no botão tal"
   * (`buttonsResponseMessage`, que carrega o id), e a Evolution não expõe endpoint nenhum pra
   * mandá-lo — ela manda texto, mídia, áudio e reação. Ver `evolution.ts`.
   *
   * Na prática é o que uma pessoa faria: ler "SIM" no botão e digitar SIM. Quase todo fluxo do
   * outro lado aceita, porque precisa aceitar quem responde digitando. Um robô que case
   * estritamente pelo id do botão não vai reconhecer — e é por isso que o botão diz, ao passar o
   * mouse, exatamente o que vai sair daqui. Prometer um clique idêntico ao do celular seria
   * mentira, e a hora de descobrir seria depois do envio.
   */
  function responderComOpcao(botao: { rotulo: string }) {
    const texto = botao.rotulo.trim();
    if (!texto) return;
    const viaBaileys = contatoUsaWhatsappNaoOficial();
    const idLocal = adicionarMensagem({
      tipo: "out",
      texto,
      hora: horaAgora(),
      canal: viaBaileys ? "whatsapp_nao_oficial" : undefined,
    });
    despacharTexto(texto, undefined, idLocal);
  }

  /* ---------------------------------------------------------------------- */
  /* Imagem: seleção, drag&drop, colar, edição real e envio                */
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
   * a bolha não pode parecer entregue. Foi assim que uma foto, um contato e um PDF "saíram" do
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
   * outros canais o comportamento continua sendo dizer que não foi. Que é melhor do que a bolha
   * silenciosa de antes, quando o vendedor achava que a proposta tinha chegado.
   *
   * `idBolha` é a mensagem que já apareceu na tela: ela nasce "pendente" e só vira entregue se a
   * Meta aceitar. Falhando, vira erro com o motivo. O duplo tique não pode aparecer num arquivo
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
        // O Direct não aceita documento. Ele vai como link no texto. Dizer isso evita a confusão
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
    // várias selecionadas, o que passar da primeira fica registrado aqui sem ter sido enviado. E
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
  /* Vídeo: seleção, corte real (in/out), mudo e envio                     */
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
   * MediaRecorder: não é só um controle visual, o arquivo final muda.
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
  /* Documento: biblioteca do CRM ou computador                            */
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
          // O cartão de contato é um vCard, formato do WhatsApp: o Direct não tem equivalente.
          // Sem esta parada, o envio ia pra rota do WhatsApp levando o id do Instagram como se
          // fosse telefone: falhava de um jeito confuso, em vez de dizer o que realmente acontece.
          avisarAnexoNaoEnviado(`O contato (${c.nome})`);
          continue;
        }

        if (!destinatario) {
          adicionarMensagem({
            tipo: "system",
            texto: `⚠️ ${traduzir("Não enviado: essa conversa não tem um número de WhatsApp associado.")}`,
            hora: horaAgora(),
          });
          continue;
        }

        // Envio real do cartão (vCard) pelo canal certo. Mesmo padrão de `enviarMensagemTexto`:
        // a bolha já entrou na conversa acima, o envio roda em segundo plano e qualquer falha vira
        // uma mensagem de sistema, não um toast que some sozinho.
        const rota = viaBaileys ? "/api/integracoes/whatsapp-nao-oficial/enviar" : "/api/integracoes/meta/whatsapp/enviar";
        fetch(rota, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ destinatario, contato: contatoPayload, conversa: aberta.nome }),
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
    // `criarContato` já persiste de verdade (ver contatos-context.tsx): o delay aqui é só pra dar
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

  /**
   * Guarda esta pessoa na agenda do CRM. `salvarDadosContato` passa pela rota com sessão, e é ela
   * que marca o `salvoEm` — o campo que decide quem aparece em Contatos.
   *
   * Manda os dados que a conversa já tem. Nome e telefone bastam pra pessoa deixar de ser um
   * número solto na lista, que é o problema que isto resolve.
   */
  async function salvarNosContatos(contato: {
    nome: string;
    whatsapp?: string;
    email?: string;
    empresa?: string;
    cargo?: string;
    fotoUrl?: string;
  }) {
    setSalvandoContato(true);
    try {
      salvarDadosContato(contato.nome, {
        whatsapp: contato.whatsapp,
        email: contato.email,
        empresa: contato.empresa,
        cargo: contato.cargo,
        fotoUrl: contato.fotoUrl,
      });
      avisarAutomacao(traduzir("Salvo nos contatos."));
    } finally {
      setSalvandoContato(false);
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
      texto: `📍 ${traduzir("Localização enviada")}`,
      hora: horaAgora(),
      localizacao: { lat, lng, endereco },
    });
  }

  /**
   * Compartilha a localização REAL de quem está atendendo.
   *
   * Antes daqui saía um ponto fixo de Goiânia, inventado: a bolha aparecia com "Localização
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
        // Sem isto o clique simplesmente fechava o menu e nada acontecia. Que foi exatamente o
        // que apareceu na tela quando a permissão não foi concedida.
        setLocalizacaoErro(
          erro.code === erro.PERMISSION_DENIED
            ? "Você precisa permitir o acesso à localização no navegador pra compartilhar."
            : "Não deu pra obter sua localização agora. Tente de novo.",
        );
      },
      // Sem `timeout`, `getCurrentPosition` pode ficar pendurado pra sempre. E a pessoa fica
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
   * participante do grupo (comparação normalizada. Mesma regra usada no back, ver
   * `normalizarTelefoneParaComparacao`): usado pelo "Enviar mensagem" no painel de participantes.
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

  /** Fábrica de handler de arrastar. Usada pelos popups flutuantes menores (mídias, conectar, detalhe do contato). */
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

  // Fluxos REAIS deste funil: publicados e ativos. Antes a lista vinha de um catálogo em memória
  // que nunca era gravado e nunca rodava: a pessoa via nomes de automação que não existiam.
  const automacoesDoFunil = fluxos.filter(
    (f) => f.funilId === funilSelecionadoId && f.status === "publicado" && !f.arquivada,
  );

  /**
   * Botão "rodar automação" manual dentro da conversa. O fluxo migrado tem o
   * mesmo `id` da `Automacao` antiga (ver `migrarAutomacaoParaFluxo`), então dá
   * pra achar o `FluxoAutomacao` real por esse id e rodar `executarFluxo` de
   * verdade a partir do nó logo após o gatilho. Assim tags/etapa/responsável
   * mudam de verdade (via as mesmas ligações do `dispararEvento`), em vez de só
   * empurrar texto de `acao.mensagem` pro chat. Chamado explicitamente pelo
   * usuário, então roda mesmo se o fluxo estiver pausado (`ativa: false`).
   * Diferente de `dispararEvento`, que só considera fluxos publicados e ativos.
   */
  async function executarAutomacaoNaConversa(automacaoId: string) {
    const automacao = automacoesDoFunil.find((a) => a.id === automacaoId);
    if (!automacao) return;

    // Roda no SERVIDOR, com as ações de verdade. Antes rodava aqui no navegador e as mensagens do
    // fluxo eram simuladas: apareciam na conversa como se tivessem sido enviadas, sem terem saído.
    const resposta = await fetch(`/api/automacoes-fluxos/${automacaoId}/rodar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contatoNome: aberta.nome }),
    }).catch(() => null);

    const dados = resposta ? await resposta.json().catch(() => null) : null;
    if (!resposta?.ok) {
      avisarAutomacao(dados?.erro ?? `Não foi possível rodar "${automacao.nome}".`);
      return;
    }

    adicionarHistorico("sistema", `Automação "${automacao.nome}" executada`);
    avisarAutomacao(`Automação "${automacao.nome}" executada`);
    setMensagemTexto("");
    setAnexoAberto(false);
  }

  const sugerirAutomacoes = mensagemTexto.startsWith("//");
  const sugerirRespostas = !sugerirAutomacoes && mensagemTexto.startsWith("/");

  /*
   * MARCAR ALGUÉM NO GRUPO COM `@`, igual no WhatsApp.
   *
   * Sem isto só dava pra digitar o número na mão — e é exatamente isso que faz a menção chegar do
   * outro lado como número em vez de nome. A lista sai dos participantes do grupo; o que é inserido
   * no texto é o TELEFONE, que é o que o WhatsApp entende, e a exibição faz a volta pro nome
   * (`aplicarMencoes`). Só em grupo: marcar alguém numa conversa de duas pessoas não quer dizer nada.
   */
  const mencaoAberta = aberta.ehGrupo ? mencaoEmDigitacao(mensagemTexto, cursorMensagem) : null;
  const participantesSugeridos = mencaoAberta
    ? filtrarParticipantes(aberta.participantesGrupo, mencaoAberta.busca)
    : [];

  function escolherMencao(participante: { nome: string; telefone: string }) {
    if (!mencaoAberta) return;
    const { texto, cursor } = inserirMencao(mensagemTexto, mencaoAberta.inicio, cursorMensagem, participante);
    setMensagemTexto(texto);
    setCursorMensagem(cursor);
    // Devolve o foco e põe o cursor depois da menção, pra pessoa continuar escrevendo sem ter que
    // clicar de novo no campo.
    requestAnimationFrame(() => {
      const campo = mensagemInputRef.current;
      if (!campo) return;
      campo.focus();
      campo.setSelectionRange(cursor, cursor);
    });
  }

  /** Botão único "Registrar resultado": abre o menu com as 5 opções (seção 14 do pedido). */
  function abrirMenuResultado(rect: DOMRect) {
    setResultadoMenuRect(rect);
    setResultadoMenuAberto(true);
  }

  /**
   * Marca venda/perda/reabertura de verdade no `NegocioCard` real (mesmo campo que o Funil usa.
   * Ver `marcarDesfecho` em `funil/page.tsx`), em vez de só guardar em `resultadoPorContato` (que
   * é puramente local e se perde ao trocar de aba). Se o contato ainda não tiver negócio em
   * nenhum funil, entra na etapa selecionada do painel (mesmo caminho de `salvarAtribuicao`) antes
   * de marcar: não dá pra fechar um negócio que não existe.
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
        valor: valorOverride || "-",
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
    // Feedback visual: a gravação em si (`setFunis`) já é síncrona; o delay é só pra dar
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
    setEmailPara(contatoDaConversa?.email ?? "");
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
   * Duplo clique numa mensagem curte/descurte, igual ao WhatsApp e ao Direct.
   *
   * VALE NO INSTAGRAM E NO WHATSAPP POR QR CODE: os dois entregam a reação do outro lado e avisam
   * quando a outra pessoa reage. Na API oficial da Meta o duplo clique não faz nada de propósito
   * — lá a reação é uma mensagem nova, que consome a janela de 24 horas e conta como envio; um
   * duplo clique sem querer viraria cobrança. Ver `api/conversas/reagir`.
   *
   * A tela muda na hora (otimista) e volta atrás se o outro lado recusar: esperar a ida e volta
   * pra pintar o coração faz o duplo clique parecer quebrado.
   */
  async function curtirMensagem(chave: string) {
    const canalAceitaReacao =
      aberta.canal === "Instagram" ||
      (aberta.canal === "WhatsApp" && !aberta.contaCanal?.startsWith("meta_whatsapp:"));
    if (!canalAceitaReacao) return;
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
      setErroCurtir(e instanceof Error ? e.message : traduzir("Não foi possível curtir a mensagem."));
    }
  }

  /** Coração colado no balão: o da cliente e o meu, quando existem: mais o coração grande que
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

  function trocarResponsavelRapido(novoResponsavel: string) {
    atribuirAtendente(aberta.nome, novoResponsavel);
    if (aberta.id !== CONVERSA_VAZIA.id) atribuirAtendenteConversa(aberta.id, novoResponsavel);
    adicionarHistorico("sistema", `Responsável alterado pra ${novoResponsavel}`);
    avisarAutomacao(`${aberta.nome} agora é atendido por ${novoResponsavel}`);
    setTrocandoResponsavel(false);
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
        valor: cardExistente?.valor ?? "-",
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
          // O gatilho "entrou na etapa" roda no SERVIDOR. Antes ele rodava aqui no navegador, o
          // que queria dizer que a automação só acontecia pra quem estava com esta tela aberta e
          // que as mensagens dela eram simuladas. Apareciam na conversa sem terem sido enviadas.
          void fetch("/api/automacoes/evento", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              tipoGatilho: "lead_entrou_etapa",
              contatoNome: aberta.nome,
              funilId: funilSelecionado.id,
              etapaId: etapaDestino.id,
              etapaTitulo: etapaDestino.titulo,
              chaveEvento: `etapa:${aberta.nome}:${etapaDestino.id}:${new Date().toISOString().slice(0, 16)}`,
            }),
          }).catch(() => {
            /* automação é efeito secundário da troca de etapa: falhar aqui não pode desfazer o que
               a pessoa acabou de fazer na tela. O erro fica no log do servidor. */
          });
        }
      }
    }
  }

  return (
    <>
      {/* Modelo aprovado: o caminho pra falar PRIMEIRO com alguém, ou depois de fechada a janela
          de 24h. Só faz sentido em conversa de WhatsApp oficial. Nos outros canais não existe
          essa regra nem esse recurso. */}
      {templateAberto && aberta.canal === "WhatsApp" && (aberta.contato || contatoDaConversa?.whatsapp) ? (
        <EnviarTemplateWhatsApp
          /* Modelo aprovado só existe no oficial, então o endereço é o do CONTATO: ver
             `destinatarioDoEnvio`. Era o da conversa, e foi assim que um modelo saiu pra um
             número antigo guardado na thread. */
          destinatario={destinatarioDoEnvio(false)}
          contatoNome={aberta.nome}
          aoFechar={() => setTemplateAberto(false)}
          aoEnviar={(texto, wamid) =>
            adicionarMensagem({ tipo: "out", texto, hora: horaAgora(), status: "enviado", wamid })
          }
        />
      ) : null}
      {/*
        SEM O TÍTULO "WhatsApp", só os controles.
        
        O menu lateral já diz em que tela você está, e o título ocupava a mesma faixa que os
        filtros — numa tela que é três colunas de conversa, cada linha de moldura no topo é uma
        mensagem a menos à vista. Os controles ficam, porque eles mudam o que a lista mostra.
      */}
      <Topbar
        title=""
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
              {traduzir("Atendente: {quem}", { quem: traduzir(atendenteTopFiltro) })} ▾
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
                <span className="n">{traduzir("Todos")}</span>
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
                  <span className="n">{traduzir(nome)}</span>
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
              {traduzir("Canal: {canal}", { canal: traduzir(canalTopFiltro) })} ▾
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
                <span className="n">{traduzir("Todos")}</span>
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
                  <span className="n">{traduzir(origem)}</span>
                </button>
              ))}
            </FloatingDropdown>
            {/* O seletor de número SAIU daqui: ele mora no cabeçalho da lista, do lado da busca.
                Trocar de número é a primeira coisa que se faz ao abrir a tela com dois conectados,
                e escolha que se usa toda hora não fica num menu suspenso da barra de filtros. */}
            {/* Conectar um número é a primeira coisa que se quer fazer numa tela de atendimento
                vazia: antes era preciso sair daqui e ir até Configurações → WhatsApp. */}
            <BotoesConectarWhatsApp />
          </>
        }
      />

      <div className="content wa-content wa-whatsapp">
        <aside className="wa-list">
          <div className="wa-list-head">
            <span>{traduzir("Conversas")}</span>
            <span className="wa-list-head-acoes">
              <button
                type="button"
                className={`wa-list-refresh${sincronizando ? " spinning" : ""}`}
                aria-label={traduzir("Recarregar conversas")}
                title={traduzir("Recarregar conversas: use se as mensagens do celular conectado saírem de sincronia")}
                onClick={sincronizarConversas}
              >
                <IconRefresh width={14} height={14} />
              </button>
              <button
                type="button"
                className="wa-list-config"
                aria-label={traduzir("Configurações das conversas")}
                title={traduzir("Configurações das conversas")}
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
                placeholder={traduzir("Pesquisar ou começar uma nova conversa")}
                aria-label={traduzir("Pesquisar conversa")}
                value={buscaConversa}
                onChange={(e) => setBuscaConversa(e.target.value)}
              />
            </label>
            {/* Um botão no lugar de duas fileiras de chips.
                As fileiras ocupavam espaço o tempo todo pra um controle que quase ninguém mexe:
                a esmagadora maioria das visitas é pra ler a lista como ela vem. O rótulo mostra o
                filtro ativo quando existe um, porque o perigo de esconder filtro atrás de botão é
                a pessoa não entender por que a lista está curta. */}
            <button
              type="button"
              className={`wa-filtro-botao${filtroAtivo ? " active" : ""}`}
              aria-expanded={filtroAberto}
              onClick={(e) => {
                setFiltroRect(e.currentTarget.getBoundingClientRect());
                setFiltroAberto((v) => !v);
              }}
            >
              {filtroAtivo ? `Filtro · ${resumoDoFiltro}` : traduzir("Filtro")}
            </button>
          </div>

          {/*
            * TROCAR DE NÚMERO FICA AQUI EM CIMA, e não escondido atrás do botão de filtro.
            *
            * Com a vendedora num número e o closer em outro, "ver o chat deste número" não é um
            * filtro que se usa de vez em quando — é a primeira coisa que se faz ao abrir a tela.
            * Escolha que se usa toda hora mora à vista, no cabeçalho da lista, do lado da busca.
            *
            * Só aparece com mais de um número conectado. Com um só, seria uma fileira ocupando
            * espaço permanente pra escolher entre "todos" e "o único".
            */}
          {variosNumeros ? (
            <div className="wa-numeros-abas" role="tablist" aria-label={traduzir("Número de WhatsApp")}>
              {/*
                SEM "TODOS", E CADA ABA DIZ O CANAL.
                
                "Tira a opção todos, deixa só os números, porque eu só vou saber se eu clicar no
                número." Com "Todos" marcado, a lista mistura as duas caixas e a coluna da
                conversa precisa repetir de quem ela é em toda linha. Escolhendo um número, a
                lista passa a ser uma caixa de entrada só — que é como se atende.
                
                O canal embaixo do nome ("API oficial", "QR Code") não é detalhe técnico: são
                regras diferentes do lado de quem atende — o oficial tem janela de 24 horas e
                modelo aprovado, o QR Code não tem nenhum dos dois.
                
                E o nome se edita aqui: um duplo clique abre o campo. Nomear o número é o que faz
                a lista parar de falar em telefone e passar a falar em "Vendas", "Closer".
              */}
              {numerosConectados
                .filter((n) => n.status === "conectado" && n.chave)
                .map((n) =>
                  renomeando === n.chave ? (
                    <input
                      key={n.chave}
                      className="wa-numero-aba wa-numero-nome"
                      autoFocus
                      defaultValue={n.apelido ?? ""}
                      placeholder={n.numeroLegivel || traduzir("Nome deste número")}
                      aria-label={traduzir("Nome deste número")}
                      onBlur={(e) => salvarApelido(n, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") setRenomeando(null);
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      role="tab"
                      key={n.chave}
                      aria-selected={numeroAtivo === n.chave}
                      className={`wa-numero-aba${numeroAtivo === n.chave ? " on" : ""}`}
                      // O telefone no `title`: o nome cabe na aba, o número nem sempre — e é o
                      // número que tira a dúvida quando dois apelidos se parecem.
                      title={`${n.numeroLegivel || n.nome} — ${traduzir("dois cliques pra renomear")}`}
                      onClick={() => {
                        /*
                          TROCAR DE NÚMERO FECHA O QUE ESTAVA ABERTO.
                          
                          "Eu estou no número final 26, aí eu cliquei no final 38. A mensagem que
                          estava ali naquela tela tem que sumir." E tem mesmo: a conversa aberta é
                          do OUTRO número, e deixá-la na tela com a lista já trocada é o convite
                          pra responder achando que está num número e estar em outro.
                          
                          Fechar é mais honesto que escolher sozinho a primeira da lista nova: a
                          escolha de qual conversa abrir é de quem atende.
                        */
                        setNumeroTopFiltro(n.chave);
                        setSelectedId(null);
                      }}
                      onDoubleClick={() => setRenomeando(n.chave)}
                    >
                      <span className="wa-numero-aba-nome">{n.apelido?.trim() || n.numeroLegivel || n.nome}</span>
                      <span className="wa-numero-aba-canal">{traduzir(canalDoNumero(n.provedor))}</span>
                    </button>
                  ),
                )}
              {temConversaSemNumero ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={numeroAtivo === SEM_NUMERO}
                  className={`wa-numero-aba${numeroAtivo === SEM_NUMERO ? " on" : ""}`}
                  title={traduzir("Conversas de antes de o CRM guardar de qual número elas vieram.")}
                  onClick={() => {
                    setNumeroTopFiltro(SEM_NUMERO);
                    setSelectedId(null);
                  }}
                >
                  <span className="wa-numero-aba-nome">{traduzir("Sem número")}</span>
                  <span className="wa-numero-aba-canal">{traduzir("antigas")}</span>
                </button>
              ) : null}
            </div>
          ) : null}
          {/*
            OS NÚMEROS QUE AINDA NÃO TÊM NOME.
            
            "Só vai aparecer agora o nome em números que chegar na mensagem nova? Os que estão lá
            não mudou." Não mudavam mesmo: o batismo acontece quando a mensagem chega. Esta linha
            é o passado — ela lê o nome no histórico que o aparelho ainda guarda.
            
            SOME DEPOIS DE PROCURAR, ache ou não ache. Antes ela contava toda conversa chamada pelo
            número, e as que o WhatsApp nunca guardou o nome voltavam a aparecer a cada clique. O
            texto diz o que acontece com elas a partir daí, pra o sumiço não parecer desistência.
          */}
          {conversasAindaComNumero > 0 ? (
            <div className="wa-sem-nome">
              <span>
                {conversasAindaComNumero === 1
                  ? traduzir("1 conversa está com o número no lugar do nome.")
                  : traduzir("{n} conversas estão com o número no lugar do nome.", {
                      n: String(conversasAindaComNumero),
                    })}
              </span>
              <button type="button" onClick={() => void buscarNomesQueFaltam()} disabled={batizando}>
                {batizando ? traduzir("Buscando…") : traduzir("Buscar nomes")}
              </button>
            </div>
          ) : null}
          <FloatingDropdown
            anchorRect={filtroAberto ? filtroRect : null}
            onClose={() => setFiltroAberto(false)}
            width={240}
          >
            <p className="dropdown-titulo">{traduzir("Mostrar")}</p>
            {FILTROS_CONVERSA.map((f) => (
              <button
                type="button"
                key={f.valor}
                className={`dropdown-item${!mostrarArquivadas && filtroConversa === f.valor ? " active" : ""}`}
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => {
                  setFiltroConversa(f.valor);
                  setMostrarArquivadas(false);
                  setFiltroAberto(false);
                }}
              >
                <span className="n">{traduzir(f.label)}</span>
              </button>
            ))}
            <button
              type="button"
              className={`dropdown-item${mostrarArquivadas ? " active" : ""}`}
                style={{ width: "100%", textAlign: "left" }}
              onClick={() => {
                setMostrarArquivadas(true);
                setFiltroAberto(false);
              }}
            >
              <span className="n">Arquivadas ({conversas.filter((c) => c.arquivada).length})</span>
            </button>

            <p className="dropdown-titulo">{traduzir("Conexão")}</p>
            {CANAIS_CONVERSA.map((canal) => {
              const quantidade =
                canal.valor === "todos"
                  ? conversas.length
                  : conversas.filter((c) => c.canal === canal.valor).length;
              return (
                <button
                  type="button"
                  key={canal.valor}
                  className={`dropdown-item${canalAba === canal.valor ? " active" : ""}`}
                style={{ width: "100%", textAlign: "left" }}
                  disabled={canal.emBreve}
                  title={canal.emBreve ? traduzir("Ainda não disponível") : undefined}
                  onClick={() => {
                    setCanalAba(canal.valor);
                    setFiltroAberto(false);
                  }}
                >
                  <span className="n">
                    {traduzir(canal.label)}
                    {canal.emBreve ? " · em breve" : quantidade > 0 ? ` (${quantidade})` : ""}
                  </span>
                </button>
              );
            })}

            {filtroAtivo ? (
              <button
                type="button"
                className="dropdown-item dropdown-item-limpar"
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => {
                  setFiltroConversa("tudo");
                  setMostrarArquivadas(false);
                  setCanalAba("todos");
                  setFiltroAberto(false);
                }}
              >
                <span className="n">{traduzir("Limpar filtro")}</span>
              </button>
            ) : null}
          </FloatingDropdown>
          <div className="wa-list-rows">
          {/* Contatos que ainda não têm conversa. A caixa de busca sempre prometeu "ou começar uma
              nova conversa" e não cumpria: o único jeito de iniciar uma era pelo participante de um
              grupo. Quem salvava um contato não tinha por onde falar com ele. */}
          {contatosSemConversa.length > 0 ? (
            <div className="conversa-contatos-novos">
              <p className="hint">{traduzir("Começar uma conversa")}</p>
              {contatosSemConversa.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="conversa-contato-novo"
                  disabled={iniciandoConversa === c.id}
                  onClick={() => void iniciarConversaCom(c)}
                >
                  <span className="conversa-contato-nome">{c.nome}</span>
                  <span className="hint">{iniciandoConversa === c.id ? "Abrindo…" : c.whatsapp}</span>
                </button>
              ))}
            </div>
          ) : null}

          {conversasFiltradas.length === 0 && contatosSemConversa.length === 0 ? (
            <p className="hint" style={{ padding: 20 }}>
              {carregandoConversas
                ? "Carregando conversas…"
                : conversas.length === 0
                  ? "Nenhuma conversa ainda: conecte um canal em Configurações para começar a receber mensagens de verdade."
                  : traduzir("Nenhuma conversa encontrada. Digite o nome de um contato pra começar uma conversa com ele.")}
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
              // Mesma regra da bolha: o que a pessoa escreveu sai como veio; só a frase que o
              // próprio CRM gravou no lugar de um anexo passa pelo dicionário.
              const previaTexto = ultimaExtra?.texto
                ? traduzirRotuloDoSistema(ultimaExtra.texto, traduzir)
                : (ultimaExtra?.legenda ??
                  (iconeTipo ? traduzir("Anexo") : traduzir("Sem mensagens ainda")));
              return (
                // Mesma barreira da bolha, agora por conversa: uma linha com dado estranho não pode
                // apagar a lista inteira e deixar a tela sem por onde começar.
                <LimiteDeErro key={c.id} rotulo={`conversa ${c.id}`}>
                <div
                  role="button"
                  tabIndex={0}
                  // `nao-lida` deixa o nome e a prévia em preto cheio: antes a única marca de não
                  // lida era o contador no canto, fácil de perder numa lista longa.
                  className={`wa-row${active ? " active" : ""}${
                    c.naoLidas > 0 && !lidas.has(c.id) ? " nao-lida" : ""
                  }`}
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
                      {c.fotoUrl ? <img src={c.fotoUrl} alt="" className="wa-avatar-foto" /> : iniciaisExibidas(c.nome, c.initials, c.canal)}
                      <CanalBadge canal={c.canal as Canal} />
                    </span>
                    <span className="cname">
                      {fixadas.has(c.id) ? (
                        <span className="wa-pin-icone">
                          <IconPin width={11} height={11} />
                        </span>
                      ) : null}
                      {c.ehGrupo ? (
                        <span className="wa-pin-icone" title={traduzir("Grupo do WhatsApp")}>
                          <IconEquipe width={11} height={11} />
                        </span>
                      ) : null}
                      {/* O NOME NUM ELEMENTO PRÓPRIO.
                          Solto aqui dentro, ele virava um item anônimo de flex — e `text-overflow`
                          não vale pra item de flex. O nome era cortado no meio da palavra, sem
                          reticências: numa lista estreita, "AGÊNCIA AZUZ - TRÁF" e "AGÊNCIA AZUZ -
                          VENDAS" viram a mesma linha. Com elemento próprio, as reticências voltam
                          a funcionar e o `title` dá o nome inteiro. */}
                      <span className="cname-texto" title={nomeExibido(c.nome, c.canal)}>
                        {nomeExibido(c.nome, c.canal)}
                      </span>
                      {ehFavorita(c) ? (
                        <span className="wa-fav-star">
                          <IconStar width={11} height={11} fill="currentColor" />
                        </span>
                      ) : null}
                      {silenciadas.has(c.id) ? (
                        <span className="wa-mute-icone" title={traduzir("Silenciada")}>
                          <IconMudo width={11} height={11} />
                        </span>
                      ) : null}
                    </span>
                    {/* `ultimaMensagemEm`, NÃO `atualizadoEm`.
                        O segundo sobe a cada escrita na linha da conversa: favoritar, mudar o
                        status, a importação do histórico, o reparo das mensagens órfãs. Ele diz
                        quando o REGISTRO foi mexido, não quando a última mensagem chegou, e era
                        por isso que conversa de hoje aparecia com hora de ontem. Sem mensagem
                        gravada ainda, a data do registro é o melhor que existe. */}
                    <span className="ctime">
                      {rotuloDeConversa(new Date(c.ultimaMensagemEm ?? c.atualizadoEm), new Date(), traduzir, localeNumero)}
                    </span>
                  </span>
                  <span className="cmsg">
                    <span className="cmsg-texto">
                      {ultimaExtra?.tipo === "out" ? (
                        <>
                          {traduzir("Você:")}{" "}
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
                      {encerradas.has(c.id) ? traduzir("Finalizado") : traduzir(c.status)}
                    </span>
                    {/* Por qual conexão esta conversa fala. Só aparece quando as DUAS estão em uso
                        na lista: com uma só, a etiqueta repetiria a mesma coisa em toda linha. */}
                    {variosNumeros && nomeDoNumeroDaConversa(etiquetasDosNumeros, c.contaCanal) ? (
                      /* Com vários números, o que importa é QUAL deles — "WhatsApp QR Code" seria
                         a mesma etiqueta nos dois. O nome ganha do tipo de conexão. */
                      <span
                        className="tag wa-conexao-tag"
                        title={traduzir("A resposta sai por este mesmo número")}
                      >
                        {nomeDoNumeroDaConversa(etiquetasDosNumeros, c.contaCanal)}
                      </span>
                    ) : distinguirConexao && conexaoDaConversa(c.contaCanal) ? (
                      <span
                        className="tag wa-conexao-tag"
                        title={traduzir("A resposta sai por esta mesma conexão")}
                      >
                        {ROTULO_CONEXAO[conexaoDaConversa(c.contaCanal)!]}
                      </span>
                    ) : null}
                    {/*
                      DE ONDE VEIO O LEAD.
                      
                      A etiqueta do RASTREIO ganha de `Conversa.origem` quando existe: a segunda é
                      gravada como "Direto" pra todo mundo pelo webhook, e um campo que diz a mesma
                      coisa em toda linha não informa nada. Quando não há rastreio, "Direto" volta
                      a aparecer — ele continua sendo a verdade disponível.
                      
                      `classeOrigem` dá a cor pelas mesmas palavras que o CRM já usa ("Meta Ads",
                      "Instagram"), então a etiqueta nova nasce com a cor certa sem paleta nova.
                    */}
                    {(() => {
                      const daOrigem = origemPorContato[chaveDeContato(c.nome)];
                      if (!daOrigem) {
                        return (
                          <span className={`tag ${classeOrigem(c.origem as Parameters<typeof classeOrigem>[0])}`}>
                            {traduzir(c.origem)}
                          </span>
                        );
                      }
                      return (
                        <span
                          className={`tag ${classeOrigem(daOrigem.rotulo as Parameters<typeof classeOrigem>[0])}`}
                          title={
                            daOrigem.detalhe
                              ? `${traduzir("De onde veio este lead")}: ${daOrigem.rotulo} · ${daOrigem.detalhe}`
                              : `${traduzir("De onde veio este lead")}: ${daOrigem.rotulo}`
                          }
                        >
                          {/* O ponto marca tráfego PAGO. É a leitura de relance que ela pediu —
                              "veio direto do tráfego pago?" — sem gastar a largura da etiqueta com
                              mais uma palavra numa linha que já tem três. */}
                          {daOrigem.pago ? "• " : ""}
                          {traduzir(daOrigem.rotulo)}
                        </span>
                      );
                    })()}
                    {!c.ehGrupo && etapaAtualDoContato(c.nome) ? (
                      <span className="tag wa-etapa-funil-tag" title={traduzir("Etapa atual no funil")}>
                        {traduzir(etapaAtualDoContato(c.nome)!)}
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className="wa-row-menu-btn"
                    aria-label={`Mais ações: ${c.nome}`}
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
                          {fixadas.has(c.id) ? traduzir("Desafixar conversa") : traduzir("Fixar conversa")}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left" }}
                        onClick={() => marcarComoNaoLida(c.id)}
                      >
                        <span className="n">{traduzir("Marcar como não lida")}</span>
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
                        <span className="n">{traduzir("Encerrar atendimento")}</span>
                      </button>
                      <div className="dropdown-sep" />
                      <button
                        type="button"
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left", color: "var(--danger)" }}
                        onClick={() => {
                          if (window.confirm(traduzir("Excluir a conversa com {nome}? Isso apaga as mensagens dela também. Não dá pra desfazer.", { nome: c.nome }))) {
                            excluirConversa(c.id);
                          }
                          setRowMenuAberto(null);
                        }}
                      >
                        <span className="n">{traduzir("Excluir conversa")}</span>
                      </button>
                    </FloatingDropdown>
                  ) : null}
                </div>
                </LimiteDeErro>
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
              title={aberta.ehGrupo ? traduzir("Ver dados do grupo") : traduzir("Ver mídias e arquivos trocados nessa conversa")}
            >
              <div className="avatar">
                {aberta.fotoUrl ? <img src={aberta.fotoUrl} alt="" className="wa-avatar-foto" /> : iniciaisExibidas(aberta.nome, aberta.initials, aberta.canal)}
              </div>
              <div>
                <p className="n">
                  {aberta.ehGrupo ? <IconEquipe width={13} height={13} style={{ marginRight: 4, verticalAlign: -2 }} /> : null}
                  {nomeExibido(aberta.nome, aberta.canal)}
                </p>
                <p className="s">
                  {aberta.ehGrupo
                    ? `Grupo · ${aberta.participantesGrupo?.length ?? 0} participantes`
                    : /* No Instagram, `contato` é o id interno da thread (algo como
                         "828654933601920"): número que não significa nada pra quem atende e que a
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
              aria-label={traduzir("Ver atributos do contato")}
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
              <div className="wa-dragover-aviso">{traduzir("Solte o arquivo pra anexar")}</div>
            ) : null}
            {/* A curtida já foi desfeita na tela quando isso aparece. O aviso existe pra explicar
                POR QUE o coração sumiu (janela de 24h vencida, conta desconectada), em vez de
                deixar parecer que o clique não funcionou. */}
            {localizacaoBuscando ? (
              <span className="hint" style={{ alignSelf: "center" }}>
                {traduzir("Obtendo sua localização…")}
              </span>
            ) : null}
            {localizacaoErro ? (
              <button
                type="button"
                className="wa-campo-erro"
                style={{ alignSelf: "center", background: "none", border: "none", cursor: "pointer" }}
                onClick={() => setLocalizacaoErro(null)}
                title={traduzir("Dispensar")}
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
                title={traduzir("Dispensar")}
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
                    {traduzir("Esta mensagem foi apagada.")}
                  </div>
                );
              }
              // UMA implementação de bolha em todo o CRM (`BolhaMensagem`). O desenho vive lá; o
              // que é interação DESTA tela. Menu, estrela, reação, bloqueio de mídia pesada,
              // visualizador, ficha do contato, "Ler mais": entra por props. Antes eram duas
              // implementações da mesma coisa, e a mesma mensagem aparecia diferente aqui e no
              // painel do Funil.
              // Barreira por mensagem: uma mensagem com dado estranho. Anexo de tipo novo, campo
              // que mudou de forma, extra vindo de um webhook antigo. Derrubava a TELA INTEIRA,
              // porque o erro subia até a barreira da rota. Agora o estrago fica do tamanho do
              // problema: aquela bolha vira um aviso e o atendimento continua utilizável.
              const bolha = (
                <LimiteDeErro rotulo={`mensagem ${chave}`}>
                <BolhaMensagem
                  msg={msg}
                  chaveDom={chave}
                  chrome={
                    <>
                      {botaoMenuMensagem(chave)}
                      {estrelaFavorita(chave)}
                      {reacaoNaMensagem(msg, chave)}
                    </>
                  }
                  velocidadeAudio={config.velocidadeAudioPadrao}
                  mostrarRemetenteGrupo={aberta.ehGrupo}
                  midiaLiberada={midiaLiberada}
                  aoLiberarMidia={liberarMidia}
                  aoAbrirImagem={abrirLightbox}
                  aoAbrirContato={(contatoCompartilhado) => {
                    setContatoDetalhePos(null);
                    setContatoDetalheAberto(contatoCompartilhado);
                  }}
                  aoResponderOpcao={responderComOpcao}
                  onTentarNovamente={
                    msg.status === "erro" && msg.id ? () => tentarNovamenteMensagem(msg.id!) : undefined
                  }
                  renderizarTexto={(textoCru) => {
                    /*
                     * Um passe só sobre o texto, em `interpretarMensagem`: negrito, menção,
                     * endereço e telefone saem classificados de lá, e aqui só viram tela.
                     *
                     * O corte de 500 caracteres acontece ANTES de interpretar, e não depois: a
                     * contagem é do que a pessoa escreveu, e interpretar primeiro faria "Ler mais"
                     * aparecer em lugar diferente conforme a mensagem tivesse ou não um link.
                     */
                    const cortar = textoCru.length > 500 && !mensagensExpandidas.has(chave);
                    const trechos = interpretarMensagem(
                      cortar ? textoCru.slice(0, 500) : textoCru,
                      resolverMencao,
                    );
                    return cortar ? (
                      <>
                        {renderizarTrechos(trechos, traduzir)}…{" "}
                        <button
                          type="button"
                          className="wa-ler-mais"
                          onClick={() => setMensagensExpandidas((prev) => new Set(prev).add(chave))}
                        >
                          {traduzir("Ler mais")}
                        </button>
                      </>
                    ) : (
                      renderizarTrechos(trechos, traduzir)
                    );
                  }}
                />
                </LimiteDeErro>
              );

              // Separador de dia entre as bolhas. Sem ele a conversa é um rolo contínuo e não dá
              // pra saber onde termina um dia e começa o outro, que é justamente o que se procura
              // ao reler um atendimento.
              const diaDesta = rotuloDoDiaEmBrasilia(msg.criadoEm, traduzir, localeNumero);
              const diaDaAnterior = iRelativo > 0 ? rotuloDoDiaEmBrasilia(arr[iRelativo - 1].criadoEm, traduzir, localeNumero) : null;
              const mudouDeDia = Boolean(diaDesta) && diaDesta !== diaDaAnterior;

              return (
                <Fragment key={`bloco-${chave}`}>
                  {mudouDeDia ? <span className="wa-separador-dia">{diaDesta}</span> : null}
                  {bolha}
                </Fragment>
              );
            })}
            {/* Âncora do fim da conversa. Rolar até ela é mais confiável do que empurrar
                `scrollTop` na mão: funciona mesmo com imagem ainda carregando, que muda a altura
                do conteúdo depois que o cálculo já foi feito. */}
            <div ref={fimDasMensagensRef} />
          </div>
          <div className="chat-input">
            <button
              type="button"
              className="chat-attach-btn"
              aria-label={traduzir("Anexar")}
              title={traduzir("Anexar")}
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
                    aria-label={traduzir("Excluir gravação")}
                    title={traduzir("Excluir gravação")}
                    onClick={pedirDescartarGravacao}
                  >
                    <IconLixeira width={14} height={14} />
                  </button>
                  <button
                    type="button"
                    className="chat-audio-btn"
                    aria-label={audioPausado ? traduzir("Continuar gravação") : traduzir("Pausar gravação")}
                    title={audioPausado ? "Continuar" : "Pausar"}
                    onClick={pausarOuContinuarGravacao}
                  >
                    {audioPausado ? <IconPlay width={13} height={13} /> : <IconPause width={13} height={13} />}
                  </button>
                  <button
                    type="button"
                    className="chat-audio-btn chat-audio-btn-concluir"
                    aria-label={traduzir("Concluir gravação")}
                    title={traduzir("Concluir gravação")}
                    onClick={concluirGravacao}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <IconCheck width={13} height={13} /> {traduzir("Concluir")}
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
                    aria-label={audioPreviewTocando ? traduzir("Pausar prévia") : traduzir("Ouvir prévia")}
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
                    aria-label={traduzir("Gravar de novo")}
                    title={traduzir("Gravar de novo")}
                    onClick={regravarAudio}
                  >
                    ↺
                  </button>
                  <button
                    type="button"
                    className="chat-audio-btn chat-audio-btn-lixeira"
                    aria-label={traduzir("Excluir áudio")}
                    title={traduzir("Excluir áudio")}
                    onClick={pedirDescartarGravacao}
                  >
                    <IconLixeira width={14} height={14} />
                  </button>
                  <button
                    type="button"
                    className="chat-audio-btn chat-audio-btn-enviar"
                    aria-label={traduzir("Enviar áudio")}
                    title={traduzir("Enviar áudio")}
                    disabled={audioEnviando}
                    onClick={enviarAudioGravado}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    {audioEnviando ? "Enviando…" : <><IconEnviar width={13} height={13} /> {traduzir("Enviar")}</>}
                  </button>
                </div>
              ) : (
                <div className="chat-input-campo-coluna">
                  {audioPermissaoErro ? (
                    <div className="chat-audio-erro">
                      <span>{audioPermissaoErro}</span>
                      <button type="button" className="link" onClick={() => setAudioPermissaoErro(null)}>
                        {traduzir("Dispensar")}
                      </button>
                    </div>
                  ) : null}
                  {/*
                    * POR ONDE VAI SAIR, quando há mais de um caminho.
                    *
                    * Só aparece com os DOIS WhatsApp conectados E na conversa que ainda não tem
                    * dono. Depois da primeira mensagem, quem manda é o histórico: a conversa
                    * pertence à conexão por onde ela veio, e trocar no meio escreveria do outro
                    * número, como se fosse outra empresa.
                    *
                    * Existe porque o CRM escolhia sozinho — e escolhia o oficial, que é o mais
                    * restrito: a pessoa caía na tela de modelo aprovado sem ter pedido isso.
                    */}
                  {/*
                    POR QUAL NÚMERO ESTA MENSAGEM SAI — SÓ QUANDO PEDIDA.
                    
                    "Não precisa ficar em todos os chats isso aqui." Ela nasceu como uma faixa fixa
                    em cima do campo de escrever, e faixa fixa cobra de todo mundo o preço de um
                    recurso que quase ninguém usa: responder pelo número da conversa é o normal, e
                    trocar é a exceção. Uma linha permanente pra exceção empurra a conversa pra
                    baixo em cem atendimentos pra servir um.
                    
                    Agora ela mora no menu do "+", junto das outras coisas que se faz de vez em
                    quando, e só aparece aqui depois de aberta — ou enquanto houver uma escolha em
                    vigor, que aí ela não é opção, é estado: a próxima mensagem vai sair de outro
                    número e isso não pode ficar invisível.
                    
                    Vale INCLUSIVE na conversa que já tem dono, que é o ponto: "mesmo já tendo
                    falado com o contato por outro número".
                    
                    O padrão continua sendo o número da conversa, e trocar é uma escolha explícita
                    com um preço explícito: pro cliente a mensagem chega de outro número, numa
                    conversa nova no aparelho dele. Por isso a linha diz isso quando a escolha sai
                    do padrão, em vez de deixar a descoberta pro cliente.
                  */}
                  {/* Conversa que JÁ tem dono não pergunta mais nada: a escolha foi feita e a
                      mensagem seguinte segue por onde a anterior foi. Quem quiser trocar assim
                      mesmo abre pelo "+", que é a porta explícita. */}
                  {variosNumeros &&
                  aberta.canal === "WhatsApp" &&
                  (seletorDeNumeroAberto || (numeroEscolhidoDaConversa() && conversaSemDono(aberta.nome))) ? (
                    <div className="chat-canal-escolha">
                      <label className="chat-canal-rotulo" htmlFor="numero-de-saida">
                        {traduzir("Enviar pelo número")}
                      </label>
                      <select
                        id="numero-de-saida"
                        className="input chat-numero-saida"
                        value={numeroEscolhidoDaConversa() ?? ""}
                        onChange={(e) => {
                          setEscolhaDeNumero(
                            e.target.value ? { conversa: aberta.nome, chave: e.target.value } : null,
                          );
                          /* Voltando pro número da conversa, a linha não tem mais o que dizer:
                             ela some junto, em vez de ficar ocupando espaço pra informar o
                             comportamento padrão. */
                          if (!e.target.value) setSeletorDeNumeroAberto(false);
                        }}
                      >
                        <option value="">
                          {nomeDoNumeroDaConversa(nomesDosNumeros, aberta.contaCanal)
                            ? `${traduzir("O desta conversa")} · ${nomeDoNumeroDaConversa(nomesDosNumeros, aberta.contaCanal)}`
                            : traduzir("O desta conversa")}
                        </option>
                        {numerosConectados
                          .filter((n) => n.status === "conectado" && n.chave)
                          .map((n) => (
                            <option key={n.chave} value={n.chave}>
                              {n.nome}
                              {n.numeroLegivel && n.numeroLegivel !== n.nome ? ` · ${n.numeroLegivel}` : ""}
                            </option>
                          ))}
                      </select>
                      {numeroEscolhidoDaConversa() ? (
                        <span className="chat-canal-aviso">
                          {traduzir(
                            "Pro cliente, esta mensagem chega de outro número — numa conversa nova, sem o histórico desta.",
                          )}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {/* Também quando a escolha do número foi explícita: aí a conversa pode já ter
                      dono e mesmo assim a próxima mensagem sai pelo oficial, onde a primeira
                      mensagem precisa de modelo aprovado. */}
                  {aberta.canal === "WhatsApp" && statusWhatsappPronto && conversaSemDono(aberta.nome) ? (
                    <div className="chat-canal-escolha">
                      {/* Os dois chips só com os DOIS ligados: com um só não há o que escolher, e
                          um botão que não escolhe ensina a desconfiar dos que escolhem. */}
                      {metaWhatsappConectado && naoOficialConectado ? (
                        <>
                          <span className="chat-canal-rotulo">{traduzir("Enviar por")}</span>
                          <button
                            type="button"
                            className={`fchip${canalEfetivo === "whatsapp_nao_oficial" ? " active" : ""}`}
                            onClick={() => setCanalEscolhido("whatsapp_nao_oficial")}
                          >
                            {traduzir("WhatsApp (QR Code)")}
                          </button>
                          <button
                            type="button"
                            className={`fchip${canalEfetivo === "whatsapp_oficial" ? " active" : ""}`}
                            onClick={() => setCanalEscolhido("whatsapp_oficial")}
                          >
                            {traduzir("API Oficial")}
                          </button>
                        </>
                      ) : (
                        /* Com uma conexão só, a linha vira informação: diz por onde ESTA mensagem
                           vai sair. "Tem que aparecer se é para API oficial" — e tem que aparecer
                           também quando não é, senão a ausência da linha é que vira a dúvida. */
                        <span className="chat-canal-rotulo">
                          {traduzir("Enviando por")}:{" "}
                          <b>
                            {traduzir(
                              canalEfetivo === "whatsapp_oficial" ? "API Oficial" : "WhatsApp (QR Code)",
                            )}
                          </b>
                        </span>
                      )}

                      {/*
                        PELO OFICIAL, O MODELO APROVADO NÃO É UM DETALHE: É O CAMINHO.
                        
                        "Não consegui conversar com ninguém pela API oficial." Falar PRIMEIRO com
                        alguém pelo oficial só acontece com um modelo que a Meta aprovou — texto
                        livre ela recusa. O CRM sabia disso e dizia numa frase cinza, enquanto o
                        caminho de verdade ficava escondido dentro do menu do clipe, duas camadas
                        abaixo, com o nome de anexo.
                        
                        Agora a frase vem com o botão: "se for API oficial, já vai direto para
                        modelos de mensagem".
                      */}
                      {!contatoUsaWhatsappNaoOficial() ? (
                        <>
                          <span className="chat-canal-aviso">
                            {traduzir("Pelo oficial, a primeira mensagem precisa ser um modelo aprovado.")}
                          </span>
                          <button
                            type="button"
                            className="btn primary pequeno chat-canal-modelo"
                            onClick={() => setTemplateAberto(true)}
                          >
                            {traduzir("Escolher modelo")}
                          </button>
                        </>
                      ) : null}
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
                        aria-label={traduzir("Cancelar resposta")}
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
                    placeholder={traduzir("Digite uma mensagem... (/ para respostas rápidas, // para automações)")}
                    value={mensagemTexto}
                    onChange={(e) => {
                      setMensagemTexto(e.target.value);
                      setCursorMensagem(e.target.selectionStart ?? e.target.value.length);
                    }}
                    onKeyUp={(e) => setCursorMensagem(e.currentTarget.selectionStart ?? 0)}
                    onClick={(e) => setCursorMensagem(e.currentTarget.selectionStart ?? 0)}
                    onKeyDown={(e) => {
                      // Com a lista de menção aberta, Enter escolhe a primeira em vez de enviar:
                      // enviar "@ra" pela metade é o erro que o seletor existe pra evitar.
                      if (e.key === "Enter" && participantesSugeridos.length) {
                        e.preventDefault();
                        escolherMencao(participantesSugeridos[0]);
                        return;
                      }
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
              {participantesSugeridos.length ? (
                <div className="chat-sugestoes">
                  {participantesSugeridos.map((p) => (
                    <button
                      type="button"
                      key={p.telefone}
                      className="dropdown-item"
                      style={{ width: "100%", textAlign: "left" }}
                      onClick={() => escolherMencao(p)}
                    >
                      <span className="n">{p.nome}</span>
                      {p.nome === p.telefone ? null : <span className="s"> {p.telefone}</span>}
                    </button>
                  ))}
                </div>
              ) : null}
              {sugerirRespostas ? (
                <div className="chat-sugestoes">
                  {respostasDoFunil.length === 0 ? (
                    <p className="hint" style={{ padding: "8px 10px" }}>
                      {traduzir("Nenhuma resposta rápida salva pra esse funil ainda.")}
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
                      {traduzir("Nenhuma automação publicada nesse funil ainda.")}
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
                        <span className="n"><IconAutomacoes width={12} height={12} /> {a.nome}</span>
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
                aria-label={traduzir("Emojis")}
                title={traduzir("Emojis")}
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
                aria-label={traduzir("Enviar mensagem")}
                title={traduzir("Enviar mensagem")}
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
                aria-label={traduzir("Gravar áudio")}
                title={traduzir("Gravar áudio")}
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
                    aria-label={traduzir("Anexar")}
                  >
                    <div
                      className="wa-anexo-drag"
                      onMouseDown={iniciarArrasteAnexo}
                      title={traduzir("Arraste pra mover")}
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
                        <span className="wa-anexo-label">{traduzir("Fotos e imagens")}</span>
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
                        <span className="wa-anexo-label">{traduzir("Vídeos")}</span>
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
                        <span className="wa-anexo-label">{traduzir("Documentos")}</span>
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
                        <span className="wa-anexo-label">{traduzir("Contatos")}</span>
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
                        <span className="wa-anexo-label">{traduzir("Localização")}</span>
                      </button>
                      {/*
                        TROCAR O NÚMERO DE SAÍDA mora aqui, e não numa faixa fixa.
                        
                        "Não precisa ficar em todos os chats isso aqui." É uma ação de vez em
                        quando — a closer que assume o lead da vendedora —, e o menu do "+" é onde
                        moram as coisas de vez em quando. Só com mais de um número conectado: com
                        um só, seria um item que não escolhe nada.
                      */}
                      {variosNumeros && aberta.canal === "WhatsApp" ? (
                        <button
                          type="button"
                          role="menuitem"
                          className="wa-anexo-item"
                          onClick={() => {
                            setAnexoAberto(false);
                            setSeletorDeNumeroAberto(true);
                          }}
                        >
                          <span className="wa-anexo-icone wa-anexo-icone-contato">
                            <IconTelefone width={19} height={19} />
                          </span>
                          <span className="wa-anexo-label">{traduzir("Enviar por outro número")}</span>
                        </button>
                      ) : null}
                      {/* Só no WhatsApp oficial: é o único canal com a regra das 24h e com modelo
                          aprovado. No QR Code e no Direct isso não existe. */}
                      {aberta.canal === "WhatsApp" && !conversaUsaWhatsappNaoOficial(aberta.nome) ? (
                        <button
                          type="button"
                          role="menuitem"
                          className="wa-anexo-item"
                          onClick={() => {
                            setAnexoAberto(false);
                            setTemplateAberto(true);
                          }}
                        >
                          <span className="wa-anexo-icone wa-anexo-icone-contato">
                            <IconContatos width={19} height={19} />
                          </span>
                          <span className="wa-anexo-label">{traduzir("Modelo aprovado")}</span>
                        </button>
                      ) : null}
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
                        <span className="wa-anexo-label">{traduzir("Executar automação")}</span>
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
                        <span className="wa-anexo-label">{traduzir("Respostas rápidas")}</span>
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
                    aria-label={traduzir("Cancelar")}
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
                      {traduzir("Largura")}
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
                      {traduzir("Altura")}
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
                      {traduzir("Aplicar corte")}
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => setImagemModoCorte(false)}
                    >
                      {traduzir("Cancelar corte")}
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
                      <IconCut width={13} height={13} /> {traduzir("Cortar")}
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={girarImagem90}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <IconRefresh width={13} height={13} /> {traduzir("Girar")}
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
                      {traduzir("Restaurar original")}
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
                      aria-label={traduzir("Adicionar mais imagens")}
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
                  placeholder={traduzir("Adicionar legenda…")}
                  value={legendaImagem}
                  onChange={(e) => setLegendaImagem(e.target.value)}
                />

                <div className="wa-contato-modal-rodape">
                  <button type="button" className="btn ghost" onClick={fecharPreviewImagem}>
                    {traduzir("Cancelar")}
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
                  <p className="n">{traduzir("Enviar vídeo")}</p>
                  <button
                    type="button"
                    className="modal-close-btn"
                    aria-label={traduzir("Cancelar")}
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
                        <IconMudo width={13} height={13} /> {traduzir("Sem áudio")}
                      </>
                    ) : (
                      <>
                        <IconVolume width={13} height={13} /> {traduzir("Com áudio")}
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
                  >{traduzir("↩ Desfazer edição")}</button>
                </div>

                {videoErro ? (
                  <p className="wa-anexo-erro" role="alert">
                    {videoErro}
                  </p>
                ) : null}

                <input
                  className="input"
                  style={{ width: "100%", marginTop: 10 }}
                  placeholder={traduzir("Adicionar legenda…")}
                  value={legendaVideo}
                  onChange={(e) => setLegendaVideo(e.target.value)}
                />

                <div className="wa-contato-modal-rodape">
                  <button type="button" className="btn ghost" onClick={fecharPreviewVideo}>
                    {traduzir("Cancelar")}
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={videoProcessando}
                    onClick={() => processarEEnviarVideo(true)}
                  >
                    {traduzir("Enviar sem editar")}
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
                  <p className="n">{traduzir("Enviar documento")}</p>
                  <button
                    type="button"
                    className="modal-close-btn"
                    aria-label={traduzir("Fechar")}
                    onClick={() => setDocumentoOrigemAberto(false)}
                  >
                    <IconClose width={12} height={12} />
                  </button>
                </div>
                <p className="hint" style={{ marginBottom: 14 }}>
                  {traduzir("Escolha um documento já salvo no CRM ou envie um arquivo do computador.")}
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
                        {traduzir("Escolher documento do CRM")}
                      </span>
                      <span className="hint">{traduzir("Biblioteca de documentos já salvos no sistema")}</span>
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
                        {traduzir("Escolher documento do computador")}
                      </span>
                      <span className="hint">{traduzir("Enviar um arquivo do seu dispositivo")}</span>
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
                  <p className="n">{traduzir("Documentos do CRM")}</p>
                  <button
                    type="button"
                    className="modal-close-btn"
                    aria-label={traduzir("Fechar")}
                    onClick={() => setBibliotecaAberta(false)}
                  >
                    <IconClose width={12} height={12} />
                  </button>
                </div>

                <input
                  className="input"
                  style={{ width: "100%" }}
                  placeholder={traduzir("Pesquisar documento…")}
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
                            {new Date(doc.atualizadoEm).toLocaleDateString(localeNumero)}
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
                          {traduzir("Visualizar")}
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
                      {traduzir("Nenhum documento encontrado.")}
                    </p>
                  ) : null}
                </div>

                <div className="wa-contato-modal-rodape">
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setBibliotecaAberta(false)}
                  >
                    {traduzir("Cancelar")}
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
                      {traduzir("Baixar")}
                    </a>
                    <button
                      type="button"
                      className="modal-close-btn"
                      aria-label={traduzir("Fechar")}
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
                  <p className="n">{traduzir("Enviar documento")}</p>
                  <button
                    type="button"
                    className="modal-close-btn"
                    aria-label={traduzir("Cancelar")}
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
                  placeholder={traduzir("Adicionar uma mensagem (opcional)…")}
                  value={legendaDocumento}
                  onChange={(e) => setLegendaDocumento(e.target.value)}
                />
                <div className="wa-contato-modal-rodape">
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setDocumentoComputador(null)}
                  >
                    {traduzir("Cancelar")}
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => documentoInputRef.current?.click()}
                  >
                    {traduzir("Substituir arquivo")}
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
                aria-label={traduzir("Fechar")}
                onClick={() => setLightbox(null)}
              >
                <IconClose width={12} height={12} />
              </button>
              {lightbox.urls.length > 1 ? (
                <button
                  type="button"
                  className="wa-lightbox-nav wa-lightbox-nav-prev"
                  aria-label={traduzir("Imagem anterior")}
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
                  aria-label={traduzir("Próxima imagem")}
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
                  {traduzir("Baixar")}
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
                aria-label={traduzir("Configurações das conversas")}
              >
                <div className="wa-modal-header">
                  <span className="wa-modal-header-icone" aria-hidden="true">
                    <IconConfiguracoes width={18} height={18} />
                  </span>
                  <span className="wa-modal-header-textos">
                    <p className="wa-modal-header-titulo">{traduzir("Configurações das conversas")}</p>
                    <p className="wa-modal-header-desc">
                      {traduzir("Personalize a aparência, a privacidade, os áudios e as notificações.")}
                    </p>
                  </span>
                  <button
                    type="button"
                    className="modal-close-btn"
                    aria-label={traduzir("Fechar")}
                    onClick={pedirFecharConfig}
                  >
                    <IconClose width={12} height={12} />
                  </button>
                </div>

                <div className="wa-config-tabs" role="tablist" aria-label={traduzir("Categorias de configuração")}>
                  {(
                    [
                      { id: "aparencia", label: traduzir("Aparência") },
                      { id: "privacidade", label: traduzir("Privacidade") },
                      { id: "notificacoes", label: traduzir("Notificações") },
                      { id: "preferencias", label: traduzir("Preferências")},
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
                        {traduzir("Fundo da conversa")}
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
                          {traduzir("Aplicar em todas as conversas")}
                        </button>
                        <button
                          type="button"
                          className={`fchip${fundoEscopoForm === "atual" ? " active" : ""}`}
                          onClick={() => setFundoEscopoForm("atual")}
                        >
                          {traduzir("Só nessa conversa")}
                        </button>
                      </div>

                      <p className="hint" style={{ marginBottom: 8 }}>
                        {traduzir("Escolha o fundo")}
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
                              <span className="wa-fundo-rotulo">{traduzir("Padrão")}</span>
                              <span className="wa-fundo-sub">{traduzir("Fundo branco")}</span>
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
                              <span className="wa-fundo-rotulo">{traduzir("Imagem")}</span>
                              <span className="wa-fundo-sub">
                                {fundoAtual.tipo === "imagem" ? traduzir("Trocar imagem") : traduzir("Do computador")}
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
                              <span className="wa-fundo-rotulo">{traduzir("Cor sólida")}</span>
                              <span className="wa-fundo-sub">
                                {fundoAtual.tipo === "cor" ? corEscolhida.toUpperCase() : traduzir("Escolher cor")}
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
                        {traduzir("Intensidade do fundo · {n}%", { n: configRascunho.fundoOpacidade })}
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
                        {traduzir("Restaurar intensidade padrão")}
                      </button>

                      <div className="field" style={{ marginTop: 14 }}>
                        <label>{traduzir("Tamanho da fonte da conversa")}</label>
                        <div className="filters-row">
                          {(
                            [
                              { valor: "pequena", label: "Pequena" },
                              { valor: "media", label: traduzir("Média")},
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
                              {traduzir(op.label)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="field">
                        <label>{traduzir("Densidade das mensagens")}</label>
                        <div className="filters-row">
                          {(
                            [
                              { valor: "confortavel", label: traduzir("Confortável")},
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
                              {traduzir(op.label)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="field">
                        <label>{traduzir("Tema")}</label>
                        <ThemeToggle />
                      </div>
                    </div>
                  ) : null}

                  {configAba === "privacidade" ? (
                    <div className="wa-config-secao">
                      <p className="int-group-h" style={{ padding: 0, marginBottom: 8 }}>
                        {traduzir("Confirmações de leitura")}
                      </p>
                      <div className="wa-config-radio-lista">
                        {(
                          [
                            { valor: "todos", label: traduzir("Ativar para todos os contatos")},
                            { valor: "salvos", label: traduzir("Ativar apenas para números salvos")},
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
                                {traduzir(op.label)}
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
                        {traduzir("O que mostrar nas mensagens")}
                      </p>
                      {(
                        [
                          { chave: "mostrarEstadoEnvio", label: traduzir("Mostrar estado de envio")},
                          { chave: "mostrarEstadoEntrega", label: traduzir("Mostrar estado de entrega")},
                          { chave: "mostrarEstadoLeitura", label: traduzir("Mostrar estado de leitura")},
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
                          <span className="tl">{traduzir(item.label)}</span>
                          <Toggle
                            key={`${item.chave}-${configRascunho[item.chave]}`}
                            defaultOn={configRascunho[item.chave]}
                            label={traduzir(item.label)}
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
                            <span className="wa-config-notif-titulo">{traduzir(item.label)}</span>
                            <span className="wa-config-notif-desc">{traduzir(item.desc)}</span>
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
                          <span className="wa-config-notif-titulo">{traduzir("Notificação do navegador")}</span>
                          <span className="wa-config-notif-desc">
                            {configPermissaoNotificacao === "granted"
                              ? "Permissão concedida: o navegador pode notificar."
                              : configPermissaoNotificacao === "denied"
                                ? "Bloqueada nas configurações do navegador. Libere o site pra ativar."
                                : configPermissaoNotificacao === "indisponivel"
                                  ? "Esse navegador não suporta notificações."
                                  : traduzir("Precisa de permissão do navegador.")}
                          </span>
                        </span>
                        {configPermissaoNotificacao === "granted" ? (
                          <Toggle
                            key={`nav-${configRascunho.notificacaoNavegador}`}
                            defaultOn={configRascunho.notificacaoNavegador}
                            label={traduzir("Notificação do navegador")}
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
                        <label>{traduzir("Som das notificações")}</label>
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
                                {traduzir(s.label)}
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
                            <IconVolume width={13} height={13} /> {traduzir("Testar som")}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {configAba === "preferencias" ? (
                    <div className="wa-config-secao">
                      <div className="field">
                        <label>{traduzir("Tecla Enter")}</label>
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
                                {traduzir("Enter envia · Shift + Enter quebra a linha")}
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
                                {traduzir("Enter quebra a linha · Ctrl/Cmd + Enter envia")}
                              </span>
                            </span>
                          </button>
                        </div>
                      </div>

                      <div className="toggle-row">
                        <span className="tl">{traduzir("Download automático de mídias")}</span>
                        <Toggle
                          key={`download-${configRascunho.downloadAutomatico}`}
                          defaultOn={configRascunho.downloadAutomatico}
                          label={traduzir("Download automático de mídias")}
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
                        <span className="tl">{traduzir("Prévia de links")}</span>
                        <Toggle
                          key={`links-${configRascunho.previaLinks}`}
                          defaultOn={configRascunho.previaLinks}
                          label={traduzir("Prévia de links")}
                          onToggle={(v) => setConfigRascunho((prev) => ({ ...prev, previaLinks: v }))}
                        />
                      </div>
                      <div className="toggle-row">
                        <span className="tl">{traduzir("Reprodução automática de vídeos")}</span>
                        <Toggle
                          key={`autoplay-${configRascunho.autoplayVideos}`}
                          defaultOn={configRascunho.autoplayVideos}
                          label={traduzir("Reprodução automática de vídeos")}
                          onToggle={(v) => setConfigRascunho((prev) => ({ ...prev, autoplayVideos: v }))}
                        />
                      </div>
                      <div className="toggle-row">
                        <span className="tl">{traduzir("Manter painel do contato aberto ao trocar de conversa")}</span>
                        <Toggle
                          key={`painel-${configRascunho.manterPainelContatoAberto}`}
                          defaultOn={configRascunho.manterPainelContatoAberto}
                          label={traduzir("Manter painel do contato aberto")}
                          onToggle={(v) =>
                            setConfigRascunho((prev) => ({ ...prev, manterPainelContatoAberto: v }))
                          }
                        />
                      </div>

                      <div className="field">
                        <label>{traduzir("Velocidade padrão dos áudios")}</label>
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
                    <p>{traduzir("Existem alterações não salvas. O que deseja fazer?")}</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => setConfigConfirmarFechar(false)}
                      >
                        {traduzir("Continuar editando")}
                      </button>
                      <button type="button" className="btn ghost" onClick={descartarEFecharConfig}>
                        {traduzir("Descartar alterações")}
                      </button>
                      <button type="button" className="btn primary" onClick={salvarConfigConversas}>
                        {traduzir("Salvar e fechar")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="wa-modal-footer">
                    <button type="button" className="btn ghost" onClick={pedirFecharConfig}>
                      {traduzir("Cancelar")}
                    </button>
                    <button type="button" className="btn ghost" onClick={restaurarPadraoRascunho}>
                      {traduzir("Restaurar padrões")}
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
                          <IconCheck width={13} height={13} /> {traduzir("Salvo")}
                        </span>
                      ) : configStatusSalvar === "erro" ? (
                        "Tentar novamente"
                      ) : (
                        traduzir("Salvar alterações")
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
                aria-label={traduzir("Enviar contato")}
              >
                <div className="wa-modal-header">
                  <span className="wa-modal-header-icone" aria-hidden="true">
                    <IconContatos width={18} height={18} />
                  </span>
                  <span className="wa-modal-header-textos">
                    <p className="wa-modal-header-titulo">{traduzir("Enviar contato")}</p>
                    <p className="wa-modal-header-desc">{traduzir("Escolha um contato do CRM ou crie um novo para compartilhar nesta conversa.")}</p>
                  </span>
                  <button
                    type="button"
                    className="modal-close-btn"
                    aria-label={traduzir("Fechar")}
                    onClick={fecharContatoPicker}
                  >
                    <IconClose width={12} height={12} />
                  </button>
                </div>

                {contatoPickerEtapa === "lista" ? (
                  <>
                    <div className="wa-config-tabs" role="tablist" aria-label={traduzir("Origem do contato")}>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={contatoPickerAba === "crm"}
                        className={`wa-config-tab${contatoPickerAba === "crm" ? " on" : ""}`}
                        onClick={() => setContatoPickerAba("crm")}
                      >
                        {traduzir("Contatos do CRM")}
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={contatoPickerAba === "criar"}
                        className={`wa-config-tab${contatoPickerAba === "criar" ? " on" : ""}`}
                        onClick={() => setContatoPickerAba("criar")}
                      >
                        {traduzir("Criar contato")}
                      </button>
                    </div>

                    <div className="wa-config-scroll">
                      {contatoPickerAba === "crm" ? (
                        <>
                          <input
                            autoFocus
                            className="input"
                            style={{ width: "100%" }}
                            placeholder={traduzir("Buscar por nome, telefone, e-mail ou empresa…")}
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
                              <option value="">{traduzir("Empresa: todas")}</option>
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
                              <option value="">{traduzir("Etiqueta: todas")}</option>
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
                              <option value="">{traduzir("Responsável: todos")}</option>
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
                              <IconStar width={12} height={12} fill={somenteFavoritosPicker ? "currentColor" : "none"} /> {traduzir("Favoritos")}
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
                                  {traduzir("Limpar seleção")}
                                </button>
                              </div>
                              <div className="wa-contato-picker-tray-lista">
                                {contatosSelecionadosPicker.map((c) => (
                                  <span className="wa-contato-picker-tray-item" key={c.id}>
                                    <span className="avatar">{c.fotoUrl ? <img src={c.fotoUrl} alt="" className="wa-avatar-foto" /> : c.initials}</span>
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
                                {traduzir("Nenhum contato encontrado com esses filtros.")}
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
                                    <span className="avatar">{c.fotoUrl ? <img src={c.fotoUrl} alt="" className="wa-avatar-foto" /> : c.initials}</span>
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
                            <label>{traduzir("Nome *")}</label>
                            <input
                              className="input"
                              style={{ width: "100%" }}
                              value={novoContatoNome}
                              onChange={(e) => setNovoContatoNome(e.target.value)}
                              placeholder={traduzir("Nome")}
                            />
                          </div>
                          <div className="field">
                            <label>{traduzir("Sobrenome")}</label>
                            <input
                              className="input"
                              style={{ width: "100%" }}
                              value={novoContatoSobrenome}
                              onChange={(e) => setNovoContatoSobrenome(e.target.value)}
                            />
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <div className="field" style={{ flex: 1 }}>
                              <label>{traduzir("Empresa")}</label>
                              <input
                                className="input"
                                style={{ width: "100%" }}
                                value={novoContatoEmpresa}
                                onChange={(e) => setNovoContatoEmpresa(e.target.value)}
                              />
                            </div>
                            <div className="field" style={{ flex: 1 }}>
                              <label>{traduzir("Cargo")}</label>
                              <input
                                className="input"
                                style={{ width: "100%" }}
                                value={novoContatoCargo}
                                onChange={(e) => setNovoContatoCargo(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="field">
                            <label>{traduzir("Telefone")}</label>
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
                            <label>{traduzir("E-mail")}</label>
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
                            <label>{traduzir("Observação")}</label>
                            <textarea
                              className="input"
                              style={{ width: "100%", minHeight: 60, resize: "vertical" }}
                              value={novoContatoObservacao}
                              onChange={(e) => setNovoContatoObservacao(e.target.value)}
                            />
                          </div>
                          {novoContatoSucesso ? (
                            <p className="wa-status-inline wa-status-sucesso" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <IconCheck width={13} height={13} /> {traduzir("Contato salvo no CRM")}
                            </p>
                          ) : null}
                        </>
                      )}
                    </div>

                    <div className="wa-modal-footer">
                      <button type="button" className="btn ghost" onClick={fecharContatoPicker}>
                        {traduzir("Cancelar")}
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
                        {traduzir("Prévia: o que vai ser compartilhado")}
                      </p>
                      <div className="wa-contato-previa-lista">
                        {contatosSelecionadosPicker.map((c) => (
                          <div className="wa-contato-previa-card" key={c.id}>
                            <span className="avatar">{c.fotoUrl ? <img src={c.fotoUrl} alt="" className="wa-avatar-foto" /> : c.initials}</span>
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
                        {traduzir("O que compartilhar")}
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
                          <span className="tl">{traduzir(campo.label)}</span>
                          <Toggle
                            key={`${campo.chave}-${previaCampos[campo.chave]}`}
                            defaultOn={previaCampos[campo.chave]}
                            label={traduzir(campo.label)}
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
                        {traduzir("Voltar")}
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
                      aqui e mandaria uma mensagem solta lá. Então a opção nem aparece, em vez de
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
                      <span className="n"><IconCopy width={12} height={12} /> {traduzir("Copiar")}</span>
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
                    <span className="n"><IconEncaminhar width={12} height={12} /> {traduzir("Encaminhar")}</span>
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
                          <IconStar width={12} height={12} fill="currentColor" /> {traduzir("Remover dos favoritos")}
                        </>
                      ) : (
                        <>
                          <IconStar width={12} height={12} fill="none" /> {traduzir("Favoritar")}
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
                      <span className="n"><IconDownload width={12} height={12} /> {traduzir("Baixar")}</span>
                    </button>
                  ) : null}
                  <div className="dropdown-sep" />
                  <button
                    type="button"
                    className="dropdown-item"
                    style={{ width: "100%", textAlign: "left" }}
                    onClick={() => pedirApagar(chave, msg, "para_mim")}
                  >
                    <span className="n"><IconLixeira width={12} height={12} /> {traduzir("Apagar pra mim")}</span>
                  </button>
                  <button
                    type="button"
                    className="dropdown-item"
                    style={{ width: "100%", textAlign: "left" }}
                    onClick={() => pedirApagar(chave, msg, "para_todos")}
                  >
                    <span className="n"><IconLixeira width={12} height={12} /> {traduzir("Apagar pra todos")}</span>
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
                  {traduzir("Encaminhar pra…")}
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
                      <span className="avatar">{c.fotoUrl ? <img src={c.fotoUrl} alt="" className="wa-avatar-foto" /> : c.initials}</span>
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
                      <p className="n">{traduzir("Apagar mensagem")}</p>
                    </div>
                    <p className="hint" style={{ marginBottom: 16 }}>{traduzir("Apagar esta mensagem somente para você? As outras pessoas ainda poderão visualizá-la.")}</p>
                    <div className="section-foot">
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ flex: 1 }}
                        onClick={() => setConfirmarApagar(null)}
                      >
                        {traduzir("Cancelar")}
                      </button>
                      <button
                        type="button"
                        className="btn primary"
                        style={{ flex: 1 }}
                        onClick={confirmarApagarParaMim}
                      >
                        {traduzir("Apagar pra mim")}
                      </button>
                    </div>
                  </>
                ) : !confirmarApagar.elegivel ? (
                  <>
                    <div className="open-conv-h" style={{ padding: 0, marginBottom: 10 }}>
                      <p className="n">{traduzir("Não é possível apagar pra todos")}</p>
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
                        {traduzir("Entendi")}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="open-conv-h" style={{ padding: 0, marginBottom: 10 }}>
                      <p className="n">{traduzir("Apagar pra todos")}</p>
                    </div>
                    <p className="hint" style={{ marginBottom: 16 }}>{traduzir("Apaga esta mensagem pra quem visualizar essa conversa no CRM. Não recolhe a mensagem do lado do contato no WhatsApp. Isso depende de um recurso que a integração conectada ainda não oferece.")}</p>
                    <div className="section-foot">
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ flex: 1 }}
                        onClick={() => setConfirmarApagar(null)}
                      >
                        {traduzir("Cancelar")}
                      </button>
                      <button
                        type="button"
                        className="btn primary"
                        style={{ flex: 1 }}
                        onClick={confirmarApagarParaTodos}
                      >
                        {traduzir("Apagar pra todos")}
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
                  <p className="n">{traduzir("Detalhes da mensagem")}</p>
                  <button
                    type="button"
                    className="modal-close-btn"
                    aria-label={traduzir("Fechar")}
                    onClick={() => setDetalhesMensagem(null)}
                  >
                    <IconClose width={12} height={12} />
                  </button>
                </div>
                <div className="wa-msg-detalhes-lista">
                  <div className="wa-msg-detalhes-item">
                    <span className="rotulo">{traduzir("Identificador")}</span>
                    <span className="valor">{detalhesMensagem.msg.id ?? detalhesMensagem.chave}</span>
                  </div>
                  <div className="wa-msg-detalhes-item">
                    <span className="rotulo">{traduzir("Canal")}</span>
                    <span className="valor">{aberta.canal}</span>
                  </div>
                  {detalhesMensagem.msg.criadoEm ? (
                    <div className="wa-msg-detalhes-item">
                      <span className="rotulo">{traduzir("Criada")}</span>
                      <span className="valor">
                        {new Date(detalhesMensagem.msg.criadoEm).toLocaleString(localeNumero)}
                      </span>
                    </div>
                  ) : null}
                  {detalhesMensagem.msg.tipo === "out" && detalhesMensagem.msg.status ? (
                    <div className="wa-msg-detalhes-item">
                      <span className="rotulo">{traduzir("Status")}</span>
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
                      <span className="rotulo">{traduzir("Motivo do erro")}</span>
                      <span className="valor">{detalhesMensagem.msg.erro}</span>
                    </div>
                  ) : null}
                  {detalhesMensagem.msg.apagadaParaTodos ? (
                    <div className="wa-msg-detalhes-item">
                      <span className="rotulo">{traduzir("Apagada")}</span>
                      <span className="valor">{traduzir("Pra todos")}</span>
                    </div>
                  ) : null}
                  <div className="wa-msg-detalhes-item">
                    <span className="rotulo">{traduzir("Hora exibida")}</span>
                    <span className="valor">{detalhesMensagem.msg.hora || "-"}</span>
                  </div>
                </div>
                <p className="hint" style={{ marginTop: 12 }}>
                  {traduzir("Etapas que o canal conectado não fornecer não aparecem aqui.")}
                </p>
              </div>
            </div>
          ) : null}

          {audioConfirmarDescarte ? (
            <div className="form-preview-overlay" onClick={() => setAudioConfirmarDescarte(false)}>
              <div className="wa-email-modal wa-contato-modal" onClick={(e) => e.stopPropagation()}>
                <div className="open-conv-h" style={{ padding: 0, marginBottom: 10 }}>
                  <p className="n">{traduzir("Excluir essa gravação?")}</p>
                </div>
                <p className="hint" style={{ marginBottom: 16 }}>{traduzir("Essa gravação tem mais de 20 segundos. Ao excluir, o áudio não vai ser enviado e não dá pra desfazer.")}</p>
                <div className="section-foot">
                  <button
                    type="button"
                    className="btn ghost"
                    style={{ flex: 1 }}
                    onClick={() => setAudioConfirmarDescarte(false)}
                  >
                    {traduzir("Cancelar")}
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    style={{ flex: 1 }}
                    onClick={descartarGravacao}
                  >
                    {traduzir("Excluir gravação")}
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
                  <p className="s">{traduzir("Contato compartilhado")}</p>
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  aria-label={traduzir("Fechar")}
                  onClick={() => setContatoDetalheAberto(null)}
                >
                  <IconClose width={12} height={12} />
                </button>
              </div>
              <div className="wa-contato-detalhe-corpo">
                <span className="avatar wa-contato-detalhe-avatar">{contatoDetalheAberto.fotoUrl ? <img src={contatoDetalheAberto.fotoUrl} alt="" className="wa-avatar-foto" /> : contatoDetalheAberto.initials}</span>
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
                  <p className="hint">{traduzir("Sem número de WhatsApp cadastrado")}</p>
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
                    <IconConversas width={13} height={13} /> {traduzir("Conversar no WhatsApp")}
                  </span>
                </a>
              ) : null}
              {/*
                * SALVAR NA AGENDA DO CRM.
                *
                * A tela de Contatos passou a mostrar só quem a equipe guardou de propósito (ver
                * `contatos/salvos.ts`), e sem este botão não haveria por onde guardar: o registro
                * de quem escreveu nasce sozinho, no bastidor, e nunca passa por uma tela.
                *
                * É diferente do "Baixar cartão" logo abaixo, que manda o contato pra agenda do
                * CELULAR. Este fica no CRM, e é o que a equipe inteira enxerga.
                */}
              <button
                type="button"
                className="btn primary block mb14"
                onClick={() => salvarNosContatos(contatoDetalheAberto)}
                disabled={salvandoContato}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <IconSalvar width={13} height={13} />{" "}
                {salvandoContato ? traduzir("Salvando…") : traduzir("Salvar nos contatos")}
              </button>
              <button
                type="button"
                className="btn ghost block"
                onClick={() => salvarContatoVcf(contatoDetalheAberto)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <IconSalvar width={13} height={13} /> {traduzir("Baixar cartão (.vcf)")}
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
                <div key={traduzir(cat.titulo)}>
                  <p className="chat-emoji-categoria">{traduzir(cat.titulo)}</p>
                  <div className="chat-emoji-grid">
                    {cat.emojis.map((emoji, i) => (
                      <button
                        type="button"
                        key={`${traduzir(cat.titulo)}-${i}`}
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
          title={traduzir("Arraste pra redimensionar")}
        />
        <aside className="wa-info" style={{ width: infoWidth }}>
          <div className="wa-info-tabs" role="tablist" aria-label={traduzir("Painel do contato")}>
            {(
              [
                /*
                 * CONTATO PRIMEIRO, RESUMO POR ÚLTIMO.
                 *
                 * O Resumo é leitura: foto, nome, uns números. Quem atende passa o dia em CONTATO
                 * — responsável, origem, valor, agendamento — e era a segunda aba, ou seja, um
                 * clique a mais em toda conversa. A primeira aba é a que abre; ela tem que ser a
                 * de trabalho, não a de vitrine.
                 */
                { id: "contato", label: "Contato" },
                { id: "negociacao", label: "Negociação" },
                { id: "atividades", label: "Atividades" },
                { id: "historico", label: "Histórico" },
                { id: "resumo", label: "Resumo" },
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
                <span className="avatar wa-resumo-avatar">{aberta.fotoUrl ? <img src={aberta.fotoUrl} alt="" className="wa-avatar-foto" /> : iniciaisExibidas(aberta.nome, aberta.initials, aberta.canal)}</span>
                <p className="wa-resumo-nome">{nomeExibido(aberta.nome, aberta.canal)}</p>
                {contatoDaConversa?.empresa ? (
                  <p className="wa-resumo-empresa">{contatoDaConversa.empresa}</p>
                ) : null}
                <div className="wa-resumo-grid">
                  <span className="wa-resumo-label">
                    {aberta.canal === "Instagram" ? "Instagram" : "Telefone"}
                  </span>
                  <span className="wa-resumo-valor">
                    {aberta.canal === "Instagram"
                      ? // O @ mora em `nome`. Enquanto ele não foi resolvido, a lista mostra um
                        // rótulo neutro (ver `nomeExibido`). Mas o id interno da thread continua
                        // existindo, e é AQUI que ele aparece: escondido da vitrine, à mão pra quem
                        // precisar dele num suporte.
                        aberta.nome.startsWith("@")
                        ? aberta.nome
                        : `sem @ · id ${aberta.nome}`
                      : contatoDaConversa?.whatsapp || aberta.contato}
                  </span>
                  <span className="wa-resumo-label">{traduzir("E-mail")}</span>
                  <span className="wa-resumo-valor">{contatoDaConversa?.email || "-"}</span>
                  <span className="wa-resumo-label">{traduzir("Responsável")}</span>
                  <span className="wa-resumo-valor">{aberta.atendenteSelecionado ?? ""}</span>
                  <span className="wa-resumo-label">Funil · Etapa</span>
                  <span className="wa-resumo-valor">
                    {funilSelecionado ? `${funilSelecionado.nome} · ${etapaSelecionada}` : ""}
                  </span>
                  <span className="wa-resumo-label">{traduzir("Origem")}</span>
                  <span className="wa-resumo-valor">{aberta.origem}</span>
                  <span className="wa-resumo-label">{traduzir("Última interação")}</span>
                  <span className="wa-resumo-valor">
                    {rotuloDeConversa(new Date(aberta.ultimaMensagemEm ?? aberta.atualizadoEm), new Date(), traduzir, localeNumero)}
                  </span>
                  <span className="wa-resumo-label">{traduzir("Situação")}</span>
                  <span className="wa-resumo-valor">{aberta.status}</span>
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
                <h4>{traduzir("Ações rápidas")}</h4>
              </div>
              <div className="wa-acoes-rapidas">
                <button
                  type="button"
                  className="wa-acao-rapida"
                  onClick={() => setAbaInfo("atividades")}
                >
                  <IconCalendar width={13} height={13} /> {traduzir("Registrar atividade")}
                </button>
                <button
                  type="button"
                  className="wa-acao-rapida"
                  onClick={() => {
                    setMensagemTexto("//");
                    mensagemInputRef.current?.focus();
                  }}
                >
                  <IconAutomacoes width={13} height={13} /> {traduzir("Executar automação")}
                </button>
                <button
                  type="button"
                  className="wa-acao-rapida"
                  onClick={() => setAbaInfo("contato")}
                >
                  <IconEtiqueta width={13} height={13} /> {traduzir("Adicionar etiqueta")}
                </button>
                <button
                  type="button"
                  className="wa-acao-rapida"
                  onClick={(e) => {
                    setTrocandoResponsavel((v) => !v);
                    e.currentTarget.scrollIntoView({ block: "nearest" });
                  }}
                >
                  <IconContatos width={13} height={13} /> {traduzir("Trocar responsável")}
                </button>
                <button
                  type="button"
                  className="wa-acao-rapida"
                  onClick={(e) => abrirMenuResultado(e.currentTarget.getBoundingClientRect())}
                >
                  <IconAlvo width={13} height={13} /> {traduzir("Registrar resultado")}
                </button>
              </div>

              {trocandoResponsavel ? (
                <div className="field">
                  <label>{traduzir("Novo responsável")}</label>
                  <select
                    className="input"
                    style={{ width: "100%", cursor: "pointer" }}
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) trocarResponsavelRapido(e.target.value);
                    }}
                  >
                    <option value="" disabled>
                      {traduzir("Escolha um atendente")}
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
                      <IconCheck width={12} height={12} /> {traduzir("Venda concluída")}
                    </>
                  ) : resultadoAtual === "perda" ? (
                    <>
                      <IconErro width={12} height={12} /> Perdida · {motivoPerdaPorContato[aberta.nome] ?? ""}
                    </>
                  ) : resultadoAtual === "adiada" ? (
                    <>
                      <IconRelogio width={12} height={12} /> {traduzir("Adiada")}
                    </>
                  ) : (
                    <>
                      <IconProibido width={12} height={12} /> {traduzir("Cancelada")}
                    </>
                  )}
                </p>
              ) : null}
            </>
          ) : null}

          {abaInfo === "contato" ? (
            /*
              O MESMO PAINEL DO FUNIL. Ver `DadosDoContato`.
              
              Eram duas telas pro mesmo registro — treze campos aqui, quatro lá — e preencher
              "cargo" numa e abrir a outra dava a impressão de que o CRM tinha perdido o dado.
              
              `key` no nome: trocar de conversa remonta o painel e zera o rascunho de edição de
              uma vez, sem uma lista de `setX` que envelhece a cada campo novo.
            */
            <DadosDoContato
              key={aberta.nome}
              nome={aberta.nome}
              canal={aberta.canal}
              aoRegistrarNoHistorico={(texto) => adicionarHistorico("sistema", texto)}
            />
          ) : null}

          {abaInfo === "negociacao" ? (
            <>
              <div className="panel-h">
                <h4>{traduzir("Funil e etapa")}</h4>
              </div>
              <div className="field">
                <label>{traduzir("Funil")}</label>
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
                  {traduzir("Salvar atribuição ao funil")}
                </button>
              </div>

              <div className="panel-h divided">
                <h4>{traduzir("Resultado")}</h4>
              </div>
              <div style={{ padding: "0 17px 14px" }}>
                {resultadoAtual ? (
                  <p
                    className={`wa-resultado-badge wa-resultado-${resultadoAtual}`}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    {resultadoAtual === "venda" ? (
                      <>
                        <IconCheck width={12} height={12} /> {traduzir("Venda concluída")}
                      </>
                    ) : resultadoAtual === "perda" ? (
                      <>
                        <IconErro width={12} height={12} /> Perdida · {motivoPerdaPorContato[aberta.nome] ?? ""}
                      </>
                    ) : resultadoAtual === "adiada" ? (
                      <>
                        <IconRelogio width={12} height={12} /> {traduzir("Adiada")}
                      </>
                    ) : (
                      <>
                        <IconProibido width={12} height={12} /> {traduzir("Cancelada")}
                      </>
                    )}
                  </p>
                ) : (
                  <p className="hint" style={{ marginBottom: 10 }}>
                    {traduzir("Nenhum resultado registrado ainda: em andamento.")}
                  </p>
                )}
                {/*
                  AS CINCO OPÇÕES À MOSTRA, e não atrás de um botão que abre um menu.
                  
                  Era "Registrar resultado" → menu flutuante → escolher. Dois cliques e uma camada
                  pra uma decisão de cinco opções que cabem na tela: este painel existe justamente
                  pra registrar o desfecho, então esconder o desfecho atrás de um botão é esconder
                  a própria função da aba. O menu continua existindo nas ações rápidas, onde o
                  espaço é de uma linha só.
                */}
                <div className="wa-resultado-opcoes">
                  {OPCOES_DE_RESULTADO.map(({ chave, rotulo, Icone }) => (
                    <button
                      key={chave}
                      type="button"
                      className="wa-resultado-opcao"
                      onClick={() => escolherResultado(chave)}
                    >
                      <Icone width={13} height={13} aria-hidden="true" />
                      {traduzir(rotulo)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {abaInfo === "atividades" ? (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "14px 17px 0" }}>
                <button
                  type="button"
                  className="btn ghost"
                  style={{ flex: "1 1 140px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  onClick={abrirEmailModal}
                >
                  <IconEmail width={13} height={13} /> {traduzir("Disparar e-mail")}
                </button>
              </div>

              {emailsDaConversa.length > 0 ? (
                <>
                  <div className="panel-h divided">
                    <h4>{traduzir("E-mails enviados")}</h4>
                  </div>
                  {emailsDaConversa.map((email) => (
                    <div className="stat-row" key={email.id}>
                      <span className="sl">{email.assunto}</span>
                      <span className={`sv${email.aberto ? " wa-email-lido" : ""}`}>
                        {email.aberto ? `Lido às ${email.abertoEm}` : traduzir("Enviado, ainda não lido")}
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
                  placeholder={traduzir("Escreva uma anotação sobre esse contato…")}
                  value={notaTexto}
                  onChange={(e) => setNotaTexto(e.target.value)}
                />
                <button
                  type="button"
                  className="btn ghost block mt14"
                  onClick={salvarAnotacao}
                  disabled={!notaTexto.trim()}
                >{traduzir("+ Salvar anotação")}</button>
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
          {OPCOES_DE_RESULTADO.map(({ chave, rotulo, Icone }) => (
            <button
              key={chave}
              type="button"
              className="dropdown-item"
              style={{ width: "100%", textAlign: "left" }}
              onClick={() => escolherResultado(chave)}
            >
              <span className="n">
                <Icone width={12} height={12} /> {traduzir(rotulo)}
              </span>
            </button>
          ))}
        </FloatingDropdown>
      ) : null}

      {formResultado === "venda" ? (
        <div className="form-preview-overlay" onClick={() => setFormResultado(null)}>
          <div className="wa-email-modal wa-contato-modal" onClick={(e) => e.stopPropagation()}>
            <div className="open-conv-h" style={{ padding: 0, marginBottom: 14 }}>
              <p className="n">{traduzir("Venda concluída")}</p>
              <button
                type="button"
                className="modal-close-btn"
                aria-label={traduzir("Fechar")}
                onClick={() => setFormResultado(null)}
              >
                <IconClose width={12} height={12} />
              </button>
            </div>
            <div className="field" style={{ padding: "0 0 10px" }}>
              <label>{traduzir("Produto/serviço")}</label>
              <input
                className="input"
                style={{ width: "100%" }}
                value={vendaProduto}
                onChange={(e) => setVendaProduto(e.target.value)}
                placeholder={traduzir("Ex.: Plano premium")}
              />
            </div>
            <div style={{ display: "flex", gap: 8, padding: "0 0 10px" }}>
              <div className="field" style={{ flex: 1, padding: 0 }}>
                <label>{traduzir("Valor")}</label>
                <input
                  className="input"
                  style={{ width: "100%" }}
                  value={vendaValor}
                  onChange={(e) => setVendaValor(e.target.value)}
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="field" style={{ flex: 1, padding: 0 }}>
                <label>{traduzir("Forma de pagamento")}</label>
                <select
                  className="input"
                  style={{ width: "100%", cursor: "pointer" }}
                  value={vendaFormaPagamento}
                  onChange={(e) => setVendaFormaPagamento(e.target.value)}
                >
                  <option value="Pix">{traduzir("Pix")}</option>
                  <option value="Cartão de crédito">{traduzir("Cartão de crédito")}</option>
                  <option value="Boleto">{traduzir("Boleto")}</option>
                  <option value="Dinheiro">{traduzir("Dinheiro")}</option>
                </select>
              </div>
            </div>
            <div className="field" style={{ padding: "0 0 10px" }}>
              <label>{traduzir("Observação")}</label>
              <textarea
                className="input"
                style={{ width: "100%", minHeight: 60, resize: "vertical" }}
                value={vendaObservacao}
                onChange={(e) => setVendaObservacao(e.target.value)}
                placeholder={traduzir("Detalhes opcionais sobre a venda…")}
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
                {traduzir("Cancelar")}
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
              <p className="n">{traduzir("Negociação perdida")}</p>
              <button
                type="button"
                className="modal-close-btn"
                aria-label={traduzir("Fechar")}
                onClick={() => setFormResultado(null)}
              >
                <IconClose width={12} height={12} />
              </button>
            </div>
            <p className="hint" style={{ marginBottom: 10 }}>{traduzir("Escolha o motivo da perda:")}</p>
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
                  placeholder={traduzir("Descreva o motivo…")}
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
              <p className="n">{traduzir("Negociação adiada")}</p>
              <button
                type="button"
                className="modal-close-btn"
                aria-label={traduzir("Fechar")}
                onClick={() => setFormResultado(null)}
              >
                <IconClose width={12} height={12} />
              </button>
            </div>
            <div className="field" style={{ padding: "0 0 10px" }}>
              <label>{traduzir("Nova data prevista")}</label>
              <SeletorDeData valor={adiadaData} onChange={setAdiadaData} className="seletor-data-largo" />
            </div>
            <div className="field" style={{ padding: "0 0 10px" }}>
              <label>{traduzir("Observação")}</label>
              <textarea
                className="input"
                style={{ width: "100%", minHeight: 60, resize: "vertical" }}
                value={adiadaObservacao}
                onChange={(e) => setAdiadaObservacao(e.target.value)}
                placeholder={traduzir("Motivo do adiamento…")}
              />
            </div>
            <div className="section-foot">
              <button
                type="button"
                className="btn ghost"
                style={{ flex: 1 }}
                onClick={() => setFormResultado(null)}
              >
                {traduzir("Cancelar")}
              </button>
              <button
                type="button"
                className="btn primary"
                style={{ flex: 1 }}
                onClick={confirmarAdiada}
              >
                {traduzir("Confirmar adiamento")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {formResultado === "cancelada" ? (
        <div className="form-preview-overlay" onClick={() => setFormResultado(null)}>
          <div className="wa-email-modal wa-contato-modal" onClick={(e) => e.stopPropagation()}>
            <div className="open-conv-h" style={{ padding: 0, marginBottom: 14 }}>
              <p className="n">{traduzir("Negociação cancelada")}</p>
              <button
                type="button"
                className="modal-close-btn"
                aria-label={traduzir("Fechar")}
                onClick={() => setFormResultado(null)}
              >
                <IconClose width={12} height={12} />
              </button>
            </div>
            <div className="field" style={{ padding: "0 0 10px" }}>
              <label>{traduzir("Motivo do cancelamento")}</label>
              <textarea
                className="input"
                style={{ width: "100%", minHeight: 60, resize: "vertical" }}
                value={canceladaMotivo}
                onChange={(e) => setCanceladaMotivo(e.target.value)}
                placeholder={traduzir("Por que a negociação foi cancelada…")}
              />
            </div>
            <div className="section-foot">
              <button
                type="button"
                className="btn ghost"
                style={{ flex: 1 }}
                onClick={() => setFormResultado(null)}
              >
                {traduzir("Cancelar")}
              </button>
              <button
                type="button"
                className="btn primary"
                style={{ flex: 1 }}
                onClick={confirmarCancelada}
              >
                {traduzir("Confirmar cancelamento")}
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
              <p className="n">{traduzir("Novo e-mail")}</p>
              <p className="s">Pra {aberta.nome}</p>
            </div>
            <button
              type="button"
              className="modal-close-btn"
              aria-label={traduzir("Fechar")}
              onClick={fecharEmailModal}
            >
              <IconClose width={12} height={12} />
            </button>
          </div>
            <div className="field" style={{ padding: "10px 0" }}>
              <label>{traduzir("Para")}</label>
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
              <label>{traduzir("Assunto")}</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="text"
                value={emailAssunto}
                onChange={(e) => setEmailAssunto(e.target.value)}
                placeholder={traduzir("Ex.: Sobre sua consulta")}
              />
            </div>
            <div className="field" style={{ padding: "10px 0" }}>
              <label>{traduzir("Mensagem")}</label>
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
                  <option value="2">{traduzir("Pequeno")}</option>
                  <option value="3">{traduzir("Médio")}</option>
                  <option value="5">{traduzir("Grande")}</option>
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
                {traduzir("Disparar e-mail")}
              </button>
            </div>

            {emailsDaConversa.length > 0 ? (
              <>
                <div className="panel-h divided">
                  <h4>{traduzir("Rastreamento")}</h4>
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
                        {email.aberto ? `Lido às ${email.abertoEm}` : traduzir("Enviado, ainda não lido")}
                      </span>
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ padding: "4px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                        onClick={() => verificarRastreamento(email)}
                      >
                        <IconRefresh width={11} height={11} /> {traduzir("Verificar")}
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
              <p className="n">{traduzir("Mídias e arquivos")}</p>
              <p className="s">Trocados com {aberta.nome}</p>
            </div>
            <button
              type="button"
              className="modal-close-btn"
              aria-label={traduzir("Fechar")}
              onClick={() => setMidiasAberto(false)}
            >
              <IconClose width={12} height={12} />
            </button>
          </div>
          <p className="hint" style={{ padding: "10px 0" }}>
            {traduzir("Nenhuma mídia trocada nessa conversa ainda.")}
          </p>
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
              <p className="n">{traduzir("Dados do grupo")}</p>
            </div>
            <button
              type="button"
              className="modal-close-btn"
              aria-label={traduzir("Fechar")}
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
              <p className="wa-dados-grupo-descricao hint">{traduzir("Esse grupo ainda não tem descrição.")}</p>
            )}
            {aberta.criacaoGrupo ? (
              <p className="wa-dados-grupo-criado">
                Grupo criado em{" "}
                {new Date(aberta.criacaoGrupo).toLocaleDateString(localeNumero, {
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
                {traduzir("Participantes")}
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
              <p className="n">{traduzir("Participantes")}</p>
              <p className="s">{aberta.participantesGrupo?.length ?? 0} pessoas em {aberta.nome}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {/*
                Perguntar de novo quem está no grupo.
                
                A lista é guardada na primeira vez que o grupo aparece e nunca mais — então ela
                envelhece: quem entrou depois não aparece, quem saiu continua aparecendo. Sem este
                botão, a única saída era esperar que alguém mandasse mensagem.
              */}
              <button
                type="button"
                className="btn"
                style={{ fontSize: 12, padding: "4px 8px" }}
                disabled={atualizandoParticipantes}
                onClick={async () => {
                  setAtualizandoParticipantes(true);
                  setErroParticipantes(null);
                  try {
                    const resposta = await fetch(
                      `/api/conversas/${encodeURIComponent(aberta.id)}/participantes`,
                      {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ forcar: true }),
                      },
                    );
                    const dados = (await resposta.json().catch(() => null)) as
                      | { participantesGrupo?: unknown[]; erro?: string }
                      | null;
                    if (dados?.erro) setErroParticipantes(dados.erro);
                    if (dados?.participantesGrupo?.length) recarregarConversas();
                  } catch (erro) {
                    console.error("Falha ao atualizar participantes do grupo:", erro);
                    setErroParticipantes(traduzir("Não deu pra falar com o WhatsApp agora."));
                  } finally {
                    setAtualizandoParticipantes(false);
                  }
                }}
              >
                {atualizandoParticipantes ? traduzir("Atualizando…") : traduzir("Atualizar")}
              </button>
              <button
                type="button"
                className="modal-close-btn"
                aria-label={traduzir("Fechar")}
                onClick={() => setParticipantesAberto(false)}
              >
                <IconClose width={12} height={12} />
              </button>
            </div>
          </div>
          {erroParticipantes ? (
            <p className="hint" style={{ padding: "6px 0 0" }}>
              {erroParticipantes}
            </p>
          ) : null}
          {aberta.participantesGrupo?.length ? (
            <div className="wa-participantes-lista">
              {aberta.participantesGrupo.map((p) => {
                const quem = identificar(p);
                return (
                  <button
                    type="button"
                    className="wa-participante-linha"
                    key={quem.identificador}
                    onClick={() => {
                      setParticipantesAberto(false);
                      setParticipanteAberto(p);
                    }}
                  >
                    <span className="avatar" style={{ width: 32, height: 32, fontSize: 13 }}>
                      {quem.temNomeReal
                        ? quem.nome
                            .split(" ")
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((parte) => parte[0])
                            .join("")
                            .toUpperCase()
                        : "?"}
                    </span>
                    <div className="wa-participante-info">
                      <p className="n">{quem.nome}</p>
                      {/*
                        A segunda linha só existe quando tem o que dizer.
                        
                        Antes ela repetia o identificador embaixo do identificador — a mesma coisa
                        duas vezes, uma delas fingindo ser telefone. Sem nome e sem telefone, o
                        honesto é dizer que ainda não dá pra saber quem é.
                      */}
                      <p className="s">
                        {quem.telefone ?? (quem.temNomeReal ? "" : traduzir("Ainda não identificado"))}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="hint" style={{ padding: "10px 0" }}>
              {traduzir("Lista de participantes ainda não disponível.")}
            </p>
          )}
        </div>
      ) : null}

      {/*
        O CARTÃO DA PESSOA, no meio da tela.
        
        Era uma caixinha flutuante com o mesmo desenho dos painéis auxiliares do CRM. Mas isto aqui
        não é painel auxiliar: é a ficha de uma pessoa, o mesmo gesto do WhatsApp quando se toca num
        participante — e lá ela abre centralizada, com a foto grande, o nome, o número e o que dá
        pra fazer com aquela pessoa. Reusa o `Modal` que o CRM já tem (fecha com Esc e com clique no
        fundo), pra não nascer um terceiro jeito de abrir janela nesta tela.
        
        O QUE NÃO ESTÁ AQUI, e é de propósito: o WhatsApp mostra "Vídeo" ao lado de "Conversar" e
        "Ligar". O CRM não faz chamada de vídeo. Um botão que não liga pra lugar nenhum é enfeite, e
        enfeite não entra.
      */}
      <Modal
        aberto={participanteAberto !== null}
        onFechar={() => setParticipanteAberto(null)}
        titulo={traduzir("Contato")}
        largura={380}
      >
        {participanteAberto
          ? (() => {
              const quem = identificar(participanteAberto);
              const conversaDele = quem.telefone
                ? conversaIndividualDoParticipante(participanteAberto.telefone)
                : null;
              /*
               * Os grupos que esta pessoa e a empresa têm em comum — a mesma seção que o WhatsApp
               * mostra, e com dado de verdade: sai das conversas de grupo do próprio CRM que têm
               * este identificador na lista de participantes.
               *
               * Procura pelos DOIS identificadores porque um grupo pode ter guardado o telefone e
               * outro o LID, dependendo de quando ele foi cadastrado.
               */
              const gruposEmComum = conversas.filter(
                (c) =>
                  c.ehGrupo &&
                  c.id !== aberta.id &&
                  c.participantesGrupo?.some((p) => p.telefone === quem.identificador),
              );
              const iniciais = quem.temNomeReal
                ? quem.nome
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p) => p[0])
                    .join("")
                    .toUpperCase()
                : "?";

              return (
                <div className="wa-ficha-pessoa">
                  <div className="avatar wa-ficha-foto">
                    {carregandoFotoParticipante ? (
                      <span className="wa-participante-foto-carregando" />
                    ) : fotoParticipante ? (
                      <img src={fotoParticipante} alt="" className="wa-avatar-foto" />
                    ) : (
                      iniciais
                    )}
                  </div>

                  <p className="wa-ficha-nome">{quem.nome}</p>

                  {/* O número só aparece quando É número. O identificador de grupo do WhatsApp tem
                      cara de telefone e não é: escrevê-lo aqui, onde todo mundo lê "o número desta
                      pessoa", seria mostrar um número que não existe. */}
                  <p className="wa-ficha-numero">
                    {quem.telefone ?? traduzir("O WhatsApp não informou o número desta pessoa.")}
                  </p>

                  {quem.telefone ? (
                    <div className="wa-ficha-acoes">
                      <button
                        type="button"
                        className="wa-ficha-acao"
                        disabled={criandoConversaParticipante}
                        onClick={async () => {
                          if (conversaDele) {
                            setSelectedId(conversaDele.id);
                            setParticipanteAberto(null);
                            return;
                          }
                          setCriandoConversaParticipante(true);
                          try {
                            const nova = await criarConversaIndividual(
                              quem.nome,
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
                        <IconConversas width={20} height={20} />
                        <span>{criandoConversaParticipante ? traduzir("Abrindo…") : traduzir("Conversar")}</span>
                      </button>
                      <a
                        className="wa-ficha-acao"
                        href={`tel:+${participanteAberto.telefone.replace(/\D/g, "")}`}
                      >
                        <IconTelefone width={20} height={20} />
                        <span>{traduzir("Ligar")}</span>
                      </a>
                    </div>
                  ) : null}

                  {gruposEmComum.length ? (
                    <div className="wa-ficha-secao">
                      <p className="wa-ficha-secao-titulo">
                        {gruposEmComum.length} {traduzir("grupos em comum")}
                      </p>
                      {gruposEmComum.map((g) => (
                        <button
                          type="button"
                          key={g.id}
                          className="wa-ficha-grupo"
                          onClick={() => {
                            setSelectedId(g.id);
                            setParticipanteAberto(null);
                          }}
                        >
                          <span className="avatar" style={{ width: 34, height: 34, fontSize: 13 }}>
                            {g.fotoUrl ? (
                              <img src={g.fotoUrl} alt="" className="wa-avatar-foto" />
                            ) : (
                              g.initials
                            )}
                          </span>
                          <span className="wa-ficha-grupo-nome">{g.nome}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })()
          : null}
      </Modal>


      {respostasGerenciarAberto ? (
        <div
          ref={respostasModalRef}
          className="wa-respostas-modal"
          style={respostasPos ? { left: respostasPos.x, top: respostasPos.y } : undefined}
        >
          <div className="wa-email-drag" onMouseDown={iniciarArrasteRespostas}>
            <div>
              <p className="n">{traduzir("Respostas rápidas")}</p>
              <p className="s">Só valem pro funil &quot;{funilSelecionado.nome}&quot;</p>
            </div>
            <button
              type="button"
              className="modal-close-btn"
              aria-label={traduzir("Fechar")}
              onClick={() => setRespostasGerenciarAberto(false)}
            >
              <IconClose width={12} height={12} />
            </button>
          </div>

          <div className="panel-h" style={{ padding: "0 0 8px" }}>
            <h4>{traduzir("Nova resposta rápida")}</h4>
          </div>
          <div className="field" style={{ padding: "0 0 8px" }}>
            <label>{traduzir("Título")}</label>
            <input
              className="input"
              style={{ width: "100%" }}
              placeholder={traduzir("Ex.: Boas-vindas")}
              value={novaRespostaTitulo}
              onChange={(e) => setNovaRespostaTitulo(e.target.value)}
            />
          </div>
          <div className="field" style={{ padding: "0 0 10px" }}>
            <label>{traduzir("Texto")}</label>
            <textarea
              className="input"
              style={{ width: "100%", minHeight: 60, resize: "vertical" }}
              placeholder={traduzir("Escreva a mensagem completa…")}
              value={novaRespostaTexto}
              onChange={(e) => setNovaRespostaTexto(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn primary block"
            onClick={criarRespostaRapida}
            disabled={!novaRespostaTitulo.trim() || !novaRespostaTexto.trim()}
          >{traduzir("+ Criar nova resposta rápida")}</button>

          <div className="panel-h" style={{ padding: "14px 0 8px" }}>
            <h4>{traduzir("Salvas")}</h4>
          </div>
          {respostasDoFunil.length === 0 ? (
            <p className="hint" style={{ padding: "0 0 10px" }}>
              {traduzir("Nenhuma resposta rápida salva pra esse funil ainda.")}
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
