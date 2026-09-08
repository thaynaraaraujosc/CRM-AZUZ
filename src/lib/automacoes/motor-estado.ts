import { avaliarGrupoCondicoes } from "@/lib/automation-flow/motor";
import type {
  AdicionarEtiquetaData,
  AguardarData,
  AlterarEtapaData,
  AlterarResponsavelData,
  AtualizarCampoData,
  AtualizarStatusData,
  AtualizarValorData,
  CondicaoGrupoData,
  FlowEdge,
  FlowNode,
  MensagemBotoesData,
  RemoverEtiquetaData,
} from "@/lib/automation-flow/types";
import type { AcoesDoMotor } from "./acoes";
import {
  avancarPara,
  aguardarEvento,
  aguardarTempo,
  encerrarExecucao,
  reagendarRodada,
  registrarPasso,
  type ContextoExecucaoPersistido,
  type ExecucaoAtiva,
} from "./execucoes";

/**
 * O motor com ESTADO — a diferença central em relação ao motor antigo.
 *
 * O antigo percorre o fluxo inteiro numa chamada e devolve um relatório. Quando encontra uma
 * espera ("aguardar 2 horas", "esperar a resposta"), ele para e o resultado é descartado: nada
 * retoma, e a automação nunca continua. Era um simulador com efeitos colaterais.
 *
 * Aqui cada nó é um passo: executa, GRAVA a posição no banco, registra o log, e só então segue.
 * Duas consequências práticas:
 *
 * - Um deploy, um restart ou uma função serverless que termina não perdem nada. A execução
 *   continua de onde parou, porque "onde parou" está no banco, não na memória.
 * - Uma espera é um estado, não um fim. `aguardar_tempo` acorda pelo cron; `aguardar_evento`
 *   acorda quando a pessoa responde (ver `execucaoAguardandoDoContato`).
 *
 * O que executar vem de uma VERSÃO PUBLICADA (nós e arestas), nunca do rascunho aberto no editor.
 */

/** Teto de nós por rodada. A execução não morre ao bater nele: ela é reagendada pro cron pegar em
 * seguida, e assim uma rodada nunca segura a função serverless além do tempo dela. */
const NOS_POR_RODADA = 30;

export type ResultadoDoNo =
  | { tipo: "seguir"; saida?: string; detalhe?: string; resultado?: "ok" | "condicao_falsa" }
  | { tipo: "aguardar_tempo"; ate: Date; evento?: string; detalhe: string }
  | { tipo: "aguardar_evento"; evento: string; ate?: Date; detalhe: string }
  | { tipo: "encerrar"; situacao: "concluida" | "cancelada"; detalhe?: string }
  | { tipo: "erro"; detalhe: string; erroTecnico?: string };

export type FimDaRodada = {
  situacao: "concluida" | "cancelada" | "erro" | "aguardando_tempo" | "aguardando_evento" | "em_andamento";
  passos: number;
  detalhe?: string;
};

/**
 * Roda a execução do ponto em que ela está até parar: por espera, por fim ou por erro.
 *
 * Idempotente por natureza: o estado é lido do banco no começo e gravado a cada nó, então chamar
 * duas vezes seguidas continua de onde a primeira parou, em vez de repetir o que já saiu.
 */
