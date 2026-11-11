/**
 * Modelo de dados do construtor de automação em grafo (nós + arestas).
 * Substitui o formato "linear" de `Automacao`/`AcaoAutomacao` (automacoes-context.tsx)
 *. A migração de um pro outro vive em `migracao.ts`, não aqui.
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
  // gatilho: Instagram (categoria própria: o canal tem eventos que nenhum outro tem)
  | "instagram_direct_recebido"
  | "instagram_midia_recebida"
  | "instagram_publicacao_compartilhada"
  | "instagram_story_respondido"
  | "instagram_mencao_story"
  | "instagram_novo_seguidor"
  | "instagram_reacao_recebida"
  | "instagram_resposta_comentario"
  | "instagram_comentario_live"
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
  | "decisao_multipla"
  | "condicao_ramos"
  | "distribuir_sorteio"
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
  /** Pragmático: "enviar_formulario" do formato antigo vira esse tipo de mensagem. Ver comentário em migracao.ts. */
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
  | "executar_robo"
  | "nota_interna"
  | "reagir_mensagem"
  | "pausar_automacoes"
  | "cancelar_automacoes"
  | "chamar_webhook"
  | "executar_integracao"
  // IA
  | "ia_responder"
  | "ia_classificar"
  // humano
  | "encaminhar_humano"
  // fim
  | "responder_comentario_instagram"
  | "ocultar_comentario_instagram"
  | "encerrar_fluxo";

/** Metadado estático de cada tipo de nó. Categoria, rótulo, cor e ícone pra paleta/palette e canvas. */
export type FlowNodeMeta = {
  tipo: FlowNodeType;
  categoria: FlowNodeCategory;
  label: string;
  /** Classes Tailwind (bg/text): ver `CATEGORIAS_BLOCOS` em blocos.ts pra cor por categoria. */
  corClasse: string;
  /** Nome de ícone lucide-react se a lib estiver disponível, senão um glyph curto/emoji. */
  icone: string;
};

/* -------------------------------------------------------------------------- */
/* Condições (grupo recursivo E/OU/NÃO)                                      */
/* -------------------------------------------------------------------------- */

