import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  MAXIMO_DE_CAMPOS,
  lerCamposDoContato,
  type CampoDoContato,
} from "@/lib/contatos/campos-do-contato";

/**
 * OS CAMPOS QUE A EMPRESA CRIOU NO CONTATO.
 *
 * A definição mora em `Preferencia`, que é a tabela de configuração por workspace que já existe —
 * não há tabela nova aqui. Os VALORES ficam no próprio contato (`Contato.camposExtras`), porque
 * são lidos junto com ele e nunca sozinhos.
 */
const CHAVE = "campos-do-contato";

async function lista(workspaceId: string): Promise<CampoDoContato[]> {
  const linha = await prisma.preferencia.findUnique({
    where: { workspaceId_chave: { workspaceId, chave: CHAVE } },
    select: { dados: true },
  });
  return lerCamposDoContato(linha?.dados);
}

export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  return NextResponse.json(await lista(sessao.user.workspaceId), {
    headers: { "cache-control": "private, no-store" },
  });
}

/**
 * Grava a lista inteira, e não um campo por vez.
 *
 * Criar, renomear, reordenar e apagar mexem todos na mesma lista curta, e mandá-la inteira evita
 * a família de rotas (`POST /campos`, `PATCH /campos/:id`, `DELETE /campos/:id`) que cada uma
 * precisaria reimplementar o mesmo saneamento. O teto é o que impede alguém de transformar uma
 * coluna de configuração em depósito.
 */
export async function PUT(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const corpo = (await request.json().catch(() => null)) as unknown;
  if (!Array.isArray(corpo)) {
    return NextResponse.json({ erro: "Esperava uma lista de campos." }, { status: 400 });
  }
  /*
   * O TETO É CONFERIDO NO QUE CHEGOU, não no que sobrou do saneamento.
   *
   * `lerCamposDoContato` corta na altura do teto, então olhar o tamanho do resultado nunca
   * acusaria nada: quem mandasse mil campos receberia "salvo" e veria trinta. Melhor recusar e
   * dizer o motivo.
   */
  if (corpo.length > MAXIMO_DE_CAMPOS) {
    return NextResponse.json(
      { erro: `No máximo ${MAXIMO_DE_CAMPOS} campos no contato.` },
      { status: 400 },
    );
  }
  const campos = lerCamposDoContato(corpo);

  const workspaceId = sessao.user.workspaceId;
  await prisma.preferencia.upsert({
    where: { workspaceId_chave: { workspaceId, chave: CHAVE } },
    create: { workspaceId, chave: CHAVE, dados: campos },
    update: { dados: campos },
  });

  return NextResponse.json(campos);
}
