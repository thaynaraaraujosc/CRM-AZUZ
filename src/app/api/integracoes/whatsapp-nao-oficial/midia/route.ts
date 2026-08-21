import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { buscarMidiaBase64 } from "@/lib/integracoes/evolution";

/**
 * GET busca o conteúdo real de uma mídia recebida (áudio, por enquanto) sob demanda — chamada pela
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
  if (!remoteJid || !id) {
    return NextResponse.json({ erro: "remoteJid e id são obrigatórios" }, { status: 400 });
  }

  const midia = await buscarMidiaBase64(sessao.user.workspaceId, { remoteJid, id, fromMe });
  if (!midia) return NextResponse.json({ dataUrl: null });

  return NextResponse.json({ dataUrl: `data:${midia.mimetype};base64,${midia.base64}` });
}