export type CampoCondicao =
  /** O texto que o contato acabou de responder. A avaliação já funcionava (o motor põe `mensagem`
   * no contexto); o que faltava era a opção existir na tela pra alguém escolher. É o campo mais
   * usado numa decisão: "se a resposta for 1…". */
  | "mensagem"
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
  | "horario"
  /* ------------------------------------------------------------------------
   * Campos que chegaram com o bloco "Condição" completo.
   *
   * Todos saem de dado que o CRM JÁ GUARDA: o comentário que acionou o fluxo, o perfil do
   * Instagram de quem escreveu (`Contato.igSegueVoce` e companhia), as colunas de contato que
   * nunca tinham sido oferecidas numa condição, e a tabela `OrigemDoLead`, que guarda UTM,
   * código do clique e os ids do Meta Ads desde que o rastreio de tráfego existe — e que até
   * aqui não dava pra consultar de dentro de uma automação.
   * --------------------------------------------------------------------- */
  | "comentario"
  | "cliente_perfil"
  | "cargo"
  | "email"
  | "telefone_celular"
  | "telefone_comercial"
  | "empresa"
  | "utm_source"
  | "utm_medium"
  | "utm_campaign"
  | "utm_content"
  | "utm_term"
  | "pagina_entrada"
  | "gclid"
  | "fbclid"
  | "utm_referrer"
  | "referrer"
  | "ttclid"
  | "meta_ads_campanha"
  | "meta_ads_conjunto"
  | "meta_ads_anuncio"
  | "meta_ads_criativo"
  | "meta_source"
  | "meta_ref"
  | "origem_caminho"
  | "primeiro_toque_em"
  | "ultimo_utm_source"
  | "ultimo_utm_campaign"
  | "ultimo_campanha"
  | "ultimo_anuncio"
  | "ultimo_caminho"
  | "ultimo_toque_em"
  /* ------------------------------------------------------------------------
   * INSTAGRAM: o que a conta conectada sabe sobre quem está do outro lado.
   *
   * Os três primeiros são relação de seguir e selo, e saem do perfil que a Meta devolve pra quem
   * MANDOU mensagem pra conta conectada (`is_user_follow_business`, `is_business_follow_user`,
   * `is_verified_user`, `follower_count`) — já gravados em `Contato`. Os outros saem do EVENTO que
   * disparou o fluxo: que tipo de interação foi, em qual publicação, e o @ de quem interagiu.
   *
   * `ig_janela_24h` é calculado, não guardado: é "a última mensagem recebida desta pessoa tem
   * menos de 24 horas?". É a pergunta que decide se o robô ainda PODE mandar mensagem livre no
   * Direct, e a única forma de tratar isso no desenho em vez de descobrir pelo erro da Meta.
   * --------------------------------------------------------------------- */
  | "ig_seguidor"
  | "ig_voce_segue"
  | "ig_janela_24h"
  | "ig_tipo_interacao"
  | "ig_post_id"
  | "ig_post_link"
  | "ig_arroba"
  | "ig_verificado"
  | "ig_seguidores"
  /**
   * UM CAMPO CRIADO PELA PRÓPRIA EMPRESA, como `cp:<id do campo>`.
   *
   * A definição (nome, tipo, opções) mora em `Preferencia`, chave `campos-do-contato`, e o valor
   * mora no contato, em `camposExtras`. Guardar o ID e não o nome é o que faz a regra sobreviver
   * a renomear o campo: o nome é o que a pessoa lê, o id é o que amarra.
   *
   * O antigo `campo_personalizado` + nome digitado continua existindo pros fluxos publicados.
   */
  | `cp:${string}`;

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
  | "nao_existe"
  /* ------------------------------------------------------------------------
   * Operadores que chegaram com os tipos de campo.
   *
   * Até aqui todo campo comparava com os onze de cima, e a falta deles obrigava a escrever a
   * pergunta errada: "maior ou igual" virava "maior que" com o número mudado à mão, "é verdadeiro"
   * virava "é igual a: sim" (que depende do texto gravado na coluna), e "a etiqueta é" comparava
   * com a lista inteira de etiquetas grudada por vírgula — nunca batia com uma etiqueta só.
   * --------------------------------------------------------------------- */
  | "maior_igual"
  | "menor_igual"
  /** Booleano: o operador já diz tudo, e não há valor a comparar. */
  | "verdadeiro"
  | "falso"
  /** Data: perguntas de calendário, resolvidas no fuso de São Paulo. */
  | "e_hoje"
  | "ultimos_dias"
  | "ha_mais_de_dias"
  /** Lista: comparar com VÁRIAS opções de uma vez. */
  | "um_destes"
  | "nenhum_destes"
  /** Multi-valor (etiquetas): o campo é um conjunto, não um texto. */
  | "tem"
  | "nao_tem"
  | "tem_qualquer"
  | "tem_todas"
  | "nao_tem_nenhuma";

export type RegraCondicao = {
  id: string;
  campo: CampoCondicao;
  operador: OperadorCondicao;
  valor?: string;
  /** Só usado com o operador "entre". */
  valorFim?: string;
  /**
   * OS VÁRIOS VALORES, pros operadores que comparam com mais de um ("é um destes", "tem todas de").
   *
   * Separado de `valor` de propósito: guardar "a,b,c" num campo de texto faria uma etiqueta com
   * vírgula no nome virar duas, e nenhuma delas existiria.
   */
  valores?: string[];
  /** Só usado quando `campo === "campo_personalizado"`. */
  campoPersonalizadoNome?: string;
  /**
   * DE ONDE SAI O VALOR COMPARADO. Ausente é "manual": o texto de `valor` vale como ele é.
   *
   * "vazio" compara com nada preenchido; qualquer outro valor é um token de mensagem
   * (`{primeiro_nome}`, `{etapa_funil}`), resolvido pro contato do momento. Ver `FonteDeValor`
   * em `campos-condicao.ts`.
   */
  fonteValor?: string;
};

