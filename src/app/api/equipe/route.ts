import { NextResponse } from "next/server";

import type { Membro } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { slugId } from "@/lib/ids";
import { enviarEmailContandoFalha, templateConvite } from "@/lib/email";
import { exigirAdmin, exigirSessao } from "@/lib/seguranca/sessao";
import { auditar } from "@/lib/seguranca/auditoria";
import { VALIDADE_CONVITE_MS, gerarTokenConvite, hashDoToken } from "@/lib/equipe/convite";

/**
 * Os campos de Membro que podem sair daqui.
 *
 * LISTA FECHADA, e esse é o ponto. Antes a rota devolvia a linha inteira do banco, o que incluía
 * `senha`: o hash bcrypt de cada pessoa da equipe ia pro navegador de qualquer colega logado, de
 * onde dá pra tentar quebrar a senha offline, sem limite e sem deixar rastro. `conviteTokenHash`
 * fica de fora pelo mesmo motivo.
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
  const guarda = await exigirSessao();
  if (!guarda.ok) return guarda.resposta;

  const linhas = await prisma.membro.findMany({
    where: { workspaceId: guarda.workspaceId },
    orderBy: { criadoEm: "asc" },
    select: CAMPOS_PUBLICOS,
  });
  return NextResponse.json(linhas.map(paraMembro));
}

/**
 * POST cria um convite de membro novo.
 *
 * Só ADMIN do workspace. Antes bastava estar logado: qualquer membro comum criava contas novas no
 * workspace, com o papel e as permissões que quisesse dar a elas, inclusive admin. Convidar gente
 * pra dentro da empresa é ação de dono da conta.
 */
export async function POST(request: Request) {
  const guarda = await exigirAdmin();
  if (!guarda.ok) return guarda.resposta;
  const { sessao, workspaceId } = guarda;

  const dados = (await request.json()) as Pick<
    Membro,
    "nome" | "email" | "papel" | "papelTipo" | "papelNota" | "enxerga" | "permissoes"
  >;
  if (!dados.nome || !dados.email) {
    return NextResponse.json({ erro: "Campos obrigatórios: nome, email" }, { status: 400 });
  }
  const email = String(dados.email).trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ erro: "E-mail inválido." }, { status: 400 });
  }
  // Valores permitidos, conferidos no servidor: um `papelTipo` inventado pelo navegador viraria um
  // papel que nenhuma regra do CRM sabe avaliar.
  if (!["admin", "padrao", "custom"].includes(dados.papelTipo)) {
    return NextResponse.json({ erro: "Tipo de papel inválido." }, { status: 400 });
  }

  /*
   * O id não pode mais ser só o slug do nome.
   *
   * `Membro.id` é chave primária global e vinha de `slugId(nome)`. Duas empresas diferentes com um
   * "João Silva" colidiam, e a rota devolvia PRA UMA o registro da OUTRA (com e-mail, papel,
   * permissões e o hash da senha). Vazamento entre workspaces pelo caminho mais banal possível:
   * dois clientes com um funcionário de mesmo nome.
   *
   * Agora a busca por duplicata é dentro do workspace, e o id ganha sufixo até não colidir com
   * ninguém. Ids já existentes continuam valendo: nada é renomeado.
   */
  const jaNoWorkspace = await prisma.membro.findFirst({
    where: { workspaceId, OR: [{ email }, { id: slugId(dados.nome) }] },
    select: CAMPOS_PUBLICOS,
  });
  if (jaNoWorkspace) return NextResponse.json(paraMembro(jaNoWorkspace));

  const emailEmUso = await prisma.membro.findUnique({ where: { email }, select: { id: true } });
  if (emailEmUso) {
    // Mesma frase de sempre, sem contar de qual empresa é a conta que já existe.
    return NextResponse.json({ erro: "Já existe uma conta com esse e-mail." }, { status: 409 });
  }

  const base = slugId(dados.nome) || "membro";
  let id = base;
  let sufixo = 2;
  while (await prisma.membro.findUnique({ where: { id }, select: { id: true } })) {
    id = `${base}-${sufixo}`;
    sufixo += 1;
  }

  const initials = dados.nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  // O token só existe em texto puro aqui e no link. O banco guarda o hash. Ver `equipe/convite.ts`.
  const token = gerarTokenConvite();

  const linha = await prisma.membro.create({
    data: {
      id,
      workspaceId,
      initials,
      nome: dados.nome,
      email,
      senha: null,
      papel: dados.papel,
      papelTipo: dados.papelTipo,
      papelNota: dados.papelNota,
      leads: "-",
      enxerga: dados.enxerga,
      permissoes: dados.permissoes,
      ativo: false,
      convitePendente: true,
      conviteTokenHash: hashDoToken(token),
      conviteExpiraEm: new Date(Date.now() + VALIDADE_CONVITE_MS),
    },
    select: CAMPOS_PUBLICOS,
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
  await auditar({
    acao: "membro.convidado",
    workspaceId,
    membroId: sessao.user.id,
    email: sessao.user.email,
    recurso: id,
    detalhe: `papel ${dados.papelTipo}`,
  });

  const link = `${process.env.APP_URL ?? "https://azuzcrm.com.br"}/convite/${id}?t=${token}`;
  const envio = await enviarEmailContandoFalha({
    to: email,
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
