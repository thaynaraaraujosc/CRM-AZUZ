import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

/**
 * Dados que a pessoa precisa copiar pro painel da Meta ao cadastrar um webhook: a URL exata e o
 * token de verificação.
 *
 * Existe porque cadastrar webhook virou um jogo de adivinhação: o token só era legível no painel da
 * hospedagem (e o valor de lá nem sempre é o que o servidor em execução está usando), e o domínio
 * tem duas formas — com e sem `www` — que podem ser servidas por deploys diferentes, cada um com
 * suas variáveis. Digitar errado qualquer um dos dois dá a mesma mensagem genérica da Meta.
 *
 * A resposta é montada a partir do próprio pedido: a URL usa o host que a pessoa está acessando, e
 * o token vem do ambiente DESTE servidor — exatamente o que vai responder quando a Meta chamar.
 * Não há como copiar o valor de um lugar e o outro responder por outro.
 *
 * O token de verificação não dá acesso a dado nenhum: ele só prova, no momento do cadastro, que
 * quem registra o webhook controla o servidor. Mesmo assim é restrito a admin, e nunca aparece
 * junto do App Secret (esse sim sensível, e que não passa por aqui).
 */
export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (sessao.user.papelTipo !== "admin") {
    return NextResponse.json({ erro: "Só o admin do workspace pode ver isto." }, { status: 403 });
  }

  const url = new URL(request.url);
  const tokenVerificacao = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() ?? null;

  return NextResponse.json({
    // `origin` do pedido, não uma variável de ambiente: é o endereço que a pessoa está usando de
    // fato, e portanto o servidor cujo token aparece abaixo.
    host: url.origin,
    urlWhatsapp: `${url.origin}/api/webhooks/whatsapp`,
    urlInstagram: `${url.origin}/api/webhooks/instagram`,
    tokenVerificacao,
  });
}
