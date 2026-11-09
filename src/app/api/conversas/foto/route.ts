import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buscarFotoPerfil } from "@/lib/integracoes/evolution";
import { baixarFotoDePerfil } from "@/lib/integracoes/foto-de-perfil";
import { conexoesLigadas, slotDaConversa } from "@/lib/integracoes/conexoes-whatsapp";
import { CANAL_NAO_OFICIAL } from "@/lib/integracoes/conta-canal";

/**
 * A FOTO DE PERFIL DE UMA CONVERSA DE WHATSAPP, buscada agora e GUARDADA.
 *
 * O webhook já busca a foto a cada mensagem que chega (ver `precisaBaixarFoto`), e isso resolve
 * quem continua conversando. Quem parou de escrever, não: a conversa ficou com a coluna vazia e
 * nada mais passa por ela. O resultado é o que a Thaynara apontou no funil — alguns cartões com
 * rosto, outros com as iniciais, sem nenhum padrão visível. A diferença é só há quanto tempo
 * aquela pessoa mandou a última mensagem.
 *
 * Já existia `GET /api/integracoes/whatsapp-nao-oficial/foto-perfil`, mas ela só CONSULTA: serve
 * ao painel de participantes de grupo e não grava nada. Esta aqui grava nos dois lugares em que a
 * foto é lida — a conversa e o contato — pra a busca valer de uma vez.
 *
 * SÓ O CANAL POR QR CODE. A foto vem da Evolution; a API oficial da Meta não entrega foto de
 * perfil de quem escreve, e fingir que entrega só geraria chamada à toa.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const { conversa } = (await request.json().catch(() => ({}))) as { conversa?: string };
  if (!conversa) return NextResponse.json({ erro: "Falta a conversa." }, { status: 400 });

  const linha = await prisma.conversa.findUnique({
    where: { workspaceId_nome: { workspaceId, nome: conversa } },
    select: { contato: true, contatoId: true, canal: true, contaCanal: true, fotoUrl: true, ehGrupo: true },
  });
  if (!linha) return NextResponse.json({ erro: "Conversa não encontrada." }, { status: 404 });
  // Já tem foto guardada de verdade: nada a fazer, e nenhuma chamada à Evolution.
  if (linha.fotoUrl?.startsWith("data:")) return NextResponse.json({ fotoUrl: linha.fotoUrl });

  if (linha.contaCanal && !linha.contaCanal.startsWith(`${CANAL_NAO_OFICIAL}:`)) {
    return NextResponse.json({ fotoUrl: null, motivo: "canal sem foto de perfil" });
  }

  /*
   * O ALVO DA BUSCA: o JID do grupo, ou o número da pessoa.
   *
   * `Conversa.contato` guarda os dois (o webhook grava `remoteJid` no grupo e `waId` na pessoa).
   * Sem ele — conversa criada à mão, ou anterior à coluna — sobram os dígitos do próprio nome,
   * que no WhatsApp é o telefone.
   */
  const alvo = linha.ehGrupo ? linha.contato : (linha.contato ?? conversa.replace(/\D/g, ""));
  if (!alvo) return NextResponse.json({ fotoUrl: null, motivo: "sem número" });

  const conexoes = await conexoesLigadas(workspaceId).catch(() => []);
  if (!conexoes.length) return NextResponse.json({ fotoUrl: null, motivo: "nenhum número conectado" });
  const slot = slotDaConversa(conexoes, linha.contaCanal) ?? conexoes[0].slot;

  const endereco = await buscarFotoPerfil(workspaceId, alvo, slot).catch(() => null);
  const baixada = endereco ? await baixarFotoDePerfil(endereco) : null;
  if (!baixada) return NextResponse.json({ fotoUrl: null, motivo: "perfil sem foto" });

  await prisma.conversa
    .update({ where: { workspaceId_nome: { workspaceId, nome: conversa } }, data: { fotoUrl: baixada } })
    .catch(() => {});
  if (linha.contatoId) {
    await prisma.contato.update({ where: { id: linha.contatoId }, data: { fotoUrl: baixada } }).catch(() => {});
  } else {
    await prisma.contato
      .updateMany({ where: { workspaceId, nome: conversa }, data: { fotoUrl: baixada } })
      .catch(() => {});
  }

  return NextResponse.json({ fotoUrl: baixada });
}
