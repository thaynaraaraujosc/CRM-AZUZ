/**
 * Modelo de dados do construtor de automação em grafo (nós + arestas).
 * Substitui o formato "linear" de `Automacao`/`AcaoAutomacao` (automacoes-context.tsx)
 * — a migração de um pro outro vive em `migracao.ts`, não aqui.
 */

import type { CanalComentario, DiaSemana } from "@/lib/data";

/* -------------------------------------------------------------------------- */
/* Categorias e tipos de nó                                                  */
/* -------------------------------------------------------------------------- */

export type FlowNodeCategory =
  | "gatilho"
  | "condicao"
  | "mensagem"
  | "espera"
  | "acao"
  | "humano"
  | "integracao"
  | "fim";

export type FlowNodeType =
  // gatilho
  | "lead_criado"
  | "lead_entrou_etapa"
  | "lead_saiu_etapa"
  | "lead_parado_etapa"
  | "lead_respondeu"
  | "lead_nao_respondeu"
  | "palavra_chave"
  | "mensagem_recebida"
  | "etiqueta_adicionada"
  | "etiqueta_removida"
  | "campo_alterado"
  | "responsavel_alterado"
  | "tarefa_criada"
  | "tarefa_concluida"
  | "tarefa_vencida"
  | "consulta_agendada"
  | "consulta_confirmada"
  | "consulta_cancelada"
  | "cliente_nao_compareceu"
  | "formulario_preenchido"
  | "pagamento_aprovado"
  | "pagamento_pendente"
  | "pagamento_vencido"
  | "aniversario"
  | "data_personalizada"
  | "horario_programado"
  | "comentario_instagram"
  | "comentario_tiktok"
  | "lead_anuncio"
  | "webhook_recebido"
  | "integracao_externa"
  // condicao
  | "condicao_grupo"
  // mensagem
  | "mensagem_texto"
  | "mensagem_imagem"
  | "mensagem_video"
  | "mensagem_audio"
  | "mensagem_documento"
  | "mensagem_contato"
  | "mensagem_localizacao"
  | "mensagem_botoes"
  | "mensagem_lista"
  | "mensagem_modelo_whatsapp"
  | "mensagem_email"
  | "notificacao_interna"
  /** Pragmático: "enviar_formulario" do formato antigo vira esse tipo de mensagem — ver comentário em migracao.ts. */
  | "enviar_formulario"
  // espera
  | "aguardar"
  // acao
  | "adicionar_etiqueta"
  | "remover_etiqueta"
  | "alterar_etapa"
  | "alterar_funil"
  | "alterar_responsavel"
  | "encaminhar_equipe"
  | "distribuir_disponibilidade"
  | "criar_tarefa"
  | "criar_lembrete"
  | "atualizar_campo"
  | "criar_negocio"
  | "atualizar_valor"
  | "atualizar_status"
  | "agendar_consulta"
  | "cancelar_agendamento"
  | "enviar_notificacao"
  | "pausar_automacoes"
  | "cancelar_automacoes"
  | "chamar_webhook"
  | "executar_integracao"
  // humano
  | "encaminhar_humano"
  // fim
  | "encerrar_fluxo";

/** Metadado estático de cada tipo de nó — categoria, rótulo, cor e ícone pra paleta/palette e canvas. */
export type FlowNodeMeta = {
  tipo: FlowNodeType;
  categoria: FlowNodeCategory;
  label: string;
  /** Classes Tailwind (bg/text) — ver `CATEGORIAS_BLOCOS` em blocos.ts pra cor por categoria. */
  corClasse: string;
  /** Nome de ícone lucide-react se a lib estiver disponível, senão um glyph curto/emoji. */
  icone: string;
};

/* -------------------------------------------------------------------------- */
/* Condições (grupo recursivo E/OU/NÃO)                                      */
/* -------------------------------------------------------------------------- */

export type CampoCondicao =
  | "origem"
  | "canal"
  | "etapa"
  | "funil"
  | "etiqueta"
  | "responsavel"
  | "equipe"
  | "numero_salvo"
  | "campo_personalizado"
  | "cidade"
  | "estado"
  | "data_ultima_conversa"
  | "horario_ultima_mensagem"
  | "respondeu"
  | "tentativas"
  | "recebeu_automacao"
  | "em_outra_automacao"
  | "possui_agendamento"
  | "situacao_agendamento"
  | "valor_negocio"
  | "campanha"
  | "anuncio"
  | "palavra_chave"
  | "consentimento"
  | "dia_semana"
  | "horario";

