/**
 * Três fluxos de demonstração prontos — servem de ponto de partida no popover
 * "Nova automação → Usar um modelo" (ver `automacoes/page.tsx`) e de exemplo
 * completo do construtor em grafo. Nunca editados diretamente pelo usuário:
 * "Usar um modelo" sempre passa por `duplicarFluxo`, que cria uma cópia em
 * rascunho independente — estes objetos aqui ficam intocados no array `fluxos`.
 *
 * Todos os três precisam passar por `validarFluxo` com zero problemas de
 * severidade "erro" — checagem manual feita via script descartável, resultado
 * colado no relatório da tarefa (não fica um arquivo de teste no repo).
 */

import { layoutFluxo } from "./migracao";
import type {
  AdicionarEtiquetaData,
  AguardarData,
  AlterarEtapaData,
  AlterarResponsavelData,
  AtualizarCampoData,
  AtualizarStatusData,
  CondicaoGrupoData,
  ConfiguracoesFluxo,
  CriarNegocioData,
  CriarTarefaData,
  EncaminharEquipeData,
  EncaminharHumanoData,
  EncerrarFluxoData,
  EnviarNotificacaoData,
  FlowEdge,
  FlowNode,
  FlowNodeCategory,
  FlowNodeType,
  FluxoAutomacao,
  GatilhoEtapaData,
  MensagemBotoesData,
  MensagemMidiaData,
  MensagemTextoData,
  PalavraChaveData,
  RemoverEtiquetaData,
  VersaoFluxo,
} from "./types";

/** Data fixa de publicação dos 3 modelos — determinística, não usa `Date.now()`/`new Date()` em runtime. */
const PUBLICADO_EM_DEMO = "2026-01-01T09:00:00.000Z";

/* -------------------------------------------------------------------------- */
/* Helpers locais de construção (mesmo espírito de `migracao.ts`, mas próprios
   daqui pra não depender de estado interno privado do módulo de migração)     */
/* -------------------------------------------------------------------------- */

function no<T>(id: string, type: FlowNodeType, category: FlowNodeCategory, data: T, titulo?: string, observacao?: string): FlowNode<T> {
  return { id, type, category, position: { x: 0, y: 0 }, titulo, observacao, data };
}

function aresta(source: string, target: string, sourceHandle?: string, label?: string): FlowEdge {
  return {
    id: `${source}->${target}${sourceHandle ? `:${sourceHandle}` : ""}`,
    source,
    target,
    sourceHandle,
    label,
  };
}

function fluxoDemo(base: {
  id: string;
  nome: string;
  descricao: string;
  objetivo: string;
  categoria?: string;
  funilId?: string;
  etapaId?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  configuracoes: ConfiguracoesFluxo;
}): FluxoAutomacao {
  // Posiciona tudo em camadas (BFS a partir do gatilho) — evita ter que
  // calcular ~15-20 pares de coordenadas à mão por fluxo.
  layoutFluxo(base.nodes, base.edges);

  const versaoInicial: VersaoFluxo = {
    versao: 1,
    nodes: base.nodes,
    edges: base.edges,
    configuracoes: base.configuracoes,
    publicadoEm: PUBLICADO_EM_DEMO,
    publicadoPor: "Sistema",
  };

  return {
    id: base.id,
    nome: base.nome,
    descricao: base.descricao,
    objetivo: base.objetivo,
    categoria: base.categoria,
    funilId: base.funilId,
    etapaId: base.etapaId,
    status: "publicado",
    ativa: false,
    nodes: base.nodes,
    edges: base.edges,
    versaoAtual: 1,
    publicadoEm: PUBLICADO_EM_DEMO,
    publicadoPor: "Sistema",
    criadoEm: PUBLICADO_EM_DEMO,
    atualizadoEm: PUBLICADO_EM_DEMO,
    configuracoes: base.configuracoes,
    execucoes: 0,
    historicoVersoes: [versaoInicial],
    modeloDemonstracao: true,
  };
}

/* Funil/etapa reais do seed (`src/lib/data.ts`) usados nos nós de ação que
   precisam de um valor concreto pra serem testáveis/válidos.               */
const FUNIL_ID_SEED = "funil-principal";
const ETAPA_NOVO_SEED = "Novo";

/* -------------------------------------------------------------------------- */
/* Automação 1 — "Recuperar lead sem resposta"                               */
/* -------------------------------------------------------------------------- */