/** Grupo recursivo: permite montar árvores tipo "(A E B) OU (NÃO C)". */
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

/** "Qual tarefa" dispara o gatilho. Ver item 10/11 do pedido: nunca "criar uma tarefa", sempre um
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

/**
 * Decisão com quantos caminhos forem necessários. Não só sim/não.
 *
 * O bloco de condição responde uma pergunta fechada, e por isso toda automação de atendimento
 * acabava virando uma escada de "sim/não" encadeados pra tratar três opções de menu. Aqui a
 * pergunta é feita UMA vez ("o que verificar?") e cada resposta possível vira uma saída própria.
 *
 * O caminho "senão" existe sempre e não é configurável: um valor que ninguém previu tem que ter
 * pra onde ir, senão a automação morre em silêncio no meio da conversa.
 */
export type CaminhoDecisao = {
  /** Vira o `sourceHandle` da aresta. Estável: renomear o rótulo não desliga o caminho. */
  id: string;
  rotulo: string;
  /** O valor comparado com o campo escolhido. */
  valor: string;
};

/**
 * CONDIÇÃO COM RAMOS: cada caminho tem as SUAS regras.
 *
 * O CRM já tinha duas formas de separar caminho, e nenhuma faz isto:
 *
 * - `condicao_grupo` pergunta uma coisa e responde sim ou não. Dois caminhos, sempre.
 * - `decisao_multipla` compara UM campo com vários valores. N caminhos, mas a mesma pergunta em
 *   todos ("a origem é A? é B? é C?").
 *
 * Aqui cada ramo é uma pergunta inteira e diferente das outras — "veio do Instagram E falou em
 * consulta" num, "é cliente antigo" no outro —, e cada um tem a sua saída. É o bloco "Condição"
 * da referência, e é o que permite um roteador de atendimento de verdade sem empilhar seis blocos
 * de sim/não em cascata.
 *
 * Dentro do ramo as regras valem JUNTAS (E). Entre os ramos vale o primeiro que bater, de cima
 * pra baixo — por isso a ordem importa e dá pra mover. Quem não bate em nenhum sai pelo
 * "Nenhuma das condições", que existe sempre e não se apaga: um lead sem caminho é um lead parado
 * para sempre no meio do fluxo.
 */
export type RamoDeCondicao = {
  id: string;
  /** O nome que aparece na saída, quando a pessoa escreve um. Vazio = resumo das regras. */
  rotulo?: string;
  /** As regras deste ramo, unidas por E. É o mesmo grupo de condições do resto do CRM. */
  grupo: GrupoCondicoes;
};

export type CondicaoRamosData = {
  ramos: RamoDeCondicao[];
};

export type DecisaoMultiplaData = {
  campo: CampoCondicao;
  /** Padrão "igual". "contem" é o outro comum: "se a resposta contém 'valor'". */
  operador?: OperadorCondicao;
  /** Só usado quando `campo === "campo_personalizado"`. */
  campoPersonalizadoNome?: string;
  caminhos: CaminhoDecisao[];
};

/**
 * DISTRIBUIR: manda cada contato por uma saída diferente, por sorteio com peso.
 *
 * É o bloco de teste A/B. A soma das porcentagens tem que dar 100 — e isso é validado na gravação
 * e de novo na execução, porque um fluxo publicado com 90% espalhados por duas saídas deixaria 10%
 * dos contatos sem caminho, e "sem caminho" num robô publicado é o contato parado para sempre.
 */
export type OpcaoDistribuicao = {
  id: string;
  rotulo: string;
  /** De 0 a 100. */
  porcentagem: number;
};

export type DistribuirSorteioData = {
  opcoes: OpcaoDistribuicao[];
};

