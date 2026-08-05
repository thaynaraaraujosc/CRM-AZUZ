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
};

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
  };
}

/** GET devolve `Record<contato, ConvMensagem[]>` do workspace de quem está logado. */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const linhas = await prisma.mensagemExtra.findMany({
    where: { workspaceId: sessao.user.workspaceId },
    orderBy: { criadoEm: "asc" },
  });
  const porContato: Record<string, ConvMensagem[]> = {};
  for (const linha of linhas) {
    (porContato[linha.contato] ??= []).push(paraMensagem(linha));
  }
  return NextResponse.json(porContato);
}

/**
 * PUT reconcilia as mensagens do workspace com o `Record<contato, ConvMensagem[]>` mandado pelo
 * front — mesmo molde de `PUT /api/funis`: não tem mutador dedicado no Context
 * (`setMensagensExtraPorContato` é cru), então sincroniza tudo a cada mudança. O `deleteMany` é
 * sempre filtrado por `workspaceId` — mesma correção crítica do `/api/funis`, senão apagaria
 * mensagens de outras empresas.
 */
export async function PUT(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const porContato = (await request.json()) as Record<string, ConvMensagem[]>;

  const todasMensagens = Object.entries(porContato).flatMap(([contato, mensagens]) =>
    mensagens.map((m, indice) => ({ contato, mensagem: m, indice })),
  );
  const idsAtuais = todasMensagens
    .map(({ mensagem, contato, indice }) => mensagem.id ?? `${contato}-${indice}`)
    .filter(Boolean);

  await prisma.$transaction([
    prisma.mensagemExtra.deleteMany({
      where: { workspaceId, id: { notIn: idsAtuais.length ? idsAtuais : ["__nenhum__"] } },
    }),
    ...todasMensagens.map(({ contato, mensagem, indice }) => {
      const { id, tipo, texto, hora, criadoEm, status, ...extras } = mensagem;
      const idFinal = id ?? `${contato}-${indice}`;
      const dados = {
        contato,
        tipo,
        texto,
        hora,
        criadoEm: criadoEm ? new Date(criadoEm) : null,
        status: status ?? null,
        extras,
      };
      return prisma.mensagemExtra.upsert({
        where: { id: idFinal },
        create: { id: idFinal, workspaceId, ...dados },
        update: dados,
      });
    }),
  ]);

  return NextResponse.json({ ok: true });
}
