import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { exigirSuperAdmin } from "@/lib/admin/guard";
import { decriptar } from "@/lib/integracoes/crypto";
import { auditar } from "@/lib/seguranca/auditoria";

/**
 * A SENHA QUE NÓS ENTREGAMOS, quando ela ainda é a nossa.
 *
 * Só existe resposta pra conta cuja senha a Azuz definiu (cortesia entregue pronta, ou o botão
 * "Nova senha" daqui). No instante em que a pessoa troca a senha — por "esqueci minha senha", por
 * convite aceito, ou pelo admin da empresa dela —, a cópia é apagada e esta rota passa a dizer
 * isso, em vez de devolver uma senha velha que não vale mais.
 *
 * NÃO VEM NA LISTA DE USUÁRIOS, de propósito: é uma rota própria, chamada só quando alguém clica
 * em "ver". Mandar a senha de todo mundo junto da lista a colocaria no cache do navegador, no log
 * de qualquer proxy no caminho e na memória de uma aba aberta a tarde inteira.
 *
 * E FICA REGISTRADO. Ver a senha de alguém é uma ação que precisa ter dono e hora: a auditoria é
 * o que separa "resolvi o acesso de um cliente" de "alguém andou olhando senha".
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/admin/membros/[id]/senha">) {
  const guarda = await exigirSuperAdmin();
  if (!guarda.ok) return guarda.resposta;
  const { sessao } = guarda;

  const { id } = await ctx.params;
  const membro = await prisma.membro.findUnique({
    where: { id },
    select: { id: true, nome: true, email: true, workspaceId: true, senhaEntregue: true },
  });
  if (!membro) return NextResponse.json({ erro: "Membro não encontrado" }, { status: 404 });

  if (!membro.senhaEntregue) {
    return NextResponse.json({
      senha: null,
      motivo:
        "Esta pessoa trocou a senha dela. A partir daí só ela sabe qual é — nem o painel tem como ver. Pra resolver o acesso, gere uma senha nova.",
    });
  }

  let senha: string;
  try {
    senha = decriptar(membro.senhaEntregue);
  } catch {
    // Chave de criptografia trocada, ou valor gravado por outra chave: a senha existe e não é
    // legível. Dizer isso é melhor do que devolver lixo com cara de senha.
    return NextResponse.json({
      senha: null,
      motivo: "A senha guardada não pôde ser lida com a chave atual. Gere uma senha nova pra resolver o acesso.",
    });
  }

  await auditar({
    acao: "membro.senha_resetada",
    workspaceId: membro.workspaceId,
    membroId: sessao.user.id,
    email: sessao.user.email,
    recurso: membro.email,
    detalhe: `senha entregue consultada no painel de admin para "${membro.nome}"`,
  });

  return NextResponse.json({ senha });
}
