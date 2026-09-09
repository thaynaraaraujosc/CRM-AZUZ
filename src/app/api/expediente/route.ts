import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EXPEDIENTE_PADRAO, type DiasDoExpediente } from "@/lib/expediente";

/**
 * O horário de funcionamento do workspace. Um por workspace, usado por todo mundo que precisa
 * saber "estamos abertos agora?": pausa de automação, follow-up e gatilho de etapa.
 */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const linha = await prisma.expediente.findUnique({ where: { workspaceId: sessao.user.workspaceId } });
  // Workspace sem expediente configurado responde o padrão comercial, não vazio: a tela abre
  // preenchida e a automação que usa expediente funciona antes de alguém passar por aqui.
  if (!linha) return NextResponse.json(EXPEDIENTE_PADRAO, { headers: { "cache-control": "no-store" } });

  return NextResponse.json(
    { dias: linha.dias as DiasDoExpediente, fuso: linha.fuso },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function PUT(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (sessao.user.papelTipo !== "admin" && !sessao.user.superAdmin) {
    return NextResponse.json({ erro: "Só o administrador pode mudar o expediente." }, { status: 403 });
  }

  const { dias, fuso } = (await request.json()) as { dias?: DiasDoExpediente; fuso?: string };
  if (!dias || typeof dias !== "object") {
    return NextResponse.json({ erro: "Formato inválido." }, { status: 400 });
  }

  // Dia com hora de fim antes da de início nunca abre, e isso viraria uma automação parada pra
  // sempre esperando um expediente que não existe. Melhor recusar do que aceitar calado.
  for (const [dia, faixa] of Object.entries(dias)) {
    if (!faixa?.de || !faixa?.ate) {
      return NextResponse.json({ erro: `O dia ${dia} está sem horário de início ou fim.` }, { status: 400 });
    }
    if (faixa.de >= faixa.ate) {
      return NextResponse.json(
        { erro: `No dia ${dia}, o horário de fim precisa ser depois do de início.` },
        { status: 400 },
      );
    }
  }

  const dados = { dias, fuso: fuso || EXPEDIENTE_PADRAO.fuso };
  const linha = await prisma.expediente.upsert({
    where: { workspaceId: sessao.user.workspaceId },
    create: { workspaceId: sessao.user.workspaceId, ...dados },
    update: dados,
  });

  return NextResponse.json({ dias: linha.dias as DiasDoExpediente, fuso: linha.fuso });
}
