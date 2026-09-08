import { avaliarGrupoCondicoes } from "@/lib/automation-flow/motor";
import { rotuloCurto } from "@/lib/conversas/enviar-pergunta";
import type {
  AdicionarEtiquetaData,
  AguardarData,
  AgendarConsultaData,
  AlterarEtapaData,
  AlterarFunilData,
  AlterarResponsavelData,
  AtualizarCampoData,
  AtualizarStatusData,
  AtualizarValorData,
  CancelarAgendamentoData,
  ChamarWebhookData,
  CondicaoGrupoData,
  CriarLembreteData,
  CriarNegocioData,
  CriarTarefaData,
  DecisaoMultiplaData,
  DistribuirDisponibilidadeData,
  EncaminharEquipeData,
  EncaminharHumanoData,
  EnviarNotificacaoData,
  FlowEdge,
  FlowNode,
  EnviarFormularioData,
  IaClassificarData,
  IaResponderData,
  MensagemBotoesData,
  MensagemContatoData,
  MensagemEmailData,
  MensagemLocalizacaoData,
  MensagemMidiaData,
  MensagemModeloWhatsappData,
  NotificacaoInternaData,
  RemoverEtiquetaData,
} from "@/lib/automation-flow/types";
import type { AcoesDoMotor } from "./acoes";
import {
  gravadorNoBanco,
  type ContextoExecucaoPersistido,
  type ExecucaoAtiva,
  type GravadorDeExecucao,
} from "./execucoes";

