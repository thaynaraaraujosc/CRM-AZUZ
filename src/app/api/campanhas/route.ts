import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RITMO, preverDuracao, type CanalCampanha } from "@/lib/campanhas/ritmo";
import { resolverParametros, type MapeamentoVariavel } from "@/lib/campanhas/variaveis";
import { destinoDoContato, resolverAudiencia, type Audiencia } from "@/lib/campanhas/audiencia";
import { contaConectada, limiteDiarioDaConta } from "@/lib/integracoes/whatsapp-oficial";

/** GET lista as campanhas do workspace com a contagem de cada situação, mais recentes primeiro. */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const campanhas = await prisma.campanha.findMany({
    where: { workspaceId: sessao.user.workspaceId },
    orderBy: { criadoEm: "desc" },
    take: 50,
  });

  // Contagem por situação, numa consulta só: sem isso seria uma consulta por campanha.
  const contagens = await prisma.campanhaDestinatario.groupBy({
    by: ["campanhaId", "status"],
    where: { campanhaId: { in: campanhas.map((c) => c.id) } },
    _count: { _all: true },
  });

  // "Respondidas" não é um status (a pessoa respondeu DEPOIS de lido/entregue), é uma marca à
  // parte: por isso a segunda contagem.
  const respostas = await prisma.campanhaDestinatario.groupBy({
    by: ["campanhaId"],
    where: { campanhaId: { in: campanhas.map((c) => c.id) }, respondidoEm: { not: null } },
    _count: { _all: true },
  });

  const porCampanha = new Map<string, Record<string, number>>();
  for (const linha of contagens) {
    const atual = porCampanha.get(linha.campanhaId) ?? {};
    atual[linha.status] = linha._count._all;
    porCampanha.set(linha.campanhaId, atual);
  }
  for (const linha of respostas) {
    const atual = porCampanha.get(linha.campanhaId) ?? {};
    atual.respondido = linha._count._all;
    porCampanha.set(linha.campanhaId, atual);
  }

  return NextResponse.json(
    campanhas.map((c) => ({ ...c, contagem: porCampanha.get(c.id) ?? {} })),
    { headers: { "cache-control": "private, no-store" } },
  );
}

type CorpoCriar = {
  titulo: string;
  corpo: string;
  assunto?: string;
  canal: CanalCampanha;
  templateNome?: string;
  templateIdioma?: string;
  /** Template do CRM de onde a mensagem saiu (só pra exibir depois). */
  templateId?: string;
  /** Como cada `{{variável}}` é preenchida. Ver `src/lib/campanhas/variaveis.ts`. */
  variaveis?: MapeamentoVariavel[];
  /** Como o público foi escolhido. Quando vem, o servidor resolve a lista (ver `audiencia.ts`). */
  audiencia?: Audiencia;
  agendadaPara?: string;
  /** Nomes dos contatos, como aparecem na tela: alternativa a `audiencia` (compatibilidade). */
  contatos?: string[];
};

