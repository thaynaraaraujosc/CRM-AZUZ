import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import {
  baixarFotoPerfil,
  buscarDadosExtrasDoPerfil,
  buscarPerfilDeQuemMandou,
  buscarPerfilNasConversas,
} from "@/lib/integracoes/instagram-login";
import { nomeAindaEhIdCru } from "@/lib/conversas/exibicao";
import { renomearConversa } from "@/lib/conversas/renomear";

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
    where: { workspaceId_provedor_slot: { workspaceId, provedor: "meta_instagram", slot: 1 } },
  });
  if (!integracao?.accessTokenCriptografado || integracao.status !== "conectado") {
    return NextResponse.json({ erro: "Instagram não está conectado." }, { status: 400 });
  }
  const token = decriptar(integracao.accessTokenCriptografado);

  // `contato` guarda o IGSID, que é a chave estável da pessoa naquela conta.
  const igsid = linha.contato;
  const [direto, extras] = await Promise.all([
    buscarPerfilDeQuemMandou(token, igsid).catch(() => null),
    buscarDadosExtrasDoPerfil(token, igsid).catch(() => null),
  ]);

  /*
   * DUAS VIAS PRO @, como o webhook já fazia — e esta rota não.
   *
   * A consulta direta pelo IGSID passa por uma permissão; a lista de conversas passa por outra, e
   * numa conta em que a primeira não responde a segunda costuma responder. O webhook tentava as
   * duas desde sempre; aqui só havia a primeira, e era por isso que uma conversa que nasceu com o
   * número no lugar do @ seguia com o número mesmo depois de alguém abri-la: o CRM tinha um
   * caminho a mais pra achar o nome e não usava.
   */
  let perfil = direto;
  if (!perfil?.username) {
    const pelaConversa = await buscarPerfilNasConversas(token, igsid).catch(() => null);
    if (pelaConversa?.username || pelaConversa?.fotoUrl) perfil = { ...perfil, ...pelaConversa };
  }

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

  /*
   * RESOLVEU O @ DE UMA CONVERSA QUE ESTAVA COM O NÚMERO: renomeia, levando o histórico junto.
   *
   * O webhook já fazia isso a cada mensagem nova. Uma conversa que parou de receber mensagem
   * ficava com o número pra sempre, porque nada mais passava por ela — e é justamente a maioria
   * das que aparecem assim na lista. Agora a visita à tela também conserta.
   *
   * `renomearConversa` move mensagens, contato e card de uma vez; se falhar, o perfil já gravado
   * acima continua valendo e a tela mostra o @ pelo contato.
   */
  const nomeNovo = perfil?.username ? `@${perfil.username}` : null;
  let renomeadaPara: string | null = null;
  if (nomeNovo && nomeNovo !== conversa && nomeAindaEhIdCru(conversa)) {
    const ok = await renomearConversa(workspaceId, conversa, nomeNovo)
      .then(() => true)
      .catch((erro) => {
        console.error("[instagram] Falha ao renomear a conversa que estava com o id:", erro);
        return false;
      });
    if (ok) renomeadaPara = nomeNovo;
  }

  return NextResponse.json({
    fotoUrl,
    username: perfil?.username ?? null,
    /** O nome novo da conversa, quando o @ resolveu o que era um número. A tela troca a chave. */
    renomeadaPara,
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
