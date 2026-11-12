import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { somenteCamposDeConversa } from "@/lib/conversas/campos-editaveis";
import { numerosDeWhatsApp } from "@/lib/integracoes/numeros-de-whatsapp";

/** PATCH atualiza campos pontuais de uma conversa (marcar como lida, favoritar, arquivar, mudar
 * status ou atendente): só mexe em conversa do mesmo workspace de quem está logado. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/conversas/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const recebido = (await request.json()) as Record<string, unknown>;

  /*
   * LISTA FECHADA, e não o corpo inteiro.
   *
   * Era `data: dados`, com uma tipagem em TypeScript no lugar de uma checagem. Tipo não existe em
   * tempo de execução: qualquer campo que o navegador mandasse era gravado — `workspaceId`
   * (mover a conversa e todo o histórico pra outra empresa), `nome` (separar a thread das próprias
   * mensagens), `contato` (mandar a próxima mensagem pra outra pessoa). Ver `campos-editaveis.ts`,
   * que é o mesmo conserto que o lado dos contatos já tinha recebido.
   */
  const dados = somenteCamposDeConversa(recebido);

  /*
   * TROCAR A CONEXÃO DA CONVERSA É UM CASO À PARTE: o valor vai virar endereço de envio, então ele
   * é conferido contra as conexões DESTA empresa. Uma chave inventada faria a conversa dizer que
   * pertence a uma conexão que não existe, e a próxima resposta não sairia de lugar nenhum.
   */
  if (dados.contaCanal !== undefined) {
    if (dados.contaCanal === null) {
      // Nada a conferir: "sem dono" é um estado válido (conversa anterior à coluna existir).
    } else if (typeof dados.contaCanal !== "string") {
      return NextResponse.json({ erro: "Conexão inválida." }, { status: 400 });
    } else {
      const conectadas = new Set(
        (await numerosDeWhatsApp(sessao.user.workspaceId)).map((n) => n.chave).filter(Boolean),
      );
      if (!conectadas.has(dados.contaCanal)) {
        return NextResponse.json({ erro: "Essa conexão não existe nesta conta." }, { status: 400 });
      }
    }
  }

  const { count } = await prisma.conversa.updateMany({
    where: { id, workspaceId: sessao.user.workspaceId },
    data: dados,
  });
  if (count === 0) return NextResponse.json({ erro: "Conversa não encontrada" }, { status: 404 });

  const linha = await prisma.conversa.findUniqueOrThrow({ where: { id } });
  return NextResponse.json(linha);
}

/** DELETE apaga a conversa e as mensagens dela. Usado pra limpar uma conversa avulsa que nasceu
 * errada (ex.: mensagem de grupo importada sem reconhecer o grupo, virou uma conversa solta com o
 * nome/telefone de quem escreveu em vez de cair dentro da thread do grupo). Não desfaz sozinho:
 * mensagem nova chegando de novo pra esse mesmo nome cria a conversa de novo. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/conversas/[id]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const conversa = await prisma.conversa.findFirst({
    where: { id, workspaceId: sessao.user.workspaceId },
    select: { nome: true },
  });
  if (!conversa) return NextResponse.json({ erro: "Conversa não encontrada" }, { status: 404 });

  await prisma.$transaction([
    prisma.mensagemExtra.deleteMany({ where: { workspaceId: sessao.user.workspaceId, contato: conversa.nome } }),
    prisma.conversa.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
