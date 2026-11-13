import { prisma } from "@/lib/prisma";
import { minutosDeAtraso, quandoRodar } from "@/lib/funil/atraso-do-gatilho";
import { deveRodarAgora } from "@/lib/funil/repeticao-do-gatilho";
import { CAMPO_NASCIMENTO, ehOMinutoDoCampo } from "@/lib/funil/campo-de-data-do-gatilho";
import { avaliarGrupoCondicoes } from "@/lib/automation-flow/avaliacao";
import { iniciarFluxoComEstado } from "@/lib/automacoes/iniciar";
import { rastreioParaCondicoes } from "@/lib/rastreio/para-condicoes";
import { enfileirarConversao } from "@/lib/rastreio/fila-de-conversoes";
import { identificadoresDoLead } from "@/lib/rastreio/identificadores-do-lead";
import type { PlataformaDeConversao } from "@/lib/rastreio/eventos-de-conversao";
import type { GrupoCondicoes } from "@/lib/automation-flow/types";
import {
  ACAO_ROTULO,
  EVENTO_DO_QUANDO,
  dentroDaJanelaDoGatilho,
  ehOMinutoMarcado,
  limiteDeSilencio,
  quandoAceitos,
  QUANDO_ROTULO,
  type AcaoDados,
  type GatilhoEtapaVisao,
  type QuandoGatilho,
  type TipoAcaoGatilho,
} from "./gatilhos-etapa-tipos";
import { acoesReais } from "@/lib/automacoes/acoes";
import { primeiraVezPara } from "@/lib/automacoes/idempotencia";

export { ACAO_ROTULO, dentroDaJanelaDoGatilho, QUANDO_ROTULO };
export type { AcaoDados, GatilhoEtapaVisao, QuandoGatilho, TipoAcaoGatilho };

/**
 * Gatilhos que moram na ETAPA do funil, não dentro do fluxo.
 *
 * A automação passa a ser vista de onde ela acontece. Olhando o quadro do funil dá pra saber
 * quais etapas fazem alguma coisa sozinhas, quais robôs elas executam e em que horário, sem abrir
 * automação por automação. O fluxo vira um robô reutilizável: várias etapas podem executar o
 * mesmo.
 *
 * Convive com o gatilho de dentro do fluxo. Os fluxos que já existem continuam disparando pelo
 * bloco de gatilho deles, e desligar um não desliga o outro.
 */

function comoGrupo(valor: unknown): GrupoCondicoes | null {
  if (!valor || typeof valor !== "object") return null;
  const grupo = valor as GrupoCondicoes;
  return Array.isArray(grupo.regras) || Array.isArray(grupo.subgrupos) ? grupo : null;
}


/**
 * Executa uma ação DIRETA da etapa. Sem robô no meio.
 *
 * Reaproveita as mesmas ações do motor de automação de propósito: mudar o responsável a partir da
 * etapa tem que fazer exatamente o que o bloco "Alterar responsável" faz dentro de um fluxo. Duas
 * implementações da mesma coisa divergem na primeira correção feita só de um lado.
 */
