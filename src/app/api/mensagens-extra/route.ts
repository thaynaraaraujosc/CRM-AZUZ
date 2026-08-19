import { NextResponse } from "next/server";

import type { ConvMensagem } from "@/lib/data";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type LinhaMensagem = {
  id: string;
  contato: string;
  tipo: string;
  texto: string;
  hora: string;
  criadoEm: Date | null;
  status: string | null;
  extras: unknown;
  canal: string | null;
};

/**
 * Teto de linhas trazidas por `GET` — sem isso, um workspace com uso contínuo (não precisa nem
 * ser flood) acumula histórico o suficiente pra transformar essa busca num table scan gigante a
 * cada abertura de tela e a cada poll de 5s, travando `/conversas` (bug real já visto em produção).
 * Pega as mais recentes primeiro e devolve em ordem cronológica.
 */
const LIMITE_MENSAGENS = 3000;

function paraMensagem(linha: LinhaMensagem): ConvMensagem {
  const extras = (linha.extras as Partial<ConvMensagem>) ?? {};
  return {
    ...extras,
    id: linha.id,
    tipo: linha.tipo as ConvMensagem["tipo"],
    texto: linha.texto,
    hora: linha.hora,
    criadoEm: linha.criadoEm ? linha.criadoEm.getTime() : undefined,
    status: (linha.status as ConvMensagem["status"]) ?? undefined,
    canal: linha.canal ?? undefined,
  };
}

/** GET devolve `Record<contato, ConvMensagem[]>` do workspace de quem está logado, limitado às
 * `LIMITE_MENSAGENS` mais recentes. */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const linhas = await prisma.mensagemExtra.findMany({
    where: { workspaceId: sessao.user.workspaceId },
    orderBy: { criadoEm: "desc" },
    take: LIMITE_MENSAGENS,
  });
  linhas.reverse();

  const porContato: Record<string, ConvMensagem[]> = {};
  for (const linha of linhas) {
    (porContato[linha.contato] ??= []).push(paraMensagem(linha));
  }
  return NextResponse.json(porContato);
}

type ItemUpsert = { contato: string; idFinal: string; mensagem: ConvMensagem };

/**
 * PUT recebe só a DIFERENÇA (mensagens novas/alteradas + ids apagados) calculada no cliente
 * (`mensagens-extra-context.tsx`) — nunca mais o `Record` inteiro. A versão antiga reconciliava a
 * tabela inteira do workspace a cada mudança (um upsert por mensagem existente + delete em massa),
 * o que virava uma transação gigante disparada a cada 5s pelo polling; era a mesma causa raiz do
 * flood de WhatsApp que já tinha derrubado essa tela antes, só que estrutural em vez de pontual.
 */
export async function PUT(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const corpo = (await request.json()) as { upserts?: ItemUpsert[]; deletarIds?: string[] };
  const upserts = corpo.upserts ?? [];
  const deletarIds = corpo.deletarIds ?? [];

  const operacoes = [
    ...(deletarIds.length ? [prisma.mensagemExtra.deleteMany({ where: { workspaceId, id: { in: deletarIds } } })] : []),
    ...upserts.map(({ contato, idFinal, mensagem }) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- só pra excluir `id` de `extras`, já vira a coluna própria
      const { id: _id, tipo, texto, hora, criadoEm, status, canal, ...extras } = mensagem;
      const dados = {
        contato,
        tipo,
        texto,
        hora,
        criadoEm: criadoEm ? new Date(criadoEm) : null,
        status: status ?? null,
        canal: canal ?? null,
        extras,
      };
      return prisma.mensagemExtra.upsert({
        where: { id: idFinal },
        create: { id: idFinal, workspaceId, ...dados },
        update: dados,
      });
    }),
  ];

  if (operacoes.length) await prisma.$transaction(operacoes);

  return NextResponse.json({ ok: true });
}