export type MensagemTextoData = {
  canal: CanalMensagem;
  texto: string;
  variaveisUsadas?: string[];
  anexos?: string[];
  templateId?: string;
  /**
   * Resquício de um interruptor que existiu por algumas horas no cartão.
   *
   * Quem decide se o bloco espera é o DESENHO: havendo um caminho ligado em "Outra resposta" ou
   * "Sem resposta", ele para e espera; sem nenhum, manda e segue. Um interruptor dizia de novo o
   * que a ligação já dizia. O campo fica no tipo pra não invalidar fluxo gravado com ele; ninguém
   * mais lê.
   *
   * @deprecated Não tem efeito nenhum.
   */
  esperarResposta?: boolean;
  /**
   * Quanto tempo esperar antes de seguir por "Sem resposta". Só vale com `esperarResposta`.
   *
   * Vazio = espera sem prazo, e aí "Sem resposta" nunca acontece. O editor grava um padrão
   * quando a pessoa liga um caminho nessa saída, pra ela não ficar desenhada sem nunca ocorrer.
   */
  esperaMinutos?: number;
};
export type OrigemArquivoMidia = "biblioteca" | "upload";

export type MensagemMidiaData = {
  canal: CanalMensagem;
  /** De onde veio o arquivo escolhido. Biblioteca reutilizável do CRM ou upload avulso nesse bloco. */
  origemArquivo?: OrigemArquivoMidia;
  /** Id em `DocumentoBiblioteca`: um upload avulso nesse bloco também entra de verdade na
   * biblioteca (base64 real), então acaba sempre preenchido, venha o arquivo de onde vier. */
  arquivoId?: string;
  /** Nome real do arquivo (o que a biblioteca guarda, ou o nome do arquivo enviado nesse bloco). */
  arquivoNome?: string;
  /** Nome de exibição opcional: o que aparece pro contato, pode ser mais curto/amigável que o nome real. */
  arquivoNomeExibicao?: string;
  /** Extensão/categoria pro ícone e validação de tipo (PDF, DOC, XLS…). */
  arquivoTipo?: string;
  /** Tamanho real, calculado do arquivo (ex.: "4,2 MB"). */
  arquivoTamanho?: string;
  /** Legado: não é mais escrito (upload avulso agora entra na biblioteca com base64 real, ver
   * `MensagemMidiaForm.tsx`); mantido opcional só pra não quebrar fluxo salvo antes dessa mudança. */
  arquivoUrlTemporaria?: string;
  legenda?: string;
};
export type OrigemContatoEnvio = "atual" | "outro" | "campo_dinamico";
export type DestinoEnvioContato = "conversa_atual" | "atendente" | "equipe" | "numero";
export type MensagemContatoData = {
  origemContato: OrigemContatoEnvio;
  contatoBuscaTexto?: string;
  contatoSelecionadoNome?: string;
  camposCompartilhados: string[];
  destinoModo: DestinoEnvioContato;
  destinoAtendente?: string;
  destinoEquipe?: string;
  destinoNumero?: string;
};

export type OrigemLocalizacao = "salva" | "workspace" | "endereco" | "coordenadas";
export type MensagemLocalizacaoData = {
  origem: OrigemLocalizacao;
  localSalvoId?: string;
  nomeLocal?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  latitude?: string;
  longitude?: string;
  temMensagem?: boolean;
  mensagem?: string;
};

