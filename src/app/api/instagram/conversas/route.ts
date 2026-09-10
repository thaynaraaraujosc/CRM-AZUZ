import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { JANELA_HORAS } from "@/lib/social/janela-direct";
import { cabecalhosComEtag, clienteJaTem, montarEtag, naoModificado } from "@/lib/conversas/assinatura";

/**
 * A caixa de entrada do Direct: as conversas do Instagram, com o perfil de cada pessoa.
 *
 * Separada da caixa do WhatsApp porque as duas não são a mesma coisa pra quem atende: o Direct tem
 * janela de 24 horas, tem story e comentário, e a pessoa do outro lado tem @, seguidores e um selo
 * de verificado. Nada disso existe no WhatsApp, e uma tela que serve aos dois não mostra nenhum
 * deles direito.
 */
export type ConversaInstagram = {
  nome: string;
  /** IGSID de quem escreve, que é o destinatário do envio. */
  contato: string | null;
  exibicao: string;
  username: string | null;
  fotoUrl: string | null;
  ultimaMensagem: string | null;
  ultimaEm: string | null;
  naoLidas: number;
  /** Ainda dá pra responder livremente? Fora da janela o Instagram recusa o envio. */
  dentroDaJanela: boolean;
  /** Quando a janela fecha. Nulo quando ela já fechou ou a pessoa nunca escreveu. */
  janelaFechaEm: string | null;
  perfil: {
    seguidores: number | null;
    verificado: boolean | null;
    segueVoce: boolean | null;
    voceSegue: boolean | null;
  } | null;
};

/**
 * A tela pergunta de 10 em 10 segundos, e quase sempre a resposta é "nada mudou".
 *
 * Montar esta lista custa quatro consultas, duas delas sobre a tabela de mensagens inteira. Repetir
 * isso a cada batida, com uma aba aberta o dia todo, é exatamente o que produziu a conta de $123
 * do Railway na tela de Conversas: ~1,9 TB saindo do banco num mês pra entregar, quase sempre, a
 * mesma lista de novo. Ver `src/lib/conversas/assinatura.ts`.
 *
 * Então vem a pergunta barata antes da cara: duas agregações sobre índice, resposta em bytes. Se a
 * assinatura for a mesma da última vez, sai um `304` sem corpo e as quatro consultas de baixo nem
 * chegam a rodar.
 *
 * A assinatura combina as DUAS tabelas de propósito. `Conversa` pega conversa nova, arquivamento e
 * não lidas; `MensagemExtra` pega mensagem nova e mudança de status, que reescreve a linha sem
 * criar outra. Faltando qualquer um dos dois, existe uma mudança que a tela não veria.
 */
export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const [resumoConversas, resumoMensagens] = await Promise.all([
    prisma.conversa.aggregate({
      where: { workspaceId, canal: "Instagram", arquivada: false },
      _count: { _all: true },
      _max: { atualizadoEm: true },
    }),
    prisma.mensagemExtra.aggregate({
      where: { workspaceId },
      _count: { _all: true },
      _max: { criadoEm: true, atualizadoEm: true },
    }),
  ]);
  const etag = montarEtag([
    workspaceId,
    "instagram",
    resumoConversas._count._all,
    resumoConversas._max.atualizadoEm,
    resumoMensagens._count._all,
    resumoMensagens._max.criadoEm,
    resumoMensagens._max.atualizadoEm,
  ]);
  if (clienteJaTem(request, etag)) return naoModificado(etag);

  const conversas = await prisma.conversa.findMany({
    where: { workspaceId, canal: "Instagram", arquivada: false },
    orderBy: { atualizadoEm: "desc" },
    take: 200,
    select: {
      nome: true,
      contato: true,
      fotoUrl: true,
      naoLidas: true,
      atualizadoEm: true,
      contatoId: true,
    },
  });
  if (!conversas.length) return NextResponse.json([], { headers: cabecalhosComEtag(etag) });

  const nomes = conversas.map((c) => c.nome);

  // Última mensagem de cada conversa e a última RECEBIDA (que é a que abre a janela). Duas
  // consultas agregadas em vez de duas por conversa: com 200 conversas isso seria 400 idas ao
  // banco pra montar uma lista.
  const [ultimas, ultimasRecebidas, contatos] = await Promise.all([
    // Sem filtro por `canal` pelo mesmo motivo do endpoint de mensagens: a coluna nasceu depois e
    // fica nula em boa parte do histórico. O nome da conversa já recorta certo.
    prisma.mensagemExtra.findMany({
      where: { workspaceId, contato: { in: nomes } },
      orderBy: { criadoEm: "desc" },
      distinct: ["contato"],
      select: { contato: true, texto: true, criadoEm: true },
    }),
    prisma.mensagemExtra.groupBy({
      by: ["contato"],
      where: { workspaceId, tipo: { not: "out" }, contato: { in: nomes } },
      _max: { criadoEm: true },
    }),
    prisma.contato.findMany({
      where: { workspaceId, nome: { in: nomes } },
      select: {
        nome: true,
        instagram: true,
        fotoUrl: true,
        igSeguidores: true,
        igVerificado: true,
        igSegueVoce: true,
        igVoceSegue: true,
      },
    }),
  ]);

  const porNome = new Map(ultimas.map((m) => [m.contato, m]));
  const recebidaPorNome = new Map(ultimasRecebidas.map((m) => [m.contato, m._max.criadoEm]));
  const contatoPorNome = new Map(contatos.map((c) => [c.nome, c]));
  const agora = Date.now();

  const lista: ConversaInstagram[] = conversas.map((c) => {
    const ultima = porNome.get(c.nome);
    const recebida = recebidaPorNome.get(c.nome) ?? null;
    const fecha = recebida ? new Date(recebida.getTime() + JANELA_HORAS * 60 * 60 * 1000) : null;
    const dados = contatoPorNome.get(c.nome);
    return {
      nome: c.nome,
      contato: c.contato,
      exibicao: c.nome,
      username: dados?.instagram ?? null,
      // A foto pode estar na conversa OU no contato: o webhook grava nos dois, mas conversa antiga
      // (de antes disso) só tem no contato. Sem o segundo lugar, a lista aparecia só com iniciais.
      fotoUrl: c.fotoUrl ?? dados?.fotoUrl ?? null,
      ultimaMensagem: ultima?.texto ?? null,
      ultimaEm: (ultima?.criadoEm ?? c.atualizadoEm)?.toISOString() ?? null,
      naoLidas: c.naoLidas ?? 0,
      dentroDaJanela: !!fecha && fecha.getTime() > agora,
      janelaFechaEm: fecha && fecha.getTime() > agora ? fecha.toISOString() : null,
      perfil: dados
        ? {
            seguidores: dados.igSeguidores,
            verificado: dados.igVerificado,
            segueVoce: dados.igSegueVoce,
            voceSegue: dados.igVoceSegue,
          }
        : null,
    };
  });

  return NextResponse.json(lista, { headers: cabecalhosComEtag(etag) });
}