function construirRecuperarLead(): FluxoAutomacao {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  // Mapeamento de gatilho (julgamento documentado): a brief descreve o início
  // como "o lead recebe uma mensagem da equipe" — um evento interno que não
  // existe como `FlowNodeType` de gatilho hoje (não é webhook, não é resposta
  // recebida). O mapeamento mais honesto disponível é `lead_entrou_etapa`,
  // interpretado como "entrou na etapa de atendimento, disparado logo após o
  // primeiro contato da equipe" — é o gatilho existente mais próximo de "a
  // equipe acabou de agir sobre esse lead".
  const gatilhoData: GatilhoEtapaData = { funilId: FUNIL_ID_SEED, etapaId: "novo", disparoImediato: true };
  nodes.push(
    no(
      "rl-gatilho",
      "lead_entrou_etapa",
      "gatilho",
      gatilhoData,
      "Entrou na etapa de atendimento",
      "Disparado logo após o primeiro contato da equipe (mapeamento mais próximo disponível pra \"lead recebeu mensagem da equipe\" — não existe um gatilho literal de \"mensagem enviada pela equipe\" nos tipos atuais).",
    ),
  );

  const esperaInicial: AguardarData = { modo: "horas", valor: 2 };
  nodes.push(no("rl-espera1", "aguardar", "espera", esperaInicial));
  edges.push(aresta("rl-gatilho", "rl-espera1"));

  const condRespondeu: CondicaoGrupoData = {
    grupo: { id: "rl-cond1-grupo", tipo: "E", regras: [{ id: "rl-cond1-regra1", campo: "respondeu", operador: "igual", valor: "sim" }], subgrupos: [] },
  };
  nodes.push(no("rl-cond1", "condicao_grupo", "condicao", condRespondeu, "O lead respondeu?"));
  edges.push(aresta("rl-espera1", "rl-cond1"));

  // Ramo SIM — lead respondeu: a inexistência de qualquer aresta partindo do
  // handle "sim" em direção aos blocos de lembrete/follow-up abaixo É a forma
  // como esse grafo já implementa "cancelar as mensagens futuras se o lead
  // responder" — não existe (nem precisa existir) um bloco de "cancelamento"
  // à parte, o motor simplesmente nunca visita esses nós nesse ramo.
  const etqRespondeu: AdicionarEtiquetaData = { etiquetaNome: "Lead respondeu" };
  nodes.push(no("rl-etq1", "adicionar_etiqueta", "acao", etqRespondeu));
  edges.push(aresta("rl-cond1", "rl-etq1", "sim"));

  const etqRemAguardando: RemoverEtiquetaData = { etiquetaNome: "Aguardando resposta" };
  nodes.push(no("rl-etq2", "remover_etiqueta", "acao", etqRemAguardando));
  edges.push(aresta("rl-etq1", "rl-etq2"));

  const manterResp: AlterarResponsavelData = { atendenteNome: "Responsável atual" };
  nodes.push(no("rl-resp1", "alterar_responsavel", "acao", manterResp, "Manter responsável atual"));
  edges.push(aresta("rl-etq2", "rl-resp1"));

  const fimSim: EncerrarFluxoData = { motivo: "Lead respondeu — fluxo de recuperação encerrado." };
  nodes.push(no("rl-fim1", "encerrar_fluxo", "fim", fimSim));
  edges.push(aresta("rl-resp1", "rl-fim1"));

  // Ramo NÃO — sem resposta: checa a janela de horário permitido antes de
  // mandar o lembrete. Escolha de modelagem (documentada): em vez de duplicar
  // a mensagem de lembrete em dois ramos idênticos, o caminho "fora do
  // horário" só insere um `aguardar` até a janela abrir e depois converge de
  // volta pro mesmo nó de mensagem que o caminho "dentro do horário" usa.
  const condHorario: CondicaoGrupoData = {
    grupo: { id: "rl-cond2-grupo", tipo: "E", regras: [{ id: "rl-cond2-regra1", campo: "horario", operador: "igual", valor: "sim" }], subgrupos: [] },
  };
  nodes.push(no("rl-cond2", "condicao_grupo", "condicao", condHorario, "Dentro do horário permitido?"));
  edges.push(aresta("rl-cond1", "rl-cond2", "nao"));

  const esperaHorario: AguardarData = { modo: "ate_horario" };
  nodes.push(no("rl-espera2", "aguardar", "espera", esperaHorario, "Aguardar abrir o horário permitido"));
  edges.push(aresta("rl-cond2", "rl-espera2", "nao"));

  const msgLembrete: MensagemTextoData = {
    canal: "whatsapp",
    texto: "Oi, {primeiro_nome}! Passando pra saber se você viu nossa última mensagem — posso te ajudar com mais alguma informação?",
  };
  nodes.push(no("rl-msg1", "mensagem_texto", "mensagem", msgLembrete));
  edges.push(aresta("rl-cond2", "rl-msg1", "sim"));
  edges.push(aresta("rl-espera2", "rl-msg1"));

  const etqFollowup: AdicionarEtiquetaData = { etiquetaNome: "Follow-up automático" };
  nodes.push(no("rl-etq3", "adicionar_etiqueta", "acao", etqFollowup));
  edges.push(aresta("rl-msg1", "rl-etq3"));

  const espera24h: AguardarData = { modo: "horas", valor: 24 };
  nodes.push(no("rl-espera3", "aguardar", "espera", espera24h));
  edges.push(aresta("rl-etq3", "rl-espera3"));

  const condFollowup: CondicaoGrupoData = {
    grupo: { id: "rl-cond3-grupo", tipo: "E", regras: [{ id: "rl-cond3-regra1", campo: "respondeu", operador: "igual", valor: "sim" }], subgrupos: [] },
  };
  nodes.push(no("rl-cond3", "condicao_grupo", "condicao", condFollowup, "Respondeu ao follow-up?"));
  edges.push(aresta("rl-espera3", "rl-cond3"));

  const etqRecuperado: AdicionarEtiquetaData = { etiquetaNome: "Lead recuperado" };
  nodes.push(no("rl-etq4", "adicionar_etiqueta", "acao", etqRecuperado));
  edges.push(aresta("rl-cond3", "rl-etq4", "sim"));

  const tarefaRecuperado: CriarTarefaData = { titulo: "Fazer contato com lead recuperado", prazoValor: 1, prazoUnidade: "horas", responsavel: "Responsável atual" };
  nodes.push(no("rl-tarefa1", "criar_tarefa", "acao", tarefaRecuperado));
  edges.push(aresta("rl-etq4", "rl-tarefa1"));

  const fimRecuperado: EncerrarFluxoData = { motivo: "Lead recuperado após follow-up." };
  nodes.push(no("rl-fim2", "encerrar_fluxo", "fim", fimRecuperado));
  edges.push(aresta("rl-tarefa1", "rl-fim2"));

  const tarefaSemResposta: CriarTarefaData = { titulo: "Entrar em contato com lead", prazoValor: 2, prazoUnidade: "horas" };
  nodes.push(no("rl-tarefa2", "criar_tarefa", "acao", tarefaSemResposta));
  edges.push(aresta("rl-cond3", "rl-tarefa2", "nao"));

  const notifSemResposta: EnviarNotificacaoData = { paraEquipe: "Responsável atual", mensagem: "Lead sem resposta após o follow-up automático — contato manual necessário." };
  nodes.push(no("rl-notif1", "enviar_notificacao", "mensagem", notifSemResposta));
  edges.push(aresta("rl-tarefa2", "rl-notif1"));

  const etqSemResposta: AdicionarEtiquetaData = { etiquetaNome: "Sem resposta" };
  nodes.push(no("rl-etq5", "adicionar_etiqueta", "acao", etqSemResposta));
  edges.push(aresta("rl-notif1", "rl-etq5"));

  const fimSemResposta: EncerrarFluxoData = { motivo: "Lead permaneceu sem resposta." };
  nodes.push(no("rl-fim3", "encerrar_fluxo", "fim", fimSemResposta));
  edges.push(aresta("rl-etq5", "rl-fim3"));

  const configuracoes: ConfiguracoesFluxo = {
    usarHorario: true,
    horarioInicio: "09:00",
    horarioFim: "19:00",
    foraDaJanela: "aguardar",
    naoIniciarSeJaNoFluxo: true,
    // `limiteExecucao` não tem uma opção de "a cada N dias" genérica — o valor
    // mais próximo de "no máximo uma vez a cada 7 dias" disponível no enum é
    // "uma_vez_por_semana" (documentado aqui por causa da granularidade limitada do enum atual).
    limiteExecucao: "uma_vez_por_semana",
  };

  return fluxoDemo({
    id: "demo-recuperar-lead",
    nome: "Recuperar lead sem resposta",
    descricao: "Recupera leads que não responderam e cria tarefas para a equipe.",
    objetivo:
      "Detectar leads que ficaram sem resposta após o primeiro contato, tentar reengajar com um lembrete automático dentro do horário comercial e, se mesmo assim não houver resposta, garantir que a equipe seja notificada com uma tarefa.",
    funilId: FUNIL_ID_SEED,
    etapaId: "novo",
    nodes,
    edges,
    configuracoes,
  });
}