export type OpcaoBotaoLista = {
  id: string;
  rotulo: string;
  /**
   * Só usadas no formato "menu numerado". Outras formas de responder que também devem contar como
   * essa opção na simulação (ex.: pra opção "1", aceitar também "número 1", "opcao 1", "orçamento").
   * O número da posição (1, 2, 3…) sempre é aceito automaticamente, não precisa listar aqui.
   */
  respostasAlternativas?: string[];
  /**
   * COMO comparar o que a pessoa respondeu com esta opção.
   *
   * O padrão continua sendo o que sempre foi: número da posição, rótulo exato, rótulo cortado em
   * 20 caracteres (é o que o botão do WhatsApp entrega) e as respostas alternativas. Escolher
   * outra comparação é pra quando isso não basta: "contém" pra frase solta, "número" pra aceitar
   * só o dígito, "qualquer" pra um caminho que pega tudo que sobrou.
   */
  comparacao?: TipoComparacao;
  /** O que comparar, quando não é o próprio rótulo. Ex.: rótulo "Quero agendar", valor "1". */
  valorComparado?: string;
  /**
   * Botão de URL: abrir um endereço em vez de responder.
   *
   * Uma opção com URL não ramifica o fluxo. Quem clica sai pro site e não volta com resposta
   * nenhuma, então não existe "o que acontece depois" pra ligar. Ela também não vira botão
   * interativo: os canais aqui não mandam botão de link, e o endereço vai no texto da opção,
   * onde a pessoa consegue tocar.
   */
  url?: string;
};
/**
 * "Formato de resposta" é só front-end/visual nesta fase. Nenhum dos quatro formatos liga em envio
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
  /**
   * Quanto tempo esperar antes de seguir pelo caminho "não respondeu".
   *
   * Sem isto a pergunta esperava PRA SEMPRE, e a saída "Não respondeu" existia no desenho sem
   * nunca acontecer: o pior tipo de defeito, porque parece configurado e só não dá a hora.
   * Vazio = espera sem prazo, que continua sendo uma escolha válida pra quem não quer desistir.
   */
  esperaMinutos?: number;
  /**
   * Quantas respostas fora das opções são toleradas antes de desistir.
   *
   * É o que impede o "não entendi, digite 1, 2 ou 3" virar um laço sem fim com alguém do outro
   * lado. A contagem é por execução, não por bloco: voltar pra mesma pergunta depois de errar
   * continua contando.
   */
  tentativasMaximas?: number;
  /** Pra onde ir quando as tentativas acabam. Só vale com `tentativasMaximas`. */
  aposTentativas?: AposTentativas;
};
export type MensagemListaData = MensagemBotoesData;

/**
 * As formas de casar uma resposta com uma opção.
 *
 * "regex" fica de fora de propósito: uma expressão mal escrita trava a execução de todo mundo
 * (o clássico catastrophic backtracking), e não há como validar isso na tela de forma confiável.
 * "contém" e "começa com" resolvem o que quase todo mundo tentaria fazer com regex aqui.
 */
export type TipoComparacao =
  | "padrao"
  | "igual"
  | "contem"
  | "comeca_com"
  | "termina_com"
  | "numero"
  | "qualquer"
  /** Expressão regular. Validada antes de salvar e com orçamento de tempo na execução: ver
   * `src/lib/automacoes/regex-seguro.ts`. */
  | "regex";

/** O que fazer quando a pessoa erra a resposta vezes demais. */
export type AposTentativas = "outra_resposta" | "encerrar" | "humano";

/** Bloco que começa outra automação pro mesmo contato. */
export type ExecutarRoboData = { fluxoId?: string; fluxoNome?: string };
export type MensagemModeloWhatsappData = { templateId: string; templateNome?: string; variaveis?: Record<string, string> };

export type DestinatarioEmailModo = "contato_email" | "outro_campo" | "especifico" | "responsavel" | "campo_personalizado";
export type SeSemEmailModo = "continuar" | "encerrar" | "criar_tarefa" | "caminho_alternativo";
export type MensagemEmailData = {
  destinatarioModo: DestinatarioEmailModo;
  destinatarioEspecifico?: string;
  cc?: string;
  cco?: string;
  remetente?: string;
  assunto: string;
  corpo: string;
  modeloId?: string;
  quandoModo?: "imediato" | "apos_tempo";
  tempoValor?: number;
  tempoUnidade?: string;
  seSemEmail?: SeSemEmailModo;
};
export type NotificacaoInternaData = { paraEquipe?: string; mensagem: string };

/**
 * Nota no histórico do lead. NÃO é mensagem: o cliente não recebe nada.
 *
 * Existe separado da "notificação interna" porque são coisas diferentes: a notificação avisa
 * alguém agora, a nota fica registrada pra quem abrir o lead depois. Misturar as duas faria toda
 * anotação virar um aviso, e o time pararia de ler os avisos.
 */
export type NotaInternaData = { texto: string };

