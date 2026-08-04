/**
 * Validações mecânicas do grafo — o que dá pra checar só olhando nós/arestas,
 * sem rodar o fluxo de verdade. Usado antes de publicar (`publicarFluxo`) e,
 * depois, pra destacar problema em cada nó no canvas.
 */

import type {
  AgendarConsultaData,
  AguardarData,
  AtualizarStatusData,
  AtualizarValorData,
  CriarTarefaData,
  EncaminharEquipeData,
  EtiquetaEventoData,
  FlowEdge,
  FlowNode,
  FluxoAutomacao,
  GatilhoEtapaData,
  MensagemBotoesData,
  MensagemMidiaData,
  MensagemModeloWhatsappData,
  MensagemTextoData,
  ProblemaValidacao,
  TarefaEventoData,
} from "./types";

let contador = 0;
function proximoIdProblema(): string {
  contador += 1;
  return `problema-${Date.now()}-${contador}`;
}

function ehTextoVazio(v: unknown): boolean {
  return typeof v !== "string" || v.trim() === "";
}

const TIPOS_MENSAGEM_TEXTO = new Set(["mensagem_texto", "mensagem_email", "notificacao_interna"]);
const TIPOS_MENSAGEM_OPCOES = new Set(["mensagem_botoes", "mensagem_lista"]);
const TIPOS_MENSAGEM_MIDIA = new Set(["mensagem_imagem", "mensagem_video", "mensagem_audio", "mensagem_documento"]);