export async function rodarExecucao(params: {
  execucao: ExecucaoAtiva;
  nodes: FlowNode[];
  edges: FlowEdge[];
  acoes: AcoesDoMotor;
  /** Substitui `new Date()` — o simulador usa pra "avançar o relógio". */
  agora?: Date;
}): Promise<FimDaRodada> {
  const { execucao, nodes, edges, acoes } = params;
  const agora = params.agora ?? new Date();
  const porId = new Map(nodes.map((n) => [n.id, n]));

  let noAtualId = execucao.noAtualId;
  let contexto: ContextoExecucaoPersistido = { ...execucao.contexto };
  let passos = 0;
  // Trava contra ciclo: um nó já visitado NESTA rodada não roda de novo. Entre rodadas o mesmo nó
  // pode repetir (um follow-up que volta pro começo é legítimo) — o que não pode é girar sem parar
  // dentro de uma chamada.
  const visitadosNaRodada = new Set<string>();

  while (noAtualId) {
    if (passos >= NOS_POR_RODADA) {
      // Reagenda em vez de continuar: a rodada tem tempo limitado, e o cron pega a sobra em
      // seguida. Uma automação longa avança em fatias, sem estourar a função.
      await reagendarRodada({ execucaoId: execucao.id, noId: noAtualId, contexto, ate: agora });
      return { situacao: "aguardando_tempo", passos, detalhe: "Continua na próxima rodada." };
    }

    const no = porId.get(noAtualId);
    if (!no) {
      const detalhe = `O bloco "${noAtualId}" não existe mais nesta versão do fluxo.`;
      await registrarPasso({
        execucaoId: execucao.id,
        workspaceId: execucao.workspaceId,
        noId: noAtualId,
        noTipo: "desconhecido",
        resultado: "erro",
        detalhe,
      });
      await encerrarExecucao({ execucaoId: execucao.id, situacao: "erro", erroMensagem: detalhe });
      return { situacao: "erro", passos, detalhe };
    }

    if (visitadosNaRodada.has(no.id)) {
      const detalhe = "Bloco repetido na mesma rodada — parado pra evitar loop.";
      await registrarPasso({
        execucaoId: execucao.id,
        workspaceId: execucao.workspaceId,
        noId: no.id,
        noTipo: no.type,
        titulo: no.titulo,
        resultado: "pulado",
        detalhe,
      });
      await encerrarExecucao({ execucaoId: execucao.id, situacao: "erro", erroMensagem: detalhe });
      return { situacao: "erro", passos, detalhe };
    }
    visitadosNaRodada.add(no.id);
    passos++;

    // Bloco desativado no editor: registra e segue, sem executar. É o "desligar temporariamente"
    // sem ter que desconectar o bloco do fluxo.
    let resultado: ResultadoDoNo;
    if (no.desativado) {
      resultado = { tipo: "seguir", detalhe: "Bloco desativado — pulado." };
    } else {
      resultado = await executarNo({ no, contexto, acoes, agora });
    }

    await registrarPasso({
      execucaoId: execucao.id,
      workspaceId: execucao.workspaceId,
      noId: no.id,
      noTipo: no.type,
      titulo: no.titulo,
      resultado:
        resultado.tipo === "erro"
          ? "erro"
          : resultado.tipo === "aguardar_tempo" || resultado.tipo === "aguardar_evento"
            ? "aguardando"
            : (resultado.tipo === "seguir" && resultado.resultado) || "ok",
      detalhe: "detalhe" in resultado ? resultado.detalhe : undefined,
      erroTecnico: resultado.tipo === "erro" ? resultado.erroTecnico : undefined,
    });

    if (resultado.tipo === "erro") {
      await encerrarExecucao({ execucaoId: execucao.id, situacao: "erro", erroMensagem: resultado.detalhe });
      return { situacao: "erro", passos, detalhe: resultado.detalhe };
    }
    if (resultado.tipo === "aguardar_tempo") {
      await aguardarTempo({ execucaoId: execucao.id, noId: no.id, ate: resultado.ate, evento: resultado.evento, contexto });
      return { situacao: "aguardando_tempo", passos, detalhe: resultado.detalhe };
    }
    if (resultado.tipo === "aguardar_evento") {
      await aguardarEvento({ execucaoId: execucao.id, noId: no.id, evento: resultado.evento, ate: resultado.ate, contexto });
      return { situacao: "aguardando_evento", passos, detalhe: resultado.detalhe };
    }
    if (resultado.tipo === "encerrar") {
      await encerrarExecucao({ execucaoId: execucao.id, situacao: resultado.situacao });
      return { situacao: resultado.situacao, passos, detalhe: resultado.detalhe };
    }

    const proximo = proximaAresta(edges, no.id, resultado.saida);
    if (!proximo) {
      // Sem saída é o fim normal do caminho — inclusive quando o último bloco não é "encerrar".
      await encerrarExecucao({ execucaoId: execucao.id, situacao: "concluida" });
      return { situacao: "concluida", passos };
    }
    noAtualId = proximo.target;
    contexto = { ...contexto };
    await avancarPara(execucao.id, noAtualId, contexto);
  }

  await encerrarExecucao({ execucaoId: execucao.id, situacao: "concluida" });
  return { situacao: "concluida", passos };
}

