import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Os contatos que chegaram pelo Instagram.
 *
 * Só quem veio de lá: um contato do WhatsApp não tem @, não tem seguidores e não tem selo, e numa
 * tabela com essas colunas ele apareceria como uma linha de traços.
 *
 * Seguidores, verificado e "segue você" vêm do perfil que a Meta devolve pra quem MANDOU mensagem
 * pra conta conectada. Não é consulta livre a qualquer perfil, que a API não permite, e por isso
 * pode faltar: falta aparece como "—", nunca como zero.
 */
export type ContatoInstagram = {
  id: string;
  nome: string;
  username: string | null;
  fotoUrl: string | null;
  seguidores: number | null;
  verificado: boolean | null;
  segueVoce: boolean | null;
  etiquetas: string[];
  atualizadoEm: string;
};

export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const busca = (new URL(request.url).searchParams.get("busca") ?? "").trim();

  const contatos = await prisma.contato.findMany({
    where: {
      workspaceId: sessao.user.workspaceId,
      instagram: { not: null },
      ...(busca
        ? { OR: [{ nome: { contains: busca } }, { instagram: { contains: busca } }] }
        : {}),
    },
    orderBy: { atualizadoEm: "desc" },
    take: 500,
    select: {
      id: true,
      nome: true,
      instagram: true,
      fotoUrl: true,
      igSeguidores: true,
      igVerificado: true,
      igSegueVoce: true,
      etiquetas: true,
      atualizadoEm: true,
    },
  });

  return NextResponse.json(
    contatos.map(
      (c): ContatoInstagram => ({
        id: c.id,
        nome: c.nome,
        username: c.instagram,
        fotoUrl: c.fotoUrl,
        seguidores: c.igSeguidores,
        verificado: c.igVerificado,
        segueVoce: c.igSegueVoce,
        etiquetas: Array.isArray(c.etiquetas) ? (c.etiquetas as string[]) : [],
        atualizadoEm: c.atualizadoEm.toISOString(),
      }),
    ),
    { headers: { "cache-control": "private, no-store" } },
  );
}

/**
 * Ação em massa sobre os contatos escolhidos.
 *
 * Duas por enquanto, e as duas são reversíveis: etiquetar e desetiquetar. Nada que apague dado em
 * lote entra aqui sem uma conversa antes: o estrago de um clique errado numa seleção de duzentos
 * contatos não tem desfazer.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const { acao, ids, etiqueta } = (await request.json()) as {
    acao?: "etiquetar" | "desetiquetar";
    ids?: string[];
    etiqueta?: string;
  };
  const alvos = Array.from(new Set(ids ?? [])).filter(Boolean);
  if (!alvos.length) return NextResponse.json({ erro: "Nenhum contato escolhido." }, { status: 400 });
  const nome = (etiqueta ?? "").trim();
  if (!nome) return NextResponse.json({ erro: "Escreva a etiqueta." }, { status: 400 });

  // O workspace entra no filtro: um id de outra conta simplesmente não é encontrado, em vez de ser
  // encontrado e recusado depois.
  const contatos = await prisma.contato.findMany({
    where: { workspaceId, id: { in: alvos } },
    select: { id: true, etiquetas: true },
  });

  let alterados = 0;
  for (const contato of contatos) {
    const atuais = Array.isArray(contato.etiquetas) ? (contato.etiquetas as string[]) : [];
    const tem = atuais.some((e) => e.trim().toLowerCase() === nome.toLowerCase());
    const novas =
      acao === "desetiquetar"
        ? atuais.filter((e) => e.trim().toLowerCase() !== nome.toLowerCase())
        : tem
          ? atuais
          : [...atuais, nome];
    if (novas.length === atuais.length && acao !== "desetiquetar") continue;
    await prisma.contato.update({ where: { id: contato.id }, data: { etiquetas: novas } });
    alterados += 1;
  }

  return NextResponse.json({ ok: true, alterados });
}
