import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { exigirSuperAdmin } from "@/lib/admin/guard";
import { gerarSenhaAleatoria } from "@/lib/senha-aleatoria";
import { encriptar } from "@/lib/integracoes/crypto";

/**
 * POST gera uma senha nova aleatória pro membro e já salva o hash dela no banco.
 *
 * A senha gerada também fica guardada CRIPTOGRAFADA em `senhaEntregue`, pelo mesmo motivo da
 * conta entregue pronta: quem recebe uma senha gerada por outra pessoa perde essa senha, e aí
 * gerar mais uma derruba de novo quem estiver usando. Ela some no instante em que a pessoa trocar
 * a senha por conta própria.
 *
 * O login continua usando o hash bcrypt, que não tem volta nem pra nós.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/admin/membros/[id]/resetar-senha">) {
  const guarda = await exigirSuperAdmin();
  if (!guarda.ok) return guarda.resposta;

  const { id } = await ctx.params;
  const novaSenha = gerarSenhaAleatoria();
  const hash = await bcrypt.hash(novaSenha, 10);

  try {
    await prisma.membro.update({ where: { id }, data: { senha: hash, senhaEntregue: encriptar(novaSenha) } });
  } catch {
    return NextResponse.json({ erro: "Membro não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ senha: novaSenha });
}