/**
 * Reage com um emoji à última mensagem que o CONTATO mandou.
 *
 * À mensagem DELE, não à nossa: numa automação de atendimento é isso que faz sentido ("vi sua
 * mensagem"), e reagir à própria mensagem pareceria o robô se elogiando.
 */
export type ReagirMensagemData = { emoji: string };

/** Por que a automação parou. Aparece no histórico e é o que explica um lead que não avançou. */
export type MotivoParada =
  | "concluido"
  | "transferido"
  | "sem_resposta"
  | "erro"
  | "desqualificado"
  | "outro";
export type EnviarFormularioData = {
  formularioOrigem?: "interno" | "externo";
  formularioId?: string;
  formularioUrlExterna?: string;
  mensagem?: string;
};

export type AguardarData = {
  modo:
    /**
     * SEGUNDOS, pra pausa entre duas mensagens.
     *
     * Não existia, e por um motivo que valia: quem acorda execução parada é uma varredura que
     * roda de minuto em minuto, então "5 segundos" viraria até um minuto sem avisar. Agora a
     * espera curta (até 10 segundos) é retomada na hora, em segundo plano, depois da resposta do
     * webhook — e só por isso a unidade pôde aparecer na tela. Ver `agendarRetomadaCurta`.
     */
    | "segundos"
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
  /** Fora da tela: o CRM não tem calendário de feriados, e um botão que promete pular feriado sem
   * saber quais são faria a mensagem sair no dia errado. O campo fica pra não invalidar fluxo já
   * salvo com ele. */
  pularFeriados?: boolean;
  /**
   * Conta só o tempo DENTRO do expediente do workspace.
   *
   * "Pausar 2 horas úteis" às 17h20 de sexta não termina às 19h20 de sexta: termina às 9h20 de
   * segunda. É a diferença entre um follow-up que chega no meio do atendimento e um que chega de
   * madrugada. O horário vem de Configurações, um só pro workspace inteiro.
   */
  somenteExpediente?: boolean;
  /** Se definido, gera as saídas "ok"/"timeout" no FlowEdge.sourceHandle. */
  tempoMaximo?: { valor: number; unidade: string };
  /**
   * Espera o tempo, MAS segue na hora se o contato responder antes.
   *
   * É o "pausar até a mensagem recebida" com cronômetro: o bloco ganha os dois caminhos, um pra
   * quem respondeu dentro do prazo e outro pra quem deixou o tempo acabar. Sem isto, uma espera de
   * 24 horas segurava o fluxo as 24 horas inteiras mesmo com a pessoa respondendo em dois minutos.
   */
  interromperSeResponder?: boolean;
};

export type AdicionarEtiquetaData = { etiquetaNome: string };
export type RemoverEtiquetaData = { etiquetaNome: string };
export type AlterarEtapaData = { funilId: string; etapaTitulo: string };
export type AlterarFunilData = { funilId: string; etapaTitulo?: string };
export type AlterarResponsavelData = { atendenteNome: string };
export type EncaminharEquipeData = { equipeNome?: string };
export type ModoDistribuicao = "round_robin" | "menos_ocupado";
export type DistribuirDisponibilidadeData = { modo?: ModoDistribuicao; equipeNome?: string };
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
export type CriarNegocioData = { nome: string; funilId: string; etapaTitulo: string; valor?: string };
export type ModoAtualizarValor = "definir" | "somar" | "subtrair";
export type AtualizarValorData = { modo?: ModoAtualizarValor; valor: string };
export type StatusNegocio = "em_andamento" | "ganho" | "perdido";
export type AtualizarStatusData = { status: string; motivoPerda?: string };
export type AgendarConsultaData = { data?: string; horario?: string; profissional?: string; tipoServico?: string; observacao?: string };
export type CriterioAgendamento = "proximo" | "ultimo_criado" | "tipo" | "responsavel" | "especifico";
export type OrigemMensagemCancelamento = "modelo" | "criar_agora";
export type CancelarAgendamentoData = {
  criterio: CriterioAgendamento;
  tipoAgendamento?: string;
  responsavel?: string;
  enviarMensagem?: boolean;
  canalMensagem?: string;
  origemMensagem?: OrigemMensagemCancelamento;
  modeloId?: string;
  mensagem?: string;
  quandoModo?: "imediato" | "apos_tempo";
  tempoValor?: number;
  tempoUnidade?: string;
};
export type EnviarNotificacaoData = { paraEquipe?: string; mensagem: string };
export type PausarAutomacoesData = Record<string, never>;
export type CancelarAutomacoesData = Record<string, never>;
export type ChamarWebhookData = { url: string; payload?: string };

