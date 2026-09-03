import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RITMO, preverDuracao, type CanalCampanha } from "@/lib/campanhas/ritmo";

/** GET lista as campanhas do workspace com a contagem de cada situação, mais recentes primeiro. */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const campanhas = await prisma.campanha.findMany({
    where: { workspaceId: sessao.user.workspaceId },
    orderBy: { criadoEm: "desc" },
    take: 50,
  });

  // Contagem por situação, numa consulta só — sem isso seria uma consulta por campanha.
  const contagens = await prisma.campanhaDestinatario.groupBy({
    by: ["campanhaId", "status"],
    where: { campanhaId: { in: campanhas.map((c) => c.id) } },
    _count: { _all: true },
  });

  const porCampanha = new Map<string, Record<string, number>>();
  for (const linha of contagens) {
    const atual = porCampanha.get(linha.campanhaId) ?? {};
    atual[linha.status] = linha._count._all;
    porCampanha.set(linha.campanhaId, atual);
  }

  return NextResponse.json(
    campanhas.map((c) => ({ ...c, contagem: porCampanha.get(c.id) ?? {} })),
  );
}

type CorpoCriar = {
  titulo: string;
  corpo: string;
  assunto?: string;
  canal: CanalCampanha;
  templateNome?: string;
  templateIdioma?: string;
  agendadaPara?: string;
  /** Nomes dos contatos, como aparecem na tela. */
  contatos: string[];
};

/**
 * POST cria a campanha e a fila inteira numa transação.
 *
 * Toda a fila é gravada AGORA, antes de qualquer envio. É isso que dá idempotência sem gambiarra:
 * o par (campanha, contato) é único no banco, então clicar duas vezes, dar F5 no meio ou repetir a
 * chamada por timeout não cria destinatário repetido — a segunda tentativa esbarra na restrição.
 *
 * O destino (telefone/e-mail) é resolvido e CONGELADO aqui. Buscar na hora do envio seria pior: uma
 * campanha de vários dias sobrevive a edições do contato, e a mensagem sairia pra um número que já
 * não é mais aquele — ou pra lugar nenhum, se alguém apagou o contato no meio.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const corpo = (await request.json()) as CorpoCriar;

  console.log("📨 POST /api/campanhas - Recebido:", {
    titulo: corpo.titulo?.slice(0, 20),
    canal: corpo.canal,
    canalType: typeof corpo.canal,
    contatosCount: corpo.contatos?.length,
    canaisDisp: Object.keys(RITMO)
  });

  if (!corpo.titulo?.trim() || !corpo.corpo?.trim() || !corpo.canal || !corpo.contatos?.length) {
    console.error("❌ Validação básica falhou");
    return NextResponse.json({ erro: "Título, mensagem, canal e contatos são obrigatórios." }, { status: 400 });
  }
  if (!RITMO[corpo.canal]) {
    console.error("❌ Canal inválido:", { canal: corpo.canal, ritmoKeys: Object.keys(RITMO) });
    return NextResponse.json({ erro: "Canal inválido." }, { status: 400 });
  }
  if (corpo.canal === "email" && !corpo.assunto?.trim()) {
    return NextResponse.json({ erro: "E-mail precisa de assunto." }, { status: 400 });
  }

  // Resolve nome -> destino. Quem não tem o dado do canal escolhido fica de fora e é DEVOLVIDO na
  // resposta: campanha que ignora em silêncio faz a pessoa achar que mandou pra lista inteira.
  const contatos = await prisma.contato.findMany({
    where: { workspaceId, nome: { in: corpo.contatos } },
    select: { nome: true, whatsapp: true, email: true },
  });

  const destinos: { contatoNome: string; destino: string }[] = [];
  const semDestino: string[] = [];
  for (const nome of corpo.contatos) {
    const c = contatos.find((x) => x.nome === nome);
    const destino = corpo.canal === "email" ? c?.email : c?.whatsapp;
    if (destino?.trim()) destinos.push({ contatoNome: nome, destino: destino.trim() });
    else semDestino.push(nome);
  }

  if (!destinos.length) {
    return NextResponse.json(
      {
        erro:
          corpo.canal === "email"
            ? "Nenhum dos contatos selecionados tem e-mail cadastrado."
            : "Nenhum dos contatos selecionados tem WhatsApp cadastrado.",
      },
      { status: 400 },
    );
  }

  const id = `campanha-${workspaceId}-${Date.now()}`;
  const agendadaPara = corpo.agendadaPara ? new Date(corpo.agendadaPara) : new Date();

  await prisma.$transaction([
    prisma.campanha.create({
      data: {
        id,
        workspaceId,
        titulo: corpo.titulo.trim(),
        corpo: corpo.corpo,
        assunto: corpo.assunto?.trim() || null,
        canal: corpo.canal,
        templateNome: corpo.templateNome || null,
        templateIdioma: corpo.templateIdioma || null,
        agendadaPara,
        status: "agendada",
      },
    }),
    prisma.campanhaDestinatario.createMany({
      data: destinos.map((d, i) => ({
        id: `${id}-${i}`,
        campanhaId: id,
        workspaceId,
        contatoNome: d.contatoNome,
        destino: d.destino,
      })),
    }),
  ]);

  const previsao = preverDuracao(corpo.canal, destinos.length);

  return NextResponse.json(
    {
      id,
      destinatarios: destinos.length,
      semDestino,
      previsao,
      ritmo: RITMO[corpo.canal],
    },
    { status: 201 },
  );
}
