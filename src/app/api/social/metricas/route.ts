import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import { buscarMetricasInstagram, type ResultadoMetricas } from "@/lib/integracoes/instagram-metricas";
import { FUSO_BRASILIA, hojeEmBrasilia, isoDeBrasilia, somarDias } from "@/lib/agenda/fuso";
import { recortePedido } from "@/lib/social/recorte-do-periodo";
import { montarSerie, type Granularidade } from "@/lib/social/serie-de-interacoes";

/**
 * O painel social. Dois blocos com origens diferentes, e a tela diz qual é qual.
 *
 * **O que o CRM registrou** é nosso: contado nas tabelas deste banco, sempre disponível, sempre
 * exato. Quantos comentários chegaram, quantos Directs, quantos leads nasceram do Instagram.
 *
 * **O que o Instagram informa** é da Meta: alcance, interações, visitas ao perfil. Depende de
 * permissão, de tipo de conta e de a API estar de pé. Quando ela recusa, a tela mostra a recusa em
 * vez de um zero. Zero é uma afirmação; ausência é a verdade.
 *
 * Misturar os dois num número só seria o jeito mais rápido de produzir um painel bonito e mentiroso.
 */
export type PainelSocial = {
  conectado: boolean;
  motivoDesconectado?: string;
  /** Dias considerados. */
  periodoDias: number;
  /**
   * O RECORTE EXATO que estes números cobrem, pra tela poder escrevê-lo.
   *
   * Antes a tela só sabia "7 dias" e a pessoa tinha que confiar. Agora o período é fechado por
   * DIA DE CALENDÁRIO no fuso da conta — "Semana" são os sete dias que terminam hoje, de meia-noite
   * a agora —, e não uma janela rolante de 168 horas. Dias inteiros é o que dá pra escrever numa
   * linha ("29/10/2026 – 04/11/2026") e é o recorte em que se pensa o Instagram.
   */
  periodo: {
    /** Primeiro dia do recorte, "YYYY-MM-DD" no calendário do fuso. */
    primeiroDia: string;
    /** Último dia do recorte — hoje —, "YYYY-MM-DD". */
    ultimoDia: string;
    /** O instante em que a resposta foi montada, pra tela mostrar "atualizado em". */
    atualizadoEm: string;
    /** O fuso em que os dias foram fechados. */
    fuso: string;
  };
  /**
   * AS INTERAÇÕES AO LONGO DO TEMPO, pra tela desenhar o gráfico.
   *
   * Conta exatamente os mesmos eventos que `crm.directs + comentarios + storiesRespondidos +
   * mencoes + reacoes`: o total do gráfico e o total dos números têm que bater, senão a tela
   * mostra duas verdades sobre a mesma coisa.
   *
   * Um balde POR HORA quando o período é de um dia só (24 barras, e a pergunta vira "a que horas
   * falam comigo?"), e POR DIA no resto. Semana e mês saem daí, somados na tela: mandar os três
   * recortes prontos seria mandar a mesma contagem três vezes.
   *
   * Dia sem nenhuma interação vem com zero, e não ausente: um buraco no meio do gráfico é
   * informação, e uma barra que simplesmente não existe parece dado faltando.
   */
  serie: {
    granularidade: Granularidade;
    pontos: { chave: string; total: number }[];
  };
  crm: {
    comentarios: number;
    directs: number;
    storiesRespondidos: number;
    mencoes: number;
    reacoes: number;
    leadsCriados: number;
    automacoesIniciadas: number;
  };
  instagram: ResultadoMetricas | null;
  /**
   * Um robô por linha, com o que ele fez no período. É o acompanhamento do Instagram.
   *
   * No WhatsApp, quem acompanha é o funil: o card anda de coluna e a etapa conta a história. O
   * Direct não entra no funil comercial, então precisava de um lugar próprio pra responder "meu
   * robô está funcionando?". Esta lista responde: quantas vezes rodou, quantas deram erro, quando
   * foi a última. Tudo contado em `ExecucaoAutomacao`, que é linha de banco, não estimativa.
   */
  robos: RoboSocial[];
};