/**
 * Responde o contato com IA, seguindo uma instrução e o contexto do negócio.
 *
 * Sem IA configurada no servidor, o bloco não inventa resposta: ele diz isso no histórico e o fluxo
 * segue. Uma resposta genérica saindo em nome da empresa é pior que nenhuma.
 */
export type IaResponderData = {
  /** O que a IA deve fazer ("responda a dúvida sobre preço em até 3 frases, com tom cordial"). */
  instrucao: string;
  /** Informações do negócio que ela pode usar (horário, preços, política de troca). */
  contexto?: string;
  /** Teto de caracteres da resposta. Mensagem de atendimento curta é lida, longa não. */
  maximoCaracteres?: number;
};

/**
 * Classifica a última mensagem do contato em uma das categorias e segue por ela.
 *
 * Cada categoria vira uma saída do bloco; quando a IA não encaixa em nenhuma, o fluxo segue pela
 * saída "nao_classificado" em vez de escolher um caminho no chute.
 */
export type IaClassificarData = {
  instrucao?: string;
  /** As saídas possíveis, na ordem. O `sourceHandle` da aresta é a própria categoria. */
  categorias: string[];
};
export type ExecutarIntegracaoData = { integracaoId?: string; acao?: string };
export type ModoDestinoAtendimento = "atendente" | "equipe" | "distribuicao" | "manter";
export type MetodoDistribuicaoAtendimento = "disponibilidade" | "rodizio" | "menos_atendimentos" | "prioridade";
export type EncaminharHumanoData = {
  destino: ModoDestinoAtendimento;
  atendenteNome?: string;
  equipeNome?: string;
  metodoDistribuicao?: MetodoDistribuicaoAtendimento;
  moverFunil?: boolean;
  funilId?: string;
  etapaTitulo?: string;
  quandoModo?: "imediato" | "apos_tempo";
  tempoValor?: number;
  tempoUnidade?: string;
};
/**
 * Encerra a execução aqui. O `motivo` não muda o que acontece: ele explica no histórico POR QUE
 * aquele lead parou, que é o que separa "deu tudo certo" de "ninguém respondeu" quando alguém for
 * olhar depois.
 */
