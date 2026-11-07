import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { esquecerConexoes } from "@/lib/integracoes/conexoes-cache";
import { CANAL_NAO_OFICIAL, CANAL_OFICIAL } from "@/lib/integracoes/conta-canal";
import { LIMITE_DE_NUMEROS, listarConexoesWhats, proximoSlotLivre } from "@/lib/integracoes/conexoes-whatsapp";
import { numerosDeWhatsApp } from "@/lib/integracoes/numeros-de-whatsapp";

/**
 * Os números de WhatsApp da empresa, dos DOIS canais.
 *
 * Rota própria, e não mais um campo na de QR Code: esta pergunta não é sobre um canal, é sobre a
 * empresa. A caixa de entrada e o funil perguntam "quais números existem aqui?" — e a resposta
 * certa inclui o oficial.
 */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const workspaceId = sessao.user.workspaceId;
  const [numeros, conexoesQr, funis] = await Promise.all([
    numerosDeWhatsApp(workspaceId),
    listarConexoesWhats(workspaceId),
    // Os funis vão junto porque a tela precisa deles pra oferecer "o funil deste número" — e uma
    // segunda chamada só pra isso seria mais uma ida ao banco por abertura de tela.
    prisma.funil.findMany({ where: { workspaceId }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);

  return NextResponse.json(
    {
      numeros,
      funis,
      limite: LIMITE_DE_NUMEROS,
      proximoLivre: proximoSlotLivre(conexoesQr.map((c) => c.slot)),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

/**
 * Nomeia um número, e diz pra onde vão os leads dele.
 *
 * Os três campos moram nos metadados da conexão, e não em colunas: são rótulo e preferência, e
 * cada um deles nasce pra ser mexido. Uma coluna por ideia num banco com cliente em cima é o
 * caminho mais caro possível pra mudar um padrão.
 */
export async function PATCH(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (sessao.user.papelTipo !== "admin" && !sessao.user.superAdmin) {
    return NextResponse.json({ erro: "Só administradores podem mexer nas conexões." }, { status: 403 });
  }

  const corpo = (await request.json().catch(() => ({}))) as {
    provedor?: string;
    slot?: number;
    apelido?: string | null;
    funilId?: string | null;
    responsavel?: string | null;
  };

  const provedor = corpo.provedor === CANAL_OFICIAL ? CANAL_OFICIAL : CANAL_NAO_OFICIAL;
  const slot = Number.isInteger(corpo.slot) && (corpo.slot as number) >= 1 ? (corpo.slot as number) : 1;

  const workspaceId = sessao.user.workspaceId;
  const linha = await prisma.integracao.findUnique({
    where: { workspaceId_provedor_slot: { workspaceId, provedor, slot } },
    select: { metadados: true },
  });
  if (!linha) return NextResponse.json({ erro: "Esse número não existe nesta conta." }, { status: 404 });

  /*
   * O FUNIL PRECISA SER DESTA EMPRESA.
   *
   * Sem esta conferência, um id qualquer no corpo mandaria os leads deste número pro funil de
   * outro cliente — e o lead simplesmente não apareceria pra ninguém aqui, sem erro nenhum.
   */
  let funilId = linha.metadados && typeof linha.metadados === "object"
    ? ((linha.metadados as Record<string, unknown>).funilId as string | null) ?? null
    : null;
  if (corpo.funilId !== undefined) {
    if (corpo.funilId === null || corpo.funilId === "") {
      funilId = null;
    } else {
      const existe = await prisma.funil.findFirst({ where: { id: corpo.funilId, workspaceId }, select: { id: true } });
      if (!existe) return NextResponse.json({ erro: "Esse funil não existe nesta conta." }, { status: 400 });
      funilId = corpo.funilId;
    }
  }

  const metadados = { ...((linha.metadados as Record<string, unknown> | null) ?? {}) };
  // Mescla campo a campo: `metadados` é Json e o Prisma troca a coluna inteira. Escrever só o que
  // mudou apagaria o número conectado, o rastro do webhook e o progresso da importação de uma vez.
  if (corpo.apelido !== undefined) metadados.apelido = (corpo.apelido ?? "").trim().slice(0, 60) || null;
  if (corpo.responsavel !== undefined) metadados.responsavel = (corpo.responsavel ?? "").trim().slice(0, 80) || null;
  metadados.funilId = funilId;

  await prisma.integracao.update({
    where: { workspaceId_provedor_slot: { workspaceId, provedor, slot } },
    data: { metadados: metadados as object },
  });
  esquecerConexoes(workspaceId);

  return NextResponse.json({ ok: true });
}