export function validarFluxo(fluxo: FluxoAutomacao): ProblemaValidacao[] {
  const problemas: ProblemaValidacao[] = [];
  const { nodes, edges } = fluxo;
  const nodesPorId = new Map<string, FlowNode>(nodes.map((n) => [n.id, n]));

  const saidasPorNo = new Map<string, FlowEdge[]>();
  const entradasPorNo = new Map<string, FlowEdge[]>();
  edges.forEach((e) => {
    if (!saidasPorNo.has(e.source)) saidasPorNo.set(e.source, []);
    saidasPorNo.get(e.source)!.push(e);
    if (!entradasPorNo.has(e.target)) entradasPorNo.set(e.target, []);
    entradasPorNo.get(e.target)!.push(e);
  });

  // 1. Precisa de pelo menos um nó de gatilho.
  const gatilhos = nodes.filter((n) => n.category === "gatilho");
  if (gatilhos.length === 0) {
    problemas.push({
      id: proximoIdProblema(),
      severidade: "erro",
      mensagem: "O fluxo não tem nenhum gatilho — nada vai disparar essa automação.",
    });
  }

  // 2. Raiz (sem entrada) que não é gatilho — bloco solto no começo do fluxo.
  nodes.forEach((n) => {
    const temEntrada = (entradasPorNo.get(n.id)?.length ?? 0) > 0;
    if (!temEntrada && n.category !== "gatilho") {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${n.titulo ?? n.type}" não está conectado a nada antes dele.`,
        nodeId: n.id,
      });
    }
  });

  // 3. Caminho pendurado — sem saída e não é um bloco de fim.
  nodes.forEach((n) => {
    const temSaida = (saidasPorNo.get(n.id)?.length ?? 0) > 0;
    if (!temSaida && n.category !== "fim") {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${n.titulo ?? n.type}" termina o fluxo sem passar por um bloco de "Encerrar fluxo".`,
        nodeId: n.id,
      });
    }
  });

  // 4. Botões/lista — precisa ter pelo menos uma opção, cada opção precisa de rótulo preenchido, e
  // toda opção precisa ter uma aresta de saída com esse handle (nenhum "caminho sem identificação").
  nodes.forEach((n) => {
    if (!TIPOS_MENSAGEM_OPCOES.has(n.type)) return;
    const data = n.data as MensagemBotoesData;
    const saidas = saidasPorNo.get(n.id) ?? [];
    const opcoes = data.opcoes ?? [];
    if (opcoes.length === 0) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${n.titulo ?? n.type}" é uma pergunta sem nenhuma opção de resposta.`,
        nodeId: n.id,
      });
    }
    opcoes.forEach((opcao) => {
      if (ehTextoVazio(opcao.rotulo)) {
        problemas.push({
          id: proximoIdProblema(),
          severidade: "erro",
          mensagem: `Uma opção do bloco "${n.titulo ?? n.type}" está sem valor de resposta (rótulo vazio).`,
          nodeId: n.id,
        });
        return;
      }
      const temAresta = saidas.some((e) => e.sourceHandle === opcao.id);
      if (!temAresta) {
        problemas.push({
          id: proximoIdProblema(),
          severidade: "erro",
          mensagem: `A opção "${opcao.rotulo}" do bloco "${n.titulo ?? n.type}" não leva a lugar nenhum.`,
          nodeId: n.id,
        });
      }
    });
  });

  // 4b. Documento/imagem/vídeo/áudio sem arquivo escolhido (biblioteca ou upload simulado).
  nodes.forEach((n) => {
    if (!TIPOS_MENSAGEM_MIDIA.has(n.type)) return;
    const data = n.data as MensagemMidiaData;
    if (ehTextoVazio(data.arquivoNome)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${n.titulo ?? n.type}" está sem arquivo escolhido.`,
        nodeId: n.id,
      });
    }
  });

  // 5. Mensagem de texto/e-mail/notificação vazia.
  nodes.forEach((n) => {
    if (!TIPOS_MENSAGEM_TEXTO.has(n.type)) return;
    const data = n.data as MensagemTextoData & { mensagem?: string };
    const texto = data.texto ?? data.mensagem;
    if (ehTextoVazio(texto)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "aviso",
        mensagem: `Bloco "${n.titulo ?? n.type}" está sem texto pra enviar.`,
        nodeId: n.id,
      });
    }
  });

  // 6. Aguardar sem valor/modo válido.
  nodes.forEach((n) => {
    if (n.type !== "aguardar") return;
    const data = n.data as AguardarData;
    const modosComValorObrigatorio: AguardarData["modo"][] = ["minutos", "horas", "dias"];
    if (modosComValorObrigatorio.includes(data.modo) && (!data.valor || data.valor <= 0)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "Aguardar" está sem um tempo de espera válido.`,
        nodeId: n.id,
      });
    }
  });

  // 7. condicao_grupo sem nenhuma regra nem subgrupo.
  nodes.forEach((n) => {
    if (n.type !== "condicao_grupo") return;
    const data = n.data as { grupo?: { regras?: unknown[]; subgrupos?: unknown[] } };
    const grupo = data.grupo;
    if (!grupo || ((grupo.regras?.length ?? 0) === 0 && (grupo.subgrupos?.length ?? 0) === 0)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "aviso",
        mensagem: `Bloco de condição "${n.titulo ?? n.type}" está vazio — nunca vai filtrar nada.`,
        nodeId: n.id,
      });
    }
  });

  // 7b. Gatilho de etapa (entrou/saiu/parado) sem funil escolhido.
  const TIPOS_GATILHO_ETAPA = new Set(["lead_entrou_etapa", "lead_saiu_etapa", "lead_parado_etapa"]);
  nodes.forEach((n) => {
    if (!TIPOS_GATILHO_ETAPA.has(n.type)) return;
    const data = n.data as GatilhoEtapaData;
    if (ehTextoVazio(data.funilId)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${n.titulo ?? n.type}" está sem funil e etapa escolhidos.`,
        nodeId: n.id,
      });
    }
  });

  // 7c. Adicionar/remover etiqueta sem etiqueta escolhida.
  const TIPOS_ETIQUETA_ACAO = new Set(["adicionar_etiqueta", "remover_etiqueta"]);
  nodes.forEach((n) => {
    if (!TIPOS_ETIQUETA_ACAO.has(n.type)) return;
    const data = n.data as EtiquetaEventoData;
    if (ehTextoVazio(data.etiquetaNome)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${n.titulo ?? n.type}" está sem etiqueta escolhida.`,
        nodeId: n.id,
      });
    }
  });

  // 7d. Criar tarefa sem título.
  nodes.forEach((n) => {
    if (n.type !== "criar_tarefa") return;
    const data = n.data as CriarTarefaData;
    if (ehTextoVazio(data.titulo)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${n.titulo ?? n.type}" está sem título de tarefa definido.`,
        nodeId: n.id,
      });
    }
  });

  // 7e. Gatilho de tarefa (criada/concluída) com filtro escolhido mas sem o valor correspondente.
  const TIPOS_GATILHO_TAREFA = new Set(["tarefa_criada", "tarefa_concluida"]);
  nodes.forEach((n) => {
    if (!TIPOS_GATILHO_TAREFA.has(n.type)) return;
    const data = n.data as TarefaEventoData;
    const faltando =
      (data.filtroModo === "categoria" && ehTextoVazio(data.categoria)) ||
      (data.filtroModo === "titulo" && ehTextoVazio(data.tituloContem)) ||
      (data.filtroModo === "responsavel" && ehTextoVazio(data.responsavel)) ||
      (data.filtroModo === "equipe" && ehTextoVazio(data.equipe)) ||
      (data.filtroModo === "funil" && ehTextoVazio(data.funilId));
    if (faltando) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${n.titulo ?? n.type}" está com o filtro de tarefa incompleto.`,
        nodeId: n.id,
      });
    }
  });

  // 7f. Encaminhar pra equipe sem equipe escolhida.
  nodes.forEach((n) => {
    if (n.type !== "encaminhar_equipe") return;
    const data = n.data as EncaminharEquipeData;
    if (ehTextoVazio(data.equipeNome)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${n.titulo ?? n.type}" está sem equipe escolhida.`,
        nodeId: n.id,
      });
    }
  });

  // 7g. Atualizar status sem status escolhido, ou "Perdido" sem motivo.
  nodes.forEach((n) => {
    if (n.type !== "atualizar_status") return;
    const data = n.data as AtualizarStatusData;
    if (ehTextoVazio(data.status)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${n.titulo ?? n.type}" está sem status escolhido.`,
        nodeId: n.id,
      });
    } else if (data.status === "perdido" && ehTextoVazio(data.motivoPerda)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${n.titulo ?? n.type}" marca como perdido mas está sem motivo da perda.`,
        nodeId: n.id,
      });
    }
  });

  // 7h. Atualizar valor do negócio sem valor definido.
  nodes.forEach((n) => {
    if (n.type !== "atualizar_valor") return;
    const data = n.data as AtualizarValorData;
    if (ehTextoVazio(data.valor)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${n.titulo ?? n.type}" está sem valor definido.`,
        nodeId: n.id,
      });
    }
  });

  // 7i. Agendar consulta sem data ou horário definidos.
  nodes.forEach((n) => {
    if (n.type !== "agendar_consulta") return;
    const data = n.data as AgendarConsultaData;
    if (ehTextoVazio(data.data) || ehTextoVazio(data.horario)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${n.titulo ?? n.type}" está sem data e horário definidos.`,
        nodeId: n.id,
      });
    }
  });

  // 7j. Modelo do WhatsApp sem template escolhido.
  nodes.forEach((n) => {
    if (n.type !== "mensagem_modelo_whatsapp") return;
    const data = n.data as MensagemModeloWhatsappData;
    if (ehTextoVazio(data.templateId)) {
      problemas.push({
        id: proximoIdProblema(),
        severidade: "erro",
        mensagem: `Bloco "${n.titulo ?? n.type}" está sem modelo escolhido.`,
        nodeId: n.id,
      });
    }
  });

  // 8. Ciclo — heurística simples: DFS de detecção de ciclo; se o ciclo não
  // passar por nenhum nó "aguardar" ou "condicao_grupo", é risco real de loop
  // infinito (nada quebra o círculo nem no tempo, nem numa condição).
  const ciclosDetectados = detectarCiclosDeLoopInfinito(nodes, edges, nodesPorId);
  ciclosDetectados.forEach((nodeId) => {
    problemas.push({
      id: proximoIdProblema(),
      severidade: "erro",
      mensagem: `Bloco "${nodesPorId.get(nodeId)?.titulo ?? nodeId}" faz parte de um ciclo sem espera nem condição — risco de loop infinito.`,
      nodeId,
    });
  });

  return problemas.sort((a, b) => (a.severidade === b.severidade ? 0 : a.severidade === "erro" ? -1 : 1));
}