export type OperadorCondicao =
  | "igual"
  | "diferente"
  | "contem"
  | "nao_contem"
  | "maior_que"
  | "menor_que"
  | "entre"
  | "existe"
  | "nao_existe";

export type RegraCondicao = {
  id: string;
  campo: CampoCondicao;
  operador: OperadorCondicao;
  valor?: string;
  /** Só usado com o operador "entre". */
  valorFim?: string;
  /** Só usado quando `campo === "campo_personalizado"`. */
  campoPersonalizadoNome?: string;
};

/** Grupo recursivo — permite montar árvores tipo "(A E B) OU (NÃO C)". */
export type GrupoCondicoes = {
  id: string;
  tipo: "E" | "OU" | "NAO";
  regras: RegraCondicao[];
  subgrupos: GrupoCondicoes[];
};

/* -------------------------------------------------------------------------- */
/* Dados por tipo de nó (data payloads)                                      */
/* -------------------------------------------------------------------------- */

export type CanalMensagem = "whatsapp" | "instagram" | "tiktok" | "email" | "interno";

export type GatilhoEtapaData = {
  funilId?: string;
  etapaId?: string;
  /** Só relevante pra gatilhos que aceitam tempo (parado/entrou/saiu com atraso). */
  tempoValor?: number;
  tempoUnidade?: "minutos" | "horas" | "dias";
  disparoImediato?: boolean;
};

export type PalavraChaveData = { palavra: string; canal?: CanalMensagem };
export type EtiquetaEventoData = { etiquetaNome: string };
export type CampoAlteradoData = { campoNome: string };
export type ResponsavelAlteradoData = { atendenteNome?: string };
export type HorarioProgramadoData = {
  data?: string;
  horario?: string;
  recorrente?: boolean;
};
export type ComentarioEventoData = { canal: CanalComentario; palavraChave?: string };
export type WebhookRecebidoData = { identificador?: string };
export type IntegracaoExternaData = { integracaoId?: string; evento?: string };
export type ConsultaEventoData = { motivo?: string };
export type FormularioPreenchidoData = { formularioId?: string };

export type CondicaoGrupoData = { grupo: GrupoCondicoes };

export type MensagemTextoData = {
  canal: CanalMensagem;
  texto: string;
  variaveisUsadas?: string[];
  anexos?: string[];
  templateId?: string;
};
export type MensagemMidiaData = {
  canal: CanalMensagem;
  arquivoNome?: string;
  legenda?: string;
};
export type MensagemContatoData = { nomeContato: string; telefone?: string };
export type MensagemLocalizacaoData = { latitude?: number; longitude?: number; endereco?: string };

export type OpcaoBotaoLista = { id: string; rotulo: string };
export type MensagemBotoesData = {
  canal: CanalMensagem;
  texto: string;
  opcoes: OpcaoBotaoLista[];
};
export type MensagemListaData = MensagemBotoesData;
export type MensagemModeloWhatsappData = { templateId: string; variaveis?: Record<string, string> };
export type MensagemEmailData = { assunto: string; corpo: string };
export type NotificacaoInternaData = { paraEquipe?: string; mensagem: string };
export type EnviarFormularioData = {
  formularioOrigem?: "interno" | "externo";
  formularioId?: string;
  formularioUrlExterna?: string;
  mensagem?: string;
};

export type AguardarData = {
  modo:
    | "minutos"
    | "horas"
    | "dias"
    | "ate_data"
    | "ate_horario"
    | "ate_resposta"
    | "ate_tarefa"
    | "ate_consulta";
  valor?: number;
  apenasDiasUteis?: boolean;
  pularFinaisDeSemana?: boolean;
  pularFeriados?: boolean;
  /** Se definido, gera as saídas "ok"/"timeout" no FlowEdge.sourceHandle. */
  tempoMaximo?: { valor: number; unidade: string };
};

