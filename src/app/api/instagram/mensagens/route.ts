import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enviarTextoPeloCanal } from "@/lib/conversas/enviar-pelo-canal";
import { dentroDaJanelaDirect } from "@/lib/social/janela-direct";
import { registrarMensagemEnviada } from "@/lib/conversas/registrar-saida";

/** Uma mensagem da conversa, como a tela desenha. */
export type MensagemInstagram = {
  id: string;
  /** "in" = da pessoa; "out" = nossa. */
  tipo: string;
  texto: string;
  hora: string;
  criadoEm: string | null;
  extras: Record<string, unknown> | null;
};

export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const conversa = new URL(request.url).searchParams.get("conversa");
  if (!conversa) return NextResponse.json({ erro: "Falta a conversa." }, { status: 400 });

  // Sem filtro por `canal`: essa coluna nasceu depois e fica nula em mensagem gravada por outros
  // caminhos (envio manual, disparo). Filtrar por ela sumia com metade da conversa. O nome da
  // conversa já é único por workspace, então ele sozinho recorta certo.
  const mensagens = await prisma.mensagemExtra.findMany({
    where: { workspaceId: sessao.user.workspaceId, contato: conversa },
    orderBy: { criadoEm: "asc" },
    take: 300,
    select: { id: true, tipo: true, texto: true, hora: true, criadoEm: true, extras: true },
  });

  // Abrir a conversa zera o não lidas: é o gesto de ter lido.
  await prisma.conversa
    .updateMany({ where: { workspaceId: sessao.user.workspaceId, nome: conversa }, data: { naoLidas: 0 } })
    .catch(() => {});

  return NextResponse.json(
    mensagens.map(
      (m): MensagemInstagram => ({
        id: m.id,
        tipo: m.tipo,
        texto: m.texto,
        hora: m.hora,
        criadoEm: m.criadoEm?.toISOString() ?? null,
        extras: (m.extras as Record<string, unknown> | null) ?? null,
      }),
    ),
    { headers: { "cache-control": "private, no-store" } },
  );
}

/**
 * Responde pelo Direct.
 *
 * A janela é conferida ANTES de tentar enviar, e a recusa explica o motivo. Sem isso a pessoa
 * escreveria a resposta inteira pra receber um erro cru da Meta, sem entender que o problema não é
 * a mensagem dela: é que o Instagram não aceita mais falar com aquela pessoa hoje.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const { conversa, texto } = (await request.json()) as { conversa?: string; texto?: string };
  if (!conversa || !texto?.trim()) {
    return NextResponse.json({ erro: "Falta a conversa ou o texto." }, { status: 400 });
  }

  if (!(await dentroDaJanelaDirect(workspaceId, conversa))) {
    return NextResponse.json(
      {
        erro: "A janela de 24 horas fechou: o Instagram só deixa responder quem escreveu nas últimas 24 horas.",
      },
      { status: 409 },
    );
  }

  const enviado = await enviarTextoPeloCanal({ workspaceId, conversaNome: conversa, texto: texto.trim() });
  if (!enviado.enviado) {
    return NextResponse.json({ erro: enviado.motivo ?? "Não deu pra enviar." }, { status: 502 });
  }

  // A mensagem enviada entra no histórico. Sem isto ela sairia de verdade e não apareceria na
  // conversa: quem atende veria só o que a outra pessoa escreveu, sem a própria resposta.
  await registrarMensagemEnviada({
    workspaceId,
    contatoNome: conversa,
    texto: texto.trim(),
    origem: "manual",
  });

  return NextResponse.json({ ok: true });
}