/* -------------------------------------------------------------------------- */
/* Automação 2 — "Distribuir e qualificar novo lead"                         */
/* -------------------------------------------------------------------------- */

function construirDistribuirLead(): FluxoAutomacao {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  nodes.push(no("dl-gatilho", "lead_criado", "gatilho", {}));

  // Modelagem do split de 3 vias (documentada): `GrupoCondicoes` só tem
  // avaliação binária sim/não por nó (ver `avaliarGrupoCondicoes` em
  // motor.ts), então a bifurcação de 3 caminhos do brief vira DOIS nós
  // `condicao_grupo` encadeados: o primeiro cobre "anúncio OU formulário"
  // (grupo tipo "OU"), o segundo (só no ramo "não") cobre "whatsapp" —
  // sobrando "sem origem" pro "não" final.
  const condOrigemAB: CondicaoGrupoData = {
    grupo: {
      id: "dl-cond1-grupo",
      tipo: "OU",
      regras: [
        { id: "dl-cond1-regra1", campo: "origem", operador: "igual", valor: "anuncio" },
        { id: "dl-cond1-regra2", campo: "origem", operador: "igual", valor: "formulario" },
      ],
      subgrupos: [],
    },
  };
  nodes.push(no("dl-cond1", "condicao_grupo", "condicao", condOrigemAB, "Veio de anúncio ou formulário?"));
  edges.push(aresta("dl-gatilho", "dl-cond1"));

  const condOrigemWpp: CondicaoGrupoData = {
    grupo: { id: "dl-cond2-grupo", tipo: "E", regras: [{ id: "dl-cond2-regra1", campo: "origem", operador: "igual", valor: "whatsapp" }], subgrupos: [] },
  };
  nodes.push(no("dl-cond2", "condicao_grupo", "condicao", condOrigemWpp, "Veio do WhatsApp?"));
  edges.push(aresta("dl-cond1", "dl-cond2", "nao"));

  // ---- Ramo A: anúncio/formulário ----
  const etqAnuncio: AdicionarEtiquetaData = { etiquetaNome: "Origem: Anúncio" };
  nodes.push(no("dl-a-etq", "adicionar_etiqueta", "acao", etqAnuncio));
  edges.push(aresta("dl-cond1", "dl-a-etq", "sim"));

  const alterarEtapaA: AlterarEtapaData = { funilId: FUNIL_ID_SEED, etapaTitulo: ETAPA_NOVO_SEED };
  nodes.push(no("dl-a-etapa", "alterar_etapa", "acao", alterarEtapaA));
  edges.push(aresta("dl-a-etq", "dl-a-etapa"));

  nodes.push(no("dl-a-dist", "distribuir_disponibilidade", "acao", {}));
  edges.push(aresta("dl-a-etapa", "dl-a-dist"));

  const tarefaA: CriarTarefaData = { titulo: "Fazer primeiro contato", prazoValor: 15, prazoUnidade: "minutos" };
  nodes.push(no("dl-a-tarefa", "criar_tarefa", "acao", tarefaA));
  edges.push(aresta("dl-a-dist", "dl-a-tarefa"));
  edges.push(aresta("dl-a-tarefa", "dl-check"));

  // ---- Ramo B: WhatsApp ----
  const etqWpp: AdicionarEtiquetaData = { etiquetaNome: "WhatsApp" };
  nodes.push(no("dl-b-etq", "adicionar_etiqueta", "acao", etqWpp));
  edges.push(aresta("dl-cond2", "dl-b-etq", "sim"));

  const respWpp: AlterarResponsavelData = { atendenteNome: "Atendente da conversa" };
  nodes.push(no("dl-b-resp", "alterar_responsavel", "acao", respWpp, "Mantém responsável da conversa, se existir"));
  edges.push(aresta("dl-b-etq", "dl-b-resp"));

  const negocioB: CriarNegocioData = { nome: "Novo negócio via WhatsApp", funilId: FUNIL_ID_SEED, etapaTitulo: ETAPA_NOVO_SEED };
  nodes.push(no("dl-b-negocio", "criar_negocio", "acao", negocioB));
  edges.push(aresta("dl-b-resp", "dl-b-negocio"));
  edges.push(aresta("dl-b-negocio", "dl-check"));

  // ---- Ramo C: sem origem identificada ----
  const etqSemOrigem: AdicionarEtiquetaData = { etiquetaNome: "Origem não identificada" };
  nodes.push(no("dl-c-etq", "adicionar_etiqueta", "acao", etqSemOrigem));
  edges.push(aresta("dl-cond2", "dl-c-etq", "nao"));

  const encaminharC: EncaminharEquipeData = { equipeNome: "Fila geral" };
  nodes.push(no("dl-c-encam", "encaminhar_equipe", "acao", encaminharC));
  edges.push(aresta("dl-c-etq", "dl-c-encam"));

  const tarefaC: CriarTarefaData = { titulo: "Revisar origem do lead" };
  nodes.push(no("dl-c-tarefa", "criar_tarefa", "acao", tarefaC));
  edges.push(aresta("dl-c-encam", "dl-c-tarefa"));
  edges.push(aresta("dl-c-tarefa", "dl-check"));

  // ---- Convergência: "nome preenchido?" ----
  const condNome: CondicaoGrupoData = {
    grupo: {
      id: "dl-check-grupo",
      tipo: "E",
      regras: [{ id: "dl-check-regra1", campo: "campo_personalizado", campoPersonalizadoNome: "nome", operador: "existe" }],
      subgrupos: [],
    },
  };
  nodes.push(no("dl-check", "condicao_grupo", "condicao", condNome, "Nome preenchido?"));

  const msgComNome: MensagemTextoData = {
    canal: "whatsapp",
    texto: "Olá, {primeiro_nome}! Recebemos seu contato e já estamos preparando o atendimento. Em instantes alguém da nossa equipe fala com você.",
  };
  nodes.push(no("dl-msg-com-nome", "mensagem_texto", "mensagem", msgComNome));
  edges.push(aresta("dl-check", "dl-msg-com-nome", "sim"));

  const msgSemNome: MensagemTextoData = {
    canal: "whatsapp",
    texto: "Olá! Recebemos seu contato e já estamos preparando o atendimento. Pode nos contar seu nome, por favor?",
  };
  nodes.push(no("dl-msg-sem-nome", "mensagem_texto", "mensagem", msgSemNome));
  edges.push(aresta("dl-check", "dl-msg-sem-nome", "nao"));

  const notifResp: EnviarNotificacaoData = { paraEquipe: "Responsável atual", mensagem: "Novo lead distribuído — primeiro atendimento pendente." };
  nodes.push(no("dl-notif", "enviar_notificacao", "mensagem", notifResp));
  edges.push(aresta("dl-msg-com-nome", "dl-notif"));
  edges.push(aresta("dl-msg-sem-nome", "dl-notif"));

  // `AguardarData.modo` não tem um "aguardar atendimento" literal — o mapeamento
  // mais honesto é `ate_tarefa` (esperar a tarefa "Fazer primeiro contato" ser
  // concluída), com `tempoMaximo` alinhado ao SLA de 15 minutos pra gerar os
  // handles "ok"/"timeout".
  const esperaAtendimento: AguardarData = { modo: "ate_tarefa", tempoMaximo: { valor: 15, unidade: "minutos" } };
  nodes.push(no("dl-espera", "aguardar", "espera", esperaAtendimento, "Aguardar primeiro atendimento"));
  edges.push(aresta("dl-notif", "dl-espera"));

  const fimOk: EncerrarFluxoData = { motivo: "Primeiro atendimento feito dentro do prazo." };
  nodes.push(no("dl-fim-ok", "encerrar_fluxo", "fim", fimOk));
  edges.push(aresta("dl-espera", "dl-fim-ok", "ok"));

  const notifGestor: EnviarNotificacaoData = { paraEquipe: "Gestor", mensagem: "Lead sem primeiro atendimento dentro do prazo de 15 minutos." };
  nodes.push(no("dl-notif-gestor", "enviar_notificacao", "mensagem", notifGestor));
  edges.push(aresta("dl-espera", "dl-notif-gestor", "timeout"));

  const statusAtrasado: AtualizarStatusData = { status: "Atendimento atrasado" };
  nodes.push(no("dl-status", "atualizar_status", "acao", statusAtrasado));
  edges.push(aresta("dl-notif-gestor", "dl-status"));

  nodes.push(
    no(
      "dl-dist2",
      "distribuir_disponibilidade",
      "acao",
      {},
      "Redistribuir disponibilidade",
      "Redistribui pra outro atendente disponível quando essa regra estiver configurada.",
    ),
  );
  edges.push(aresta("dl-status", "dl-dist2"));

  const fimTimeout: EncerrarFluxoData = { motivo: "Atendimento atrasado — escalado pro gestor." };
  nodes.push(no("dl-fim-timeout", "encerrar_fluxo", "fim", fimTimeout));
  edges.push(aresta("dl-dist2", "dl-fim-timeout"));

  const configuracoes: ConfiguracoesFluxo = {
    naoIniciarSeJaNoFluxo: true,
    // "uma_vez_por_contato" combinado com `naoIniciarSeJaNoFluxo` é o par mais
    // próximo do requisito "impedir criação duplicada de negociação".
    limiteExecucao: "uma_vez_por_contato",
  };

  return fluxoDemo({
    id: "demo-distribuir-lead",
    nome: "Distribuir e qualificar novo lead",
    descricao: "Distribui novos leads, cria negociação e acompanha o primeiro atendimento.",
    objetivo:
      "Rotear automaticamente cada lead novo pro caminho certo conforme a origem (anúncio, formulário, WhatsApp ou desconhecida), garantir que o primeiro atendimento aconteça dentro do prazo e escalar pro gestor quando o SLA estourar.",
    // Funil/etapa/equipe ficam configuráveis pelo usuário — não fixados no nível do fluxo
    // (só os nós individuais de ação abaixo usam um funil/etapa concreto do seed, pra
    // continuarem válidos/testáveis mesmo sem essa configuração de nível de fluxo).
    nodes,
    edges,
    configuracoes,
  });
}

