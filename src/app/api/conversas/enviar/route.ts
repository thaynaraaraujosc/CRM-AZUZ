import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { POLITICAS, contarChamada, respostaDeLimiteExcedido } from "@/lib/seguranca/limite-de-uso";
import { enviarTextoPeloCanal } from "@/lib/conversas/enviar-pelo-canal";

/**
 * Manda um texto numa conversa, escolhendo o canal pela própria conversa.
 *
 * Caminho ÚNICO de envio pra qualquer tela do CRM que não seja a de Conversas — hoje o popup de
 * resposta rápida do Funil, amanhã qualquer outra. Existe porque cada tela que montava o próprio
 * envio acabou virando um lugar a menos onde a mensagem realmente saía: a resposta rápida do Funil
 * só guardava a mensagem no estado local e ainda a marcava como "lida", então o vendedor via
 * "entregue e lida" numa mensagem que nunca chegou em ninguém.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  // Limite por WORKSPACE, não por pessoa: o custo e o risco de spam são da empresa, e várias
  // pessoas do mesmo cliente compartilham o mesmo número. Contar por usuário deixaria o teto real
  // ser multiplicado pelo tamanho da equipe.
  const limiteDeUso = contarChamada(`envio-conversa:${sessao.user.workspaceId}`, POLITICAS.envioDeMensagem);
  if (!limiteDeUso.permitido) return respostaDeLimiteExcedido(limiteDeUso.esperarSegundos);

  const { conversaNome, texto } = (await request.json()) as { conversaNome?: string; texto?: string };
  if (!conversaNome?.trim() || !texto?.trim()) {
    return NextResponse.json({ erro: "conversaNome e texto são obrigatórios" }, { status: 400 });
  }

  const resultado = await enviarTextoPeloCanal({
    workspaceId: sessao.user.workspaceId,
    conversaNome: conversaNome.trim(),
    texto,
  });

  if (!resultado.enviado) {
    return NextResponse.json({ erro: resultado.motivo ?? "Não foi possível enviar." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