/**
 * Escolhe por onde sair. Com uma saída só, é ela. Com várias, vale o `sourceHandle` que o nó pediu
 * ("sim"/"nao", id da opção, "ok"/"timeout").
 *
 * Sem correspondência, não escolhe nenhuma: seguir por um caminho aleatório mandaria a pessoa pro
 * ramo errado, e um fluxo que termina é mais fácil de diagnosticar do que um que mente.
 */
export function proximaAresta(edges: FlowEdge[], noId: string, saida?: string): FlowEdge | undefined {
  const saidas = edges.filter((e) => e.source === noId);
  if (!saidas.length) return undefined;
  if (!saida) return saidas.find((e) => !e.sourceHandle) ?? saidas[0];
  return saidas.find((e) => e.sourceHandle === saida);
}

/** Como o contato aparece pras condições (mesma forma que o motor antigo usa). */
function contatoDoContexto(contexto: ContextoExecucaoPersistido) {
  const bruto = (contexto.contato ?? {}) as Record<string, unknown>;
  return {
    ...bruto,
    nome: String(bruto.nome ?? ""),
    etiquetas: Array.isArray(bruto.etiquetas) ? (bruto.etiquetas as string[]) : [],
  };
}

/** Aplica no contexto uma mudança que o próprio fluxo fez — o nó seguinte precisa enxergar. */
function atualizarContato(contexto: ContextoExecucaoPersistido, mudanca: Record<string, unknown>): void {
  contexto.contato = { ...contatoDoContexto(contexto), ...mudanca };
}

/** Momento em que uma espera termina, a partir da configuração do bloco. */
export function calcularEspera(data: AguardarData, agora: Date): Date | null {
  const valor = data.valor ?? 0;
  if (data.modo === "minutos") return new Date(agora.getTime() + valor * 60_000);
  if (data.modo === "horas") return new Date(agora.getTime() + valor * 3_600_000);
  if (data.modo === "dias") return new Date(agora.getTime() + valor * 86_400_000);
  return null;
}

/** Prazo máximo de uma espera por resposta ("resposta OU 2 horas"). */
export function calcularTempoMaximo(data: AguardarData, agora: Date): Date | null {
  if (!data.tempoMaximo) return null;
  const { valor, unidade } = data.tempoMaximo;
  const fator = unidade.startsWith("min") ? 60_000 : unidade.startsWith("hor") ? 3_600_000 : 86_400_000;
  return new Date(agora.getTime() + valor * fator);
}