async function executarAcaoDireta(params: {
  workspaceId: string;
  contatoNome: string;
  funilId: string;
  tipo: TipoAcaoGatilho;
  dados: AcaoDados;
}): Promise<{ ok: boolean; detalhe: string }> {
  const acoes = acoesReais({ workspaceId: params.workspaceId });
  const { contatoNome, dados } = params;

  switch (params.tipo) {
    case "responsavel": {
      if (!dados.responsavel) return { ok: false, detalhe: "Gatilho sem responsável escolhido." };
      return acoes.salvarContato({ contatoNome, dados: { responsavel: dados.responsavel } });
    }

    case "etapa": {
      if (!dados.etapaDestinoId) return { ok: false, detalhe: "Gatilho sem etapa de destino." };
      // A etapa de destino vira título porque é assim que `moverEtapa` procura, e é o mesmo
      // caminho que o bloco do editor usa.
      const destino = await prisma.funilEtapa.findFirst({
        where: { id: dados.etapaDestinoId, workspaceId: params.workspaceId },
        select: { titulo: true, funilId: true },
      });
      if (!destino) return { ok: false, detalhe: "A etapa de destino não existe mais." };
      return acoes.moverEtapa({ contatoNome, funilId: destino.funilId, etapaTitulo: destino.titulo });
    }

    case "etiquetas": {
      const contato = await prisma.contato.findUnique({
        where: { workspaceId_nome: { workspaceId: params.workspaceId, nome: contatoNome } },
      });
      const atuais = Array.isArray(contato?.etiquetas) ? (contato.etiquetas as string[]) : [];
      const remover = new Set(dados.etiquetasRemover ?? []);
      const finais = [...new Set([...atuais.filter((e) => !remover.has(e)), ...(dados.etiquetasAdicionar ?? [])])];
      return acoes.salvarContato({ contatoNome, dados: { etiquetas: finais } });
    }

    case "webhook": {
      if (!dados.webhookUrl?.trim()) return { ok: false, detalhe: "Gatilho sem endereço de webhook." };
      return acoes.chamarWebhook({
        url: dados.webhookUrl,
        corpo: { contato: contatoNome, funilId: params.funilId, origem: "gatilho-de-etapa" },
      });
    }

    case "mensagem": {
      if (!dados.mensagemTexto?.trim()) return { ok: false, detalhe: "Gatilho sem texto de mensagem." };
      return acoes.enviarTexto({ contatoNome, texto: dados.mensagemTexto });
    }

    /*
     * DEVOLVER A CONVERSÃO PRA PLATAFORMA DE ANÚNCIO.
     *
     * Põe na fila e acabou: nenhuma chamada de rede acontece aqui. Mover um card é uma ação da
     * pessoa, no meio do trabalho dela — pendurar nela uma conversa com a API do Google faria o
     * arrasto travar e faria a venda deixar de ser devolvida toda vez que o Google estivesse fora
     * do ar. A rodada tenta de novo sozinha, e ninguém espera por ela.
     *
     * O valor sai do negócio ganho deste lead. Compra sem valor é recusada na entrada da fila,
     * com o motivo escrito: uma venda enviada com valor zero ensina o algoritmo que aquela
     * campanha produz vendas que não valem nada.
     */
    case "conversao": {
      const plataforma = (dados.conversaoPlataforma ?? "").trim();
      const evento = (dados.conversaoEvento ?? "").trim();
      if (!plataforma || !evento) return { ok: false, detalhe: "Gatilho sem plataforma ou evento de conversão." };

      const contato = await prisma.contato.findUnique({
        where: { workspaceId_nome: { workspaceId: params.workspaceId, nome: contatoNome } },
        select: { id: true, email: true, whatsapp: true, origemDoLead: true },
      });
      if (!contato) return { ok: false, detalhe: "O contato não existe mais." };

      const negocio = await prisma.negocioCard.findFirst({
        where: { workspaceId: params.workspaceId, nome: contatoNome, statusFechamento: "ganho" },
        orderBy: { dataFechamento: "desc" },
        select: { id: true, valor: true, dataFechamento: true },
      });
      const valor = negocio ? Number(String(negocio.valor).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")) : null;
      const origem = contato.origemDoLead;

      const resultado = await enfileirarConversao(prisma, {
        workspaceId: params.workspaceId,
        contatoId: contato.id,
        plataforma: plataforma as PlataformaDeConversao,
        evento,
        eventoEm: negocio?.dataFechamento ?? new Date(),
        valor: Number.isFinite(valor) ? valor : null,
        moeda: dados.conversaoMoeda?.trim() || "BRL",
        resultadoId: negocio?.id ?? null,
        identificadores: identificadoresDoLead(origem, contato),
      });

      if (resultado.enfileirado) return { ok: true, detalhe: "Conversão na fila." };
      if (resultado.motivo === "ja-existe") return { ok: true, detalhe: "Essa conversão já tinha sido registrada." };
      if (resultado.motivo === "pulado") return { ok: true, detalhe: `Não enviada: ${resultado.detalhe}` };
      return { ok: false, detalhe: "Não foi possível pôr a conversão na fila." };
    }

    default:
      return { ok: false, detalhe: `Ação "${params.tipo}" não é uma ação direta.` };
  }
}

/**
 * Executa o que a etapa pediu. Chamado depois de o card já estar na etapa nova.
 *
 * Erros de um gatilho não derrubam os outros: uma automação com problema não pode impedir a
 * seguinte de rodar, e o card já se moveu de qualquer jeito.
 */
export async function dispararGatilhosDaEtapa(params: {
  workspaceId: string;
  etapaId: string;
  contatoNome: string;
  evento: QuandoGatilho;
  agora?: Date;
}): Promise<void> {
  const agora = params.agora ?? new Date();
  const linhas = await prisma.gatilhoEtapa.findMany({
    where: {
      workspaceId: params.workspaceId,
      etapaId: params.etapaId,
      ativo: true,
      quando: { in: quandoAceitos(params.evento) },
    },
    orderBy: { ordem: "asc" },
  });
  if (!linhas.length) return;

  for (const linha of linhas) {
    // Aqui a janela VALE: o lead entrou na etapa fora do horário em que a pessoa quis automatizar.
    if (!dentroDaJanelaDoGatilho(linha as unknown as GatilhoEtapaVisao, agora)) continue;

    /*
     * GATILHO COM ESPERA NÃO RODA AGORA: ENTRA NA FILA.
     *
     * "Imediatamente quando movido para esta etapa, ou depois de 5 minutos, ou depois de 10
     * minutos, ou um dia."
     *
     * Não dá pra resolver com `setTimeout`: o processo que atendeu a requisição morre em
     * segundos, e num servidor sem estado não existe "daqui a um dia" na memória. A intenção vira
     * linha em `GatilhoAgendado` e quem a cumpre é a varredura de minuto, que já roda.
     */
    const atraso = minutosDeAtraso(linha.atrasoMinutos);
    if (atraso > 0) {
      await agendarGatilho({
        workspaceId: params.workspaceId,
        gatilhoId: linha.id,
        etapaId: params.etapaId,
        contatoNome: params.contatoNome,
        rodarEm: quandoRodar(agora, atraso),
      }).catch((erro) => console.error(`[gatilho-etapa] ${linha.id} não entrou na fila:`, erro));
      continue;
    }

    await executarUmGatilho({
      workspaceId: params.workspaceId,
      contatoNome: params.contatoNome,
      gatilho: linha,
    }).catch((erro) => {
      console.error(`[gatilho-etapa] ${linha.id} falhou:`, erro);
      return false;
    });
  }
}

/**
 * Põe (ou reinicia) a espera de UM lead num gatilho.
 *
 * `upsert` pela chave (gatilho, contato) porque entrar na etapa DE NOVO durante a espera reinicia
 * a contagem, em vez de somar uma segunda execução: duas mensagens iguais com um minuto de
 * diferença é o que a pessoa veria do outro lado.
 */
async function agendarGatilho(params: {
  workspaceId: string;
  gatilhoId: string;
  etapaId: string;
  contatoNome: string;
  rodarEm: Date;
}): Promise<void> {
  const { workspaceId, gatilhoId, etapaId, contatoNome, rodarEm } = params;
  await prisma.gatilhoAgendado.upsert({
    where: { gatilhoId_contatoNome: { gatilhoId, contatoNome } },
    create: {
      id: `age-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      workspaceId,
      gatilhoId,
      etapaId,
      contatoNome,
      rodarEm,
    },
    update: { rodarEm, etapaId },
  });
}

/**
 * RODA O QUE JÁ VENCEU NA FILA DE ESPERA.
 *
 * `rodarEm <= agora`, e não "igual a este minuto": uma batida perdida (um deploy, uma fila cheia)
 * precisa atrasar a execução, não cancelá-la. É a diferença entre uma automação que escorrega
 * cinco minutos e uma que simplesmente não aconteceu — e a segunda ninguém descobre.
 */
export async function rodarGatilhosAgendados(agora: Date = new Date()): Promise<number> {
  const vencidos = await prisma.gatilhoAgendado.findMany({
    where: { rodarEm: { lte: agora } },
    orderBy: { rodarEm: "asc" },
    // Um teto por batida pra uma fila represada não estourar o tempo da função. O resto sai na
    // batida seguinte, que é daqui a um minuto.
    take: 200,
    include: { gatilho: true },
  });
  if (!vencidos.length) return 0;

  let feitos = 0;
  for (const agendado of vencidos) {
    /*
     * A LINHA SAI DA FILA ANTES DE RODAR.
     *
     * Se a execução falhar no meio, a alternativa seria tentar de novo na batida seguinte — e com
     * um erro permanente (robô apagado, webhook fora do ar) isso vira uma tentativa por minuto,
     * pra sempre. Uma automação que não aconteceu aparece no registro de execução; uma que
     * acontece mil vezes aparece no WhatsApp do lead.
     */
    await prisma.gatilhoAgendado.delete({ where: { id: agendado.id } }).catch(() => {});

    const gatilho = agendado.gatilho;
    // Gatilho desligado durante a espera não dispara: desligar precisa valer pro que já está na
    // fila, senão "desliguei e continuou mandando" é verdade por um dia inteiro.
    if (!gatilho || !gatilho.ativo) continue;

    /*
     * O LEAD AINDA ESTÁ NA ETAPA?
     *
     * "Cinco minutos depois de entrar em Proposta, mande a mensagem" não vale pra quem já foi
     * movido pra Ganho no meio do caminho: a etapa é a dona do gatilho, e quem saiu dela saiu do
     * alcance dele. Sem esta conferência, a espera manda a mensagem da etapa errada.
     */
    const aindaAqui = await prisma.negocioCard.findFirst({
      where: {
        workspaceId: agendado.workspaceId,
        etapaId: agendado.etapaId,
        nome: agendado.contatoNome,
      },
      select: { id: true },
    });
    if (!aindaAqui) continue;

    const feito = await executarUmGatilho({
      workspaceId: agendado.workspaceId,
      contatoNome: agendado.contatoNome,
      gatilho,
    }).catch((erro) => {
      console.error(`[gatilho-etapa] agendado ${agendado.id} falhou:`, erro);
      return false;
    });
    if (feito) feitos++;
  }
  return feitos;
}

/** A linha do banco, como o executor precisa dela. */
type LinhaGatilho = {
  id: string;
  workspaceId: string;
  funilId: string;
  etapaId: string;
  quando: string;
  tipoAcao: string;
  fluxoId: string | null;
  acaoDados: unknown;
  condicao: unknown;
};

/**
 * Executa UM gatilho para UM lead. É o miolo compartilhado entre a entrada na etapa, o "aplicar
 * aos leads que já estão aqui" e a varredura diária: os três fazem exatamente a mesma coisa, e
 * três cópias divergiriam na primeira correção feita só numa delas.
 *
 * Devolve `false` quando o gatilho foi pulado (condição não bateu, robô sumiu, ação sem dados).
 */
async function executarUmGatilho(params: {
  workspaceId: string;
  contatoNome: string;
  gatilho: LinhaGatilho;
}): Promise<boolean> {
  const { workspaceId, contatoNome, gatilho } = params;

  const contatoNoBanco = await prisma.contato.findUnique({
    where: { workspaceId_nome: { workspaceId, nome: contatoNome } },
    // A origem vem junto: um gatilho de etapa é exatamente onde se quer perguntar "este lead veio
    // de anúncio?" — e sem o `include` a condição não enxergava nada disso, enquanto o mesmo robô
    // disparado por mensagem enxergava. O mesmo robô, dois comportamentos, por causa da leitura.
    include: { origemDoLead: true },
  });
  const contato = {
    ...(contatoNoBanco ?? {}),
    ...rastreioParaCondicoes(contatoNoBanco?.origemDoLead),
    nome: contatoNome,
    etiquetas: Array.isArray(contatoNoBanco?.etiquetas) ? (contatoNoBanco.etiquetas as string[]) : [],
    canal: "crm",
    mensagem: "",
  };

  // "Para todos os leads com:". Sem condição, vale pra todo lead.
  const condicao = comoGrupo(gatilho.condicao);
  if (condicao && !avaliarGrupoCondicoes(condicao, contato)) return false;

  const tipo = (gatilho.tipoAcao ?? "robo") as TipoAcaoGatilho;

  if (tipo !== "robo") {
    const resultado = await executarAcaoDireta({
      workspaceId,
      contatoNome,
      funilId: gatilho.funilId,
      tipo,
      dados: (gatilho.acaoDados as AcaoDados) ?? {},
    });
    if (!resultado.ok) {
      console.warn(`[gatilho-etapa] ${gatilho.id} (${ACAO_ROTULO[tipo]}): ${resultado.detalhe}`);
      return false;
    }
    return true;
  }

  if (!gatilho.fluxoId) {
    console.warn(`[gatilho-etapa] ${gatilho.id} é do tipo robô mas não tem robô escolhido`);
    return false;
  }
  const fluxo = await prisma.fluxoAutomacao.findFirst({
    where: { id: gatilho.fluxoId, workspaceId, arquivada: false },
  });
  if (!fluxo) {
    console.warn(`[gatilho-etapa] ${gatilho.id} aponta pro robô ${gatilho.fluxoId}, que não existe mais`);
    return false;
  }

  const fim = await iniciarFluxoComEstado({
    workspaceId,
    fluxoId: fluxo.id,
    gatilho: `etapa:${gatilho.quando}`,
    configuracoes: fluxo.configuracoes as never,
    publicarSeFaltar: {
      versao: Math.max(1, Number(fluxo.versaoAtual ?? 1)),
      nodes: fluxo.nodes as never,
      edges: fluxo.edges as never,
      configuracoes: fluxo.configuracoes as never,
    },
    contatoNome,
    contatoId: contatoNoBanco?.id ?? null,
    contato,
  });

  /* Barrado antes de começar (limite, horário, outra automação no contato) não conta como
     execução: o número ao lado do robô é quantas vezes ele RODOU. */
  if (fim?.naoIniciou) {
    console.log(`[gatilho-etapa] robô "${fluxo.nome}" não iniciou:`, fim.detalhe);
    return false;
  }

  await prisma.fluxoAutomacao
    .update({ where: { id: fluxo.id }, data: { execucoes: { increment: 1 } } })
    .catch(() => {});
  return true;
}

/**
 * Roda UM gatilho nos leads que já estão na etapa dele.
 *
 * Serve a duas coisas: a caixinha "aplicar aos leads que já estão aqui", e a varredura diária
 * (o `quando = "diariamente"`), que é exatamente a mesma operação repetida todo dia no horário.
 *
 * A janela de dias/horário NÃO é checada aqui: quem aplica à mão está pedindo agora, e a
 * varredura diária já roda no horário que a própria pessoa escolheu.
 */
export async function rodarGatilhoNosLeadsDaEtapa(params: {
  workspaceId: string;
  gatilhoId: string;
  /** Teto de leads por chamada. Uma etapa com milhares não pode estourar o tempo da função. */
  limite?: number;
}): Promise<number> {
  const gatilho = await prisma.gatilhoEtapa.findFirst({
    where: { id: params.gatilhoId, workspaceId: params.workspaceId },
  });
  if (!gatilho) return 0;

  const cards = await prisma.negocioCard.findMany({
    where: { workspaceId: params.workspaceId, etapaId: gatilho.etapaId },
    select: { nome: true },
    orderBy: { ordem: "asc" },
    take: params.limite ?? 200,
  });

  let alcancados = 0;
  for (const card of cards) {
    const feito = await executarUmGatilho({
      workspaceId: params.workspaceId,
      contatoNome: card.nome,
      gatilho,
    }).catch((erro) => {
      console.error(`[gatilho-etapa] ${gatilho.id} falhou no lead ${card.nome}:`, erro);
      return false;
    });
    if (feito) alcancados++;
  }
  return alcancados;
}

/**
 * Quem está nesta etapa e ficou tempo demais sem falar.
 *
 * "Sem resposta" se mede pela última mensagem DO LEAD, não pela última da conversa: se a régua
 * fosse a última mensagem qualquer, nossa própria cobrança de ontem zeraria o relógio e o gatilho
 * nunca mais dispararia. Quem nunca mandou mensagem nenhuma fica de fora — não dá pra passar
 * tempo "desde a última resposta" de quem nunca respondeu, e incluí-los transformaria o gatilho
 * numa varredura da base inteira.
 */
async function leadsEmSilencio(params: {
  workspaceId: string;
  etapaId: string;
  limite: Date;
}): Promise<string[]> {
  const cards = await prisma.negocioCard.findMany({
    where: { workspaceId: params.workspaceId, etapaId: params.etapaId },
    select: { nome: true },
    take: 500,
  });
  if (!cards.length) return [];

  const ultimas = await prisma.mensagemExtra.groupBy({
    by: ["contato"],
    where: { workspaceId: params.workspaceId, contato: { in: cards.map((c) => c.nome) }, tipo: "in" },
    _max: { criadoEm: true },
  });

  return ultimas
    .filter((u) => u._max.criadoEm && u._max.criadoEm < params.limite)
    .map((u) => u.contato);
}

/**
 * Quem está nesta etapa e cuja data da ficha vence AGORA, com o deslocamento aplicado.
 *
 * "Vou programar que ele vai ativar tal hora antes ou depois." A data é de cada lead — a consulta
 * da Ana é quinta, a do Bruno é no mês que vem —, então aqui não dá pra responder uma vez pra
 * etapa inteira: cada ficha tem o seu instante.
 *
 * O campo é lido de `camposExtras` (os campos que a empresa criou) ou da coluna `nascimento`.
 * Contato sem aquele campo preenchido simplesmente não entra: ausência de data é ausência de
 * evento, nunca "hoje".
 */
async function leadsComCampoDeDataVencendo(params: {
  workspaceId: string;
  etapaId: string;
  campoDeData: string;
  offsetHoras: number;
  agora: Date;
}): Promise<string[]> {
  const cards = await prisma.negocioCard.findMany({
    where: { workspaceId: params.workspaceId, etapaId: params.etapaId },
    select: { nome: true },
    take: 500,
  });
  if (!cards.length) return [];

  const contatos = await prisma.contato.findMany({
    where: { workspaceId: params.workspaceId, nome: { in: cards.map((c) => c.nome) } },
    select: { nome: true, nascimento: true, camposExtras: true },
  });

  return contatos
    .filter((c) => {
      const valor =
        params.campoDeData === CAMPO_NASCIMENTO
          ? c.nascimento
          : ((c.camposExtras as Record<string, unknown> | null)?.[params.campoDeData] as string | undefined);
      return ehOMinutoDoCampo(typeof valor === "string" ? valor : null, params.offsetHoras, params.agora);
    })
    .map((c) => c.nome);
}

/**
 * A varredura dos gatilhos de RELÓGIO da etapa ("diariamente", data marcada, silêncio do lead).
 * Chamada pela batida do cron.
 *
 * O controle de repetição é diferente em cada um, porque a pergunta é diferente:
 *
 * - "Diariamente às 12:00" dispara na batida do minuto exato, e não de novo porque o minuto já
 *   passou. É o mais barato: na maioria das batidas a consulta não acha nada.
 * - "Numa data e hora" é a mesma coisa, uma vez só — com uma trava de idempotência por cima, pra
 *   uma batida repetida do cron não mandar duas vezes.
 * - "Sem resposta" é o único que fica verdadeiro por HORAS seguidas: sem trava, ele dispararia a
 *   cada batida enquanto o lead continuasse calado. A trava é por lead e por DIA — cobrar quem
 *   sumiu uma vez por dia é o que a gente quis dizer; a cada minuto é spam.
 */
export async function rodarGatilhosProgramados(agora: Date = new Date()): Promise<{ gatilhos: number; leads: number }> {
  const hora = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
  const dia = agora.toISOString().slice(0, 10);

  /*
   * O SILÊNCIO SÓ É CONFERIDO DE 10 EM 10 MINUTOS, e isso é dinheiro.
   *
   * Os outros dois se resolvem no banco (um `where` por hora exata que quase sempre volta vazio).
   * O de silêncio não: ele precisa olhar os cards da etapa e as mensagens deles, e continuaria
   * verdadeiro a cada batida. Rodar isso 1.440 vezes por dia pra responder uma pergunta medida em
   * HORAS seria pagar sessenta vezes por minuto de precisão que ninguém pediu.
   */
  const conferirSilencio = agora.getMinutes() % 10 === 0;

  /*
   * O CAMPO DE DATA SÓ É CONFERIDO NA VIRADA DA HORA, e isso não perde precisão nenhuma.
   *
   * O alvo é uma data da ficha (sem hora: `<input type="date">`) mais um deslocamento em HORAS
   * inteiras. Meia-noite mais um número inteiro de horas cai sempre no minuto zero — não existe
   * alvo às 14h37. Conferir nos outros 59 minutos seria varrer os leads da etapa 59 vezes pra
   * responder "não" com certeza.
   */
  const conferirCampoDeData = agora.getMinutes() === 0;

  const linhas = await prisma.gatilhoEtapa.findMany({
    where: {
      ativo: true,
      OR: [
        /* A HORA CONTINUA FILTRANDO NO BANCO, em toda repetição: semanal, mensal e anual também
           têm hora marcada, e o que muda entre elas é só o DIA. Trazer todos os programados do
           workspace pra decidir em memória seria uma varredura por minuto sem necessidade. */
        { quando: "diariamente", horarioDiario: hora },
        { quando: "data_hora" },
        ...(conferirSilencio ? [{ quando: "sem_resposta" }] : []),
        ...(conferirCampoDeData ? [{ quando: "campo_de_data" }] : []),
      ],
    },
  });

  let gatilhos = 0;
  let leads = 0;
  for (const linha of linhas) {
    if (linha.quando === "data_hora") {
      if (!ehOMinutoMarcado(linha.dataHora, agora)) continue;
      const primeiraVez = await primeiraVezPara({
        workspaceId: linha.workspaceId,
        fluxoId: `gatilho:${linha.id}`,
        chaveEvento: `data_hora:${linha.dataHora}`,
      });
      if (!primeiraVez) continue;
      gatilhos++;
      leads += await rodarGatilhoNosLeadsDaEtapa({
        workspaceId: linha.workspaceId,
        gatilhoId: linha.id,
      }).catch(() => 0);
      continue;
    }

    /*
     * A REPETIÇÃO DECIDE O DIA; a hora já foi filtrada no banco.
     *
     * "Diariamente, uma vez por semana, uma vez por mês, uma vez por ano." Gatilho gravado antes
     * desta coluna tem `repeticao` nula, que `deveRodarAgora` lê como diária — exatamente o que
     * ele sempre fez.
     */
    if (linha.quando === "diariamente") {
      if (
        !deveRodarAgora(
          { ...linha, diasAtivos: Array.isArray(linha.diasAtivos) ? (linha.diasAtivos as number[]) : null },
          agora,
        )
      ) {
        continue;
      }
      gatilhos++;
      leads += await rodarGatilhoNosLeadsDaEtapa({
        workspaceId: linha.workspaceId,
        gatilhoId: linha.id,
      }).catch(() => 0);
      continue;
    }

    /*
     * O GATILHO PRESO A UMA DATA DA FICHA: aqui cada lead tem o SEU instante.
     *
     * Os outros programados perguntam "chegou a hora?" uma vez e agem em todo mundo da etapa.
     * Este precisa perguntar por lead, porque a resposta vem do campo de cada um — a consulta da
     * Ana é quinta, a do Bruno é no mês que vem.
     */
    if (linha.quando === "campo_de_data") {
      if (!linha.campoDeData) continue;
      if (!dentroDaJanelaDoGatilho(linha as unknown as GatilhoEtapaVisao, agora)) continue;
      const alvos = await leadsComCampoDeDataVencendo({
        workspaceId: linha.workspaceId,
        etapaId: linha.etapaId,
        campoDeData: linha.campoDeData,
        offsetHoras: linha.campoOffsetHoras ?? 0,
        agora,
      }).catch(() => []);
      if (!alvos.length) continue;
      gatilhos++;
      for (const contatoNome of alvos) {
        /* Uma vez por lead por dia: a varredura roda de hora em hora e o alvo pode cair no mesmo
           minuto de duas batidas se o relógio escorregar. */
        const primeiraVez = await primeiraVezPara({
          workspaceId: linha.workspaceId,
          fluxoId: `gatilho:${linha.id}`,
          chaveEvento: `campo_de_data:${contatoNome}:${dia}`,
        });
        if (!primeiraVez) continue;
        const feito = await executarUmGatilho({
          workspaceId: linha.workspaceId,
          contatoNome,
          gatilho: linha,
        }).catch((erro) => {
          console.error(`[gatilho-etapa] ${linha.id} falhou no lead ${contatoNome}:`, erro);
          return false;
        });
        if (feito) leads++;
      }
      continue;
    }

    if (linha.quando === "sem_resposta") {
      // A janela VALE aqui: quem escolhe a hora é o relógio, não a pessoa. Sem isso, "cobrar quem
      // sumiu há 2 horas" mandaria mensagem às três da manhã.
      if (!dentroDaJanelaDoGatilho(linha as unknown as GatilhoEtapaVisao, agora)) continue;
      const calados = await leadsEmSilencio({
        workspaceId: linha.workspaceId,
        etapaId: linha.etapaId,
        limite: limiteDeSilencio(linha.esperaValor, linha.esperaUnidade, agora),
      }).catch(() => []);
      if (!calados.length) continue;
      gatilhos++;
      for (const contatoNome of calados) {
        const primeiraVez = await primeiraVezPara({
          workspaceId: linha.workspaceId,
          fluxoId: `gatilho:${linha.id}`,
          chaveEvento: `sem_resposta:${contatoNome}:${dia}`,
        });
        if (!primeiraVez) continue;
        const feito = await executarUmGatilho({
          workspaceId: linha.workspaceId,
          contatoNome,
          gatilho: linha,
        }).catch((erro) => {
          console.error(`[gatilho-etapa] ${linha.id} falhou no lead ${contatoNome}:`, erro);
          return false;
        });
        if (feito) leads++;
      }
      continue;
    }

    gatilhos++;
    leads += await rodarGatilhoNosLeadsDaEtapa({
      workspaceId: linha.workspaceId,
      gatilhoId: linha.id,
    }).catch(() => 0);
  }
  return { gatilhos, leads };
}

/**
 * Dispara os gatilhos da etapa em que o lead ESTÁ AGORA, a partir de um evento que não é entrada
 * na etapa (mudou uma etiqueta, um campo, concluiu uma tarefa).
 *
 * A etapa continua sendo a dona: "quando mudarem a etiqueta de alguém que está em Follow-up, faça
 * X". Sem isto, esses gatilhos existiriam na tela e nunca aconteceriam, que é o pior defeito
 * possível numa automação, porque parece que está funcionando e só não deu a hora.
 *
 * Lead sem card em funil nenhum simplesmente não tem etapa, e não há gatilho de etapa a disparar.
 */
export async function dispararGatilhosDoLead(params: {
  workspaceId: string;
  contatoNome: string;
  /** O tipo de evento do CRM ("etiqueta_adicionada", "tarefa_concluida"…). */
  tipoGatilho: string;
  agora?: Date;
}): Promise<void> {
  const quando = (Object.keys(EVENTO_DO_QUANDO) as QuandoGatilho[]).find(
    (q) => EVENTO_DO_QUANDO[q] === params.tipoGatilho,
  );
  if (!quando) return;

  // "Sair da etapa" é o único que NÃO vale pela etapa atual: quando o evento chega, o lead já
  // está na etapa nova, e disparar por ela faria "quando sair de Follow-up" rodar os gatilhos de
  // quem chegou em Qualificação. Quem sabe de qual etapa ele saiu é quem moveu o card, e é de lá
  // que esse disparo sai.
  if (quando === "saiu") return;

  /*
   * TODAS AS ETAPAS EM QUE O LEAD ESTÁ, e não a primeira que o banco devolver.
   *
   * Era `findFirst`, e dava no mesmo enquanto havia um card por pessoa. Agora a mesma pessoa pode
   * estar em dois funis de propósito — um por número que fala com ela —, e pegar um card só faria
   * os gatilhos de etapa de UM dos quadros rodarem e os do outro nunca. Automação que existe na
   * tela e nunca acontece é o pior defeito possível aqui: parece que está funcionando e só não deu
   * a hora.
   *
   * `Set` porque dois cards podem estar na MESMA etapa (duas grafias do nome ainda não juntadas), e
   * aí o gatilho dispararia duas vezes pela mesma pessoa.
   */
  const cards = await prisma.negocioCard.findMany({
    where: { workspaceId: params.workspaceId, nome: params.contatoNome },
    select: { etapaId: true },
    orderBy: { ordem: "asc" },
  });
  if (!cards.length) return;

  for (const etapaId of new Set(cards.map((c) => c.etapaId))) {
    await dispararGatilhosDaEtapa({
      workspaceId: params.workspaceId,
      etapaId,
      contatoNome: params.contatoNome,
      evento: quando,
      agora: params.agora,
    });
  }
}