/**
 * POST cria a campanha e a fila inteira numa transação.
 *
 * Toda a fila é gravada AGORA, antes de qualquer envio. É isso que dá idempotência sem gambiarra:
 * o par (campanha, contato) é único no banco, então clicar duas vezes, dar F5 no meio ou repetir a
 * chamada por timeout não cria destinatário repetido. A segunda tentativa esbarra na restrição.
 *
 * O destino (telefone/e-mail) é resolvido e CONGELADO aqui. Buscar na hora do envio seria pior: uma
 * campanha de vários dias sobrevive a edições do contato, e a mensagem sairia pra um número que já
 * não é mais aquele: ou pra lugar nenhum, se alguém apagou o contato no meio.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const corpo = (await request.json()) as CorpoCriar;

  if (!corpo.canal || !RITMO[corpo.canal]) {
    return NextResponse.json({ erro: "Canal inválido." }, { status: 400 });
  }

  // Template do CRM: quando vem, é ELE a fonte do texto, do assunto e do modelo da Meta. A tela
  // não manda o corpo de um template. Mandar deixaria a pessoa (ou um bug) enviar um texto
  // diferente do que a Meta aprovou.
  let variaveis = Array.isArray(corpo.variaveis) ? corpo.variaveis : [];
  let texto = (corpo.corpo ?? "").trim();
  let assunto = corpo.assunto?.trim() || null;
  let templateNome = corpo.templateNome || null;
  let templateIdioma = corpo.templateIdioma || null;
  if (corpo.templateId) {
    const template = await prisma.template.findFirst({ where: { id: corpo.templateId, workspaceId } });
    if (!template) return NextResponse.json({ erro: "Template não encontrado." }, { status: 404 });
    if (template.canal !== corpo.canal) return NextResponse.json({ erro: "Este template é de outro canal." }, { status: 400 });
    if (template.status !== "aprovado") return NextResponse.json({ erro: "Só template aprovado pode ser disparado." }, { status: 400 });
    texto = template.corpo;
    assunto = template.assunto;
    // Origem/valor de cada variável pode ter sido ajustada na tela do disparo; chave e índice não.
    const doTemplate = (Array.isArray(template.variaveis) ? template.variaveis : []) as MapeamentoVariavel[];
    const ajustes = new Map(variaveis.map((v) => [v.chave, v]));
    variaveis = doTemplate.map((v) => {
      const ajuste = ajustes.get(v.chave);
      return ajuste ? { ...v, origem: ajuste.origem, valor: ajuste.valor } : v;
    });
    if (template.whatsappTemplateId) {
      const espelho = await prisma.whatsappTemplate.findFirst({ where: { id: template.whatsappTemplateId, workspaceId } });
      if (!espelho) return NextResponse.json({ erro: "O modelo deste template não foi encontrado na Meta." }, { status: 409 });
      templateNome = espelho.nome;
      templateIdioma = espelho.idioma;
    }
  }

  // WhatsApp oficial fala com quem não escreveu primeiro: fora da janela de 24h a Meta só aceita
  // modelo aprovado. Recusar aqui evita uma campanha inteira de "falhou" com o código 131047.
  // No Instagram só existe UM público legítimo, e é o servidor que impõe isso: a janela de 24
  // horas. Aceitar "todos os contatos" aqui produziria uma campanha em que a esmagadora maioria
  // das mensagens é recusada pela Meta, uma a uma, sujando a conta com erro previsível.
  if (corpo.canal === "instagram" && corpo.audiencia?.modo !== "janela_instagram") {
    return NextResponse.json(
      { erro: "No Instagram o disparo só vale pra quem escreveu no Direct nas últimas 24 horas." },
      { status: 400 },
    );
  }

  if (corpo.canal === "whatsapp_oficial" && !templateNome) {
    return NextResponse.json({ erro: "No WhatsApp API Oficial o disparo precisa de um template aprovado pela Meta." }, { status: 400 });
  }
  if (!texto) return NextResponse.json({ erro: "Escreva a mensagem ou escolha um template." }, { status: 400 });
  if (corpo.canal === "email" && !assunto) {
    return NextResponse.json({ erro: "E-mail precisa de assunto." }, { status: 400 });
  }
  const titulo = (corpo.titulo ?? "").trim() || texto.split("\n")[0].slice(0, 60);

  // Público: resolvido no servidor a partir da descrição (ou da lista de nomes, no caminho antigo).
  // É a mesma resolução da prévia. O que a tela mostrou é o que vai receber.
  const audiencia: Audiencia | null = corpo.audiencia?.modo
    ? corpo.audiencia
    : corpo.contatos?.length
      ? { modo: "selecionados", nomes: corpo.contatos }
      : null;
  if (!audiencia) return NextResponse.json({ erro: "Escolha o público." }, { status: 400 });
  const contatos = await resolverAudiencia(workspaceId, audiencia);

  const destinos: { contatoNome: string; destino: string; parametros: Record<string, string> }[] = [];
  const semDestino: string[] = [];
  for (const c of contatos) {
    const destino = destinoDoContato(c, corpo.canal);
    if (destino) {
      // Valores das variáveis DESTA pessoa, congelados agora: pelo mesmo motivo do destino.
      destinos.push({ contatoNome: c.nome, destino, parametros: resolverParametros(variaveis, c) });
    } else {
      semDestino.push(c.nome);
    }
  }

  if (!destinos.length) {
    return NextResponse.json(
      {
        erro:
          corpo.canal === "email"
            ? "Nenhum dos contatos selecionados tem e-mail cadastrado."
            : corpo.canal === "instagram"
              ? "Ninguém escreveu no Direct nas últimas 24 horas, ou os contatos ainda não têm o identificador do Instagram. Fora da janela o Instagram recusa a mensagem."
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
        titulo,
        corpo: texto,
        assunto,
        canal: corpo.canal,
        templateNome,
        templateIdioma,
        templateId: corpo.templateId || null,
        variaveis: variaveis as never,
        audiencia: audiencia as never,
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
        parametros: d.parametros as never,
      })),
    }),
  ]);

  // Previsão com a cota REAL da conta no WhatsApp oficial (lida da Meta), não um chute.
  let limiteDiario: number | null | undefined;
  if (corpo.canal === "whatsapp_oficial") {
    const conta = await contaConectada(workspaceId);
    if (conta) limiteDiario = (await limiteDiarioDaConta(conta)).porDia;
  }
  const previsao = preverDuracao(corpo.canal, destinos.length, limiteDiario);

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
