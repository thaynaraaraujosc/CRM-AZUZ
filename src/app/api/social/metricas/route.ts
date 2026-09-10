import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import { buscarMetricasInstagram, type ResultadoMetricas } from "@/lib/integracoes/instagram-metricas";

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

/** Situações de `ExecucaoAutomacao` que ainda não terminaram. */
const EM_ANDAMENTO = ["em_andamento", "aguardando_tempo", "aguardando_evento"];

export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  // 1 a 90 dias. O teto não é gosto: a API de insights da Meta não devolve período maior, e
  // oferecer "último ano" na tela seria prometer um recorte que volta vazio.
  const pedido = Number(new URL(request.url).searchParams.get("dias") ?? "7");
  const periodoDias = Number.isFinite(pedido) ? Math.min(90, Math.max(1, Math.trunc(pedido))) : 7;
  const ate = new Date();
  const desde = new Date(ate.getTime() - periodoDias * 24 * 60 * 60 * 1000);

  const [eventos, leadsCriados, automacoesIniciadas, integracao, fluxosSociais, execucoes] = await Promise.all([
    prisma.instagramEvento.groupBy({
      by: ["tipo"],
      where: { workspaceId, criadoEm: { gte: desde } },
      _count: { _all: true },
    }),
    prisma.contato.count({ where: { workspaceId, criadoVia: "instagram", criadoEm: { gte: desde } } }),
    prisma.execucaoAutomacao.count({
      where: { workspaceId, iniciadaEm: { gte: desde }, fluxo: { area: "social" } },
    }),
    prisma.integracao.findUnique({
      where: { workspaceId_provedor: { workspaceId, provedor: "meta_instagram" } },
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
      where: { workspaceId, iniciadaEm: { gte: desde }, fluxo: { area: "social" } },
      select: { fluxoId: true, situacao: true, iniciadaEm: true },
    }),
  ]);

  function contar(tipos: string[]): number {
    return eventos
      .filter((e) => tipos.includes(e.tipo))
      .reduce((soma, e) => soma + e._count._all, 0);
  }

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
