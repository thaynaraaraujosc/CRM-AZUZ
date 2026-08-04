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
  | "comeca_com"
  | "termina_com"
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

/** "Qual tarefa" dispara o gatilho — ver item 10/11 do pedido: nunca "criar uma tarefa", sempre um
 * filtro sobre tarefas que já existem/serão criadas por outro caminho. */
export type FiltroTarefaModo = "qualquer" | "categoria" | "titulo" | "responsavel" | "equipe" | "funil";
export type TarefaEventoData = {
  filtroModo: FiltroTarefaModo;
  categoria?: string;
  tituloContem?: string;
  responsavel?: string;
  equipe?: string;
  funilId?: string;
};

export type CondicaoGrupoData = { grupo: GrupoCondicoes };

export type MensagemTextoData = {
  canal: CanalMensagem;
  texto: string;
  variaveisUsadas?: string[];
  anexos?: string[];
  templateId?: string;
};
export type OrigemArquivoMidia = "biblioteca" | "upload";

export type MensagemMidiaData = {
  canal: CanalMensagem;
  /** De onde veio o arquivo escolhido — biblioteca reutilizável do CRM ou upload avulso nesse bloco. */
  origemArquivo?: OrigemArquivoMidia;
  /** Só quando `origemArquivo === "biblioteca"` — id em `ArquivosDaBiblioteca`. */
  arquivoId?: string;
  /** Nome real do arquivo (o que a biblioteca guarda, ou o nome do arquivo enviado nesse bloco). */
  arquivoNome?: string;
  /** Nome de exibição opcional — o que aparece pro contato, pode ser mais curto/amigável que o nome real. */
  arquivoNomeExibicao?: string;
  /** Extensão/categoria pro ícone e validação de tipo (PDF, DOC, XLS…). */
  arquivoTipo?: string;
  /** Tamanho mockado (ex.: "4,2 MB") — nunca calculado de um upload de verdade. */
  arquivoTamanho?: string;
  /** Só quando `origemArquivo === "upload"` — `URL.createObjectURL` local, nunca enviado a servidor. */
  arquivoUrlTemporaria?: string;
  legenda?: string;
};
export type MensagemContatoData = { nomeContato: string; telefone?: string };
export type MensagemLocalizacaoData = { latitude?: number; longitude?: number; endereco?: string };

export type OpcaoBotaoLista = {
  id: string;
  rotulo: string;
  /**
   * Só usadas no formato "menu numerado" — outras formas de responder que também devem contar como
   * essa opção na simulação (ex.: pra opção "1", aceitar também "número 1", "opcao 1", "orçamento").
   * O número da posição (1, 2, 3…) sempre é aceito automaticamente, não precisa listar aqui.
   */
  respostasAlternativas?: string[];
};
/**
 * "Formato de resposta" é só front-end/visual nesta fase — nenhum dos quatro formatos liga em envio
 * real de mensagem ainda. Existe pra o CRM não parecer dependente de conexão com API oficial: menu
 * numerado e texto livre funcionam em texto puro (qualquer conexão), botões/lista dependem do que o
 * provedor conectado suporta.
 */
export type FormatoResposta = "menu_numerado" | "botoes" | "lista_interativa" | "texto_livre";

export type MensagemBotoesData = {
  canal: CanalMensagem;
  texto: string;
  opcoes: OpcaoBotaoLista[];
  formatoResposta?: FormatoResposta;
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
export type ModoResponsavelTarefa = "atual" | "pessoa" | "equipe";
export type ModoPrazoTarefa = "imediatamente" | "depois_de" | "data_especifica";
export type PrioridadeTarefa = "baixa" | "normal" | "alta" | "urgente";
export type RelacionarTarefaA = "contato" | "negocio" | "ambos";

export type CriarTarefaData = {
  categoria?: string;
  titulo: string;
  descricao?: string;
  modoResponsavel?: ModoResponsavelTarefa;
  responsavel?: string;
  equipe?: string;
  modoPrazo?: ModoPrazoTarefa;
  prazoValor?: number;
  prazoUnidade?: string;
  data?: string;
  horario?: string;
  prioridade?: PrioridadeTarefa;
  relacionarA?: RelacionarTarefaA;
};
export type CriarLembreteData = { titulo: string; tempoValor?: number; tempoUnidade?: string };
export type AtualizarCampoData = { campoNome: string; valor: string };
export type CriarNegocioData = { funilId: string; etapaTitulo: string; valor?: string };
export type ModoAtualizarValor = "definir" | "somar" | "subtrair";
export type AtualizarValorData = { modo?: ModoAtualizarValor; valor: string };
export type StatusNegocio = "em_andamento" | "ganho" | "perdido";
export type AtualizarStatusData = { status: string; motivoPerda?: string };
export type AgendarConsultaData = { data?: string; horario?: string; profissional?: string; tipoServico?: string; observacao?: string };
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
  /** Bloco pausado — continua no fluxo (não perde a posição/conexões) mas fica marcado como "não
   * roda por enquanto"; útil pra desligar temporariamente uma etapa sem ter que desconectar e
   * excluir. Puramente visual/de estado nesta fase (front-end apenas). */
  desativado?: boolean;
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
  /** Arquivamento é um estado próprio, distinto de "pausada" — ver `arquivarFluxo`/`desarquivarFluxo` em automation-flow-context.tsx. Opcional pra não quebrar fluxos já existentes/seeds. */
  arquivada?: boolean;
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
  /** Marca um fluxo seed pronto pra uso como ponto de partida ("Usar um modelo") — nunca criado pelo usuário. Aditivo, não quebra fluxos existentes. */
  modeloDemonstracao?: boolean;
  /** Frase um pouco mais longa que `descricao`, só usada na pré-visualização (Task 4) — opcional, aditivo. */
  objetivo?: string;
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