/**
 * O motor com ESTADO: a diferença central em relação ao motor antigo.
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
  /** Onde a posição e o histórico são gravados. O padrão grava no banco; o simulador passa um
   * gravador de memória e por isso consegue rodar o motor de verdade sem sujar nada. */
  gravador?: GravadorDeExecucao;
  /** Substitui `new Date()`: o simulador usa pra "avançar o relógio". */
  agora?: Date;
}): Promise<FimDaRodada> {
  const { execucao, nodes, edges, acoes } = params;
  const gravador = params.gravador ?? gravadorNoBanco;
  const agora = params.agora ?? new Date();
  const porId = new Map(nodes.map((n) => [n.id, n]));

  let noAtualId = execucao.noAtualId;
  let contexto: ContextoExecucaoPersistido = { ...execucao.contexto };
  let passos = 0;
  // Trava contra ciclo: um nó já visitado NESTA rodada não roda de novo. Entre rodadas o mesmo nó
  // pode repetir (um follow-up que volta pro começo é legítimo). O que não pode é girar sem parar
  // dentro de uma chamada.
  const visitadosNaRodada = new Set<string>();

  while (noAtualId) {
    if (passos >= NOS_POR_RODADA) {
      // Reagenda em vez de continuar: a rodada tem tempo limitado, e o cron pega a sobra em
      // seguida. Uma automação longa avança em fatias, sem estourar a função.
      await gravador.reagendarRodada({ execucaoId: execucao.id, noId: noAtualId, contexto, ate: agora });
      return { situacao: "aguardando_tempo", passos, detalhe: "Continua na próxima rodada." };
    }

    const no = porId.get(noAtualId);
    if (!no) {
      const detalhe = `O bloco "${noAtualId}" não existe mais nesta versão do fluxo.`;
      await gravador.registrarPasso({
        execucaoId: execucao.id,
        workspaceId: execucao.workspaceId,
        noId: noAtualId,
        noTipo: "desconhecido",
        resultado: "erro",
        detalhe,
      });
      await gravador.encerrarExecucao({ execucaoId: execucao.id, situacao: "erro", erroMensagem: detalhe });
      return { situacao: "erro", passos, detalhe };
    }

    if (visitadosNaRodada.has(no.id)) {
      const detalhe = "Bloco repetido na mesma rodada. Parado pra evitar loop.";
      await gravador.registrarPasso({
        execucaoId: execucao.id,
        workspaceId: execucao.workspaceId,
        noId: no.id,
        noTipo: no.type,
        titulo: no.titulo,
        resultado: "pulado",
        detalhe,
      });
      await gravador.encerrarExecucao({ execucaoId: execucao.id, situacao: "erro", erroMensagem: detalhe });
      return { situacao: "erro", passos, detalhe };
    }
    visitadosNaRodada.add(no.id);
    passos++;

    // Bloco desativado no editor: registra e segue, sem executar. É o "desligar temporariamente"
    // sem ter que desconectar o bloco do fluxo.
    let resultado: ResultadoDoNo;
    if (no.desativado) {
      resultado = { tipo: "seguir", detalhe: "Bloco desativado: pulado." };
    } else {
      resultado = await executarNo({ no, contexto, acoes, agora, fluxoId: execucao.fluxoId });
    }

    await gravador.registrarPasso({
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
      await gravador.encerrarExecucao({ execucaoId: execucao.id, situacao: "erro", erroMensagem: resultado.detalhe });
      return { situacao: "erro", passos, detalhe: resultado.detalhe };
    }
    if (resultado.tipo === "aguardar_tempo") {
      await gravador.aguardarTempo({ execucaoId: execucao.id, noId: no.id, ate: resultado.ate, evento: resultado.evento, contexto });
      return { situacao: "aguardando_tempo", passos, detalhe: resultado.detalhe };
    }
    if (resultado.tipo === "aguardar_evento") {
      await gravador.aguardarEvento({ execucaoId: execucao.id, noId: no.id, evento: resultado.evento, ate: resultado.ate, contexto });
      return { situacao: "aguardando_evento", passos, detalhe: resultado.detalhe };
    }
    if (resultado.tipo === "encerrar") {
      await gravador.encerrarExecucao({ execucaoId: execucao.id, situacao: resultado.situacao });
      return { situacao: resultado.situacao, passos, detalhe: resultado.detalhe };
    }

    const proximo = proximaAresta(edges, no.id, resultado.saida);
    if (!proximo) {
      // Sem saída é o fim normal do caminho. Inclusive quando o último bloco não é "encerrar".
      await gravador.encerrarExecucao({ execucaoId: execucao.id, situacao: "concluida" });
      return { situacao: "concluida", passos };
    }
    noAtualId = proximo.target;
    contexto = { ...contexto };
    await gravador.avancarPara(execucao.id, noAtualId, contexto);
  }

  await gravador.encerrarExecucao({ execucaoId: execucao.id, situacao: "concluida" });
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

/** Aplica no contexto uma mudança que o próprio fluxo fez. O nó seguinte precisa enxergar. */
function atualizarContato(contexto: ContextoExecucaoPersistido, mudanca: Record<string, unknown>): void {
  contexto.contato = { ...contatoDoContexto(contexto), ...mudanca };
}

/** Momento em que uma espera termina, a partir da configuração do bloco. */
export function calcularEspera(data: AguardarData, agora: Date): Date | null {
  const valor = data.valor ?? 0;
  let quando: Date | null = null;
  if (data.modo === "minutos") quando = new Date(agora.getTime() + valor * 60_000);
  if (data.modo === "horas") quando = new Date(agora.getTime() + valor * 3_600_000);
  if (data.modo === "dias") {
    // Contar em dias ÚTEIS é diferente de contar em dias e depois empurrar: "2 dias úteis" a
    // partir de uma sexta é terça, não domingo empurrado pra segunda.
    quando = data.apenasDiasUteis ? somarDiasUteis(agora, valor) : new Date(agora.getTime() + valor * 86_400_000);
  }
  if (!quando) return null;

  // Empurra pra segunda quando cai no fim de semana. Uma cobrança que chega sábado de manhã tem
  // menos chance de resposta e mais chance de irritar. Era a razão de a opção existir na tela.
  if (data.pularFinaisDeSemana) quando = proximoDiaUtil(quando);
  return quando;
}

function ehFimDeSemana(data: Date): boolean {
  const dia = data.getDay();
  return dia === 0 || dia === 6;
}

function proximoDiaUtil(data: Date): Date {
  const resultado = new Date(data);
  while (ehFimDeSemana(resultado)) resultado.setDate(resultado.getDate() + 1);
  return resultado;
}

function somarDiasUteis(inicio: Date, dias: number): Date {
  const resultado = new Date(inicio);
  let restantes = Math.max(0, Math.round(dias));
  while (restantes > 0) {
    resultado.setDate(resultado.getDate() + 1);
    if (!ehFimDeSemana(resultado)) restantes--;
  }
  return resultado;
}

/** Prazo máximo de uma espera por resposta ("resposta OU 2 horas"). */
export function calcularTempoMaximo(data: AguardarData, agora: Date): Date | null {
  if (!data.tempoMaximo) return null;
  const { valor, unidade } = data.tempoMaximo;
  return new Date(agora.getTime() + valor * fatorDaUnidade(unidade));
}

/** Milissegundos de uma unidade escrita por extenso ("minutos", "horas", "dias"). Dias é o padrão:
 * é a unidade que a interface oferece primeiro. */
function fatorDaUnidade(unidade: string): number {
  return unidade.startsWith("min") ? 60_000 : unidade.startsWith("hor") ? 3_600_000 : 86_400_000;
}

async function executarNo(params: {
  no: FlowNode;
  /** Qual fluxo está rodando: o bloco de parar automações precisa poupar a si mesmo. */
  fluxoId: string;
  contexto: ContextoExecucaoPersistido;
  acoes: AcoesDoMotor;
  agora: Date;
}): Promise<ResultadoDoNo> {
  const { no, contexto, acoes, agora, fluxoId } = params;
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
      const opcoes = (data.opcoes ?? []).filter((o) => o.rotulo?.trim()).map((o) => ({ id: o.id, rotulo: o.rotulo }));
      const envio = await acoes.perguntar({ contatoNome: nome, texto: preencher(data.texto ?? "", contato), opcoes });
      if (!envio.ok) return { tipo: "erro", detalhe: envio.detalhe, erroTecnico: envio.erroTecnico };
      return { tipo: "aguardar_evento", evento: "resposta", detalhe: `${envio.detalhe} Esperando a escolha do contato.` };
    }

    case "mensagem_texto": {
      const data = no.data as { texto?: string; mensagem?: string; canal?: string };
      const texto = preencher((data.texto ?? data.mensagem ?? "").trim(), contato);
      if (!texto) return { tipo: "erro", detalhe: "Bloco de mensagem sem texto configurado." };
      const envio = await acoes.enviarTexto({ contatoNome: nome, texto, canal: data.canal });
      return envio.ok
        ? { tipo: "seguir", detalhe: envio.detalhe }
        : { tipo: "erro", detalhe: envio.detalhe, erroTecnico: envio.erroTecnico };
    }

    case "mensagem_imagem":
    case "mensagem_video":
    case "mensagem_audio":
    case "mensagem_documento": {
      const data = no.data as MensagemMidiaData;
      if (!data.arquivoId) return { tipo: "erro", detalhe: "O bloco não tem arquivo escolhido." };
      const tipo = TIPO_DE_MIDIA[no.type];
      const legenda = preencher(data.legenda ?? "", contato);
      const r = await acoes.enviarMidia({ contatoNome: nome, arquivoId: data.arquivoId, tipo, legenda });
      if (!r.ok) return { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
      // O Direct do Instagram manda o anexo sozinho. A legenda vai numa segunda mensagem, senão
      // ela simplesmente não aparece pra quem recebe.
      if (legenda && contatoCanal(contexto) === "instagram") {
        await acoes.enviarTexto({ contatoNome: nome, texto: legenda });
      }
      return { tipo: "seguir", detalhe: r.detalhe };
    }

    case "mensagem_modelo_whatsapp": {
      const data = no.data as MensagemModeloWhatsappData;
      if (!data.templateId) return { tipo: "erro", detalhe: "O bloco não tem modelo escolhido." };
      const r = await acoes.enviarModeloOficial({ contatoNome: nome, templateId: data.templateId, variaveis: data.variaveis });
      return r.ok ? { tipo: "seguir", detalhe: r.detalhe } : { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
    }

    case "mensagem_email": {
      const data = no.data as MensagemEmailData;
      const assunto = preencher(data.assunto ?? "", contato);
      const corpo = preencher(data.corpo ?? "", contato);
      if (!assunto.trim() && !corpo.trim()) return { tipo: "erro", detalhe: "E-mail sem assunto e sem corpo." };
      const para = data.destinatarioModo === "especifico" ? data.destinatarioEspecifico : undefined;
      const r = await acoes.enviarEmail({ contatoNome: nome, para, assunto, corpo });
      if (r.ok) return { tipo: "seguir", detalhe: r.detalhe };
      // "Sem e-mail" é uma situação prevista no próprio bloco, não uma falha do fluxo.
      if (data.seSemEmail === "encerrar") return { tipo: "encerrar", situacao: "concluida", detalhe: r.detalhe };
      if (data.seSemEmail === "caminho_alternativo") return { tipo: "seguir", saida: "sem_email", detalhe: r.detalhe };
      return { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
    }

    case "decisao_multipla": {
      const data = no.data as DecisaoMultiplaData;
      const caminhos = (data.caminhos ?? []).filter((c) => c.valor?.trim());
      const valor = String(valorParaDecisao(data, contato) ?? "").trim().toLowerCase();
      const operador = data.operador ?? "igual";

      // Primeiro que bate ganha, na ordem em que a pessoa escreveu. Ordem importa quando os valores
      // se sobrepõem ("valor" e "valores"), e a ordem da tela é a que ela consegue prever.
      const escolhido = caminhos.find((c) => {
        const alvoValor = c.valor.trim().toLowerCase();
        return operador === "contem" ? valor.includes(alvoValor) : valor === alvoValor;
      });

      return escolhido
        ? { tipo: "seguir", saida: escolhido.id, detalhe: `Seguiu por "${escolhido.rotulo || escolhido.valor}".` }
        : { tipo: "seguir", saida: "senao", detalhe: `"${valor || "(vazio)"}" não bate com nenhum caminho. Seguiu por "Qualquer outra".` };
    }

    case "ia_responder": {
      const data = no.data as IaResponderData;
      const r = await acoes.responderComIA({
        contatoNome: nome,
        instrucao: preencher(data.instrucao ?? "", contato),
        contexto: data.contexto,
        maximoCaracteres: data.maximoCaracteres,
      });
      return r.ok ? { tipo: "seguir", detalhe: r.detalhe } : { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
    }

    case "ia_classificar": {
      const data = no.data as IaClassificarData;
      const r = await acoes.classificarComIA({
        contatoNome: nome,
        instrucao: data.instrucao,
        categorias: data.categorias ?? [],
      });
      if (r.ok) return { tipo: "seguir", saida: r.detalhe, detalhe: `Classificado como "${r.detalhe}".` };
      // Detalhe vazio é o caso previsto: a IA respondeu, mas nada encaixou. O fluxo segue pelo
      // caminho de "não classificado" em vez de escolher um ramo no chute.
      if (!r.detalhe) {
        return { tipo: "seguir", saida: "nao_classificado", detalhe: "A IA não encaixou a conversa em nenhuma categoria." };
      }
      return { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
    }

    case "pausar_automacoes":
    case "cancelar_automacoes": {
      const r = await acoes.pararOutrasAutomacoes({
        contatoNome: nome,
        // O próprio fluxo nunca se encerra: um bloco que matasse a execução que o está executando
        // pararia o fluxo no meio, e não é isso que "pausar as automações do contato" quer dizer.
        fluxoAtualId: fluxoId,
        modo: no.type === "pausar_automacoes" ? "pausar" : "cancelar",
      });
      return r.ok ? { tipo: "seguir", detalhe: r.detalhe } : { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
    }

    case "alterar_funil": {
      const data = no.data as AlterarFunilData;
      if (!data.funilId) return { tipo: "erro", detalhe: "O bloco não tem funil escolhido." };
      // Sem etapa escolhida vai pra primeira do funil. Mover pra um funil sem dizer onde é o que
      // a pessoa quer dizer com "mandar pro começo dele".
      const r = await acoes.moverEtapa({ contatoNome: nome, funilId: data.funilId, etapaTitulo: data.etapaTitulo ?? "" });
      return r.ok ? { tipo: "seguir", detalhe: r.detalhe } : { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
    }

    case "encaminhar_equipe":
    case "distribuir_disponibilidade": {
      const data = no.data as EncaminharEquipeData & DistribuirDisponibilidadeData;
      const escolhido = await acoes.escolherAtendente({
        equipe: data.equipeNome,
        metodo: data.modo === "menos_ocupado" ? "menos_atendimentos" : "rodizio",
      });
      if (!escolhido.ok) return { tipo: "erro", detalhe: escolhido.detalhe, erroTecnico: escolhido.erroTecnico };
      const r = await acoes.salvarContato({ contatoNome: nome, dados: { responsavel: escolhido.detalhe } });
      return r.ok
        ? { tipo: "seguir", detalhe: `Atendimento com ${escolhido.detalhe}.` }
        : { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
    }

    case "criar_lembrete": {
      const data = no.data as CriarLembreteData;
      const titulo = preencher(data.titulo ?? "", contato);
      if (!titulo.trim()) return { tipo: "erro", detalhe: "Lembrete sem título." };
      const quando = data.tempoValor
        ? new Date(agora.getTime() + data.tempoValor * fatorDaUnidade(data.tempoUnidade ?? "dias"))
        : agora;
      // Lembrete é uma tarefa com prazo. Mesmo quadro, mesma tela. Um segundo lugar pra "coisas
      // pra fazer" só faria a pessoa procurar em dois lugares.
      const r = await acoes.criarTarefa({ contatoNome: nome, titulo, prazo: quando, prioridade: "normal" });
      return r.ok ? { tipo: "seguir", detalhe: r.detalhe } : { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
    }

    case "criar_negocio": {
      const data = no.data as CriarNegocioData;
      if (!data.funilId || !data.etapaTitulo) return { tipo: "erro", detalhe: "O bloco não tem funil e etapa escolhidos." };
      const r = await acoes.criarNegocio({
        contatoNome: nome,
        nome: preencher(data.nome ?? "", contato) || nome,
        funilId: data.funilId,
        etapaTitulo: data.etapaTitulo,
        valor: data.valor,
      });
      return r.ok ? { tipo: "seguir", detalhe: r.detalhe } : { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
    }

    case "agendar_consulta": {
      const data = no.data as AgendarConsultaData;
      if (!data.data || !data.horario) {
        return { tipo: "erro", detalhe: "O bloco de agendamento precisa de data e horário." };
      }
      const r = await acoes.agendarConsulta({
        contatoNome: nome,
        dataIso: data.data,
        hora: data.horario,
        responsavel: data.profissional,
        tipo: data.tipoServico,
        observacao: data.observacao,
      });
      return r.ok ? { tipo: "seguir", detalhe: r.detalhe } : { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
    }

    case "cancelar_agendamento": {
      const data = no.data as CancelarAgendamentoData;
      const r = await acoes.cancelarAgendamento({ contatoNome: nome, motivo: data.mensagem });
      if (!r.ok) return { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
      // O aviso ao contato é opcional e sai depois do cancelamento: avisar antes e falhar o
      // cancelamento deixaria a pessoa achando que perdeu a consulta sem ter perdido.
      if (data.enviarMensagem && data.mensagem?.trim()) {
        await acoes.enviarTexto({ contatoNome: nome, texto: preencher(data.mensagem, contato) });
      }
      return { tipo: "seguir", detalhe: r.detalhe };
    }

    case "enviar_notificacao": {
      const data = no.data as EnviarNotificacaoData;
      const r = await acoes.avisarEquipe({
        contatoNome: nome,
        equipe: data.paraEquipe,
        mensagem: preencher(data.mensagem ?? "", contato),
      });
      return r.ok ? { tipo: "seguir", detalhe: r.detalhe } : { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
    }

    case "ocultar_comentario_instagram": {
      const r = await acoes.ocultarComentario();
      return r.ok ? { tipo: "seguir", detalhe: r.detalhe } : { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
    }

    case "criar_tarefa": {
      const data = no.data as CriarTarefaData;
      const titulo = preencher(data.titulo ?? "", contato);
      if (!titulo.trim()) return { tipo: "erro", detalhe: "Tarefa sem título." };
      const r = await acoes.criarTarefa({
        contatoNome: nome,
        titulo,
        descricao: preencher(data.descricao ?? "", contato),
        responsavel:
          data.modoResponsavel === "pessoa"
            ? data.responsavel
            : ((contato as Record<string, unknown>).responsavel as string | undefined),
        prazo: prazoDaTarefa(data, agora),
        prioridade: data.prioridade,
      });
      return r.ok ? { tipo: "seguir", detalhe: r.detalhe } : { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
    }

    case "chamar_webhook": {
      const data = no.data as ChamarWebhookData;
      if (!data.url?.trim()) return { tipo: "erro", detalhe: "Webhook sem endereço." };
      let corpo: Record<string, unknown> = { contato: contato.nome, fluxo: no.id, em: agora.toISOString() };
      if (data.payload?.trim()) {
        try {
          corpo = JSON.parse(preencher(data.payload, contato)) as Record<string, unknown>;
        } catch {
          return { tipo: "erro", detalhe: "O conteúdo do webhook não é um JSON válido." };
        }
      }
      const r = await acoes.chamarWebhook({ url: data.url.trim(), corpo });
      return r.ok ? { tipo: "seguir", detalhe: r.detalhe } : { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
    }

    case "mensagem_localizacao": {
      const data = no.data as MensagemLocalizacaoData;
      const latitude = Number(data.latitude);
      const longitude = Number(data.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        // Endereço escrito por extenso não vira coordenada sozinho: isso precisaria de um serviço
        // de geocodificação, que o CRM não tem. Dizer isso é melhor que mandar um mapa no lugar
        // errado.
        return { tipo: "erro", detalhe: "O bloco de localização precisa de latitude e longitude. Endereço por extenso ainda não é convertido." };
      }
      const enderecoCompleto = [data.endereco, data.numero, data.bairro, data.cidade, data.estado].filter(Boolean).join(", ");
      const r = await acoes.enviarLocalizacao({
        contatoNome: nome,
        latitude,
        longitude,
        nome: data.nomeLocal,
        endereco: enderecoCompleto || undefined,
      });
      return r.ok ? { tipo: "seguir", detalhe: r.detalhe } : { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
    }

    case "mensagem_contato": {
      const data = no.data as MensagemContatoData;
      const escolhido = data.contatoSelecionadoNome?.trim();
      if (!escolhido) return { tipo: "erro", detalhe: "O bloco não tem contato escolhido." };
      const dados = await acoes.buscarContato(escolhido);
      if (!dados.ok) return { tipo: "erro", detalhe: dados.detalhe, erroTecnico: dados.erroTecnico };
      const r = await acoes.enviarContato({ contatoNome: nome, ...JSON.parse(dados.detalhe) });
      return r.ok ? { tipo: "seguir", detalhe: r.detalhe } : { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
    }

    case "enviar_formulario": {
      const data = no.data as EnviarFormularioData;
      const link = await acoes.linkDoFormulario({
        origem: data.formularioOrigem ?? "interno",
        formularioId: data.formularioId,
        urlExterna: data.formularioUrlExterna,
      });
      if (!link.ok) return { tipo: "erro", detalhe: link.detalhe, erroTecnico: link.erroTecnico };
      const texto = [preencher(data.mensagem ?? "", contato).trim(), link.detalhe].filter(Boolean).join("\n\n");
      const envio = await acoes.enviarTexto({ contatoNome: nome, texto });
      return envio.ok
        ? { tipo: "seguir", detalhe: `Formulário enviado: ${link.detalhe}` }
        : { tipo: "erro", detalhe: envio.detalhe, erroTecnico: envio.erroTecnico };
    }

    case "notificacao_interna": {
      const data = no.data as NotificacaoInternaData;
      const r = await acoes.avisarEquipe({
        contatoNome: nome,
        equipe: data.paraEquipe,
        mensagem: preencher(data.mensagem ?? "", contato),
      });
      return r.ok ? { tipo: "seguir", detalhe: r.detalhe } : { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
    }

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

    case "encaminhar_humano": {
      const data = no.data as EncaminharHumanoData;
      // "manter" é o único caso em que ninguém novo assume: o fluxo só sai do caminho.
      if (data.destino === "atendente" && data.atendenteNome) {
        const r = await acoes.salvarContato({ contatoNome: nome, dados: { responsavel: data.atendenteNome } });
        if (!r.ok) return { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
      } else if (data.destino === "distribuicao" || data.destino === "equipe") {
        const escolhido = await acoes.escolherAtendente({ equipe: data.equipeNome, metodo: data.metodoDistribuicao });
        if (!escolhido.ok) return { tipo: "erro", detalhe: escolhido.detalhe, erroTecnico: escolhido.erroTecnico };
        const r = await acoes.salvarContato({ contatoNome: nome, dados: { responsavel: escolhido.detalhe } });
        if (!r.ok) return { tipo: "erro", detalhe: r.detalhe, erroTecnico: r.erroTecnico };
      }

      if (data.moverFunil && data.funilId && data.etapaTitulo) {
        await acoes.moverEtapa({ contatoNome: nome, funilId: data.funilId, etapaTitulo: data.etapaTitulo });
      }

      // Encerra de propósito: o atendimento passou pra uma pessoa, e a automação continuar mandando
      // mensagem por cima de quem assumiu é o comportamento que mais irrita cliente.
      return { tipo: "encerrar", situacao: "concluida", detalhe: "Encaminhado pra atendimento humano." };
    }

    case "encerrar_fluxo":
      return { tipo: "encerrar", situacao: "concluida" };

    default:
      // Bloco que ainda não tem execução real. Segue em frente e diz isso no histórico, em vez de
      // fingir que fez ou derrubar o fluxo inteiro por causa de um passo.
      return { tipo: "seguir", detalhe: `"${no.titulo ?? no.type}" ainda não é executado pelo motor. O fluxo seguiu.` };
  }
}

/**
 * Troca `{{nome}}`, `{{origem}}`, `{{responsavel}}` e afins pelo valor do contato.
 *
 * O motor não fazia isso: quem escrevia "Oi {{nome}}" no bloco via a mensagem sair com as chaves
 * literais pro cliente. Variável sem valor vira texto vazio. Melhor uma frase com um buraco do que
 * uma frase com `{{primeiro_nome}}` no meio dela.
 */
export function preencher(texto: string, contato: Record<string, unknown>): string {
  if (!texto.includes("{{")) return texto;
  return texto.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_todo, chave: string) => {
    const valor = valorDoContato(contato, chave);
    return valor ?? "";
  });
}

function valorDoContato(contato: Record<string, unknown>, chave: string): string | null {
  const direto = contato[chave];
  if (typeof direto === "string" || typeof direto === "number") return String(direto);

  if (chave === "primeiro_nome") {
    const nome = typeof contato.nome === "string" ? contato.nome : "";
    return nome.trim().split(/\s+/)[0] ?? null;
  }

  const personalizados = contato.camposPersonalizados as Record<string, string> | undefined;
  const doCampo = personalizados?.[chave];
  return typeof doCampo === "string" ? doCampo : null;
}

/**
 * O valor que a decisão compara.
 *
 * `mensagem` é o caso comum e vem do contexto (o motor grava ali a última resposta). Campo
 * personalizado é lido do mapa próprio; o resto sai direto do contato.
 */
function valorParaDecisao(data: DecisaoMultiplaData, contato: Record<string, unknown>): unknown {
  if (data.campo === "campo_personalizado") {
    const personalizados = contato.camposPersonalizados as Record<string, string> | undefined;
    return personalizados?.[data.campoPersonalizadoNome ?? ""];
  }
  if (data.campo === "etiqueta") {
    const etiquetas = contato.etiquetas;
    return Array.isArray(etiquetas) ? etiquetas.join(",") : "";
  }
  return contato[data.campo];
}

const TIPO_DE_MIDIA: Record<string, "imagem" | "video" | "audio" | "documento"> = {
  mensagem_imagem: "imagem",
  mensagem_video: "video",
  mensagem_audio: "audio",
  mensagem_documento: "documento",
};

/** O canal da conversa, quando o contexto sabe: usado pra decidir detalhes de formato. */
function contatoCanal(contexto: ContextoExecucaoPersistido): string {
  const contato = (contexto.contato ?? {}) as { canal?: string };
  return (contato.canal ?? "").toLowerCase();
}

/** Quando a tarefa vence, conforme o bloco. Sem prazo configurado, é pra hoje. */
function prazoDaTarefa(data: CriarTarefaData, agora: Date): Date | undefined {
  if (data.modoPrazo === "data_especifica" && data.data) {
    const escolhida = new Date(`${data.data}T${data.horario ?? "09:00"}:00`);
    return Number.isNaN(escolhida.getTime()) ? undefined : escolhida;
  }
  if (data.modoPrazo === "depois_de" && data.prazoValor) {
    return new Date(agora.getTime() + data.prazoValor * fatorDaUnidade(data.prazoUnidade ?? "dias"));
  }
  return undefined;
}

/**
 * Qual saída a resposta do contato escolheu, num bloco de opções.
 *
 * Aceita as formas que a pessoa usa de verdade: o número ("2"), o texto do botão ("Quero saber
 * valores"): que é também como um clique chega. E as `respostasAlternativas` que o fluxo listou
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
  // O rótulo encurtado entra na comparação porque é ELE que a pessoa recebeu: botão do WhatsApp e
  // resposta rápida do Instagram cortam em 20 caracteres, e o clique volta com o texto cortado.
  const exata = opcoes.find(
    (o) =>
      o.rotulo.trim().toLowerCase() === limpa ||
      rotuloCurto(o.rotulo).toLowerCase() === limpa ||
      (o.respostasAlternativas ?? []).some((r) => r.trim().toLowerCase() === limpa),
  );
  if (exata) return exata.id;
  const contida = opcoes.find((o) => limpa.includes(o.rotulo.trim().toLowerCase()));
  return contida?.id ?? null;
}
