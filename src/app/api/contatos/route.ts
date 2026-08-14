import { NextResponse } from "next/server";

import type { Contato } from "@/lib/data";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encontrarContatoPorTelefone, upsertContato } from "@/lib/contatos/upsert";

/** Linha do banco -> `Contato` do front — só o formato de `etiquetas` (JSON no banco) muda. */
function paraContato(linha: { etiquetas: unknown; [k: string]: unknown }): Contato {
  return {
    ...linha,
    etiquetas: Array.isArray(linha.etiquetas) ? (linha.etiquetas as string[]) : undefined,
  } as Contato;
}

/** GET lista os contatos do workspace de quem está logado. */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const linhas = await prisma.contato.findMany({
    where: { workspaceId: sessao.user.workspaceId },
    orderBy: { criadoEm: "asc" },
  });
  return NextResponse.json(linhas.map(paraContato));
}

/**
 * POST faz upsert por `nome` dentro do workspace — mesma semântica que
 * `salvarDadosContato`/`atribuirAtendente`/`criarContato` já tinham no Context (ver
 * contatos-context.tsx): cria com valores padrão se o nome ainda não existe nesse workspace, ou
 * funde os dados enviados se já existe.
 *
 * Dedupe por telefone: se o `nome` ainda não existe mas o `whatsapp` enviado já bate (comparação
 * normalizada) com outro Contato já cadastrado, mescla nele em vez de criar um segundo registro
 * "órfão" pro mesmo número — devolve `mesclado: true` pra UI avisar o usuário.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const body = (await request.json()) as {
    nome: string;
    dados?: Partial<Contato> & Record<string, unknown>;
    /** Origem só aplicada se o contato ainda não existir — ex.: `/formulario-preview` usa
     * "Formulário" aqui, sem afetar a origem de um contato já existente que responde de novo. */
    origemPadrao?: Contato["origem"];
  };
  const { nome, dados = {}, origemPadrao = "Indicação" } = body;
  if (!nome) {
    return NextResponse.json({ erro: "Campo obrigatório: nome" }, { status: 400 });
  }

  const jaExistePorNome = await prisma.contato.findUnique({ where: { workspaceId_nome: { workspaceId, nome } } });
  const duplicataPorTelefone =
    !jaExistePorNome && dados.whatsapp ? await encontrarContatoPorTelefone(workspaceId, dados.whatsapp) : null;

  if (duplicataPorTelefone) {
    const linha = await prisma.contato.update({
      where: { id: duplicataPorTelefone.id },
      data: { ...dados, etiquetas: dados.etiquetas ?? undefined },
    });
    return NextResponse.json({ ...paraContato(linha), mesclado: true });
  }

  const linha = await upsertContato({ workspaceId, nome, dados, origemPadrao });
  return NextResponse.json(paraContato(linha), { status: jaExistePorNome ? 200 : 201 });
}