export type RoboSocial = {
  id: string;
  nome: string;
  /** Publicado E ativo. É o que faz o robô responder de verdade. */
  ligado: boolean;
  execucoes: number;
  /** Execuções que terminaram em erro. Zero é bom, e é diferente de "nunca rodou". */
  erros: number;
  /** Execuções ainda em andamento ou esperando resposta/tempo. */
  emAndamento: number;
  /** ISO da última vez que este robô começou. Nulo = não rodou no período. */
  ultimaEm: string | null;
};

/** Tipos normalizados de `InstagramEvento` agrupados pelo que a pessoa quer contar. */
const GRUPOS = {
  comentarios: ["comentario_criado", "resposta_comentario"],
  directs: ["mensagem_recebida", "midia_recebida", "publicacao_compartilhada"],
  storiesRespondidos: ["story_respondido"],
  mencoes: ["mencao_em_story"],
  reacoes: ["reacao_adicionada"],
};

/**
 * Tudo que conta como "interação recebida" — a união dos grupos acima.
 *
 * Serve pra duas coisas ao mesmo tempo: filtrar a leitura no banco (não há motivo pra trazer tipo
 * que nenhuma conta usa) e garantir que o gráfico e os números somem os MESMOS eventos.
 */
const TIPOS_DE_INTERACAO = Array.from(new Set(Object.values(GRUPOS).flat()));

/** Situações de `ExecucaoAutomacao` que ainda não terminaram. */
const EM_ANDAMENTO = ["em_andamento", "aguardando_tempo", "aguardando_evento"];