/* -------------------------------------------------------------------------- */
/* Automação 3 — "Pós-venda e relacionamento com cliente"                    */
/* -------------------------------------------------------------------------- */

function construirPosVenda(): FluxoAutomacao {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  // Mapeamento de gatilho (julgamento documentado, mesmo padrão da Automação 1):
  // não existe um `venda_concluida` literal em `FlowNodeType` — `pagamento_aprovado`
  // é o gatilho existente que mais diretamente representa "a venda foi concluída".
  nodes.push(no("pv-gatilho", "pagamento_aprovado", "gatilho", {}, "Pagamento aprovado (venda concluída)"));

  const etqCliente: AdicionarEtiquetaData = { etiquetaNome: "Cliente" };
  nodes.push(no("pv-etq1", "adicionar_etiqueta", "acao", etqCliente));
  edges.push(aresta("pv-gatilho", "pv-etq1"));

  const etqRemNegociacao: RemoverEtiquetaData = { etiquetaNome: "Em negociação" };
  nodes.push(no("pv-etq2", "remover_etiqueta", "acao", etqRemNegociacao));
  edges.push(aresta("pv-etq1", "pv-etq2"));

  const campoData: AtualizarCampoData = { campoNome: "data_primeira_compra", valor: "{data}" };
  nodes.push(
    no(
      "pv-campo1",
      "atualizar_campo",
      "acao",
      campoData,
      undefined,
      "Valor ilustrativo/instrucional — seria preenchido com a data real do negócio quando conectado a um backend de verdade.",
    ),
  );
  edges.push(aresta("pv-etq2", "pv-campo1"));

  const espera7d: AguardarData = { modo: "dias", valor: 7 };
  nodes.push(no("pv-espera1", "aguardar", "espera", espera7d));
  edges.push(aresta("pv-campo1", "pv-espera1"));

  const msgAcompanhamento: MensagemTextoData = {
    canal: "whatsapp",
    texto: "Oi, {primeiro_nome}! Já faz uma semana desde a sua compra — como está sendo a experiência até aqui?",
  };
  nodes.push(no("pv-msg1", "mensagem_texto", "mensagem", msgAcompanhamento));
  edges.push(aresta("pv-espera1", "pv-msg1"));

  const opcoes: MensagemBotoesData["opcoes"] = [
    { id: "satisfeito", rotulo: "Estou satisfeito" },
    { id: "ajuda", rotulo: "Preciso de ajuda" },
    { id: "insatisfeito", rotulo: "Não fiquei satisfeito" },
  ];
  const msgBotoes: MensagemBotoesData = {
    canal: "whatsapp",
    texto: "Olá, {primeiro_nome}! Como você avalia sua experiência com a gente até agora?",
    opcoes,
  };
  nodes.push(no("pv-msg2", "mensagem_botoes", "mensagem", msgBotoes));
  edges.push(aresta("pv-msg1", "pv-msg2"));

  // ---- Opção "Estou satisfeito" ----
  const etqSatisfeito: AdicionarEtiquetaData = { etiquetaNome: "Cliente satisfeito" };
  nodes.push(no("pv-sat-etq", "adicionar_etiqueta", "acao", etqSatisfeito));
  edges.push(aresta("pv-msg2", "pv-sat-etq", "satisfeito"));

  const msgAgradecimento: MensagemTextoData = { canal: "whatsapp", texto: "Que ótimo saber disso, {primeiro_nome}! Muito obrigado pela confiança. 🙌" };
  nodes.push(no("pv-sat-msg", "mensagem_texto", "mensagem", msgAgradecimento));
  edges.push(aresta("pv-sat-etq", "pv-sat-msg"));

  // Não existe um bloco literal de "pedir avaliação" no catálogo — reaproveita
  // `enviar_notificacao` como um registro interno de "solicitar avaliação,
  // quando essa integração estiver configurada" (documentado no título/observação).
  const notifAvaliacao: EnviarNotificacaoData = { paraEquipe: "Marketing", mensagem: "Cliente satisfeito — solicitar avaliação pública quando a integração estiver configurada." };
  nodes.push(no("pv-sat-notif", "enviar_notificacao", "mensagem", notifAvaliacao, "Solicitar avaliação (quando configurado)"));
  edges.push(aresta("pv-sat-msg", "pv-sat-notif"));

  const espera30d: AguardarData = { modo: "dias", valor: 30 };
  nodes.push(no("pv-sat-espera", "aguardar", "espera", espera30d));
  edges.push(aresta("pv-sat-notif", "pv-sat-espera"));

  const negocioRecompra: CriarNegocioData = { nome: "Oportunidade de recompra", funilId: FUNIL_ID_SEED, etapaTitulo: ETAPA_NOVO_SEED };
  nodes.push(no("pv-sat-negocio", "criar_negocio", "acao", negocioRecompra, "Oportunidade de recompra"));
  edges.push(aresta("pv-sat-espera", "pv-sat-negocio"));

  const fimSatisfeito: EncerrarFluxoData = { motivo: "Pós-venda concluído — cliente satisfeito." };
  nodes.push(no("pv-sat-fim", "encerrar_fluxo", "fim", fimSatisfeito));
  edges.push(aresta("pv-sat-negocio", "pv-sat-fim"));

  // ---- Opção "Preciso de ajuda" ----
  const etqAjuda: AdicionarEtiquetaData = { etiquetaNome: "Atenção no pós-venda" };
  nodes.push(no("pv-ajuda-etq", "adicionar_etiqueta", "acao", etqAjuda));
  edges.push(aresta("pv-msg2", "pv-ajuda-etq", "ajuda"));

  // `CriarTarefaData` não tem campo de prioridade — a urgência fica explícita no título.
  const tarefaAjuda: CriarTarefaData = { titulo: "Atender cliente em pós-venda — urgente", prazoValor: 1, prazoUnidade: "horas" };
  nodes.push(no("pv-ajuda-tarefa", "criar_tarefa", "acao", tarefaAjuda));
  edges.push(aresta("pv-ajuda-etq", "pv-ajuda-tarefa"));

  const encamAjuda: EncaminharHumanoData = { destino: "equipe", equipeNome: "Suporte" };
  nodes.push(no("pv-ajuda-encam", "encaminhar_humano", "humano", encamAjuda));
  edges.push(aresta("pv-ajuda-tarefa", "pv-ajuda-encam"));

  nodes.push(no("pv-ajuda-pausa", "pausar_automacoes", "acao", {}));
  edges.push(aresta("pv-ajuda-encam", "pv-ajuda-pausa"));

  const fimAjuda: EncerrarFluxoData = { motivo: "Encaminhado pro suporte humano." };
  nodes.push(no("pv-ajuda-fim", "encerrar_fluxo", "fim", fimAjuda));
  edges.push(aresta("pv-ajuda-pausa", "pv-ajuda-fim"));

  // ---- Opção "Não fiquei satisfeito" ----
  const etqInsatisfeito: AdicionarEtiquetaData = { etiquetaNome: "Cliente insatisfeito" };
  nodes.push(no("pv-insat-etq", "adicionar_etiqueta", "acao", etqInsatisfeito));
  edges.push(aresta("pv-msg2", "pv-insat-etq", "insatisfeito"));

  const notifGestorInsat: EnviarNotificacaoData = { paraEquipe: "Gestor", mensagem: "Cliente insatisfeito no pós-venda — atenção prioritária." };
  nodes.push(no("pv-insat-notif", "enviar_notificacao", "mensagem", notifGestorInsat));
  edges.push(aresta("pv-insat-etq", "pv-insat-notif"));

  const tarefaInsat: CriarTarefaData = { titulo: "Recuperar cliente insatisfeito", prazoValor: 2, prazoUnidade: "horas" };
  nodes.push(no("pv-insat-tarefa", "criar_tarefa", "acao", tarefaInsat));
  edges.push(aresta("pv-insat-notif", "pv-insat-tarefa"));

  const encamInsat: EncaminharHumanoData = { destino: "equipe", equipeNome: "Suporte" };
  nodes.push(no("pv-insat-encam", "encaminhar_humano", "humano", encamInsat));
  edges.push(aresta("pv-insat-tarefa", "pv-insat-encam"));

  const fimInsatisfeito: EncerrarFluxoData = { motivo: "Encerra mensagens automáticas — cliente insatisfeito segue com atendimento humano." };
  nodes.push(no("pv-insat-fim", "encerrar_fluxo", "fim", fimInsatisfeito));
  edges.push(aresta("pv-insat-encam", "pv-insat-fim"));

  // ---- Caminho implícito "não respondeu" ----
  // `saidasDoNo` (resumo.ts) já gera os handles "outra_resposta"/"nao_respondeu"
  // automaticamente pra todo nó `mensagem_botoes`/`mensagem_lista" — então,
  // diferente do que uma leitura apressada da brief sugeriria, esse caminho É
  // representável no modelo atual. Ambos os handles convergem pro mesmo
  // lembrete único, já que a brief só descreve um comportamento pra "sem resposta".
  const espera3d: AguardarData = { modo: "dias", valor: 3 };
  nodes.push(no("pv-naoresp-espera", "aguardar", "espera", espera3d));
  edges.push(aresta("pv-msg2", "pv-naoresp-espera", "nao_respondeu"));
  edges.push(aresta("pv-msg2", "pv-naoresp-espera", "outra_resposta"));

  const msgLembreteUnico: MensagemTextoData = {
    canal: "whatsapp",
    texto: "Oi, {primeiro_nome}! Só passando pra saber se ficou tudo certo com sua compra — qualquer coisa, é só chamar.",
  };
  nodes.push(no("pv-naoresp-msg", "mensagem_texto", "mensagem", msgLembreteUnico));
  edges.push(aresta("pv-naoresp-espera", "pv-naoresp-msg"));

  const fimNaoRespondeu: EncerrarFluxoData = { motivo: "Sem resposta após o lembrete único — fluxo encerrado." };
  nodes.push(no("pv-naoresp-fim", "encerrar_fluxo", "fim", fimNaoRespondeu));
  edges.push(aresta("pv-naoresp-msg", "pv-naoresp-fim"));

  const configuracoes: ConfiguracoesFluxo = {
    // Evita reprocessar o mesmo evento de pagamento aprovado no mesmo dia
    // (ex.: parcelas aprovadas em sequência) sem impedir um novo ciclo de
    // pós-venda numa compra futura.
    limiteExecucao: "uma_vez_por_dia",
    naoIniciarSeJaNoFluxo: true,
  };

  return fluxoDemo({
    id: "demo-pos-venda",
    nome: "Pós-venda e relacionamento com cliente",
    descricao: "Realiza o pós-venda, mede satisfação e prepara a recompra.",
    objetivo:
      "Acompanhar o cliente logo após a compra, medir satisfação com uma pergunta direta e ramificar o atendimento — elogio vira pedido de avaliação e chance de recompra, problema vira encaminhamento humano prioritário.",
    nodes,
    edges,
    configuracoes,
  });
}