export type EncerrarFluxoData = { motivo?: MotivoParada; observacao?: string };

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
  /** Bloco pausado: continua no fluxo (não perde a posição/conexões) mas fica marcado como "não
   * roda por enquanto"; útil pra desligar temporariamente uma etapa sem ter que desconectar e
   * excluir. O motor com estado respeita este marcador (registra "pulado" e segue); o motor
   * antigo ainda não. */
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
  /**
   * O que fazer quando o gatilho acontece fora dos dias/horário ativos.
   *
   * "aguardar" estaciona a execução e retoma na abertura seguinte. O motor com estado é o que
   * tornou isso possível; antes tinha exatamente o mesmo efeito de "continuar". "ignorar" é o nome
   * antigo de "encerrar", mantido pra não invalidar fluxo já salvo.
   */
  foraDaJanela?: "aguardar" | "continuar" | "encerrar" | "ignorar";
  dataInicio?: string;
  dataFim?: string;
  prioridade?: "baixa" | "normal" | "alta";
  limiteExecucao?:
    | "sempre"
    | "uma_vez_por_contato"
    | "uma_vez_por_entrada"
    | "uma_vez_por_dia"
    | "uma_vez_por_semana"
    | "uma_vez_por_mes"
    /** Teto explícito por contato: o número vem de `maximoExecucoes`. */
    | "no_maximo";
  /** Quantas vezes no máximo, quando `limiteExecucao === "no_maximo"`. */
  maximoExecucoes?: number;
  naoIniciarSeJaNoFluxo?: boolean;
  cancelarExecucaoAnterior?: boolean;
  /**
   * O QUE FAZER QUANDO O CONTATO JÁ ESTÁ EM OUTRA AUTOMAÇÃO.
   *
   * As duas chaves acima falam da MESMA automação: "não iniciar se já estiver nesse fluxo",
   * "cancelar a execução anterior". Nenhuma das duas via as outras — e é entre automações
   * diferentes que o estrago aparece: a pessoa comenta num post e recebe a resposta do robô de
   * comentário, a do robô de palavra-chave e a do robô de boas-vindas, três mensagens em cima da
   * outra, de três conversas que não sabem uma da outra.
   *
   * - `permitir` (o padrão): o que o CRM sempre fez. Toda automação que casa com o evento roda.
   * - `nao_iniciar`: esta não começa enquanto o contato estiver em outra. Vale pra automação
   *   secundária — a de boas-vindas que não deve atropelar uma venda em andamento.
   * - `encerrar_as_outras`: esta começa e derruba as outras. Vale pra automação que PRECISA ter a
   *   palavra: o cancelamento, a reclamação, o atendimento humano.
   *
   * Ausente = `permitir`, porque todo fluxo gravado antes disto rodava assim e mudar o
   * comportamento de robôs que já estão no ar seria quebrar automação em produção sem ninguém
   * pedir.
   *
   * Vale só pro disparo por GATILHO. O bloco "Executar robô" é uma passagem de bastão escrita à
   * mão por quem montou o fluxo, e bloqueá-la seria desligar o desenho dela.
   */
  concorrencia?: "permitir" | "nao_iniciar" | "encerrar_as_outras";
  /**
   * Onde a pessoa deixou a pastilha de início no canvas.
   *
   * Fica nas CONFIGURAÇÕES e não entre os blocos porque o início não é um bloco: o motor não o
   * executa, e gravá-lo como nó criaria um passo fantasma. Mas a posição dele é escolha de quem
   * desenha — a pastilha ficava grudada à esquerda do primeiro bloco, e não dava pra tirar do
   * caminho. Sem valor gravado, ela volta pro lugar calculado.
   */
  posicaoInicio?: { x: number; y: number };
  /**
   * Resquício da época em que existiam dois motores: a chave escolhia qual deles rodava o fluxo.
   *
   * Continua no tipo só porque fluxos gravados ainda têm o campo no Json de configurações, e
   * removê-lo do tipo faria o TypeScript reclamar de dado que existe no banco. Ninguém lê mais:
   * o motor com estado é o único.
   *
   * @deprecated Não tem efeito nenhum.
   */
  motorNovo?: boolean;
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
  /** "comercial" ou "social". Ver `AreaAutomacao` em `@/lib/canais/capacidades`. Opcional porque
   * todo fluxo anterior a esta coluna é comercial, e ausência significa exatamente isso. */
  area?: "comercial" | "social";
  /** Pasta em que o robô está guardado. Ausente ou nulo = na raiz. */
  pastaId?: string | null;
  status: "rascunho" | "publicado";
  ativa: boolean;
  /** Arquivamento é um estado próprio, distinto de "pausada": ver `arquivarFluxo`/`desarquivarFluxo` em automation-flow-context.tsx. Opcional pra não quebrar fluxos já existentes/seeds. */
  arquivada?: boolean;
  /** Estado de edição atual (draft). Só vira uma `VersaoFluxo` quando publicado. */
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
  /** Marca um fluxo seed pronto pra uso como ponto de partida ("Usar um modelo"). Nunca criado pelo usuário. Aditivo, não quebra fluxos existentes. */
  modeloDemonstracao?: boolean;
  /** Frase um pouco mais longa que `descricao`, só usada na pré-visualização (Task 4). Opcional, aditivo. */
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
