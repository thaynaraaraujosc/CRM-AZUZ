import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MODELOS_DE_ROBO } from "@/lib/automacoes/modelos-de-robo";

/**
 * Cria um robô VAZIO e devolve o id, pra a grade do funil abrir o editor nele.
 *
 * É o "+ Criar novo robô" do painel de gatilho. Existe pra não haver dois caminhos de criação: o
 * robô nasce como um `FluxoAutomacao` comum, na mesma tabela e com a mesma forma dos que a aba
 * Automações lista. Quem cria pelo funil e quem cria pela biblioteca criam a MESMA coisa, e é por
 * isso que o robô aparece nos dois lugares sem ninguém sincronizar nada.
 *
 * Nasce sem bloco de gatilho de propósito: quem dispara é a etapa. O motor sabe começar um fluxo
 * assim (o início é o único nó em que ninguém entra).
 *
 * Com `modeloId`, nasce com o fluxo do modelo já montado — uma CÓPIA editável, não um vínculo: a
 * partir daí ele é um robô como outro qualquer, e mexer nele não mexe no catálogo.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { nome, modeloId } = (await request.json().catch(() => ({}))) as {
    nome?: string;
    modeloId?: string;
  };

  /*
   * O MODELO VIRA UMA CÓPIA EDITÁVEL, montada aqui e não no navegador.
   *
   * A galeria manda só o id. Montar do lado do cliente obrigaria a mandar o fluxo inteiro pela
   * rede e a confiar nele: um `nodes` vindo do navegador é texto que alguém pode trocar, e ele
   * acabaria gravado como automação executável. Aqui o id é só um índice num catálogo que mora no
   * servidor.
   *
   * Id desconhecido cria o robô VAZIO em vez de recusar: a pessoa fica com um robô pra montar, em
   * vez de um erro e nada. O catálogo pode encolher entre a tela abrir e o clique acontecer.
   */
  const modelo = modeloId ? MODELOS_DE_ROBO.find((m) => m.id === modeloId) : undefined;
  const montado = modelo?.construir();

  const linha = await prisma.fluxoAutomacao.create({
    data: {
      id: `fluxo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      workspaceId: sessao.user.workspaceId,
      nome: nome?.trim() || modelo?.nome || "Novo robô",
      descricao: modelo?.objetivo ?? null,
      status: "rascunho",
      ativa: false,
      arquivada: false,
      nodes: (montado?.nodes ?? []) as object[],
      edges: (montado?.edges ?? []) as object[],
      versaoAtual: 0,
      configuracoes: (montado?.configuracoes ?? {}) as object,
      execucoes: 0,
      historicoVersoes: [],
      modeloDemonstracao: false,
    },
    select: { id: true, nome: true },
  });

  return NextResponse.json(linha, { status: 201 });
}
