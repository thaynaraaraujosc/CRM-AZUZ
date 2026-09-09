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
};

/** Tipos normalizados de `InstagramEvento` agrupados pelo que a pessoa quer contar. */
const GRUPOS = {
  comentarios: ["comentario_criado", "resposta_comentario"],
  directs: ["mensagem_recebida", "midia_recebida", "publicacao_compartilhada"],
  storiesRespondidos: ["story_respondido"],
  mencoes: ["mencao_em_story"],
  reacoes: ["reacao_adicionada"],
};

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

  const [eventos, leadsCriados, automacoesIniciadas, integracao] = await Promise.all([
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
  };

  return NextResponse.json(painel, { headers: { "cache-control": "private, no-store" } });
}
