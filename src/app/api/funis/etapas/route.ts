import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ESCOPOS, escopoPermitido } from "@/lib/configuracoes/permissoes";

/**
 * PRA ONDE DÁ PRA ENCAMINHAR UM NEGÓCIO.
 *
 * "Vamos supor que o lead dele aceitou a proposta e quer fechar: ele pode ir lá nos três
 * pontinhos e mandar para a etapa tal. E aí ele encaminha o lead dele e vai aparecer para o outro
 * da equipe, lá no quadro dele."
 *
 * ESTA ROTA EXISTE POR CAUSA DO RECORTE DE ETAPAS, e é o complemento necessário dele. Quem só
 * enxerga "Proposta" não enxerga "Fechado" — então não tem como arrastar o card pra lá, e não tem
 * nem como saber que "Fechado" existe. Sem uma saída, o recorte vira uma cela: o lead avança até
 * a etapa dela e para ali.
 *
 * Então: o recorte de ETAPAS não se aplica aqui, e o de FUNIS se aplica. A diferença não é
 * descuido. Ver só a sua etapa é sobre não se distrair com o trabalho dos outros; ver só os seus
 * funis é sobre não ter acesso ao quadro de outra operação. O primeiro tem escape, o segundo não.
 *
 * E o que volta é o MÍNIMO: id, título e o nome do funil. Nada de card, nome de cliente ou valor —
 * esta rota responde "pra onde", não "o que tem lá dentro".
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const funisPermitidos = escopoPermitido(sessao.user.permissoes, ESCOPOS.funis);

  const etapas = await prisma.funilEtapa.findMany({
    where: {
      workspaceId: sessao.user.workspaceId,
      ...(funisPermitidos ? { funilId: { in: funisPermitidos } } : {}),
    },
    orderBy: [{ funilId: "asc" }, { ordem: "asc" }],
    select: { id: true, titulo: true, funilId: true, funil: { select: { nome: true } } },
  });

  return NextResponse.json(
    etapas.map((e) => ({ id: e.id, titulo: e.titulo, funilId: e.funilId, funilNome: e.funil.nome })),
    { headers: { "cache-control": "no-store" } },
  );
}
