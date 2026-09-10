import { NextResponse } from "next/server";

import type { Membro } from "@/lib/data";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugId } from "@/lib/ids";
import { enviarEmailContandoFalha, templateConvite } from "@/lib/email";

/** Linha do banco -> `Membro` do front. Formato de `permissoes` (JSON) e `ultimoAcesso` (Date ->
 * ISO string) mudam. */
function paraMembro(linha: { permissoes: unknown; ultimoAcesso?: Date | null; [k: string]: unknown }): Membro {
  return {
    ...linha,
    permissoes: Array.isArray(linha.permissoes) ? (linha.permissoes as string[]) : [],
    ultimoAcesso: linha.ultimoAcesso ? linha.ultimoAcesso.toISOString() : null,
  } as Membro;
}

/** GET lista os membros da equipe do workspace de quem está logado. */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const linhas = await prisma.membro.findMany({
    where: { workspaceId: sessao.user.workspaceId },
    orderBy: { criadoEm: "asc" },
  });
  return NextResponse.json(linhas.map(paraMembro));
}

/**
 * POST cria um convite de membro novo. Mesma semântica que `convidarMembro` já tinha no Context
 * (ver equipe-context.tsx): entra sem senha, inativo, com `convitePendente`, associado ao workspace
 * de quem está convidando. Se o id (slug do nome) já existir, retorna o membro existente em vez de
 * duplicar.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const dados = (await request.json()) as Pick<
    Membro,
    "nome" | "email" | "papel" | "papelTipo" | "papelNota" | "enxerga" | "permissoes"
  >;
  if (!dados.nome || !dados.email) {
    return NextResponse.json({ erro: "Campos obrigatórios: nome, email" }, { status: 400 });
  }

  const id = slugId(dados.nome);
  const existente = await prisma.membro.findUnique({ where: { id } });
  if (existente) {
    return NextResponse.json(paraMembro(existente));
  }

  const initials = dados.nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  const linha = await prisma.membro.create({
    data: {
      id,
      workspaceId: sessao.user.workspaceId,
      initials,
      nome: dados.nome,
      email: dados.email,
      senha: null,
      papel: dados.papel,
      papelTipo: dados.papelTipo,
      papelNota: dados.papelNota,
      leads: "-",
      enxerga: dados.enxerga,
      permissoes: dados.permissoes,
      ativo: false,
      convitePendente: true,
    },
  });

  /*
   * O link SEMPRE volta pra tela, e o resultado do e-mail volta junto.
   *
   * Antes, o envio era `await enviarEmail(...)`, que engole a falha e loga no servidor. O convite
   * era criado, a tela mostrava "convite pendente", e ninguém tinha como saber que o e-mail não
   * tinha saído: a pessoa convidada esperava um e-mail que nunca ia chegar, e quem convidou
   * esperava que ela entrasse. É o pior tipo de defeito, o que se parece com sucesso.
   *
   * Agora a tela sabe as duas coisas, e tem o link pra mandar por WhatsApp de qualquer jeito. O
   * link não é um plano B envergonhado: é o caminho que funciona mesmo com o e-mail configurado,
   * porque convite por e-mail cai em spam com frequência.
   */
  const link = `${process.env.APP_URL ?? "https://azuzcrm.com.br"}/convite/${id}`;
  const envio = await enviarEmailContandoFalha({
    to: dados.email,
    subject: `${sessao.user.workspaceNome ?? "Alguém"} te convidou pro CRM AZUZ`,
    html: templateConvite(dados.nome, sessao.user.workspaceNome ?? "o workspace", link),
  });

  return NextResponse.json(
    {
      ...paraMembro(linha),
      linkConvite: link,
      emailEnviado: envio.ok,
      motivoEmail: envio.ok ? undefined : envio.motivo,
    },
    { status: 201 },
  );
}
