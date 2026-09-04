import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { contasCanalVisiveis, filtroContaCanal, provedoresConectados } from "@/lib/integracoes/conta-canal";

/**
 * GET lista as conversas do workspace de quem está logado, mais recentes primeiro — só as da(s)
 * conexão(ões) de WhatsApp conectada(s) agora (ver `conta-canal.ts`). Nada é apagado ao
 * desconectar: a conversa continua no banco e reaparece inteira se aquele número voltar.
 */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const contas = await contasCanalVisiveis(sessao.user.workspaceId);
  const provedores = await provedoresConectados(sessao.user.workspaceId);
  const filtro = filtroContaCanal(contas);

  // Conversa do Instagram aparece enquanto o Instagram estiver conectado, tenha ela conexão
  // marcada ou não. Sem isto, uma conversa criada antes dessa coluna existir (ou sem o
  // identificador gravado) caía na regra do WhatsApp e só apareceria com o QR Code conectado —
  // ficava invisível em Conversas enquanto o negócio dela continuava no funil. Ver o card órfão
  // que apareceu na tela: o mesmo contato existindo num lugar e não no outro.
  const where = provedores.includes("meta_instagram")
    ? { workspaceId: sessao.user.workspaceId, OR: [...filtro.OR ?? [{ contaCanal: filtro.contaCanal }], { canal: "Instagram" }] }
    : { workspaceId: sessao.user.workspaceId, ...filtro };

  const linhas = await prisma.conversa.findMany({
    where,
    orderBy: { atualizadoEm: "desc" },
    // A foto do contato ligado entra como reserva da foto da conversa — ver abaixo.
    include: { contatoVinculado: { select: { fotoUrl: true } } },
  });

  // Conversa sem foto herda a do contato. As duas colunas são preenchidas pelo mesmo webhook, mas
  // saem de sincronia sozinhas: quem já tinha conversa antes da foto passar a ser buscada ficou com
  // `Conversa.fotoUrl` nulo pra sempre, enquanto o contato ganhou a foto depois, por outro caminho.
  // O sintoma era o rosto aparecer no funil e a mesma pessoa continuar como iniciais em Conversas.
  const comFoto = linhas.map(({ contatoVinculado, ...c }) => ({
    ...c,
    fotoUrl: c.fotoUrl ?? contatoVinculado?.fotoUrl ?? null,
  }));

  // Segunda via, por NOME: nem toda conversa tem a FK preenchida (as criadas antes da coluna
  // existir, e as do Instagram quando "levar para o funil" está desligado, não têm contatoId).
  // Nesses casos o contato existe e tem a foto, só não está ligado — e é o mesmo nome dos dois
  // lados, porque quem cria os dois é o mesmo webhook.
  const semFoto = comFoto.filter((c) => !c.fotoUrl).map((c) => c.nome);
  if (semFoto.length) {
    const contatos = await prisma.contato.findMany({
      where: { workspaceId: sessao.user.workspaceId, nome: { in: semFoto }, fotoUrl: { not: null } },
      select: { nome: true, fotoUrl: true },
    });
    const porNome = new Map(contatos.map((c) => [c.nome, c.fotoUrl]));
    for (const c of comFoto) if (!c.fotoUrl) c.fotoUrl = porNome.get(c.nome) ?? null;
  }

  return NextResponse.json(comFoto);
}

/**
 * POST cria uma conversa individual vazia (sem mensagem ainda) — usado quando a usuária quer ser a
 * PRIMEIRA a escrever pra alguém, ex.: um participante de grupo que ela nunca conversou fora do
 * grupo. Se já existir uma conversa com esse `contato` (telefone) no workspace, devolve ela em vez
 * de duplicar.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { nome, contato, canal } = (await request.json()) as {
    nome?: string;
    contato?: string;
    canal?: string;
  };
  if (!nome?.trim() || !contato?.trim()) {
    return NextResponse.json({ erro: "nome e contato são obrigatórios" }, { status: 400 });
  }

  const existente = await prisma.conversa.findFirst({
    where: { workspaceId: sessao.user.workspaceId, contato: contato.trim(), ehGrupo: false },
  });
  if (existente) return NextResponse.json(existente);

  const iniciais =
    nome
      .trim()
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0])
      .join("")
      .toUpperCase() || "?";

  const criada = await prisma.conversa.create({
    data: {
      id: `conversa-${Date.now()}`,
      workspaceId: sessao.user.workspaceId,
      nome: nome.trim(),
      initials: iniciais,
      canal: canal ?? "WhatsApp",
      contato: contato.trim(),
    },
  });
  return NextResponse.json(criada);
}
