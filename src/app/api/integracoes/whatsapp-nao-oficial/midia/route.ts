import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slotDeEnvio } from "@/lib/integracoes/conexoes-whatsapp";
import { buscarMidiaBase64 } from "@/lib/integracoes/evolution";

/**
 * GET busca o conteúdo real de uma mídia recebida (áudio, imagem, figurinha ou documento) sob
 * demanda: chamada pela
 * tela de Conversas quando a pessoa clica pra carregar. Mídia embutida no webhook em si está
 * desligada de propósito (payload de arquivo grande já derrubou o servidor antes), então o
 * conteúdo só é buscado aqui, um de cada vez, quando alguém realmente quer ver/ouvir.
 */
export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const remoteJid = url.searchParams.get("remoteJid");
  const id = url.searchParams.get("id");
  const fromMe = url.searchParams.get("fromMe") === "true";
  const pedido = url.searchParams.get("tipo");
  const tipo =
    pedido === "imagem" || pedido === "documento" || pedido === "figurinha" ? pedido : "audio";
  if (!remoteJid || !id) {
    return NextResponse.json({ erro: "remoteJid e id são obrigatórios" }, { status: 400 });
  }

  /*
   * A MÍDIA SÓ EXISTE NA CONEXÃO QUE A RECEBEU.
   *
   * Cada instância da Evolution guarda as mensagens do número dela. Pedir o áudio de uma conversa
   * do closer à instância da vendedora devolve "não achei" — e na tela isso aparece como um áudio
   * que não toca, sem dizer por quê. A conexão é a mesma lógica do envio: a da conversa.
   */
  const conversa = await prisma.conversa.findFirst({
    where: { workspaceId: sessao.user.workspaceId, contato: remoteJid.split("@")[0] },
    select: { contaCanal: true },
  });
  const { slot } = await slotDeEnvio(sessao.user.workspaceId, conversa?.contaCanal ?? null);

  const midia = await buscarMidiaBase64(
    sessao.user.workspaceId,
    { remoteJid, id, fromMe, tipo },
    slot ?? 1,
  );
  if (!midia) return NextResponse.json({ dataUrl: null });

  return NextResponse.json({ dataUrl: `data:${midia.mimetype};base64,${midia.base64}` });
}
