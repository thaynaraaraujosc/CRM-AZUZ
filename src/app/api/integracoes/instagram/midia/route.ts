import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";

/**
 * Repassa uma mídia do Instagram para o navegador, buscando-a com o token da conta conectada.
 *
 * Existe porque o CDN do Instagram (`lookaside.fbsbx.com/ig_messaging_cdn/...`) exige o token de
 * acesso: uma tag `<img>` no navegador não tem como enviá-lo, então apontar direto para lá devolve
 * uma página de erro. Sem este intermediário, a única forma de exibir era baixar o arquivo e
 * guardá-lo embutido na mensagem.
 *
 * É o que permite ver a miniatura do story respondido — indispensável pra saber A QUAL story a
 * pessoa está respondendo quando há dezenas no ar — sem guardar cópia de nada: o arquivo continua
 * no Instagram, e o CRM só serve de ponte na hora de mostrar.
 *
 * O link do CDN expira em algumas horas. Depois disso a miniatura para de carregar, o que é o
 * comportamento correto pra conteúdo que não é nosso.
 */

/** Só hosts de mídia do Instagram/Facebook. Sem esta lista, a rota viraria um proxy aberto: daria
 * pra usar o servidor do CRM (e a rede dele) pra buscar qualquer endereço. */
const HOSTS_PERMITIDOS = [/\.fbcdn\.net$/, /\.cdninstagram\.com$/, /^lookaside\.fbsbx\.com$/];

export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const alvo = new URL(request.url).searchParams.get("url");
  if (!alvo) return NextResponse.json({ erro: "url é obrigatória" }, { status: 400 });

  let destino: URL;
  try {
    destino = new URL(alvo);
  } catch {
    return NextResponse.json({ erro: "url inválida" }, { status: 400 });
  }
  if (destino.protocol !== "https:" || !HOSTS_PERMITIDOS.some((padrao) => padrao.test(destino.hostname))) {
    return NextResponse.json({ erro: "Endereço não permitido." }, { status: 400 });
  }

  const integracao = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId: sessao.user.workspaceId, provedor: "meta_instagram" } },
  });
  if (!integracao?.accessTokenCriptografado) {
    return NextResponse.json({ erro: "Instagram não está conectado." }, { status: 400 });
  }

  const resposta = await fetch(destino, {
    headers: { authorization: `Bearer ${decriptar(integracao.accessTokenCriptografado)}` },
  });
  if (!resposta.ok || !resposta.body) {
    return NextResponse.json({ erro: "Mídia indisponível — o link do Instagram pode ter expirado." }, { status: 404 });
  }

  const tipo = resposta.headers.get("content-type") ?? "application/octet-stream";
  // Página HTML aqui significa que o CDN recusou (token inválido/expirado) — devolver isso como se
  // fosse imagem deixaria a tela com um quadro quebrado sem explicação.
  if (!/^(image|video|audio)\//.test(tipo)) {
    return NextResponse.json({ erro: "O Instagram não devolveu mídia para esse endereço." }, { status: 404 });
  }

  return new NextResponse(resposta.body, {
    headers: {
      "content-type": tipo,
      // Cache curto no navegador: o link do CDN expira, então guardar por muito tempo só geraria
      // imagem quebrada depois.
      "cache-control": "private, max-age=1800",
    },
  });
}
