import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * O que os robôs fizeram, e o que deu errado. Serve as duas áreas.
 *
 * São DUAS listas, e isso não é organização: é a diferença entre duas falhas que se parecem na
 * tela e são opostas na causa.
 *
 * - **Execução com erro**: o gatilho chegou, o robô começou e parou no meio. O problema está no
 *   fluxo ou no envio.
 * - **Evento com erro**: o webhook chegou e nem virou execução. Token vencido, permissão que a
 *   conta perdeu, comentário sem autor. Aqui nenhum robô chegou a rodar, e procurar o defeito no
 *   fluxo seria procurar no lugar errado.
 *
 * Com uma lista só, a pergunta "por que o cliente não recebeu?" continuaria sem resposta na metade
 * dos casos.
 */
export type ExecucaoDetalhada = {
  id: string;
  fluxoId: string;
  fluxoNome: string;
  contatoNome: string;
  gatilho: string;
  situacao: string;
  iniciadaEm: string;
  finalizadaEm: string | null;
  erroMensagem: string | null;
  /** Até quando esta execução está parada esperando o relógio. Nulo = não está esperando tempo. */
  aguardandoAte: string | null;
  /** O bloco onde ela parou. É o "próximo passo" quando ela for acordada. */
  noAtualId: string | null;
  passos: { noTipo: string; titulo: string | null; resultado: string; detalhe: string | null; criadoEm: string }[];
};

export type EventoComErro = {
  id: string;
  tipo: string;
  contatoNome: string | null;
  texto: string | null;
  erro: string;
  criadoEm: string;
};

export type PainelExecucoes = {
  execucoes: ExecucaoDetalhada[];
  /** Só na área social: webhook que nem virou execução. Vazio no comercial. */
  eventosComErro: EventoComErro[];
};

export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const url = new URL(request.url);
  const soErros = url.searchParams.get("erros") === "1";
  // `area` decide o recorte. Sem ela, comercial: é a área de quem chega por Automatizar funil.
  const area = url.searchParams.get("area") === "social" ? "social" : "comercial";
  const limite = Math.min(Number(url.searchParams.get("limite") ?? 30) || 30, 100);

  const execucoes = await prisma.execucaoAutomacao.findMany({
    where: {
      workspaceId,
      fluxo: { area },
      ...(soErros ? { situacao: "erro" } : {}),
    },
    orderBy: { iniciadaEm: "desc" },
    take: limite,
    include: { fluxo: { select: { nome: true } } },
  });

  const passos = execucoes.length
    ? await prisma.passoAutomacao.findMany({
        where: { workspaceId, execucaoId: { in: execucoes.map((e) => e.id) } },
        orderBy: { criadoEm: "asc" },
        // `erroTecnico` fica de fora: ele é pra investigação e pode carregar o corpo de erro de um
        // provedor externo. O que a tela mostra é `detalhe`, escrito pra ser lido.
        select: { execucaoId: true, noTipo: true, titulo: true, resultado: true, detalhe: true, criadoEm: true },
      })
    : [];

  const porExecucao = new Map<string, typeof passos>();
  for (const passo of passos) {
    const lista = porExecucao.get(passo.execucaoId) ?? [];
    lista.push(passo);
    porExecucao.set(passo.execucaoId, lista);
  }

  // Evento de webhook só existe no Instagram. No comercial a lista vem vazia em vez de a consulta
  // rodar à toa.
  const eventosComErro =
    area === "social"
      ? await prisma.instagramEvento.findMany({
          where: { workspaceId, erro: { not: null } },
          orderBy: { criadoEm: "desc" },
          take: limite,
          select: { id: true, tipo: true, contatoNome: true, texto: true, erro: true, criadoEm: true },
        })
      : [];

  const painel: PainelExecucoes = {
    execucoes: execucoes.map((e) => ({
      id: e.id,
      fluxoId: e.fluxoId,
      fluxoNome: e.fluxo.nome,
      contatoNome: e.contatoNome,
      gatilho: e.gatilho,
      situacao: e.situacao,
      iniciadaEm: e.iniciadaEm.toISOString(),
      finalizadaEm: e.finalizadaEm?.toISOString() ?? null,
      erroMensagem: e.erroMensagem,
      aguardandoAte: e.aguardandoAte?.toISOString() ?? null,
      noAtualId: e.aguardandoNoId ?? e.noAtualId,
      passos: (porExecucao.get(e.id) ?? []).map((p) => ({
        noTipo: p.noTipo,
        titulo: p.titulo,
        resultado: p.resultado,
        detalhe: p.detalhe,
        criadoEm: p.criadoEm.toISOString(),
      })),
    })),
    eventosComErro: eventosComErro.map((e) => ({
      id: e.id,
      tipo: e.tipo,
      contatoNome: e.contatoNome,
      texto: e.texto,
      erro: e.erro ?? "",
      criadoEm: e.criadoEm.toISOString(),
    })),
  };

  return NextResponse.json(painel, { headers: { "cache-control": "private, no-store" } });
}