export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  /*
   * DOIS JEITOS DE PEDIR O PERÍODO, e um só jeito de representá-lo.
   *
   * `?dias=7` é o atalho das pastilhas (Dia, Semana, Mês, Trimestre). `?de=&ate=` é o intervalo
   * que a pessoa escolhe no calendário. Qualquer um dos dois vira o mesmo par primeiro/último
   * dia, e daí pra frente o resto da rota não sabe por qual porta a pergunta entrou.
   *
   * O PERÍODO FECHA POR DIA DE CALENDÁRIO, no fuso da conta. Era `agora - dias * 24h`. Numa
   * janela rolante, "Semana" às 13h de quarta começa às 13h da quarta anterior: o primeiro e o
   * último dia do gráfico aparecem pela metade, e o rótulo do período não cabe numa linha sem
   * escrever a hora.
   */
  const parametros = new URL(request.url).searchParams;
  const hoje = hojeEmBrasilia();
  const { primeiroDia, ultimoDia, periodoDias } = recortePedido(parametros, hoje);

  const desde = new Date(isoDeBrasilia(primeiroDia, "00:00"));
  // O fim do intervalo é o FIM do último dia, não "agora": pedindo um recorte que termina ontem,
  // cortar em `new Date()` incluiria o dia de hoje inteiro por acidente.
  const ate = new Date(isoDeBrasilia(somarDias(ultimoDia, 1), "00:00"));

  const janela = { gte: desde, lt: ate };

  const [eventos, leadsCriados, automacoesIniciadas, integracao, fluxosSociais, execucoes] = await Promise.all([
    // Os eventos do período, crus. Era um `groupBy` por tipo, que dava os totais e só: o gráfico
    // precisa de QUANDO cada um chegou. São poucas linhas por workspace num recorte de até 90
    // dias, e a mesma leitura passou a servir às duas respostas.
    prisma.instagramEvento.findMany({
      where: { workspaceId, criadoEm: janela, tipo: { in: TIPOS_DE_INTERACAO } },
      select: { tipo: true, criadoEm: true },
    }),
    prisma.contato.count({ where: { workspaceId, criadoVia: "instagram", criadoEm: janela } }),
    prisma.execucaoAutomacao.count({
      where: { workspaceId, iniciadaEm: janela, fluxo: { area: "social" } },
    }),
    prisma.integracao.findUnique({
      where: { workspaceId_provedor_slot: { workspaceId, provedor: "meta_instagram", slot: 1 } },
      select: { status: true, accessTokenCriptografado: true, erroMensagem: true },
    }),
    prisma.fluxoAutomacao.findMany({
      where: { workspaceId, area: "social", arquivada: false },
      select: { id: true, nome: true, status: true, ativa: true },
      orderBy: { nome: "asc" },
    }),
    // As execuções do período, cruas. Agrupar aqui em memória em vez de fazer um groupBy por
    // situação: são poucas linhas por workspace, e assim a última data sai da mesma leitura.
    prisma.execucaoAutomacao.findMany({
      where: { workspaceId, iniciadaEm: janela, fluxo: { area: "social" } },
      select: { fluxoId: true, situacao: true, iniciadaEm: true },
    }),
  ]);

  function contar(tipos: string[]): number {
    return eventos.filter((e) => tipos.includes(e.tipo)).length;
  }

  /*
   * O GRÁFICO SAI DA MESMA LEITURA dos números, por balde fino: um por hora quando o período é de
   * um dia só, um por dia no resto. Semana e mês a tela soma a partir daí — ver
   * `serie-de-interacoes.ts`, que é onde a contagem mora e onde ela é testada.
   */
  const granularidade: Granularidade = periodoDias === 1 ? "hora" : "dia";
  const pontos = montarSerie(
    eventos.map((e) => e.criadoEm),
    granularidade,
    primeiroDia,
    ultimoDia,
  );

  const conectado = integracao?.status === "conectado" && !!integracao.accessTokenCriptografado;

  // Só fala com a Meta quando há conta ligada. Sem isto, cada carregamento do painel de um cliente
  // sem Instagram viraria quatro chamadas HTTP fadadas a falhar.
  let instagram: ResultadoMetricas | null = null;
  if (conectado && integracao?.accessTokenCriptografado) {
    instagram = await buscarMetricasInstagram({
      accessToken: decriptar(integracao.accessTokenCriptografado),
      desde,
      ate,
    }).catch(() => null);
  }

  const painel: PainelSocial = {
    conectado,
    motivoDesconectado: conectado
      ? undefined
      : (integracao?.erroMensagem ?? "Conecte a conta do Instagram em Configurações."),
    periodoDias,
    periodo: {
      primeiroDia,
      ultimoDia,
      atualizadoEm: new Date().toISOString(),
      fuso: FUSO_BRASILIA,
    },
    serie: { granularidade, pontos },
    crm: {
      comentarios: contar(GRUPOS.comentarios),
      directs: contar(GRUPOS.directs),
      storiesRespondidos: contar(GRUPOS.storiesRespondidos),
      mencoes: contar(GRUPOS.mencoes),
      reacoes: contar(GRUPOS.reacoes),
      leadsCriados,
      automacoesIniciadas,
    },
    instagram,
    robos: fluxosSociais.map((f) => {
      const minhas = execucoes.filter((e) => e.fluxoId === f.id);
      const ultima = minhas.reduce<Date | null>(
        (maior, e) => (!maior || e.iniciadaEm > maior ? e.iniciadaEm : maior),
        null,
      );
      return {
        id: f.id,
        nome: f.nome,
        ligado: f.status === "publicado" && f.ativa,
        execucoes: minhas.length,
        erros: minhas.filter((e) => e.situacao === "erro").length,
        emAndamento: minhas.filter((e) => EM_ANDAMENTO.includes(e.situacao)).length,
        ultimaEm: ultima ? ultima.toISOString() : null,
      };
    }),
  };

  return NextResponse.json(painel, { headers: { "cache-control": "private, no-store" } });
}