/* -------------------------------------------------------------------------- */
/* Automação 4 — "Boas-vindas e triagem do lead novo"                        */
/* -------------------------------------------------------------------------- */

/**
 * O modelo mais simples dos quatro, de propósito: é o primeiro exemplo que
 * alguém abre pra entender o construtor (gatilho → uma pergunta de botões →
 * dois ramos curtos → fim), sem condições encadeadas nem convergência — isso
 * já existe nos outros três modelos.
 */
function construirBoasVindas(): FluxoAutomacao {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  nodes.push(no("bv-gatilho", "lead_criado", "gatilho", {}, "Novo contato chegou"));

  const triagem: MensagemBotoesData = {
    canal: "whatsapp",
    texto: "Oi! Recebemos seu contato 💙 Antes de continuar, me conta uma coisa:",
    opcoes: [
      { id: "bv-op-paciente", rotulo: "Já sou paciente da clínica" },
      { id: "bv-op-novo", rotulo: "É minha primeira vez por aqui" },
    ],
    formatoResposta: "botoes",
  };
  nodes.push(no("bv-triagem", "mensagem_botoes", "mensagem", triagem, "Pergunta e espera a resposta"));
  edges.push(aresta("bv-gatilho", "bv-triagem"));

  // Ramo "já é paciente" — reconhece quem já tem histórico e encaminha pra um
  // atendimento de retorno, sem repetir a triagem de lead novo.
  const etqRecorrente: AdicionarEtiquetaData = { etiquetaNome: "Paciente recorrente" };
  nodes.push(no("bv-etq-recorrente", "adicionar_etiqueta", "acao", etqRecorrente));
  edges.push(aresta("bv-triagem", "bv-etq-recorrente", "bv-op-paciente"));

  const tarefaRecorrente: CriarTarefaData = { titulo: "Confirmar retorno e agendar horário", prazoValor: 2, prazoUnidade: "horas" };
  nodes.push(no("bv-tarefa-recorrente", "criar_tarefa", "acao", tarefaRecorrente));
  edges.push(aresta("bv-etq-recorrente", "bv-tarefa-recorrente"));

  const fimRecorrente: EncerrarFluxoData = { motivo: "Paciente recorrente encaminhado pro atendimento de retorno." };
  nodes.push(no("bv-fim-recorrente", "encerrar_fluxo", "fim", fimRecorrente));
  edges.push(aresta("bv-tarefa-recorrente", "bv-fim-recorrente"));

  // Ramo "primeira vez" — manda uma mensagem de boas-vindas própria e cria a
  // tarefa de triagem inicial pra equipe.
  const msgBoasVindas: MensagemTextoData = {
    canal: "whatsapp",
    texto: "Seja muito bem-vindo(a)! Vou te mandar as informações da clínica e já aviso a equipe do seu contato.",
  };
  nodes.push(no("bv-msg-novo", "mensagem_texto", "mensagem", msgBoasVindas));
  edges.push(aresta("bv-triagem", "bv-msg-novo", "bv-op-novo"));

  const etqNovo: AdicionarEtiquetaData = { etiquetaNome: "Lead novo" };
  nodes.push(no("bv-etq-novo", "adicionar_etiqueta", "acao", etqNovo));
  edges.push(aresta("bv-msg-novo", "bv-etq-novo"));

  const tarefaNovo: CriarTarefaData = { titulo: "Fazer a triagem inicial do lead novo", prazoValor: 1, prazoUnidade: "horas" };
  nodes.push(no("bv-tarefa-novo", "criar_tarefa", "acao", tarefaNovo));
  edges.push(aresta("bv-etq-novo", "bv-tarefa-novo"));

  const fimNovo: EncerrarFluxoData = { motivo: "Lead novo triado — tarefa criada pra equipe." };
  nodes.push(no("bv-fim-novo", "encerrar_fluxo", "fim", fimNovo));
  edges.push(aresta("bv-tarefa-novo", "bv-fim-novo"));

  const configuracoes: ConfiguracoesFluxo = {
    naoIniciarSeJaNoFluxo: true,
  };

  return fluxoDemo({
    id: "demo-boas-vindas-triagem",
    nome: "Boas-vindas e triagem do lead novo",
    descricao: "Recebe o contato, faz uma pergunta rápida por botões e direciona pro atendimento certo.",
    objetivo:
      "Servir de primeiro exemplo pra quem nunca usou o construtor: um gatilho, uma pergunta de múltipla escolha e dois caminhos curtos — sem condição encadeada nem convergência, pra não competir com os outros modelos mais avançados.",
    funilId: FUNIL_ID_SEED,
    etapaId: "novo",
    nodes,
    edges,
    configuracoes,
  });
}

