import { NextResponse } from "next/server";

import type { Prisma } from "@/generated/prisma/client";
import type { ConvMensagem } from "@/lib/data";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { contasCanalVisiveis, filtroContaCanal } from "@/lib/integracoes/conta-canal";
import { preservarMidiaGuardada, trocarMidiaPorLink } from "@/lib/conversas/midia-mensagem";
import { guardarMidiasDosExtras } from "@/lib/armazenamento/midia";

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
  wamid: string | null;
};

/**
 * Teto de linhas trazidas por `GET` — sem isso, um workspace com uso contínuo (não precisa nem
 * ser flood) acumula histórico o suficiente pra transformar essa busca num table scan gigante a
 * cada abertura de tela e a cada poll de 5s, travando `/conversas` (bug real já visto em produção).
 * Pega as mais recentes primeiro e devolve em ordem cronológica.
 */
const LIMITE_MENSAGENS = 3000;

function paraMensagem(linha: LinhaMensagem): ConvMensagem {
  // O anexo sai daqui como LINK, não embutido: este GET traz o histórico inteiro do workspace de
  // uma vez (e repete a cada 5s no polling), então mandar foto/áudio/vídeo dentro do JSON obrigava
  // o navegador a baixar tudo antes de desenhar a primeira bolha — a demora que aparecia ao
  // atualizar a página. Ver `midia-mensagem.ts`.
  const extras = (linha.extras ? trocarMidiaPorLink(linha.extras, linha.id) : {}) as Partial<ConvMensagem>;
  return {
    ...extras,
    id: linha.id,
    tipo: linha.tipo as ConvMensagem["tipo"],
    texto: linha.texto,
    hora: linha.hora,
    criadoEm: linha.criadoEm ? linha.criadoEm.getTime() : undefined,
    status: (linha.status as ConvMensagem["status"]) ?? undefined,
    canal: linha.canal ?? undefined,
    wamid: linha.wamid ?? undefined,
  };
}

/** GET devolve `Record<contato, ConvMensagem[]>` do workspace de quem está logado, limitado às
 * `LIMITE_MENSAGENS` mais recentes. */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  // Mesmo filtro por conexão das conversas — mensagem de um número desconectado some da tela sem
  // sair do banco (ver `conta-canal.ts`).
  const contas = await contasCanalVisiveis(sessao.user.workspaceId);
  const linhas = await prisma.mensagemExtra.findMany({
    where: { workspaceId: sessao.user.workspaceId, ...filtroContaCanal(contas) },
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

  // O cliente nunca recebeu o conteúdo dos anexos (só um link pra eles), então não pode ser fonte
  // de verdade sobre eles: sem isto, o primeiro PUT depois de um GET gravaria o link por cima da
  // data URL e o arquivo se perderia. Busca o que já está guardado pra restaurar esses campos.
  const guardadas = upserts.length
    ? await prisma.mensagemExtra.findMany({
        where: { workspaceId, id: { in: upserts.map((u) => u.idFinal) } },
        select: { id: true, extras: true },
      })
    : [];
  const extrasGuardados = new Map(guardadas.map((m) => [m.id, m.extras]));

  // Os anexos sobem pro R2 ANTES da transação: subir arquivo é uma chamada de rede que pode levar
  // segundos, e uma transação aberta esse tempo todo segura conexão do banco à toa — foi assim que
  // essa mesma rota já travou `/conversas` antes. Aqui a transação só grava texto e referência.
  const preparados = await Promise.all(
    upserts.map(async ({ contato, idFinal, mensagem }) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- só pra excluir `id` de `extras`, já vira a coluna própria
      const { id: _id, tipo, texto, hora, criadoEm, status, canal, wamid, ...extras } = mensagem;
      const preservados = preservarMidiaGuardada(extras, extrasGuardados.get(idFinal));
      return {
        idFinal,
        dados: {
          contato,
          tipo,
          texto,
          hora,
          criadoEm: criadoEm ? new Date(criadoEm) : null,
          status: status ?? null,
          canal: canal ?? null,
          wamid: wamid ?? null,
          extras: (await guardarMidiasDosExtras(preservados, workspaceId)) as Prisma.InputJsonValue,
        },
      };
    }),
  );

  const operacoes = [
    ...(deletarIds.length ? [prisma.mensagemExtra.deleteMany({ where: { workspaceId, id: { in: deletarIds } } })] : []),
    ...preparados.map(({ idFinal, dados }) =>
      prisma.mensagemExtra.upsert({
        where: { id: idFinal },
        create: { id: idFinal, workspaceId, ...dados },
        update: dados,
      }),
    ),
  ];

  if (operacoes.length) await prisma.$transaction(operacoes);

  return NextResponse.json({ ok: true });
}
