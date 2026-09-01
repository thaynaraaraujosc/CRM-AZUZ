import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { contasCanalVisiveis } from "@/lib/integracoes/conta-canal";

/**
 * Por que uma mensagem está no banco e não aparece na tela.
 *
 * Uma conversa só mostra as mensagens da CONEXÃO ativa (ver `conta-canal.ts`). Quando o
 * identificador gravado na mensagem diverge por um fio do que está nos metadados da integração, a
 * mensagem é gravada e nunca aparece — e o sintoma ("conversa na lista, vazia por dentro", ou
 * "some ao atualizar a página") não aponta pra causa. Já aconteceu duas vezes com o Instagram.
 *
 * Esta rota põe os dois lados lado a lado: o que as mensagens dizem e o que as conexões dizem.
 * Nenhum dado sensível sai daqui — só identificadores de número e contagens.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const [porContaCanal, visiveis, integracoes] = await Promise.all([
    prisma.mensagemExtra.groupBy({
      by: ["contaCanal", "canal"],
      where: { workspaceId },
      _count: { _all: true },
    }),
    contasCanalVisiveis(workspaceId),
    prisma.integracao.findMany({
      where: { workspaceId, provedor: { in: ["whatsapp_nao_oficial", "meta_whatsapp", "meta_instagram"] } },
      select: { provedor: true, status: true, metadados: true },
    }),
  ]);

  const mensagens = porContaCanal.map((linha) => ({
    contaCanal: linha.contaCanal,
    canal: linha.canal,
    quantidade: linha._count._all,
    // O veredito: esta linha aparece na tela hoje, ou está invisível?
    apareceNaTela: visiveis.includes(linha.contaCanal),
  }));

  return NextResponse.json(
    {
      conexoes: integracoes.map((i) => {
        const m = (i.metadados as Record<string, unknown> | null) ?? {};
        return {
          provedor: i.provedor,
          status: i.status,
          phoneNumberId: (m.phoneNumberId as string) ?? null,
          wabaId: (m.wabaId as string) ?? null,
          numero: (m.numero as string) ?? (m.displayPhoneNumber as string) ?? null,
          instagramContaId: (m.instagramContaId as string) ?? null,
        };
      }),
      contasVisiveis: visiveis,
      mensagens,
      invisiveis: mensagens.filter((m) => !m.apareceNaTela),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

/**
 * Reparo: adota as mensagens órfãs, dando a elas a marca da conversa a que pertencem.
 *
 * Mensagem enviada pelo CRM nascia sem marca de conexão (o navegador não sabe por qual número a
 * conversa fala), então ficava gravada e invisível. A correção já vale pras novas; esta rota
 * conserta as que ficaram para trás.
 *
 * Só toca em mensagem cuja CONVERSA já tem dono. Conversa sem marca é histórico antigo do QR Code,
 * que deve mesmo continuar escondido enquanto aquela conexão não voltar — adotar essas seria
 * ressuscitar na tela mensagens de um número desconectado.
 */
export async function POST() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const conversas = await prisma.conversa.findMany({
    where: { workspaceId, contaCanal: { not: null } },
    select: { nome: true, contaCanal: true },
  });

  let adotadas = 0;
  for (const conversa of conversas) {
    const { count } = await prisma.mensagemExtra.updateMany({
      where: { workspaceId, contato: conversa.nome, contaCanal: null },
      data: { contaCanal: conversa.contaCanal },
    });
    adotadas += count;
  }

  const aindaOrfas = await prisma.mensagemExtra.count({ where: { workspaceId, contaCanal: null } });

  return NextResponse.json(
    {
      adotadas,
      aindaOrfas,
      observacao:
        "As que sobraram pertencem a conversas sem conexão dona — histórico antigo do WhatsApp por QR Code. " +
        "Elas voltam sozinhas quando aquela conexão for reconectada.",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