/**
 * DFS clássica com pilha de recursão pra achar ciclos. Pra cada ciclo achado,
 * se nenhum nó dele "quebra o loop" (aguardar/condição), marca todos os nós
 * do ciclo como problematicos. Não tenta achar TODOS os ciclos possíveis —
 * só o suficiente pra avisar o usuário, sem virar um analisador completo de grafos.
 */
function detectarCiclosDeLoopInfinito(
  nodes: FlowNode[],
  edges: FlowEdge[],
  nodesPorId: Map<string, FlowNode>,
): Set<string> {
  const adjacencia = new Map<string, string[]>();
  edges.forEach((e) => {
    if (!adjacencia.has(e.source)) adjacencia.set(e.source, []);
    adjacencia.get(e.source)!.push(e.target);
  });

  const problematicos = new Set<string>();
  const visitados = new Set<string>();
  const pilha: string[] = [];
  const naPilha = new Set<string>();

  function quebraLoop(nodeId: string): boolean {
    const n = nodesPorId.get(nodeId);
    return n?.type === "aguardar" || n?.type === "condicao_grupo";
  }

  function dfs(nodeId: string) {
    visitados.add(nodeId);
    pilha.push(nodeId);
    naPilha.add(nodeId);

    for (const proximo of adjacencia.get(nodeId) ?? []) {
      if (!visitados.has(proximo)) {
        dfs(proximo);
      } else if (naPilha.has(proximo)) {
        const inicio = pilha.indexOf(proximo);
        const ciclo = pilha.slice(inicio);
        const temQuebraLoop = ciclo.some(quebraLoop);
        if (!temQuebraLoop) {
          ciclo.forEach((id) => problematicos.add(id));
        }
      }
    }

    pilha.pop();
    naPilha.delete(nodeId);
  }

  nodes.forEach((n) => {
    if (!visitados.has(n.id)) dfs(n.id);
  });

  return problematicos;
}
