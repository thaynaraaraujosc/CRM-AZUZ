/**
 * Contratos conceituais pra integração futura do módulo de Conversas com o
 * back-end e com as APIs oficiais dos canais (WhatsApp/Instagram/TikTok).
 *
 * Nada aqui é chamado hoje — são os formatos que os componentes visuais e o
 * estado do front-end já assumem, documentados num lugar só, pra quando o
 * engenheiro de back-end for implementar as rotas reais. Quando isso
 * acontecer, a ideia é que só a camada de serviço (as funções `async` como
 * `enviarAudioGravado`, `confirmarApagarParaTodos`, `confirmarEnvioContatos`,
 * `salvarConfigConversas` em `conversas/page.tsx`) precise trocar o corpo —
 * os tipos abaixo já batem com o que essas funções produzem/consomem.
 */

/* -------------------------------------------------------------------------- */
/* Áudio                                                                      */
/* -------------------------------------------------------------------------- */

export type EstadoUploadAudio =
  | "vazio"
  | "gravando"
  | "pausado"
  | "processando"
  | "pronto_pra_enviar"
  | "enviando"
  | "erro";

export type EstadoReproducaoAudio = "nao_reproduzido" | "reproduzido";

/**
 * Corpo que o front-end monta hoje em memória (blob local + waveform
 * calculada por decodeAudioData) e que, com back-end, vira upload real antes
 * de criar a mensagem.
 */
export type AudioAnexoContrato = {
  /** Id local, gerado no front-end antes do upload — usado pra rastrear o card de progresso até o back-end confirmar. */
  idLocal: string;
  /** Depois do upload, o back-end troca a URL local (blob:) pela URL definitiva de storage. */
  arquivo: { url: string; mimeType: string; tamanhoBytes: number };
  duracaoSegundos: number;
  /** Picos de amplitude 0–1, calculados no front-end — reaproveitados como estão, sem precisar reprocessar no servidor. */
  formaDeOnda: number[];
  estadoUpload: EstadoUploadAudio;
  estadoMensagem: EstadoMensagemContrato;
  estadoReproducao: EstadoReproducaoAudio;
  criadoEm: string;
  enviadoEm?: string;
  entregueEm?: string;
  lidoEm?: string;
  /** Só populado por confirmação real do canal/webhook — nunca setado a partir de o próprio remetente ter ouvido o áudio. */
  reproduzidoEm?: string;
};

/* -------------------------------------------------------------------------- */
/* Estado geral de uma mensagem enviada                                      */
/* -------------------------------------------------------------------------- */

export type EstadoMensagemContrato =
  | "pendente"
  | "enviado"
  | "entregue"
  | "lido"
  | "reproduzido"
  | "erro";

/* -------------------------------------------------------------------------- */
/* Exclusão de mensagem                                                      */
/* -------------------------------------------------------------------------- */

export type TipoExclusaoContrato = "para_mim" | "para_todos";

export type EstadoSolicitacaoExclusao =
  | "nao_solicitada"
  | "excluindo"
  | "excluida"
  | "erro";

export type MotivoIndisponibilidadeExclusao =
  | "prazo_expirado"
  | "canal_sem_suporte"
  | "enviada_por_outro_usuario"
  | "sem_permissao"
  | "canal_desconectado"
  | "falha_na_integracao";

export type ExclusaoMensagemContrato = {
  idMensagem: string;
  tipo: TipoExclusaoContrato;
  usuarioSolicitante: string;
  solicitadoEm: string;
  estado: EstadoSolicitacaoExclusao;
  /** Só presente quando o tipo é "para_todos" e o canal recusou/não permitiu. */
  motivoIndisponibilidade?: MotivoIndisponibilidadeExclusao;
};

/* -------------------------------------------------------------------------- */
/* Contato compartilhado                                                     */
/* -------------------------------------------------------------------------- */

/** Formato que o cartão de contato assume dentro de cada canal, quando ele suporta um cartão nativo em vez de texto simples. */
export type FormatoCartaoContatoPorCanal = "whatsapp_vcard" | "instagram_texto" | "tiktok_texto";

export type ContatoCompartilhadoContrato = {
  idContatoCrm: string;
  nome: string;
  /** Só os telefones que o usuário marcou pra incluir na prévia (seção 19 do pedido) — nunca todos automaticamente. */
  telefonesSelecionados: { tipo: "principal" | "alternativo"; numero: string }[];
  emailSelecionado?: string;
  empresa?: string;
  cargo?: string;
  fotoUrl?: string;
  formatoCanal: FormatoCartaoContatoPorCanal;
};

/* -------------------------------------------------------------------------- */
/* Preferências das conversas                                                */
/* -------------------------------------------------------------------------- */

/**
 * Espelha `ConfigConversas` (`src/lib/conversas-config-context.tsx`), que
 * hoje persiste só em localStorage. Com back-end, vira preferência por
 * usuário/equipe — o formato de campos é o mesmo, só troca onde é lido e
 * gravado (o rascunho da janela de configurações já isola a edição do que
 * está aplicado, então a troca é só na função `salvarConfigConversas`).
 */
export type PreferenciasConversaContrato = {
  usuarioId: string;
  fundo: { escopo: "global" | "por_conversa"; valor: unknown };
  intensidadeFundo: number;
  confirmacoes: {
    leitura: "todos" | "salvos" | "desativado";
    mostrarEnvio: boolean;
    mostrarEntrega: boolean;
    mostrarLeitura: boolean;
    mostrarReproducao: boolean;
    mostrarUltimaAtividade: boolean;
  };
  notificacoes: {
    somNovaMensagem: boolean;
    notificacaoNavegador: boolean;
    notificacaoNovaConversa: boolean;
    notificacaoMencao: boolean;
    notificacaoTarefa: boolean;
    previaMensagem: boolean;
    silenciarArquivadas: boolean;
    somSoSegundoPlano: boolean;
    somEscolhido: string;
  };
  audio: {
    velocidadePadrao: 1 | 1.5 | 2;
    downloadAutomatico: boolean;
  };
  downloads: {
    imagem: boolean;
    video: boolean;
    audio: boolean;
    documento: boolean;
  };
  editor: {
    comportamentoEnter: "enter_envia" | "enter_quebra";
    tamanhoFonte: "pequena" | "media" | "grande";
    densidadeMensagens: "compacta" | "confortavel";
    previaLinks: boolean;
    autoplayVideos: boolean;
    manterPainelContatoAberto: boolean;
  };
};
