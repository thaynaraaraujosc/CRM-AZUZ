import { NextResponse } from "next/server";

import type { Contato } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { slugId } from "@/lib/ids";

function iniciais(nome: string) {
  return nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

/** Linha do banco -> `Contato` do front — só o formato de `etiquetas` (JSON no banco) muda. */
function paraContato(linha: { etiquetas: unknown; [k: string]: unknown }): Contato {
  return {
    ...linha,
    etiquetas: Array.isArray(linha.etiquetas) ? (linha.etiquetas as string[]) : undefined,
  } as Contato;
}

/** GET lista todos os contatos. */
export async function GET() {
  const linhas = await prisma.contato.findMany({ orderBy: { criadoEm: "asc" } });
  return NextResponse.json(linhas.map(paraContato));
}

/**
 * POST faz upsert por `nome` — mesma semântica que `salvarDadosContato`/`atribuirAtendente`/
 * `criarContato` já tinham no Context (ver contatos-context.tsx): cria com valores padrão se o
 * nome ainda não existe, ou funde os dados enviados se já existe.
 */
export async function POST(request: Request) {
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

  const existente = await prisma.contato.findUnique({ where: { nome } });
  const linha = existente
    ? await prisma.contato.update({
        where: { nome },
        data: { ...dados, etiquetas: dados.etiquetas ?? undefined },
      })
    : await prisma.contato.create({
        data: {
          id: slugId(nome),
          initials: iniciais(nome),
          nome,
          origem: origemPadrao,
          etapa: "Novo",
          responsavel: "—",
          ultima: "Agora",
          valor: "—",
          ...dados,
          etiquetas: dados.etiquetas ?? undefined,
        },
      });

  return NextResponse.json(paraContato(linha), { status: existente ? 200 : 201 });
}
