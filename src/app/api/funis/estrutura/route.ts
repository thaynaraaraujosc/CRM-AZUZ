import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { lerCorDaEtapa, lerDicas } from "@/lib/funil/etapa-aparencia";
import { numerosDeWhatsApp } from "@/lib/integracoes/numeros-de-whatsapp";

/**
 * Criar e apagar funil/etapa: gravado na hora, e não pelo PUT de estado inteiro.
 *
 * Criar era a operação mais frágil do módulo: dependia de um PUT debouçado que reconciliava o funil
 * inteiro dentro de uma transação única. Qualquer falha em qualquer parte descartava tudo. E como
 * o cliente não olhava a resposta, o funil novo simplesmente não existia depois do F5, sem erro,
 * sem aviso, sem pista.
 *
 * A exclusão vive aqui pelo motivo oposto: ela precisa PODER RECUSAR. `FunilEtapa` e `NegocioCard`
 * têm `onDelete: Cascade` no banco, então apagar uma etapa levava junto todos os negócios dela,
 * silenciosamente e sem volta. Aqui a exclusão só acontece quando não há negócio pendurado, ou
 * quando quem chama diz explicitamente para onde mover os que existem.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const corpo = (await request.json()) as {
    tipo?: "funil" | "etapa";
    id?: string;
    nome?: string;
    responsavel?: string | null;
    /** De qual número é este funil. Só na CRIAÇÃO: não há rota que o altere. */
    contaCanal?: string | null;
    funilId?: string;
    etapas?: { id: string; titulo: string }[];
    /** Onde a etapa entra. Ausente = no fim, que é como sempre foi. */
    ordem?: number;
  };

  if (corpo.tipo === "funil") {
    if (!corpo.id || !corpo.nome) {
      return NextResponse.json({ erro: "id e nome são obrigatórios" }, { status: 400 });
    }

    /*
     * O NÚMERO DO FUNIL, CONFERIDO AQUI — não só no seletor da tela.
     *
     * "Nenhum funil pode ter mais do que um número. Não pode receber mensagens de WhatsApps
     * diferentes." A tela já oferece só o que pode ser escolhido, mas a tela é o navegador: duas
     * abas abertas criando funil ao mesmo tempo passariam as duas pelo seletor e chegariam aqui
     * com o mesmo número. Duas caixas de entrada disputando o mesmo quadro fazem metade dos leads
     * sumir de um deles sem explicação nenhuma.
     *
     * Conferido contra as conexões DESTA empresa: um `contaCanal` qualquer vindo do corpo faria o
     * funil dizer que é de uma conexão que não existe, e nada cairia nele.
     */
    let contaCanal: string | null = null;
    if (corpo.contaCanal) {
      const chavesConectadas = new Set(
        (await numerosDeWhatsApp(workspaceId)).map((n) => n.chave).filter(Boolean),
      );
      if (!chavesConectadas.has(corpo.contaCanal)) {
        return NextResponse.json({ erro: "Esse número não está conectado nesta conta." }, { status: 400 });
      }
      const jaTem = await prisma.funil.findFirst({
        where: { workspaceId, contaCanal: corpo.contaCanal },
        select: { nome: true },
      });
      if (jaTem) {
        return NextResponse.json(
          { erro: `Esse número já é do funil "${jaTem.nome}". Cada número tem um funil só.` },
          { status: 409 },
        );
      }
      contaCanal = corpo.contaCanal;
    }

    await prisma.funil.create({
      data: {
        id: corpo.id,
        workspaceId,
        nome: corpo.nome,
        responsavel: corpo.responsavel ?? null,
        contaCanal,
        etapas: {
          create: (corpo.etapas ?? []).map((etapa, ordem) => ({
            id: etapa.id,
            workspaceId,
            titulo: etapa.titulo,
            ordem,
          })),
        },
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (corpo.tipo === "etapa") {
    if (!corpo.id || !corpo.nome || !corpo.funilId) {
      return NextResponse.json({ erro: "id, nome e funilId são obrigatórios" }, { status: 400 });
    }
    // O funil precisa ser desta empresa. Id de outro workspace não vira etapa aqui.
    const funil = await prisma.funil.findFirst({ where: { id: corpo.funilId, workspaceId }, select: { id: true } });
    if (!funil) return NextResponse.json({ erro: "Funil não encontrado." }, { status: 404 });

    const ultima = await prisma.funilEtapa.findFirst({
      where: { funilId: corpo.funilId },
      orderBy: { ordem: "desc" },
      select: { ordem: true },
    });
    const noFim = (ultima?.ordem ?? -1) + 1;

    /*
     * ETAPA NO MEIO DO FUNIL, e não só no fim.
     *
     * O funil é uma esteira: "Follow up" entre "Novo" e "Qualificado" não é a mesma coisa que
     * "Follow up" depois de "Fechado". Antes a etapa nascia sempre no fim e a pessoa arrastava —
     * e na grade de automação, onde não há arraste, ela simplesmente não tinha como pôr no lugar
     * certo.
     *
     * As duas escritas na MESMA transação: abrir espaço e não criar a etapa deixaria o funil com
     * um buraco na numeração, e criar sem abrir espaço deixaria duas etapas na mesma ordem — as
     * duas aparecendo em posição imprevisível, porque a leitura ordena por `ordem`.
     */
    const posicao = Number.isInteger(corpo.ordem) ? Math.max(0, Math.min(corpo.ordem!, noFim)) : noFim;

    await prisma.$transaction([
      ...(posicao < noFim
        ? [
            prisma.funilEtapa.updateMany({
              where: { funilId: corpo.funilId, ordem: { gte: posicao } },
              data: { ordem: { increment: 1 } },
            }),
          ]
        : []),
      prisma.funilEtapa.create({
        data: {
          id: corpo.id,
          workspaceId,
          funilId: corpo.funilId,
          titulo: corpo.nome,
          ordem: posicao,
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ erro: "tipo inválido" }, { status: 400 });
}

/**
 * Apaga uma etapa ou um funil. Recusando quando há negócio dentro.
 *
 * `?destinoEtapaId=` move os negócios antes de apagar. Sem ele, e havendo negócios, a resposta é
 * 409 com a contagem: quem chama decide o que fazer, em vez de descobrir depois que os leads
 * sumiram junto.
 */
export async function DELETE(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const url = new URL(request.url);
  const tipo = url.searchParams.get("tipo");
  const id = url.searchParams.get("id");
  const destinoEtapaId = url.searchParams.get("destinoEtapaId");
  if (!id || (tipo !== "funil" && tipo !== "etapa")) {
    return NextResponse.json({ erro: "tipo e id são obrigatórios" }, { status: 400 });
  }

  const onde = tipo === "etapa" ? { workspaceId, etapaId: id } : { workspaceId, etapa: { funilId: id } };

  const negocios = await prisma.negocioCard.count({ where: onde });

  if (negocios > 0) {
    if (!destinoEtapaId) {
      return NextResponse.json(
        {
          erro:
            `Existem ${negocios} negócios aqui dentro. Escolha para onde movê-los antes de apagar. ` +
            "apagar levaria o histórico deles junto.",
          negocios,
          precisaDestino: true,
        },
        { status: 409 },
      );
    }
    const destino = await prisma.funilEtapa.findFirst({
      where: { id: destinoEtapaId, workspaceId },
      select: { id: true },
    });
    if (!destino) return NextResponse.json({ erro: "Etapa de destino não encontrada." }, { status: 400 });

    await prisma.negocioCard.updateMany({ where: onde, data: { etapaId: destinoEtapaId } });
  }

  if (tipo === "etapa") {
    await prisma.funilEtapa.deleteMany({ where: { id, workspaceId } });
  } else {
    await prisma.funil.deleteMany({ where: { id, workspaceId } });
  }

  return NextResponse.json({ ok: true, movidos: negocios });
}

/**
 * MUDA O QUE A ETAPA É, sem mexer no que ela contém.
 *
 * Três coisas, e as três são de quem MONTA o funil, não de quem o usa no dia: a ordem das etapas,
 * a cor de uma etapa e as dicas dela. Ficam aqui, junto de criar e apagar, porque são todas
 * ESTRUTURA — o `PUT /api/funis` reconcilia o conteúdo (os negócios, suas posições) e misturar as
 * duas coisas foi o que já tornou a criação frágil uma vez.
 */
export async function PATCH(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const corpo = (await request.json().catch(() => null)) as {
    tipo?: "ordem-etapas" | "aparencia-etapa";
    funilId?: string;
    ids?: unknown;
    etapaId?: string;
    cor?: unknown;
    dicas?: unknown;
  } | null;

  if (corpo?.tipo === "ordem-etapas") {
    const ids = Array.isArray(corpo.ids) ? corpo.ids.filter((x): x is string => typeof x === "string") : [];
    if (!corpo.funilId || !ids.length) {
      return NextResponse.json({ erro: "funilId e ids são obrigatórios" }, { status: 400 });
    }

    /*
     * SÓ AS ETAPAS DESTE FUNIL, E TODAS ELAS.
     *
     * Gravar uma lista parcial deixaria as que ficaram de fora com a ordem antiga, colidindo com
     * as novas — duas etapas na mesma posição aparecem em ordem imprevisível, porque a leitura
     * ordena por `ordem`. E um id de outro funil (ou de outra empresa) reordenaria o funil errado.
     */
    const doFunil = await prisma.funilEtapa.findMany({
      where: { workspaceId, funilId: corpo.funilId },
      select: { id: true },
    });
    const conhecidas = new Set(doFunil.map((e) => e.id));
    const limpos = ids.filter((id) => conhecidas.has(id));
    if (limpos.length !== doFunil.length) {
      return NextResponse.json(
        { erro: "A lista precisa ter exatamente as etapas deste funil." },
        { status: 400 },
      );
    }

    await prisma.$transaction(
      limpos.map((id, ordem) =>
        prisma.funilEtapa.update({ where: { id }, data: { ordem } }),
      ),
    );
    return NextResponse.json({ ok: true });
  }

  if (corpo?.tipo === "aparencia-etapa") {
    if (!corpo.etapaId) return NextResponse.json({ erro: "etapaId é obrigatório" }, { status: 400 });

    // A etapa precisa ser desta empresa: sem esta linha, um id adivinhado pintaria o funil de
    // outro cliente.
    const etapa = await prisma.funilEtapa.findFirst({
      where: { id: corpo.etapaId, workspaceId },
      select: { id: true },
    });
    if (!etapa) return NextResponse.json({ erro: "Etapa não encontrada." }, { status: 404 });

    const dados: Prisma.FunilEtapaUpdateInput = {};
    // `null` explícito é "volte pra cor automática"; ausente é "não mexa nisso".
    if (corpo.cor !== undefined) dados.cor = corpo.cor === null ? null : lerCorDaEtapa(corpo.cor);
    // `DbNull` e não `null`: numa coluna Json, `null` do Prisma significa o VALOR nulo do JSON, e
    // `DbNull` significa a coluna vazia. Apagar as dicas é a segunda coisa.
    if (corpo.dicas !== undefined) {
      const limpas = lerDicas(corpo.dicas);
      dados.dicas = limpas ? (limpas as Prisma.InputJsonValue) : Prisma.DbNull;
    }

    await prisma.funilEtapa.update({ where: { id: corpo.etapaId }, data: dados });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ erro: "tipo inválido" }, { status: 400 });
}
