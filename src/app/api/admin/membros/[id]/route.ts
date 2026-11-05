import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { exigirSuperAdmin } from "@/lib/admin/guard";
import { auditar } from "@/lib/seguranca/auditoria";

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

/**
 * DELETE apaga a conta de uma pessoa.
 *
 * Diferente de bloquear: bloquear mantém a linha e tira o acesso; apagar tira a pessoa da base.
 * As duas existem porque resolvem coisas diferentes — bloquear é pra quem pode voltar, apagar é
 * pra quem nunca foi cliente (a maioria das contas do começo é de teste, e cada uma delas
 * continua contando no "usuários" do painel).
 *
 * O ÚLTIMO ADMINISTRADOR DE UMA EMPRESA NÃO É APAGADO. Sem admin, aquela conta fica sem ninguém
 * que consiga pagar, convidar ou configurar nada: ela vira uma empresa inacessível que só o
 * super-admin enxerga. Quem quer se livrar da empresa inteira apaga a EMPRESA, que é outro botão.
 */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/admin/membros/[id]">) {
  const guarda = await exigirSuperAdmin();
  if (!guarda.ok) return guarda.resposta;
  const { sessao } = guarda;

  const { id } = await ctx.params;
  const membro = await prisma.membro.findUnique({
    where: { id },
    select: { id: true, nome: true, email: true, papelTipo: true, workspaceId: true },
  });
  if (!membro) return NextResponse.json({ erro: "Membro não encontrado" }, { status: 404 });

  if (membro.papelTipo === "admin") {
    const outrosAdmins = await prisma.membro.count({
      where: { workspaceId: membro.workspaceId, papelTipo: "admin", id: { not: id } },
    });
    if (outrosAdmins === 0) {
      return NextResponse.json(
        {
          erro:
            "Esta é a única pessoa que administra a empresa. Apagar deixaria a conta sem ninguém pra pagar ou configurar nada — pra se livrar dela, apague a empresa inteira.",
        },
        { status: 409 },
      );
    }
  }

  // Sessão aberta e token de redefinição pendem do membro e não têm `workspaceId`: sem apagá-los
  // antes, a chave estrangeira recusa — e uma sessão sobrevivente valeria por um tempo pra uma
  // conta que não existe mais.
  await prisma.sessaoAtiva.deleteMany({ where: { membroId: id } });
  await prisma.tokenRedefinicaoSenha.deleteMany({ where: { membroId: id } });
  await prisma.membro.delete({ where: { id } });

  await auditar({
    acao: "membro.excluido",
    workspaceId: membro.workspaceId,
    membroId: sessao.user.id,
    email: sessao.user.email,
    recurso: membro.email,
    detalhe: `usuário "${membro.nome}" apagado pelo painel de admin`,
  });

  return NextResponse.json({ ok: true });
}