/* -------------------------------------------------------------------------- */
/* Automação 5 — "Atendimento — Empresa de Toldos" (item 10 da spec de mídia) */
/* -------------------------------------------------------------------------- */

/**
 * Modelo pensado especificamente pra mostrar os dois pontos novos desta rodada
 * funcionando juntos num caso real: um bloco "Enviar documento" apontando pra
 * um arquivo da biblioteca reutilizável (`arq-catalogo-toldos`, ver
 * `biblioteca-documentos-context.tsx`) e uma pergunta em formato "menu
 * numerado" com 4 opções virando 4 caminhos separados (sem convergência).
 */
function construirAtendimentoToldos(): FluxoAutomacao {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  const gatilhoData: PalavraChaveData = { palavra: "toldo", canal: "whatsapp" };
  nodes.push(no("at-gatilho", "palavra_chave", "gatilho", gatilhoData, "Mensagem recebida contendo \"toldo\""));

  const msgInicial: MensagemTextoData = {
    canal: "whatsapp",
    texto: "Olá, {primeiro_nome}! Trabalhamos com vários modelos de toldos.",
  };
  nodes.push(no("at-msg1", "mensagem_texto", "mensagem", msgInicial));
  edges.push(aresta("at-gatilho", "at-msg1"));

  // Aponta pro arquivo já cadastrado na biblioteca reutilizável (ver
  // DOCUMENTOS_INICIAIS em biblioteca-documentos-context.tsx) — o mesmo
  // arquivo que outras automações também podem escolher sem reenviar nada.
  const doc: MensagemMidiaData = {
    canal: "whatsapp",
    origemArquivo: "biblioteca",
    arquivoId: "arq-catalogo-toldos",
    arquivoNome: "Catálogo de Toldos 2026.pdf",
    arquivoTipo: "PDF",
    arquivoTamanho: "4,2 MB",
    legenda: "Vou te enviar nosso catálogo para você conhecer os modelos.",
  };
  nodes.push(no("at-doc", "mensagem_documento", "mensagem", doc));
  edges.push(aresta("at-msg1", "at-doc"));

  const pergunta: MensagemBotoesData = {
    canal: "whatsapp",
    texto: "Qual modelo mais chamou sua atenção?",
    formatoResposta: "menu_numerado",
    opcoes: [
      { id: "at-op-retratil", rotulo: "Toldo retrátil" },
      { id: "at-op-fixo", rotulo: "Toldo fixo" },
      { id: "at-op-articulado", rotulo: "Toldo articulado" },
      { id: "at-op-orientacao", rotulo: "Preciso de orientação" },
    ],
  };
  nodes.push(no("at-pergunta", "mensagem_botoes", "mensagem", pergunta, "Qual modelo mais chamou sua atenção?"));
  edges.push(aresta("at-doc", "at-pergunta"));

  // 4 caminhos separados, um por opção — de propósito sem convergir de volta
  // num nó comum, pra deixar claro que cada resposta segue seu próprio rumo.
  const caminhos: { handle: string; etiqueta: string; tarefa: string }[] = [
    { handle: "at-op-retratil", etiqueta: "Interesse: toldo retrátil", tarefa: "Enviar orçamento de toldo retrátil" },
    { handle: "at-op-fixo", etiqueta: "Interesse: toldo fixo", tarefa: "Enviar orçamento de toldo fixo" },
    { handle: "at-op-articulado", etiqueta: "Interesse: toldo articulado", tarefa: "Enviar orçamento de toldo articulado" },
    { handle: "at-op-orientacao", etiqueta: "Precisa de orientação", tarefa: "Ligar pra entender a necessidade e orientar" },
  ];
  caminhos.forEach(({ handle, etiqueta, tarefa }, i) => {
    const etqData: AdicionarEtiquetaData = { etiquetaNome: etiqueta };
    nodes.push(no(`at-etq-${i}`, "adicionar_etiqueta", "acao", etqData));
    edges.push(aresta("at-pergunta", `at-etq-${i}`, handle));

    const tarefaData: CriarTarefaData = { titulo: tarefa, prazoValor: 2, prazoUnidade: "horas" };
    nodes.push(no(`at-tarefa-${i}`, "criar_tarefa", "acao", tarefaData));
    edges.push(aresta(`at-etq-${i}`, `at-tarefa-${i}`));

    const fimData: EncerrarFluxoData = { motivo: `Caminho "${etiqueta}" concluído.` };
    nodes.push(no(`at-fim-${i}`, "encerrar_fluxo", "fim", fimData));
    edges.push(aresta(`at-tarefa-${i}`, `at-fim-${i}`));
  });

  const configuracoes: ConfiguracoesFluxo = {
    naoIniciarSeJaNoFluxo: true,
  };

  return fluxoDemo({
    id: "demo-atendimento-toldos",
    nome: "Atendimento — Empresa de Toldos",
    descricao: "Responde quem menciona \"toldo\", manda o catálogo da biblioteca e pergunta o modelo de interesse.",
    objetivo:
      "Mostrar o bloco de documento ligado à biblioteca de arquivos reutilizável e uma pergunta em menu numerado virando 4 caminhos separados — o exemplo de referência dos itens de compatibilidade de pergunta e biblioteca de arquivos.",
    nodes,
    edges,
    configuracoes,
  });
}

/* -------------------------------------------------------------------------- */

export const FLUXOS_DEMONSTRACAO_INICIAIS: FluxoAutomacao[] = [
  construirBoasVindas(),
  construirAtendimentoToldos(),
  construirRecuperarLead(),
  construirDistribuirLead(),
  construirPosVenda(),
];
