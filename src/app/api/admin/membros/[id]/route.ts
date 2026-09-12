import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { exigirSuperAdmin } from "@/lib/admin/guard";

type CorpoAtualizarMembro = {
  ativo?: boolean;
  papelTipo?: "admin" | "padrao" | "custom";
};

/** PATCH mexe em qualquer membro, de qualquer workspace: diferente de `PATCH /api/equipe/[id]`
 * (que só deixa mexer em gente do próprio workspace de quem está logado). Só os campos de acesso
 * (ativo/papelTipo): não deixa o super-admin trocar senha ou dado pessoal de ninguém por aqui. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/membros/[id]">) {
  const guarda = await exigirSuperAdmin();
  if (!guarda.ok) return guarda.resposta;

  const { id } = await ctx.params;
  const corpo = (await request.json()) as CorpoAtualizarMembro;

  const dados: CorpoAtualizarMembro = {};
  if (typeof corpo.ativo === "boolean") dados.ativo = corpo.ativo;
  if (corpo.papelTipo && ["admin", "padrao", "custom"].includes(corpo.papelTipo)) dados.papelTipo = corpo.papelTipo;

  if (Object.keys(dados).length === 0) return NextResponse.json({ erro: "Nada para atualizar." }, { status: 400 });

  try {
    // Lista fechada de campos na RESPOSTA: `update` devolve a linha inteira, e ela inclui o hash
    // da senha. Super-admin é gente de confiança e ainda assim não há motivo pra esse valor sair do
    // servidor: o que não trafega não vaza por log, cache de proxy ou aba aberta.
    const membro = await prisma.membro.update({
      where: { id },
      data: dados,
      select: {
        id: true,
        nome: true,
        email: true,
        papel: true,
        papelTipo: true,
        ativo: true,
        convitePendente: true,
        workspaceId: true,
        criadoEm: true,
      },
    });
    return NextResponse.json(membro);
  } catch {
    return NextResponse.json({ erro: "Membro não encontrado" }, { status: 404 });
  }
}
