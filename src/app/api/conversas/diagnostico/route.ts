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
