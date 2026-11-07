import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { esquecerConexoes } from "@/lib/integracoes/conexoes-cache";
import {
  LIMITE_DE_NUMEROS,
  formatarNumeroConectado,
  listarConexoesWhats,
  nomeDaConexao,
  proximoSlotLivre,
} from "@/lib/integracoes/conexoes-whatsapp";

/**
 * OS NÚMEROS DE WHATSAPP DA EMPRESA.
 *
 * A rota antiga (`/api/integracoes/whatsapp-nao-oficial`) responde por UM número e continua
 * existindo: é dela que vive a tela de conexão de sempre, e mexer nela seria arriscar o canal que
 * já está no ar pra adicionar um recurso novo. Esta aqui é a lista — o que a tela de vários
 * números lê.
 */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const conexoes = await listarConexoesWhats(sessao.user.workspaceId);
  return NextResponse.json({
    limite: LIMITE_DE_NUMEROS,
    proximoLivre: proximoSlotLivre(conexoes.map((c) => c.slot)),
    conexoes: conexoes.map((c) => ({
      slot: c.slot,
      nome: nomeDaConexao(c),
      apelido: c.apelido,
      numero: c.numero,
      numeroLegivel: formatarNumeroConectado(c.numero),
      status: c.status,
      erroMensagem: c.erroMensagem,
      qrDataUrl: c.status === "aguardando_qr" ? c.qrDataUrl : null,
    })),
  });
}

/**
 * Dá nome a um número. "Vendas — Marina" diz quem está do outro lado; `+55 (11) 98888-7777` não.
 *
 * O nome vive nos metadados da conexão, e não numa coluna: é rótulo, não dado de negócio, e
 * `Integracao` já carrega tudo o mais que descreve a conexão no mesmo lugar.
 */
export async function PATCH(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (sessao.user.papelTipo !== "admin" && !sessao.user.superAdmin) {
    return NextResponse.json({ erro: "Só administradores podem mexer nas conexões." }, { status: 403 });
  }

  const { slot, apelido } = (await request.json()) as { slot?: number; apelido?: string };
  if (!Number.isInteger(slot) || (slot as number) < 1) {
    return NextResponse.json({ erro: "slot inválido" }, { status: 400 });
  }

  const workspaceId = sessao.user.workspaceId;
  const linha = await prisma.integracao.findUnique({
    where: { workspaceId_provedor_slot: { workspaceId, provedor: "whatsapp_nao_oficial", slot: slot as number } },
    select: { metadados: true },
  });
  if (!linha) return NextResponse.json({ erro: "Esse número não existe nesta conta." }, { status: 404 });

  const limpo = (apelido ?? "").trim().slice(0, 60);
  await prisma.integracao.update({
    where: { workspaceId_provedor_slot: { workspaceId, provedor: "whatsapp_nao_oficial", slot: slot as number } },
    // Mescla: `metadados` é Json e o Prisma troca a coluna inteira. Escrever só o apelido apagaria
    // o número conectado, o rastro do webhook e o progresso da importação de uma vez.
    data: { metadados: { ...((linha.metadados as Record<string, unknown> | null) ?? {}), apelido: limpo || null } },
  });
  esquecerConexoes(workspaceId);

  return NextResponse.json({ ok: true, apelido: limpo || null });
}
