import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import { INSTAGRAM_GRAPH_VERSION } from "@/lib/integracoes/instagram-login";

/**
 * Pergunta à Meta o perfil de alguém que já escreveu, e devolve o que ela respondeu.
 *
 * Existe porque "a foto de perfil não aparece" já custou várias rodadas de tentativa: o CRM pede o
 * campo, a Meta não manda, e nada na tela indica se faltou permissão, se o campo mudou de nome ou
 * se a pessoa não tem foto. Aqui a resposta vem crua — quais campos vieram e qual erro, se houve.
 *
 * Devolve NOMES de campos e o @, nunca o conteúdo do perfil de terceiros além disso: o objetivo é
 * diagnosticar a integração, não expor dados de quem conversa.
 */
export async function POST() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const integracao = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId, provedor: "meta_instagram" } },
  });
  if (!integracao?.accessTokenCriptografado || integracao.status !== "conectado") {
    return NextResponse.json({ erro: "Instagram não está conectado." }, { status: 400 });
  }

  // A conversa mais recente do Direct serve de cobaia — é alguém que comprovadamente escreveu, que
  // é a condição que a Meta exige pra devolver o perfil.
  const conversa = await prisma.conversa.findFirst({
    where: { workspaceId, canal: "Instagram", contato: { not: null } },
    orderBy: { atualizadoEm: "desc" },
  });
  if (!conversa?.contato) {
    return NextResponse.json({ erro: "Nenhuma conversa do Instagram pra testar ainda." }, { status: 400 });
  }

  const token = decriptar(integracao.accessTokenCriptografado);
  const resposta = await fetch(
    `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/${conversa.contato}?fields=username,name,profile_pic,profile_picture_url&access_token=${token}`,
  );
  const dados = (await resposta.json()) as Record<string, unknown> & {
    error?: { message?: string; code?: number; type?: string };
  };

  // A última mensagem com anexo diz se o CÓDIGO NOVO chegou a rodar: se ela tem `compartilhadoPor`
  // e `linkExterno`, o cartão de publicação está sendo montado; se não tem, ou a mensagem é
  // anterior ao deploy, ou a Meta não mandou o que o cartão precisa.
  const ultimaComAnexo = await prisma.mensagemExtra.findFirst({
    where: { workspaceId, canal: "meta_instagram", extras: { not: undefined } },
    orderBy: { criadoEm: "desc" },
  });
  const extras = (ultimaComAnexo?.extras as Record<string, unknown> | null) ?? {};

  return NextResponse.json({
    conversaTestada: conversa.nome,
    ultimaMensagemComAnexo: ultimaComAnexo?.criadoEm ?? null,
    camposGuardadosNoAnexo: Object.keys(extras),
    temLinkDaPublicacao: Boolean(extras.linkExterno),
    temAutorDaPublicacao: Boolean(extras.compartilhadoPor),
    httpStatus: resposta.status,
    camposRecebidos: Object.keys(dados).filter((c) => c !== "error"),
    temUsername: Boolean(dados.username),
    temFoto: Boolean(dados.profile_pic ?? dados.profile_picture_url),
    erroDaMeta: dados.error?.message ?? null,
    codigoDaMeta: dados.error?.code ?? null,
  });
}