export type AdicionarEtiquetaData = { etiquetaNome: string };
export type RemoverEtiquetaData = { etiquetaNome: string };
export type AlterarEtapaData = { funilId: string; etapaTitulo: string };
export type AlterarFunilData = { funilId: string; etapaTitulo?: string };
export type AlterarResponsavelData = { atendenteNome: string };
export type EncaminharEquipeData = { equipeNome?: string };
export type DistribuirDisponibilidadeData = { candidatos?: string[] };
export type CriarTarefaData = { titulo: string; prazoValor?: number; prazoUnidade?: string; responsavel?: string };
export type CriarLembreteData = { titulo: string; tempoValor?: number; tempoUnidade?: string };
export type AtualizarCampoData = { campoNome: string; valor: string };
export type CriarNegocioData = { funilId: string; etapaTitulo: string; valor?: string };
export type AtualizarValorData = { valor: string };
export type AtualizarStatusData = { status: string };
export type AgendarConsultaData = { data?: string; horario?: string; observacao?: string };
export type CancelarAgendamentoData = { motivo?: string };
export type EnviarNotificacaoData = { paraEquipe?: string; mensagem: string };
export type PausarAutomacoesData = Record<string, never>;
export type CancelarAutomacoesData = Record<string, never>;
export type ChamarWebhookData = { url: string; payload?: string };
export type ExecutarIntegracaoData = { integracaoId?: string; acao?: string };
export type EncaminharHumanoData = { atendenteNome?: string; equipeNome?: string };
export type EncerrarFluxoData = { motivo?: string };

/* -------------------------------------------------------------------------- */
/* Nó e aresta genéricos                                                     */
/* -------------------------------------------------------------------------- */

export type FlowNode<T = Record<string, unknown>> = {
  id: string;
  type: FlowNodeType;
  category: FlowNodeCategory;
  position: { x: number; y: number };
  titulo?: string;
  observacao?: string;
  data: T;
};

/**
 * `sourceHandle` identifica de qual "saída" do nó a aresta parte, quando o nó
 * tem mais de uma (condição: "sim"/"nao"; botões/lista: id da opção; aguardar
 * com `tempoMaximo`: "ok"/"timeout"; mensagem interativa herdada: "outra_resposta"/"nao_respondeu").
 */
export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
  cor?: string;
};

/* -------------------------------------------------------------------------- */
/* Fluxo completo (versionado)                                               */
/* -------------------------------------------------------------------------- */

export type ConfiguracoesFluxo = {
  diasAtivos?: DiaSemana[];
  usarHorario?: boolean;
  horarioInicio?: string;
  horarioFim?: string;
  fusoHorario?: string;
  foraDaJanela?: "aguardar" | "ignorar";
  dataInicio?: string;
  dataFim?: string;
  prioridade?: "baixa" | "normal" | "alta";
  limiteExecucao?:
    | "sempre"
    | "uma_vez_por_contato"
    | "uma_vez_por_entrada"
    | "uma_vez_por_dia"
    | "uma_vez_por_semana"
    | "uma_vez_por_mes";
  naoIniciarSeJaNoFluxo?: boolean;
  cancelarExecucaoAnterior?: boolean;
};

export type VersaoFluxo = {
  versao: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  configuracoes: ConfiguracoesFluxo;
  publicadoEm: string;
  publicadoPor: string;
};

export type FluxoAutomacao = {
  id: string;
  nome: string;
  descricao?: string;
  funilId?: string;
  etapaId?: string;
  categoria?: string;
  status: "rascunho" | "publicado";
  ativa: boolean;
  /** Estado de edição atual (draft) — só vira uma `VersaoFluxo` quando publicado. */
  nodes: FlowNode[];
  edges: FlowEdge[];
  versaoAtual: number;
  publicadoEm?: string;
  publicadoPor?: string;
  criadoEm: string;
  atualizadoEm: string;
  configuracoes: ConfiguracoesFluxo;
  execucoes: number;
  historicoVersoes: VersaoFluxo[];
};

/* -------------------------------------------------------------------------- */
/* Validação                                                                 */
/* -------------------------------------------------------------------------- */

export type ProblemaValidacao = {
  id: string;
  severidade: "erro" | "aviso";
  mensagem: string;
  nodeId?: string;
  edgeId?: string;
};

/* -------------------------------------------------------------------------- */
/* Execução                                                                  */
/* -------------------------------------------------------------------------- */

export type PassoExecucao = {
  nodeId: string;
  nodeType: FlowNodeType;
  label: string;
  status: "ok" | "condicao_falsa" | "aguardando" | "erro" | "pulado";
  detalhe?: string;
  timestamp: string;
};

export type RegistroExecucao = {
  id: string;
  fluxoId: string;
  fluxoVersao: number;
  contatoNome: string;
  iniciadoEm: string;
  finalizadoEm?: string;
  situacao: "aguardando" | "em_andamento" | "concluida" | "pausada" | "cancelada" | "erro";
  passos: PassoExecucao[];
  gatilho: string;
  erro?: string;
};
