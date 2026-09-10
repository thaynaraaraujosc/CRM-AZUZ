import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enviarEmailContandoFalha, templateConvite } from "@/lib/email";

export type RespostaConvite = {
  linkConvite: string;
  emailEnviado: boolean;
  motivoEmail?: string;
};

/**
 * Reenvia o convite de um membro que ainda não entrou, e devolve o link.
 *
 * Existe por dois motivos práticos. O e-mail pode simplesmente não ter saído (ver
 * `enviarEmailContandoFalha`), e mesmo saindo, convite costuma cair em spam. Sem esta rota, o
 * único jeito de dar uma segunda chance era excluir o convite e convidar de novo, o que muda o id
 * e invalida qualquer link que já tivesse sido mandado.
 *
 * O link é o MESMO de antes: ele é o id do membro, e não expira sozinho. Reenviar não invalida o
 * anterior, então quem já tinha recebido continua conseguindo entrar.
 *
 * Só para convite PENDENTE. Reenviar convite pra quem já entrou e já tem senha ofereceria um
 * caminho de definir senha nova sem passar por autenticação nenhuma.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/equipe/[id]/convite">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const membro = await prisma.membro.findFirst({
    where: { id, workspaceId: sessao.user.workspaceId },
    select: { id: true, nome: true, email: true, convitePendente: true },
  });
  if (!membro) return NextResponse.json({ erro: "Membro não encontrado" }, { status: 404 });
  if (!membro.convitePendente) {
    return NextResponse.json(
      { erro: "Esta pessoa já entrou. Pra ajudar com o acesso, use “Gerar nova senha”." },
      { status: 409 },
    );
  }

  const link = `${process.env.APP_URL ?? "https://azuzcrm.com.br"}/convite/${membro.id}`;
  const envio = await enviarEmailContandoFalha({
    to: membro.email,
    subject: `${sessao.user.workspaceNome ?? "Alguém"} te convidou pro CRM AZUZ`,
    html: templateConvite(membro.nome, sessao.user.workspaceNome ?? "o workspace", link),
  });

  return NextResponse.json({
    linkConvite: link,
    emailEnviado: envio.ok,
    motivoEmail: envio.ok ? undefined : envio.motivo,
  } satisfies RespostaConvite);
}
