import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { conviteValido } from "@/lib/equipe/convite";
import { auditar } from "@/lib/seguranca/auditoria";
import { POLITICAS, contarChamada, ipDeQuemChamou, respostaDeLimiteExcedido } from "@/lib/seguranca/limite-de-uso";

/**
 * Aceitar um convite. Sem sessão, porque quem está aqui ainda não tem conta.
 *
 * O que autoriza é o TOKEN do link (`?t=`), não o id da URL. O id é o slug do nome da pessoa
 * ("João Silva" → "joao-silva"): adivinhável. Enquanto ele sozinho bastava, qualquer pessoa de
 * fora que chutasse o nome de alguém com convite pendente definia a senha daquela conta e entrava
 * no workspace da empresa. Ver `lib/equipe/convite.ts`.
 *
 * Convite antigo, criado antes do token existir, não é aceito: o admin reenvia pela tela de
 * Usuários e o novo já nasce com token e prazo.
 */

/** Uma resposta só pros três casos: não existe, não é mais pendente, token errado ou vencido. A
 * diferença entre elas contaria a quem tentou se aquele id existe em algum lugar. */
const NAO_ENCONTRADO = { erro: "Esse convite não existe mais, expirou ou já foi usado. Peça um novo." };

function tokenDaUrl(request: Request): string | null {
  return new URL(request.url).searchParams.get("t");
}

/** GET devolve os dados públicos do convite, só pra tela mostrar nome e empresa. */
export async function GET(request: Request, ctx: RouteContext<"/api/convite/[id]">) {
  const ip = await ipDeQuemChamou();
  const limite = contarChamada(`convite:${ip}`, POLITICAS.recuperacaoDeSenha);
  if (!limite.permitido) return respostaDeLimiteExcedido(limite.esperarSegundos);

  const { id } = await ctx.params;
  const membro = await prisma.membro.findUnique({
    where: { id },
    include: { workspace: { select: { nome: true } } },
  });
  if (!conviteValido(membro, tokenDaUrl(request))) {
    return NextResponse.json(NAO_ENCONTRADO, { status: 404 });
  }
  return NextResponse.json({ nome: membro!.nome, email: membro!.email, workspaceNome: membro!.workspace.nome });
}

/**
 * POST aceita o convite: define a senha, ativa a conta e QUEIMA o token.
 *
 * O token é de uso único: depois de aceito, o hash e o prazo são zerados junto com
 * `convitePendente`, então o mesmo link não serve pra trocar a senha de novo mais tarde.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/convite/[id]">) {
  // Sem limite, o token do link (32 bytes) ainda é inviável de adivinhar, mas a rota vira um jeito
  // barato de martelar o banco. O mesmo teto da recuperação de senha serve aqui.
  const ip = await ipDeQuemChamou();
  const limite = contarChamada(`convite:${ip}`, POLITICAS.recuperacaoDeSenha);
  if (!limite.permitido) return respostaDeLimiteExcedido(limite.esperarSegundos);

  const { id } = await ctx.params;
  const corpo = await request.json().catch(() => null);
  const senha = typeof corpo?.senha === "string" ? corpo.senha : "";
  if (senha.length < 8) {
    return NextResponse.json({ erro: "A senha precisa ter pelo menos 8 caracteres." }, { status: 400 });
  }
  if (senha.length > 200) {
    return NextResponse.json({ erro: "Senha longa demais." }, { status: 400 });
  }

  const membro = await prisma.membro.findUnique({ where: { id } });
  if (!conviteValido(membro, tokenDaUrl(request))) {
    return NextResponse.json(NAO_ENCONTRADO, { status: 404 });
  }

  const hash = await bcrypt.hash(senha, 12);
  // `convitePendente: false` na condição do update: se duas chamadas chegarem juntas com o mesmo
  // link, só a primeira encontra o convite de pé. A segunda atualiza zero linhas.
  const { count } = await prisma.membro.updateMany({
    where: { id, convitePendente: true },
    data: { senha: hash, ativo: true, convitePendente: false, conviteTokenHash: null, conviteExpiraEm: null },
  });
  if (count === 0) return NextResponse.json(NAO_ENCONTRADO, { status: 404 });

  await auditar({
    acao: "convite.aceito",
    workspaceId: membro!.workspaceId,
    membroId: id,
    email: membro!.email,
    recurso: id,
  });
  return NextResponse.json({ ok: true });
}