async function executarNo(params: {
  no: FlowNode;
  contexto: ContextoExecucaoPersistido;
  acoes: AcoesDoMotor;
  agora: Date;
}): Promise<ResultadoDoNo> {
  const { no, contexto, acoes, agora } = params;
  const contato = contatoDoContexto(contexto);
  const nome = contato.nome;

  switch (no.type) {
    case "condicao_grupo": {
      const data = no.data as CondicaoGrupoData;
      const passou = avaliarGrupoCondicoes(data.grupo, contato);
      return {
        tipo: "seguir",
        saida: passou ? "sim" : "nao",
        resultado: passou ? "ok" : "condicao_falsa",
        detalhe: passou ? "Condição verdadeira." : "Condição falsa.",
      };
    }

    case "aguardar": {
      const data = no.data as AguardarData;
      if (data.modo === "ate_resposta") {
        const ate = calcularTempoMaximo(data, agora);
        return {
          tipo: "aguardar_evento",
          evento: "resposta",
          ate: ate ?? undefined,
          detalhe: ate ? `Esperando resposta até ${ate.toLocaleString("pt-BR")}.` : "Esperando a resposta do contato.",
        };
      }
      const ate = calcularEspera(data, agora);
      if (!ate) return { tipo: "erro", detalhe: "Bloco de espera sem tempo configurado." };
      return { tipo: "aguardar_tempo", ate, detalhe: `Esperando até ${ate.toLocaleString("pt-BR")}.` };
    }

    case "mensagem_botoes":
    case "mensagem_lista": {
      // Manda a pergunta e PARA esperando a escolha. É aqui que "clicou em Sim" continua o fluxo:
      // a resposta acorda esta execução e escolhe a saída pelo id da opção.
      const data = no.data as MensagemBotoesData;
      const envio = await acoes.enviarTexto({ contatoNome: nome, texto: montarPergunta(data), canal: data.canal });
      if (!envio.ok) return { tipo: "erro", detalhe: envio.detalhe, erroTecnico: envio.erroTecnico };
      return { tipo: "aguardar_evento", evento: "resposta", detalhe: "Esperando a escolha do contato." };
    }

    case "mensagem_texto": {
      const data = no.data as { texto?: string; mensagem?: string; canal?: string };
      const texto = (data.texto ?? data.mensagem ?? "").trim();
      if (!texto) return { tipo: "erro", detalhe: "Bloco de mensagem sem texto configurado." };
      const envio = await acoes.enviarTexto({ contatoNome: nome, texto, canal: data.canal });
      return envio.ok
        ? { tipo: "seguir", detalhe: envio.detalhe }
        : { tipo: "erro", detalhe: envio.detalhe, erroTecnico: envio.erroTecnico };
    }

    // Mídia, e-mail, modelo oficial e formulário NÃO caem no envio de texto de propósito. Mandar só
    // a legenda de um bloco de imagem — ou o assunto de um e-mail pelo WhatsApp — entregaria coisa
    // errada e ainda registraria "enviado". Enquanto o envio de verdade não existe (fase 4), o
    // histórico diz o que faltou, e o fluxo segue.
    case "mensagem_imagem":
    case "mensagem_video":
    case "mensagem_audio":
    case "mensagem_documento":
    case "mensagem_contato":
    case "mensagem_localizacao":
    case "mensagem_modelo_whatsapp":
    case "mensagem_email":
    case "enviar_formulario":
    case "notificacao_interna":
      return {
        tipo: "seguir",
        detalhe: `"${no.titulo ?? no.type}" ainda não é enviado pelo motor — nada saiu, e o fluxo seguiu.`,
      };

    case "adicionar_etiqueta": {
      const data = no.data as AdicionarEtiquetaData;
      const etiquetas = contato.etiquetas.includes(data.etiquetaNome)
        ? contato.etiquetas
        : [...contato.etiquetas, data.etiquetaNome];
      const r = await acoes.salvarContato({ contatoNome: nome, dados: { etiquetas } });
      if (r.ok) atualizarContato(contexto, { etiquetas });
      return r.ok ? { tipo: "seguir", detalhe: `Etiqueta "${data.etiquetaNome}" adicionada.` } : { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
    }

    case "remover_etiqueta": {
      const data = no.data as RemoverEtiquetaData;
      const etiquetas = contato.etiquetas.filter((e) => e !== data.etiquetaNome);
      const r = await acoes.salvarContato({ contatoNome: nome, dados: { etiquetas } });
      if (r.ok) atualizarContato(contexto, { etiquetas });
      return r.ok ? { tipo: "seguir", detalhe: `Etiqueta "${data.etiquetaNome}" removida.` } : { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
    }

    case "alterar_etapa": {
      const data = no.data as AlterarEtapaData;
      if (!data.funilId || !data.etapaTitulo) return { tipo: "erro", detalhe: "Bloco sem funil e etapa escolhidos." };
      const r = await acoes.moverEtapa({ contatoNome: nome, funilId: data.funilId, etapaTitulo: data.etapaTitulo });
      if (r.ok) atualizarContato(contexto, { funilId: data.funilId, etapaTitulo: data.etapaTitulo });
      return r.ok ? { tipo: "seguir", detalhe: r.detalhe } : { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
    }

    case "alterar_responsavel": {
      const data = no.data as AlterarResponsavelData;
      if (!data.atendenteNome) return { tipo: "erro", detalhe: "Bloco sem responsável escolhido." };
      const r = await acoes.salvarContato({ contatoNome: nome, dados: { responsavel: data.atendenteNome } });
      if (r.ok) atualizarContato(contexto, { responsavel: data.atendenteNome });
      return r.ok ? { tipo: "seguir", detalhe: `Responsável: ${data.atendenteNome}.` } : { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
    }

    case "atualizar_campo": {
      const data = no.data as AtualizarCampoData;
      if (!data.campoNome) return { tipo: "erro", detalhe: "Bloco sem campo escolhido." };
      const r = await acoes.salvarContato({ contatoNome: nome, dados: { [data.campoNome]: data.valor } });
      if (r.ok) {
        const anteriores = (contato as Record<string, unknown>).camposPersonalizados as Record<string, string> | undefined;
        const personalizados = { ...anteriores, [data.campoNome]: data.valor };
        atualizarContato(contexto, { camposPersonalizados: personalizados, [data.campoNome]: data.valor });
      }
      return r.ok ? { tipo: "seguir", detalhe: `${data.campoNome} = "${data.valor}".` } : { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
    }

    case "atualizar_valor": {
      const data = no.data as AtualizarValorData;
      const r = await acoes.salvarContato({ contatoNome: nome, dados: { valor: data.valor } });
      return r.ok ? { tipo: "seguir", detalhe: `Valor: ${data.valor}.` } : { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
    }

    case "atualizar_status": {
      const data = no.data as AtualizarStatusData;
      const r = await acoes.salvarContato({ contatoNome: nome, dados: { etapa: data.status } });
      return r.ok ? { tipo: "seguir", detalhe: `Status: ${data.status}.` } : { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
    }

    case "responder_comentario_instagram": {
      const texto = ((no.data as { texto?: string }).texto ?? "").trim();
      if (!texto) return { tipo: "erro", detalhe: "Sem texto configurado pra resposta." };
      const r = await acoes.responderComentario(texto);
      return r.ok ? { tipo: "seguir", detalhe: r.detalhe } : { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
    }

    case "encaminhar_humano":
      return { tipo: "encerrar", situacao: "concluida", detalhe: "Encaminhado pra atendimento humano." };

    case "encerrar_fluxo":
      return { tipo: "encerrar", situacao: "concluida" };

    default:
      // Bloco que ainda não tem execução real. Segue em frente e diz isso no histórico, em vez de
      // fingir que fez ou derrubar o fluxo inteiro por causa de um passo.
      return { tipo: "seguir", detalhe: `"${no.titulo ?? no.type}" ainda não é executado pelo motor — o fluxo seguiu.` };
  }
}

/** A pergunta com as opções numeradas — é o que vai no texto quando o canal não tem botão. */
export function montarPergunta(data: MensagemBotoesData): string {
  const opcoes = (data.opcoes ?? []).filter((o) => o.rotulo?.trim());
  if (!opcoes.length) return data.texto;
  const linhas = opcoes.map((o, i) => `${i + 1} - ${o.rotulo}`);
  return `${data.texto}\n\n${linhas.join("\n")}`;
}

/**
 * Qual saída a resposta do contato escolheu, num bloco de opções.
 *
 * Aceita as formas que a pessoa usa de verdade: o número ("2"), o texto do botão ("Quero saber
 * valores") — que é também como um clique chega — e as `respostasAlternativas` que o fluxo listou
 * pra aquela opção ("orçamento"). Sem correspondência,
 * devolve `null` e quem chama decide (seguir por "outra_resposta" ou continuar esperando).
 */
export function saidaDaResposta(data: MensagemBotoesData, resposta: string): string | null {
  const opcoes = (data.opcoes ?? []).filter((o) => o.rotulo?.trim());
  if (!opcoes.length) return null;
  const limpa = resposta.trim().toLowerCase();
  if (!limpa) return null;

  const porNumero = Number(limpa.replace(/[^\d]/g, ""));
  if (Number.isInteger(porNumero) && porNumero >= 1 && porNumero <= opcoes.length && /^\D*\d+\D*$/.test(limpa)) {
    return opcoes[porNumero - 1].id;
  }
  const exata = opcoes.find(
    (o) =>
      o.rotulo.trim().toLowerCase() === limpa ||
      (o.respostasAlternativas ?? []).some((r) => r.trim().toLowerCase() === limpa),
  );
  if (exata) return exata.id;
  const contida = opcoes.find((o) => limpa.includes(o.rotulo.trim().toLowerCase()));
  return contida?.id ?? null;
}
