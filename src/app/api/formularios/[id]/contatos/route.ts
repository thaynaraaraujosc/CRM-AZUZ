import { NextResponse } from "next/server";

import type { Contato } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import {
  POLITICAS,
  TAMANHO_MAXIMO,
  contarChamada,
  corpoGrandeDemais,
  ipDeQuemChamou,
  respostaDeCorpoGrande,
  respostaDeLimiteExcedido,
} from "@/lib/seguranca/limite-de-uso";
import { slugId } from "@/lib/ids";
import { somenteCamposDeContato } from "@/lib/contatos/campos-editaveis";

function iniciais(nome: string) {
  return nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function paraContato(linha: { etiquetas: unknown; [k: string]: unknown }): Contato {
  return {
    ...linha,
    etiquetas: Array.isArray(linha.etiquetas) ? (linha.etiquetas as string[]) : undefined,
  } as Contato;
}

/**
 * POST público (sem `auth()`). Equivalente de `POST /api/contatos`, mas pro fluxo de
 * `/formulario-preview`: cria/atualiza o contato do lead que respondeu, no workspace do
 * formulário (resolvido aqui, nunca enviado pelo cliente). Mesma semântica de upsert-por-nome.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/formularios/[id]/contatos">) {
  // Rota PÚBLICA (o lead que responde não tem login). Sem limite, ela vira um jeito grátis de
  // encher a base de um cliente de contato falso, e sem teto de tamanho um corpo gigante derruba o
  // processo inteiro, não só esta chamada.
  if (corpoGrandeDemais(request, TAMANHO_MAXIMO.formulario)) return respostaDeCorpoGrande();
  const ip = await ipDeQuemChamou();
  const limite = contarChamada(`formulario-publico:${ip}`, POLITICAS.formularioPublico);
  if (!limite.permitido) return respostaDeLimiteExcedido(limite.esperarSegundos);

  const { id } = await ctx.params;
  const formulario = await prisma.formulario.findUnique({ where: { id }, select: { workspaceId: true } });
  if (!formulario) return NextResponse.json({ erro: "Formulário não encontrado" }, { status: 404 });
  const workspaceId = formulario.workspaceId;

  const body = (await request.json()) as {
    nome: string;
    dados?: Partial<Contato> & Record<string, unknown>;
    origemPadrao?: Contato["origem"];
  };
  const { nome, dados = {}, origemPadrao = "Formulário" } = body;
  if (!nome) {
    return NextResponse.json({ erro: "Campo obrigatório: nome" }, { status: 400 });
  }

  const existente = await prisma.contato.findUnique({ where: { workspaceId_nome: { workspaceId, nome } } });
  const linha = existente
    ? await prisma.contato.update({
        where: { workspaceId_nome: { workspaceId, nome } },
        // Lista fechada: espalhar o corpo deixava o navegador gravar `workspaceId` e mover o
      // contato pra outra empresa. Ver `campos-editaveis.ts`.
      data: somenteCamposDeContato(dados),
      })
    : await prisma.contato.create({
        data: {
          id: `${workspaceId}-${slugId(nome)}`,
          workspaceId,
          initials: iniciais(nome),
          nome,
          origem: origemPadrao,
          etapa: "Novo",
          responsavel: "-",
          ultima: "Agora",
          valor: "-",
          ...dados,
          etiquetas: dados.etiquetas ?? undefined,
        },
      });

  return NextResponse.json(paraContato(linha), { status: existente ? 200 : 201 });
}
