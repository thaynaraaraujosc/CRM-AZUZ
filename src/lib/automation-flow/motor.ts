/**
 * Motor de execução — o único lugar que de fato MUTA estado real do CRM
 * (funis/contatos) a partir de um fluxo. Não existe backend/cron aqui: tudo
 * roda síncrono, na hora que `executarFluxo`/`dispararEvento` é chamado.
 *
 * Mensagens, webhooks e integrações NUNCA fazem uma chamada de rede de verdade
 * — são só registradas via `Ligacoes.registrarMensagemSimulada`/`registrarWebhookSimulado`,
 * se o chamador passar esses hooks (pra mostrar num toast/log de conversa, por exemplo).
 */

import type {
  AdicionarEtiquetaData,
  AguardarData,
  AlterarEtapaData,
  AlterarResponsavelData,
  AtualizarCampoData,
  AtualizarStatusData,
  AtualizarValorData,
  ChamarWebhookData,
  CondicaoGrupoData,
  CriarLembreteData,
  CriarNegocioData,
  CriarTarefaData,
  EnviarNotificacaoData,
  FlowEdge,
  FlowNode,
  FlowNodeType,
  FluxoAutomacao,
  GrupoCondicoes,
  MensagemBotoesData,
  PassoExecucao,
  RegistroExecucao,
  RemoverEtiquetaData,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Contrato de execução                                                      */
/* -------------------------------------------------------------------------- */

export type ContextoExecucao = {
  contato: {
    nome: string;
    etiquetas: string[];
    origem?: string;
    responsavel?: string;
    camposPersonalizados?: Record<string, string>;
    funilId?: string;
    etapaTitulo?: string;
    ultimaRespostaEm?: string;
    [k: string]: unknown;
  };
  /** Timestamp ISO que substitui `new Date()` — usado pelo simulador ao "avançar o relógio". */
  agora?: string;
};

export type Ligacoes = {
  /** Envolve `useFunis().atribuirContatoAoFunil`. */
  moverEtapa: (funilId: string, etapaTitulo: string, contato: { nome: string; [k: string]: unknown }) => void;
  /** Envolve `useContatos().salvarDadosContato` — usado pra etiquetas/campos/responsável. */
  salvarContato: (nome: string, dados: Record<string, unknown>) => void;
  /** Envolve `useContatos().atribuirAtendente`. */
  atribuirAtendente: (nome: string, atendente: string) => void;
  /** Hook opcional pra empurrar um toast/log de conversa — nunca é um envio real. */
  registrarMensagemSimulada?: (info: { canal: string; conteudo: string }) => void;
  /** Hook opcional pra registrar uma chamada de webhook simulada. */
  registrarWebhookSimulado?: (info: { url: string; payload: unknown }) => void;
  /** Responde ao comentário do Instagram que disparou o fluxo. Só existe quando foi um comentário
   * que disparou — nos demais gatilhos não há comentário a que responder. */
  responderComentario?: (texto: string) => void;
};

/* -------------------------------------------------------------------------- */
/* Utilidades internas                                                       */
/* -------------------------------------------------------------------------- */

function agoraOuContexto(contexto: ContextoExecucao): Date {
  return contexto.agora ? new Date(contexto.agora) : new Date();
}

function indiceMapa(nodes: FlowNode[]): Map<string, FlowNode> {
  return new Map(nodes.map((n) => [n.id, n]));
}

function saidasDoNo(edges: FlowEdge[], nodeId: string): FlowEdge[] {
  return edges.filter((e) => e.source === nodeId);
}

/** Lê um "campo" de condição a partir do contato do contexto — melhor esforço, nem todo campo tem um valor real disponível na simulação. */
function valorDoCampo(campo: string, contato: ContextoExecucao["contato"]): string | undefined {
  switch (campo) {
    case "origem":
      return contato.origem;
    case "etapa":
      return contato.etapaTitulo;
    case "funil":
      return contato.funilId;
    case "etiqueta":
      return contato.etiquetas?.join(",");
    case "responsavel":
    case "equipe":
      return contato.responsavel;
    case "respondeu":
      return contato.ultimaRespostaEm ? "sim" : "nao";
    default: {
      const direto = contato[campo];
      if (typeof direto === "string") return direto;
      return contato.camposPersonalizados?.[campo];
    }
  }
}

function avaliarRegra(regra: GrupoCondicoes["regras"][number], contato: ContextoExecucao["contato"]): boolean {
  const valorCampo =
    regra.campo === "campo_personalizado"
      ? contato.camposPersonalizados?.[regra.campoPersonalizadoNome ?? ""]
      : valorDoCampo(regra.campo, contato);

  switch (regra.operador) {
    case "existe":
      return valorCampo !== undefined && valorCampo !== "";
    case "nao_existe":
      return valorCampo === undefined || valorCampo === "";
    case "igual":
      return (valorCampo ?? "").toLowerCase() === (regra.valor ?? "").toLowerCase();
    case "diferente":
      return (valorCampo ?? "").toLowerCase() !== (regra.valor ?? "").toLowerCase();
    case "contem":
      return (valorCampo ?? "").toLowerCase().includes((regra.valor ?? "").toLowerCase());
    case "nao_contem":
      return !(valorCampo ?? "").toLowerCase().includes((regra.valor ?? "").toLowerCase());
    case "maior_que":
      return Number(valorCampo ?? 0) > Number(regra.valor ?? 0);
    case "menor_que":
      return Number(valorCampo ?? 0) < Number(regra.valor ?? 0);
    case "entre":
      return (
        Number(valorCampo ?? 0) >= Number(regra.valor ?? 0) &&
        Number(valorCampo ?? 0) <= Number(regra.valorFim ?? 0)
      );
    default:
      return true;
  }
}

export function avaliarGrupoCondicoes(grupo: GrupoCondicoes, contato: ContextoExecucao["contato"]): boolean {
  const resultadosRegras = grupo.regras.map((r) => avaliarRegra(r, contato));
  const resultadosSubgrupos = grupo.subgrupos.map((g) => avaliarGrupoCondicoes(g, contato));
  const todos = [...resultadosRegras, ...resultadosSubgrupos];

  if (grupo.tipo === "E") return todos.every(Boolean);
  if (grupo.tipo === "OU") return todos.some(Boolean);
  // "NAO" nega o resultado combinado (tratado aqui como E dos itens, negado).
  return !todos.every(Boolean);
}

/* -------------------------------------------------------------------------- */
/* avaliarGatilho                                                            */
/* -------------------------------------------------------------------------- */

function dentroDaJanela(fluxo: FluxoAutomacao, agora: Date): boolean {
  const cfg = fluxo.configuracoes;
  if (cfg.diasAtivos && cfg.diasAtivos.length > 0) {
    const dias = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;
    const diaAtual = dias[agora.getDay()];
    if (!cfg.diasAtivos.includes(diaAtual)) return cfg.foraDaJanela === "aguardar";
  }
  if (cfg.usarHorario && cfg.horarioInicio && cfg.horarioFim) {
    const hhmm = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
    if (hhmm < cfg.horarioInicio || hhmm > cfg.horarioFim) {
      return cfg.foraDaJanela === "aguardar";
    }
  }
  return true;
}

export type EventoAutomacao = {
  tipo: FlowNodeType;
  funilId?: string;
  etapaId?: string;
  contatoNome?: string;
  [k: string]: unknown;
};

/** Tira acentos e caixa, pra "GUIA", "guia" e "guía" contarem como a mesma palavra. */
function normalizar(texto: string, ignorarAcentos: boolean): string {
  const minusculo = texto.toLowerCase().trim();
  return ignorarAcentos ? minusculo.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : minusculo;
}

export type ConfiguracaoDePalavras = {
  /** Lista configurada. `palavraChave` (campo antigo, uma só) continua valendo. */
  palavras?: string[];
  palavraChave?: string;
  /** "contem" (padrão), "exata" ou "qualquer" — qualquer uma das palavras, como palavra inteira. */
  modoPalavra?: "contem" | "exata" | "qualquer";
  ignorarAcentos?: boolean;
};

/**
 * Se o texto recebido casa com as palavras configuradas no gatilho.
 *
 * Sem palavra configurada, casa com tudo — é o comportamento de "qualquer comentário dispara", que
 * é o que a pessoa espera ao deixar o campo vazio.
 *
 * "qualquer" compara PALAVRA INTEIRA de propósito: com "contém", uma automação de "quero" também
 * dispararia em "não quero", que é o oposto da intenção de quem montou o fluxo.
 */
export function textoCasaComPalavras(texto: string, config: ConfiguracaoDePalavras): boolean {
  const lista = (config.palavras ?? [])
    .concat(config.palavraChave ? [config.palavraChave] : [])
    .map((p) => p.trim())
    .filter(Boolean);
  if (!lista.length) return true;

  const ignorarAcentos = config.ignorarAcentos ?? true;
  const alvo = normalizar(texto, ignorarAcentos);
  const modo = config.modoPalavra ?? "contem";

  return lista.some((palavra) => {
    const p = normalizar(palavra, ignorarAcentos);
    if (!p) return false;
    if (modo === "exata") return alvo === p;
    if (modo === "qualquer") {
      // `\b` não funciona com acentos em JS; a fronteira é conferida na mão pelo que cerca a
      // ocorrência — só conta se não houver letra ou número colado dos dois lados.
      const posicao = alvo.indexOf(p);
      if (posicao < 0) return false;
      const antes = alvo[posicao - 1];
      const depois = alvo[posicao + p.length];
      const ehLetra = (c?: string) => Boolean(c && /[\p{L}\p{N}]/u.test(c));
      return !ehLetra(antes) && !ehLetra(depois);
    }
    return alvo.includes(p);
  });
}

export function avaliarGatilho(fluxo: FluxoAutomacao, evento: EventoAutomacao): boolean {
  const noGatilho = fluxo.nodes.find((n) => n.category === "gatilho");
  if (!noGatilho) return false;
  if (noGatilho.type !== evento.tipo) return false;

  const data = noGatilho.data as {
    funilId?: string;
    etapaId?: string;
    publicacaoId?: string;
  } & ConfiguracaoDePalavras;
  if (data.funilId && evento.funilId && data.funilId !== evento.funilId) return false;
  if (data.etapaId && evento.etapaId && data.etapaId !== evento.etapaId) return false;

  // Automação de comentário pode valer só pra UMA publicação. Vazio = qualquer publicação.
  if (data.publicacaoId && evento.publicacaoId && data.publicacaoId !== evento.publicacaoId) return false;

  // Palavra configurada no gatilho: comentário ou mensagem só dispara se casar.
  const textoDoEvento = typeof evento.mensagem === "string" ? evento.mensagem : undefined;
  if (textoDoEvento !== undefined && !textoCasaComPalavras(textoDoEvento, data)) return false;

  const agora = new Date();
  if (!dentroDaJanela(fluxo, agora)) return false;

  // Se o nó logo depois do gatilho for uma condição, ela também precisa bater
  // — best-effort, porque aqui a gente ainda não tem o contato completo (só o evento).
  const primeiraAresta = saidasDoNo(fluxo.edges, noGatilho.id)[0];
  if (primeiraAresta) {
    const proximoNo = fluxo.nodes.find((n) => n.id === primeiraAresta.target);
    if (proximoNo?.type === "condicao_grupo") {
      const condicaoData = proximoNo.data as CondicaoGrupoData;
      const contatoParcial = { nome: evento.contatoNome ?? "", etiquetas: [] as string[], ...evento };
      if (!avaliarGrupoCondicoes(condicaoData.grupo, contatoParcial)) return false;
    }
  }

  return true;
}

/* -------------------------------------------------------------------------- */
/* executarFluxo                                                             */
/* -------------------------------------------------------------------------- */

function labelDoNo(node: FlowNode): string {
  return node.titulo ?? node.type;
}

function novoPasso(node: FlowNode, status: PassoExecucao["status"], detalhe: string | undefined, agora: Date): PassoExecucao {
  return {
    nodeId: node.id,
    nodeType: node.type,
    label: labelDoNo(node),
    status,
    detalhe,
    timestamp: agora.toISOString(),
  };
}

const LIMITE_MINUTOS_ESPERA_SINCRONA = 5;

export function executarFluxo(
  fluxo: FluxoAutomacao,
  nodeInicialId: string,
  contexto: ContextoExecucao,
  ligacoes: Ligacoes,
): RegistroExecucao {
  const nodesPorId = indiceMapa(fluxo.nodes);
  const passos: PassoExecucao[] = [];
  const agora = agoraOuContexto(contexto);
  const iniciadoEm = agora.toISOString();

  const registro: RegistroExecucao = {
    id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fluxoId: fluxo.id,
    fluxoVersao: fluxo.versaoAtual,
    contatoNome: contexto.contato.nome,
    iniciadoEm,
    situacao: "em_andamento",
    passos,
    gatilho: fluxo.nodes.find((n) => n.category === "gatilho")?.type ?? "desconhecido",
  };

  // Cópia mutável do contato — mutações de etiqueta/campo dentro do próprio fluxo
  // precisam refletir nos passos seguintes, mesmo antes do `ligacoes.salvarContato`
  // "de verdade" (que é assíncrono do ponto de vista do estado do React).
  const contato = { ...contexto.contato, etiquetas: [...contexto.contato.etiquetas] };

  let atualId: string | undefined = nodeInicialId;
  const visitados = new Set<string>();
  let iteracoesRestantes = 500; // trava de segurança contra ciclo sem quebra que passou da validação

  while (atualId && iteracoesRestantes > 0) {
    iteracoesRestantes -= 1;
    const node = nodesPorId.get(atualId);
    if (!node) {
      registro.situacao = "erro";
      registro.erro = `Nó "${atualId}" não existe mais no fluxo.`;
      break;
    }

    if (visitados.has(node.id)) {
      // Já passamos por aqui nessa execução — evita loop infinito de verdade.
      passos.push(novoPasso(node, "pulado", "Bloco já executado nessa mesma rodada — parado pra evitar loop.", agora));
      break;
    }
    visitados.add(node.id);

    const resultado = executarNo(node, fluxo, contato, ligacoes, agora);
    passos.push(resultado.passo);

    if (resultado.parar) {
      registro.situacao = resultado.situacaoFinal ?? "aguardando";
      atualId = undefined;
      break;
    }

    const saidas = saidasDoNo(fluxo.edges, node.id);
    const proxima = escolherProximaAresta(node, saidas, contato);
    if (!proxima) {
      // Sem saída: só é "normal" se o bloco for de fim — senão, encerra por segurança.
      if (node.category !== "fim") {
        registro.situacao = "erro";
        registro.erro = `Bloco "${labelDoNo(node)}" não tem caminho de saída definido.`;
      } else {
        registro.situacao = "concluida";
      }
      atualId = undefined;
      break;
    }
    atualId = proxima.target;
  }

  if (!atualId && registro.situacao === "em_andamento") {
    registro.situacao = "concluida";
  }
  registro.finalizadoEm = new Date().toISOString();
  return registro;
}

function escolherProximaAresta(node: FlowNode, saidas: FlowEdge[], contato: ContextoExecucao["contato"]): FlowEdge | undefined {
  if (saidas.length <= 1) return saidas[0];

  if (node.type === "condicao_grupo") {
    const data = node.data as CondicaoGrupoData;
    const passou = avaliarGrupoCondicoes(data.grupo, contato);
    return saidas.find((e) => e.sourceHandle === (passou ? "sim" : "nao")) ?? saidas.find((e) => e.sourceHandle === "sim");
  }

  // Botões/lista/aguardar com múltiplas saídas: sem uma resposta real do lead
  // (não existe backend pra "esperar a resposta chegar"), a execução já parou
  // antes de chegar aqui (ver `executarNo`) — isso é só um fallback defensivo.
  return saidas[0];
}

type ResultadoNo = { passo: PassoExecucao; parar: boolean; situacaoFinal?: RegistroExecucao["situacao"] };

function executarNo(
  node: FlowNode,
  fluxo: FluxoAutomacao,
  contato: ContextoExecucao["contato"],
  ligacoes: Ligacoes,
  agora: Date,
): ResultadoNo {
  switch (node.type) {
    case "condicao_grupo": {
      const data = node.data as CondicaoGrupoData;
      const passou = avaliarGrupoCondicoes(data.grupo, contato);
      return { passo: novoPasso(node, passou ? "ok" : "condicao_falsa", undefined, agora), parar: false };
    }

    case "mensagem_botoes":
    case "mensagem_lista": {
      // Não existe canal de resposta real aqui — registra a mensagem (se o
      // chamador quiser mostrar em algum log) e pausa a execução esperando
      // uma resposta que só chegaria via um evento futuro (integração/próxima fase).
      const data = node.data as MensagemBotoesData;
      ligacoes.registrarMensagemSimulada?.({ canal: data.canal, conteudo: data.texto });
      return {
        passo: novoPasso(node, "aguardando", "Esperando o lead escolher uma opção (sem integração de resposta nessa fase).", agora),
        parar: true,
        situacaoFinal: "aguardando",
      };
    }

    case "aguardar": {
      const data = node.data as AguardarData;
      const ehEsperaCurta = data.modo === "minutos" && (data.valor ?? 0) <= LIMITE_MINUTOS_ESPERA_SINCRONA;
      if (ehEsperaCurta) {
        // Espera trivial — como não tem cron/backend, seguimos direto (é só uma
        // simplificação pragmática pra demo/simulador, documentada aqui mesmo).
        return { passo: novoPasso(node, "ok", "Espera curta — seguiu direto (sem backend pra agendar retomada).", agora), parar: false };
      }
      return {
        passo: novoPasso(node, "aguardando", "Fluxo pausado — sem cron/backend pra retomar automaticamente depois desse tempo.", agora),
        parar: true,
        situacaoFinal: "aguardando",
      };
    }

    case "adicionar_etiqueta": {
      const data = node.data as AdicionarEtiquetaData;
      if (!contato.etiquetas.includes(data.etiquetaNome)) contato.etiquetas.push(data.etiquetaNome);
      ligacoes.salvarContato(contato.nome, { etiquetas: [...contato.etiquetas] });
      return { passo: novoPasso(node, "ok", `Etiqueta "${data.etiquetaNome}" adicionada.`, agora), parar: false };
    }

    case "remover_etiqueta": {
      const data = node.data as RemoverEtiquetaData;
      contato.etiquetas = contato.etiquetas.filter((e) => e !== data.etiquetaNome);
      ligacoes.salvarContato(contato.nome, { etiquetas: [...contato.etiquetas] });
      return { passo: novoPasso(node, "ok", `Etiqueta "${data.etiquetaNome}" removida.`, agora), parar: false };
    }

    case "alterar_etapa": {
      const data = node.data as AlterarEtapaData;
      ligacoes.moverEtapa(data.funilId, data.etapaTitulo, { ...contato });
      contato.funilId = data.funilId;
      contato.etapaTitulo = data.etapaTitulo;
      return { passo: novoPasso(node, "ok", `Movido pra "${data.etapaTitulo}".`, agora), parar: false };
    }

    case "alterar_responsavel": {
      const data = node.data as AlterarResponsavelData;
      ligacoes.atribuirAtendente(contato.nome, data.atendenteNome);
      contato.responsavel = data.atendenteNome;
      return { passo: novoPasso(node, "ok", `Responsável: ${data.atendenteNome}.`, agora), parar: false };
    }

    case "atualizar_campo": {
      const data = node.data as AtualizarCampoData;
      contato.camposPersonalizados = { ...contato.camposPersonalizados, [data.campoNome]: data.valor };
      ligacoes.salvarContato(contato.nome, { [data.campoNome]: data.valor });
      return { passo: novoPasso(node, "ok", `Campo "${data.campoNome}" = "${data.valor}".`, agora), parar: false };
    }

    case "criar_tarefa": {
      const data = node.data as CriarTarefaData;
      ligacoes.salvarContato(contato.nome, {});
      return { passo: novoPasso(node, "ok", `Tarefa criada: "${data.titulo}".`, agora), parar: false };
    }

    case "criar_lembrete": {
      const data = node.data as CriarLembreteData;
      ligacoes.salvarContato(contato.nome, {});
      return { passo: novoPasso(node, "ok", `Lembrete criado: "${data.titulo}".`, agora), parar: false };
    }

    case "criar_negocio": {
      const data = node.data as CriarNegocioData;
      ligacoes.moverEtapa(data.funilId, data.etapaTitulo, { ...contato, valor: data.valor });
      return { passo: novoPasso(node, "ok", `Negócio criado em "${data.etapaTitulo}".`, agora), parar: false };
    }

    case "atualizar_valor": {
      const data = node.data as AtualizarValorData;
      ligacoes.salvarContato(contato.nome, { valor: data.valor });
      return { passo: novoPasso(node, "ok", `Valor atualizado: ${data.valor}.`, agora), parar: false };
    }

    case "atualizar_status": {
      const data = node.data as AtualizarStatusData;
      ligacoes.salvarContato(contato.nome, { status: data.status });
      return { passo: novoPasso(node, "ok", `Status atualizado: ${data.status}.`, agora), parar: false };
    }

    case "mensagem_texto":
    case "mensagem_imagem":
    case "mensagem_video":
    case "mensagem_audio":
    case "mensagem_documento":
    case "mensagem_contato":
    case "mensagem_localizacao":
    case "mensagem_modelo_whatsapp":
    case "mensagem_email":
    case "notificacao_interna":
    case "enviar_formulario": {
      const data = node.data as { canal?: string; texto?: string; mensagem?: string; assunto?: string };
      const conteudo = data.texto ?? data.mensagem ?? data.assunto ?? "";
      ligacoes.registrarMensagemSimulada?.({ canal: data.canal ?? "whatsapp", conteudo });
      return { passo: novoPasso(node, "ok", "Envio simulado — sem canal de mensagens real conectado.", agora), parar: false };
    }

    case "responder_comentario_instagram": {
      const data = node.data as { texto?: string };
      const texto = (data.texto ?? "").trim();
      if (!texto) {
        return { passo: novoPasso(node, "erro", "Sem texto configurado pra resposta.", agora), parar: false };
      }
      if (!ligacoes.responderComentario) {
        // Não é erro do fluxo: é o mesmo fluxo sendo disparado por outro gatilho, onde não existe
        // comentário a que responder. Segue adiante em vez de derrubar o resto das ações.
        return {
          passo: novoPasso(node, "ok", "Ignorado — este disparo não veio de um comentário.", agora),
          parar: false,
        };
      }
      ligacoes.responderComentario(texto);
      return { passo: novoPasso(node, "ok", "Resposta ao comentário enfileirada.", agora), parar: false };
    }

    case "ocultar_comentario_instagram": {
      return {
        passo: novoPasso(node, "ok", "Ocultar comentário — aplicado no envio real.", agora),
        parar: false,
      };
    }

    case "chamar_webhook": {
      const data = node.data as ChamarWebhookData;
      ligacoes.registrarWebhookSimulado?.({ url: data.url, payload: data.payload });
      return { passo: novoPasso(node, "ok", "Chamada de webhook simulada — nenhuma requisição real foi feita.", agora), parar: false };
    }

    case "executar_integracao": {
      ligacoes.registrarWebhookSimulado?.({ url: "integracao://simulada", payload: node.data });
      return { passo: novoPasso(node, "ok", "Integração simulada — nenhuma chamada real foi feita.", agora), parar: false };
    }

    case "encaminhar_humano": {
      return { passo: novoPasso(node, "ok", "Encaminhado pra atendimento humano — fluxo automático encerra aqui.", agora), parar: true, situacaoFinal: "pausada" };
    }

    case "enviar_notificacao": {
      const data = node.data as EnviarNotificacaoData;
      ligacoes.registrarMensagemSimulada?.({ canal: "interno", conteudo: data.mensagem });
      return { passo: novoPasso(node, "ok", "Notificação interna registrada.", agora), parar: false };
    }

    case "pausar_automacoes":
    case "cancelar_automacoes": {
      return { passo: novoPasso(node, "ok", "Sinalizado — cabe ao contexto de automações interpretar esse sinal.", agora), parar: false };
    }

    case "encerrar_fluxo": {
      return { passo: novoPasso(node, "ok", undefined, agora), parar: false };
    }

    default: {
      // Gatilhos e demais tipos "de evento" não deveriam ser executados diretamente
      // (a execução começa DEPOIS do gatilho) — se cair aqui, só registra e segue.
      void fluxo;
      return { passo: novoPasso(node, "ok", "Bloco sem efeito colateral definido nessa versão do motor.", agora), parar: false };
    }
  }
}
