import { NextResponse } from "next/server";

import type { Membro } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { exigirAdmin } from "@/lib/seguranca/sessao";

/**
 * Os campos que podem SAIR daqui. `senha` e `conviteTokenHash` ficam de fora: o hash da senha de
 * um colega no navegador é material pra quebra offline, sem limite e sem rastro.
 */
const CAMPOS_PUBLICOS = {
  id: true,
  workspaceId: true,
  initials: true,
  nome: true,
  email: true,
  papel: true,
  papelTipo: true,
  papelNota: true,
  leads: true,
  enxerga: true,
  permissoes: true,
  ativo: true,
  convitePendente: true,
  foto: true,
  criadoEm: true,
  atualizadoEm: true,
  ultimoAcesso: true,
} as const;

function paraMembro(linha: { permissoes: unknown; [k: string]: unknown }): Membro {
  return {
    ...linha,
    permissoes: Array.isArray(linha.permissoes) ? (linha.permissoes as string[]) : [],
  } as Membro;
}

/**
 * Os campos que esta rota aceita mudar. LISTA FECHADA, e é o ponto dela.
 *
 * Antes o corpo era espalhado direto no `update` (`data: { ...dados }`), o que significa que
 * qualquer campo mandado pelo navegador ia pro banco: `senha` (que aqui entraria como texto puro,
 * quebrando o login de quem depende do hash), `convitePendente` (marcar alguém como já aceito sem
 * nunca ter aceitado), `workspaceId` (mover um membro pra outra empresa). Nada disso era intenção
 * de ninguém; era só o `...` fazendo o que `...` faz.
 *
 * `senha` NÃO está aqui de propósito: senha se define por convite ou por "Gerar nova senha", que
 * são os caminhos que passam pelo hash.
 */
const CAMPOS_EDITAVEIS = [
  "nome",
  "email",
  "initials",
  "papel",
  "papelTipo",
  "papelNota",
  "leads",
  "enxerga",
  "permissoes",
  "ativo",
  "foto",
] as const;

/**
 * PATCH altera um membro. SÓ ADMIN do workspace.
 *
 * Antes bastava estar logado, e a lista acima aceita `papelTipo` e `permissoes`. Quer dizer:
 * qualquer membro comum chamava esta rota apontando pro próprio id e virava admin do workspace; ou
 * apontava pro id do dono da conta, trocava o e-mail dele pelo próprio e tomava a conta inteira
 * pelo "esqueci minha senha". Esconder o botão na tela nunca impediu nada disso.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/equipe/[id]">) {
  const guarda = await exigirAdmin();
  if (!guarda.ok) return guarda.resposta;
  const { sessao, workspaceId } = guarda;

  const { id } = await ctx.params;
  const corpo = (await request.json()) as Partial<Membro> & Record<string, unknown>;

  const dados: Record<string, unknown> = {};
  for (const campo of CAMPOS_EDITAVEIS) {
    if (corpo[campo] !== undefined) dados[campo] = corpo[campo];
  }
  if (!Object.keys(dados).length) {
    return NextResponse.json({ erro: "Nada pra atualizar." }, { status: 400 });
  }

  if (typeof dados.papelTipo === "string" && !["admin", "padrao", "custom"].includes(dados.papelTipo)) {
    return NextResponse.json({ erro: "Tipo de papel inválido." }, { status: 400 });
  }
  if ("permissoes" in dados && !Array.isArray(dados.permissoes)) {
    return NextResponse.json({ erro: "Permissões precisam ser uma lista." }, { status: 400 });
  }

  /*
   * Ninguém tira o próprio acesso de administrador, nem se desativa.
   *
   * Um workspace sem nenhum admin ativo não tem mais como gerir a própria equipe, e a saída vira
   * um chamado pro suporte mexer no banco. Vale também como trava contra o caso em que a conta do
   * admin foi tomada e o invasor quer trancar a porta por dentro.
   */
  if (id === sessao.user.id) {
    if (dados.papelTipo !== undefined && dados.papelTipo !== "admin") {
      return NextResponse.json(
        { erro: "Você não pode remover o próprio acesso de administrador. Peça a outro admin." },
        { status: 409 },
      );
    }
    if (dados.ativo === false) {
      return NextResponse.json({ erro: "Você não pode desativar a própria conta." }, { status: 409 });
    }
  }

  // E-mail é chave única e é por ele que se entra no CRM. Trocar pra um que já pertence a outra
  // pessoa faria o banco recusar com um erro técnico; aqui a recusa vem em português, antes.
  if (typeof dados.email === "string") {
    const email = dados.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ erro: "E-mail inválido." }, { status: 400 });
    }
    const jaUsado = await prisma.membro.findFirst({ where: { email, NOT: { id } }, select: { id: true } });
    if (jaUsado) {
      return NextResponse.json({ erro: "Já existe alguém com esse e-mail." }, { status: 409 });
    }
    dados.email = email;
  }

  const { count } = await prisma.membro.updateMany({
    where: { id, workspaceId },
    data: dados,
  });
  if (count === 0) {
    return NextResponse.json({ erro: "Membro não encontrado" }, { status: 404 });
  }

  // Relê já filtrando pelo workspace: sem isso, um id de outra empresa que tivesse passado pelo
  // `updateMany` (não passa, mas a leitura não pode ser mais frouxa que a escrita) seria devolvido.
  const linha = await prisma.membro.findFirst({ where: { id, workspaceId }, select: CAMPOS_PUBLICOS });
  if (!linha) return NextResponse.json({ erro: "Membro não encontrado" }, { status: 404 });
  return NextResponse.json(paraMembro(linha));
}

/** DELETE remove um membro do workspace. Só admin, e ninguém apaga a si mesmo. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/equipe/[id]">) {
  const guarda = await exigirAdmin();
  if (!guarda.ok) return guarda.resposta;
  const { sessao, workspaceId } = guarda;

  const { id } = await ctx.params;
  if (id === sessao.user.id) {
    return NextResponse.json({ erro: "Você não pode excluir a própria conta." }, { status: 409 });
  }

  const { count } = await prisma.membro.deleteMany({
    where: { id, workspaceId },
  });
  if (count === 0) {
    return NextResponse.json({ erro: "Membro não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
