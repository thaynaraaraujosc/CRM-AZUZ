import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import { reagirNoDirectInstagram } from "@/lib/integracoes/instagram-login";

/**
 * Curte (ou descurte) uma mensagem do Direct — o duplo clique na bolha, em `/conversas`.
 *
 * Só Instagram por enquanto: é o canal em que a Meta expõe reação como ação sobre uma mensagem
 * existente e devolve a reação da outra pessoa pelo webhook (`messaging_reactions`). Num canal em
 * que o CRM não conseguisse ENTREGAR o coração, mostrar um coração na tela seria mentira — a
 * cliente nunca veria.
 *
 * O token nunca sai daqui: o cliente manda só o id da mensagem, e quem fala com a Meta é o
 * servidor, com a integração do workspace da sessão.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const { mensagemId, curtir } = (await request.json()) as { mensagemId?: string; curtir?: boolean };
  if (!mensagemId) return NextResponse.json({ erro: "mensagemId é obrigatório" }, { status: 400 });

  // A mensagem precisa ser deste workspace — sem esta checagem, um id adivinhado reagiria na
  // conversa de outra empresa.
  const mensagem = await prisma.mensagemExtra.findUnique({ where: { id: mensagemId } });
  if (!mensagem || mensagem.workspaceId !== workspaceId) {
    return NextResponse.json({ erro: "Mensagem não encontrada" }, { status: 404 });
  }

  const conversa = await prisma.conversa.findUnique({
    where: { workspaceId_nome: { workspaceId, nome: mensagem.contato } },
  });
  if (conversa?.canal !== "Instagram" || !conversa.contato) {
    return NextResponse.json(
      { erro: "Curtir mensagem só está disponível nas conversas do Instagram." },
      { status: 400 },
    );
  }

  const integracao = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId, provedor: "meta_instagram" } },
  });
  if (!integracao?.accessTokenCriptografado) {
    return NextResponse.json({ erro: "Instagram não está conectado." }, { status: 400 });
  }

  try {
    await reagirNoDirectInstagram(
      decriptar(integracao.accessTokenCriptografado),
      conversa.contato,
      mensagemId,
      curtir ? "❤️" : null,
    );
  } catch (erro) {
    const texto = erro instanceof Error ? erro.message : "Falha ao curtir a mensagem.";
    return NextResponse.json({ erro: texto }, { status: 502 });
  }

  // Só grava depois que a Meta aceitou: um coração salvo aqui que não chegou do outro lado é pior
  // do que nenhum, porque some no próximo carregamento sem explicação nenhuma.
  const extras = (mensagem.extras as Record<string, unknown> | null) ?? {};
  await prisma.mensagemExtra.update({
    where: { id: mensagemId },
    data: { extras: { ...extras, reacaoMinha: curtir ? "❤️" : undefined } as object },
  });

  return NextResponse.json({ ok: true });
}
