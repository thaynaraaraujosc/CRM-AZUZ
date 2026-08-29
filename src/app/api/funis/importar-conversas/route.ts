import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugId } from "@/lib/ids";
import { contasCanalVisiveis, filtroContaCanal } from "@/lib/integracoes/conta-canal";

/**
 * Cria um negócio no funil para cada conversa que ainda não tem um.
 *
 * Existe por dois motivos que se encontram no mesmo lugar:
 *
 * 1. Só quem escreve PELA PRIMEIRA VEZ entra no funil sozinho — mandar mensagem de novo nunca pode
 *    mexer na etapa em que o vendedor deixou a pessoa. Quem já era contato antes de existir funil
 *    (ou antes de conectar o canal) ficava fora pra sempre, sem nenhuma forma de entrar em massa.
 * 2. Quem começa a usar o CRM com uma caixa de entrada cheia precisa de um jeito de puxar tudo pro
 *    funil de uma vez, em vez de abrir conversa por conversa.
 *
 * Nunca mexe em card existente: conversa que já tem negócio é pulada, esteja na etapa que estiver.
 * Grupo fica de fora — grupo não é um lead.
 */
export async function POST() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const funil = await prisma.funil.findFirst({
    where: { workspaceId },
    include: { etapas: { orderBy: { ordem: "asc" }, take: 1 } },
  });
  const primeiraEtapa = funil?.etapas[0];
  if (!primeiraEtapa) {
    return NextResponse.json({ erro: "Crie um funil com pelo menos uma etapa primeiro." }, { status: 400 });
  }

  // Só conversas dos canais conectados agora: importar conversa de um canal desconectado criaria
  // um card que sumiria da tela no instante seguinte, pelo filtro do próprio funil.
  const contas = await contasCanalVisiveis(workspaceId);
  const conversas = await prisma.conversa.findMany({
    where: { workspaceId, ehGrupo: false, arquivada: false, ...filtroContaCanal(contas) },
  });

  const jaTemCard = new Set(
    (await prisma.negocioCard.findMany({ where: { workspaceId }, select: { nome: true } })).map((c) => c.nome),
  );

  const novos = conversas.filter((c) => !jaTemCard.has(c.nome));
  if (!novos.length) return NextResponse.json({ criados: 0 });

  const maiorOrdem = await prisma.negocioCard.aggregate({
    where: { etapaId: primeiraEtapa.id },
    _max: { ordem: true },
  });
  let ordem = (maiorOrdem._max.ordem ?? -1) + 1;

  await prisma.negocioCard.createMany({
    data: novos.map((conversa) => ({
      id: `${workspaceId}-${slugId(conversa.nome)}-${Date.now()}-${ordem}`,
      etapaId: primeiraEtapa.id,
      ordem: ordem++,
      workspaceId,
      nome: conversa.nome,
      valor: "—",
      origem: conversa.canal,
      // Sem isto o card entraria sem dono e nunca sumiria ao desconectar o canal de onde veio.
      contaCanal: conversa.contaCanal,
      dias: "Hoje",
      data: new Date().toISOString().slice(0, 10),
    })),
  });

  return NextResponse.json({ criados: novos.length });
}
