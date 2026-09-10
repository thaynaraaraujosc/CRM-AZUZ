import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import {
  baixarFotoPerfil,
  buscarDadosExtrasDoPerfil,
  buscarPerfilDeQuemMandou,
} from "@/lib/integracoes/instagram-login";

/**
 * Busca o perfil de quem está do outro lado, AGORA, e guarda.
 *
 * Existe porque os dados de perfil só passaram a ser gravados quando a coluna nasceu: toda conversa
 * anterior a isso ficou sem foto, sem contagem de seguidores e sem o selo, e não há como preencher
 * isso em lote (a Meta só responde sobre quem MANDOU mensagem pra conta, um por vez).
 *
 * A tela chama isto ao abrir uma conversa cujo perfil está vazio ou velho. É uma chamada à Meta
 * por conversa aberta, e não por conversa listada, que seria uma por linha da caixa de entrada.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const { conversa } = (await request.json()) as { conversa?: string };
  if (!conversa) return NextResponse.json({ erro: "Falta a conversa." }, { status: 400 });

  const linha = await prisma.conversa.findUnique({
    where: { workspaceId_nome: { workspaceId, nome: conversa } },
    select: { contato: true, contatoId: true, canal: true },
  });
  if (!linha || linha.canal !== "Instagram" || !linha.contato) {
    return NextResponse.json({ erro: "Conversa do Instagram não encontrada." }, { status: 404 });
  }

  const integracao = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId, provedor: "meta_instagram" } },
  });
  if (!integracao?.accessTokenCriptografado || integracao.status !== "conectado") {
    return NextResponse.json({ erro: "Instagram não está conectado." }, { status: 400 });
  }
  const token = decriptar(integracao.accessTokenCriptografado);

  // `contato` guarda o IGSID, que é a chave estável da pessoa naquela conta.
  const igsid = linha.contato;
  const [perfil, extras] = await Promise.all([
    buscarPerfilDeQuemMandou(token, igsid).catch(() => null),
    buscarDadosExtrasDoPerfil(token, igsid).catch(() => null),
  ]);

  // A foto vem embutida: o link do CDN da Meta vence em horas, e guardar só a URL deixaria a
  // conversa sem foto no dia seguinte.
  const fotoUrl = perfil?.fotoUrl ? await baixarFotoPerfil(perfil.fotoUrl).catch(() => null) : null;

  const dadosDoContato = {
    ...(perfil?.username ? { instagram: perfil.username } : {}),
    ...(fotoUrl ? { fotoUrl } : {}),
    ...(extras
      ? {
          igSeguidores: extras.seguidores,
          igVerificado: extras.verificado,
          igSegueVoce: extras.segueVoce,
          igVoceSegue: extras.voceSegue,
          igPerfilAtualizado: new Date(),
        }
      : {}),
  };

  if (Object.keys(dadosDoContato).length) {
    if (linha.contatoId) {
      await prisma.contato.update({ where: { id: linha.contatoId }, data: dadosDoContato }).catch(() => {});
    } else {
      await prisma.contato
        .updateMany({ where: { workspaceId, nome: conversa }, data: dadosDoContato })
        .catch(() => {});
    }
  }
  if (fotoUrl) {
    await prisma.conversa
      .update({ where: { workspaceId_nome: { workspaceId, nome: conversa } }, data: { fotoUrl } })
      .catch(() => {});
  }

  return NextResponse.json({
    fotoUrl,
    username: perfil?.username ?? null,
    perfil: extras
      ? {
          seguidores: extras.seguidores ?? null,
          verificado: extras.verificado ?? null,
          segueVoce: extras.segueVoce ?? null,
          voceSegue: extras.voceSegue ?? null,
        }
      : null,
    // Diz por que veio vazio, quando veio: a tela precisa distinguir "a conta não concede esses
    // campos" de "ainda não buscamos".
    semExtras: !extras,
  });
}
