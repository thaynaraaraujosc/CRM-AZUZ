import { NextResponse } from "next/server";

import type { Prisma } from "@/generated/prisma/client";
import type { Funil } from "@/lib/data";
import { auth } from "@/lib/auth";
import { lerDicas } from "@/lib/funil/etapa-aparencia";
import { ESCOPOS, escopoPermitido } from "@/lib/configuracoes/permissoes";
import { numerosDoFunil } from "@/lib/funis/numeros-do-funil";
import { montarFunilPadrao } from "@/lib/funil/funil-padrao";
import { avisarQueEntrouNaEtapa } from "@/lib/funil/entrou-na-etapa";
import { emSegundoPlano } from "@/lib/automacoes/segundo-plano";
import { prisma } from "@/lib/prisma";
import { filtroConexaoDeNegocio, provedoresDeNegocio } from "@/lib/integracoes/conta-canal";

/**
 * Cria o funil padrão quando a empresa não tem nenhum. Não faz nada quando já existe um.
 *
 * Os ids são derivados do workspace, então duas leituras simultâneas numa conta vazia não criam
 * dois funis: a segunda esbarra na chave duplicada. O erro é engolido de propósito — o resultado
 * que importa (existe um funil) é o mesmo, e derrubar a tela de Funil por causa de uma corrida
 * seria trocar uma tela branca por uma tela de erro.
 */
async function garantirFunilPadrao(workspaceId: string) {
  const quantos = await prisma.funil.count({ where: { workspaceId } });
  if (quantos > 0) return;

  const funil = montarFunilPadrao(workspaceId);
  try {
    await prisma.funil.create({
      data: {
        id: funil.id,
        workspaceId,
        nome: funil.nome,
        responsavel: null,
        etapas: {
          create: funil.etapas.map((e) => ({
            id: e.id,
            workspaceId,
            titulo: e.titulo,
            cor: e.cor,
            ordem: e.ordem,
          })),
        },
      },
    });
  } catch {
    // Outra requisição criou primeiro. A leitura abaixo traz o que ela criou.
  }
}

/** GET lista os funis do workspace de quem está logado, com etapas e negócios, na ordem salva. */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  // Mesmo filtro por conexão das conversas: negócio que nasceu de um canal desconectado some do
  // funil sem sair do banco, e volta inteiro se aquela conexão voltar (ver `conta-canal.ts`). Card
  // criado à mão tem `contaCanal` nulo e aparece sempre.
  const provedores = await provedoresDeNegocio(sessao.user.workspaceId);
  /*
   * CONTA SEM NENHUM FUNIL GANHA O PADRÃO AQUI, na primeira leitura.
   *
   * Toda conta nova passa a nascer com ele (ver `cadastro` e `admin/workspaces`), mas as que já
   * existiam nasceram sem — e pra elas não há outro momento em que isso possa acontecer: não há
   * migração que saiba o que é "um funil bom", e pedir pra cada cliente montar o dele do zero é
   * justamente o que esta mudança existe pra evitar. Então a correção mora na leitura.
   *
   * É seguro porque só roda quando a empresa tem ZERO funis: quem apagou todos de propósito
   * ganha o padrão de volta, o que é melhor do que uma tela branca, e qualquer funil existente
   * (mesmo vazio de etapas) impede que isto rode.
   */
  await garantirFunilPadrao(sessao.user.workspaceId);

  /*
   * O RECORTE DE FUNIS DESTA PESSOA, aplicado no servidor.
   *
   * "Às vezes eu quero que esse funcionário veja apenas o funil dele. Eu não quero que ele veja os
   * outros funis, porque ele pode cometer algum erro."
   *
   * Aqui e não na tela: esconder no navegador é esconder de quem olha, não de quem pede. A mesma
   * rota responde ao `fetch` de qualquer um que esteja logado, e um quadro que não devia ser visto
   * chegaria inteiro — com nome de cliente, valor e telefone — a quem abrisse as ferramentas do
   * navegador.
   *
   * Nada marcado = vê todos, que é o comportamento de sempre.
   */
  const funisPermitidos = escopoPermitido(sessao.user.permissoes, ESCOPOS.funis);
  /*
   * O RECORTE DE ETAPAS, mais fino que o de funis e aplicado também aqui.
   *
   * "Eu coloquei o closer dentro do meu CRM. Mas eu não quero que ele veja todo o processo do
   * funil — novo, qualificado, proposta, fechado. Eu quero que ele tenha a visão apenas de
   * proposta, porque ele vai ficar responsável por proposta."
   *
   * No servidor pelo mesmo motivo do recorte de funis: esconder coluna no navegador é esconder de
   * quem olha, não de quem pede — e a coluna carrega nome de cliente, valor e telefone.
   *
   * Nada marcado = vê todas, que é o comportamento de hoje.
   */
  const etapasPermitidas = escopoPermitido(sessao.user.permissoes, ESCOPOS.etapasDoFunil);

  const linhas = await prisma.funil.findMany({
    where: {
      workspaceId: sessao.user.workspaceId,
      ...(funisPermitidos ? { id: { in: funisPermitidos } } : {}),
    },
    // A ordem é a que a pessoa arrastou. O id desempata porque ele é estável: sem ele, dois funis
    // com a mesma `ordem` trocariam de lugar entre carregamentos, sem ninguém ter mexido.
    orderBy: [{ ordem: "asc" }, { id: "asc" }],
    include: {
      numeros: { select: { contaCanal: true } },
      etapas: {
        ...(etapasPermitidas ? { where: { id: { in: etapasPermitidas } } } : {}),
        orderBy: { ordem: "asc" },
        include: { cards: { where: filtroConexaoDeNegocio(provedores), orderBy: { ordem: "asc" } } },
      },
    },
  });

  const funis: Funil[] = linhas.map((f) => ({
    id: f.id,
    nome: f.nome,
    responsavel: f.responsavel ?? undefined,
    // O primeiro número do funil, pro que ainda lê um só.
    contaCanal: f.contaCanal,
    // TODOS os números dele, já com o antigo incluído: a tela não precisa saber que há dois
    // formatos guardados. Ver `numerosDoFunil`.
    contaCanais: numerosDoFunil({
      id: f.id,
      nome: f.nome,
      contaCanal: f.contaCanal,
      contaCanais: f.numeros.map((n) => n.contaCanal),
    }),
    colunas: f.etapas.map((e) => ({
      id: e.id,
      titulo: e.titulo,
      total: e.cards.length,
      cor: e.cor ?? undefined,
      // Qual número responde esta etapa. Ver `FunilEtapa.contaCanal`.
      contaCanal: e.contaCanal ?? undefined,
      dicas: lerDicas(e.dicas),
      cards: e.cards.map((c) => ({
        id: c.id,
        nome: c.nome,
        valor: c.valor,
        origem: c.origem as Funil["colunas"][number]["cards"][number]["origem"],
        dias: c.dias,
        data: c.data,
        etiquetas: Array.isArray(c.etiquetas) ? (c.etiquetas as string[]) : undefined,
        responsavel: c.responsavel ?? undefined,
        statusFechamento: (c.statusFechamento as "ganho" | "perdido" | null) ?? undefined,
        motivoPerda: c.motivoPerda ?? undefined,
        dataFechamento: c.dataFechamento ? c.dataFechamento.toISOString().slice(0, 10) : undefined,
      })),
    })),
  }));

  return NextResponse.json(funis);
}

/**
 * PUT reconcilia o funil do workspace de quem está logado com o array `funis` mandado pelo front.
 * Não existem mutadores dedicados no Context pra Funil (~13 pontos em
 * `funil/page.tsx`/`FunisSecao.tsx` mexem direto em `setFunis`), então o Provider sincroniza o
 * estado inteiro a cada mudança em vez de granular por operação. Roda numa transação: upsert de
 * cada funil/etapa/card presente, e apaga o que sumiu do array. **sempre filtrado por
 * `workspaceId`** nos `deleteMany`, senão apagaria funis/etapas/cards de outras empresas (qualquer
 * id que não seja dessa empresa "não está no payload dela").
 *
 * O `deleteMany` dos cards leva TAMBÉM o filtro por conexão, e isso não é detalhe: o GET esconde
 * os negócios de um canal desconectado, então o front nunca os recebe. E "não veio no payload"
 * passaria a significar "apague". Sem esta linha, desconectar um canal deixava de esconder os
 * negócios dele e passava a APAGÁ-LOS no primeiro salvamento seguinte. Regra geral: um PUT que
 * reconcilia estado inteiro só pode apagar dentro do mesmo recorte que o GET mostrou.
 */
export async function PUT(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const funis = (await request.json()) as Funil[];

  const provedores = await provedoresDeNegocio(workspaceId);

  const idsFunis = funis.map((f) => f.id);
  const idsEtapas = funis.flatMap((f) => f.colunas.map((c) => c.id));
  const idsCards = funis.flatMap((f) => f.colunas.flatMap((c) => c.cards.map((card) => card.id)));

  // Estado ATUAL do banco, lido antes de escrever qualquer coisa.
  //
  // Sem isto, a reconciliação mandava um `upsert` por funil, por etapa e por CARD a cada
  // salvamento: dezenas de idas e voltas até o banco no Railway dentro de UMA transação, com um
  // pool de 3 conexões. Passando dos 20s a transação inteira era abortada por prazo (P2028) e o
  // funil não salvava: era o "O funil é grande demais para salvar de uma vez".
  //
  // O que muda num salvamento real é quase sempre UM card (arrastar, fechar, editar). Comparando
  // com o que já está gravado, a transação passa a levar só o que de fato mudou. De ~50
  // instruções para 1 ou 2 no caso comum.
  const [funisAtuais, etapasAtuais, cardsAtuais] = await Promise.all([
    prisma.funil.findMany({ where: { workspaceId }, select: { id: true, nome: true, responsavel: true } }),
    prisma.funilEtapa.findMany({
      where: { workspaceId },
      select: { id: true, funilId: true, titulo: true, ordem: true },
    }),
    prisma.negocioCard.findMany({
      /*
       * O MESMO RECORTE DO GET, e isto decide o que pode ser apagado.
       *
       * O GET esconde os negócios de um canal desconectado, então o front nunca os recebe — e
       * "não veio no payload" não pode significar "apague". Lendo só o que o GET mostraria, a
       * conta de quem sumiu é feita dentro do mesmo recorte, e o que está escondido fica de fora
       * dos dois lados.
       */
      where: { workspaceId, ...filtroConexaoDeNegocio(provedores) },
      select: {
        id: true,
        etapaId: true,
        ordem: true,
        nome: true,
        valor: true,
        origem: true,
        dias: true,
        data: true,
        etiquetas: true,
        responsavel: true,
        statusFechamento: true,
        motivoPerda: true,
        dataFechamento: true,
      },
    }),
  ]);

  const funilPorId = new Map(funisAtuais.map((f) => [f.id, f]));
  const etapaPorId = new Map(etapasAtuais.map((e) => [e.id, e]));
  const cardPorId = new Map(cardsAtuais.map((c) => [c.id, c]));

  /** Data de fechamento normalizada pra "AAAA-MM-DD" (ou null) dos dois lados da comparação. O
   * banco devolve `Date` e o front manda string; comparar direto marcaria tudo como alterado. */
  function dataFechamentoIso(valor: Date | string | null | undefined): string | null {
    if (!valor) return null;
    return valor instanceof Date ? valor.toISOString().slice(0, 10) : valor.slice(0, 10);
  }

  const operacoes: Prisma.PrismaPromise<unknown>[] = [];

  /*
   * APAGAR PELO ID DO QUE SUMIU, e só quando sumiu alguma coisa.
   *
   * Eram três `deleteMany` com `id: { notIn: [...todos os ids do payload] }`, e eles rodavam em
   * TODO salvamento — inclusive em "arrastei um card" e "renomeei uma etapa", em que nada é
   * apagado. Cada um varre as linhas do workspace comparando contra uma lista que cresce junto
   * com o funil, e faz isso DENTRO da transação, segurando trava no caminho. Com dois
   * salvamentos próximos (e o quadro salva a cada 500 ms de arrasto), um espera o outro até o
   * prazo estourar: era o "o banco demorou demais pra responder" que apagava o trabalho da tela.
   *
   * Agora a conta é feita em memória, com o que já foi lido acima: quem está no banco e não está
   * no payload. O `in` cai na chave primária, e no caso comum — ninguém apagou nada — a instrução
   * nem existe.
   */
  const idsCardsNoPayload = new Set(idsCards);
  const idsEtapasNoPayload = new Set(idsEtapas);
  const idsFunisNoPayload = new Set(idsFunis);

  const cardsSumidos = cardsAtuais.filter((c) => !idsCardsNoPayload.has(c.id)).map((c) => c.id);
  const etapasSumidas = etapasAtuais.filter((e) => !idsEtapasNoPayload.has(e.id)).map((e) => e.id);
  const funisSumidos = funisAtuais.filter((f) => !idsFunisNoPayload.has(f.id)).map((f) => f.id);

  if (cardsSumidos.length) {
    operacoes.push(prisma.negocioCard.deleteMany({ where: { workspaceId, id: { in: cardsSumidos } } }));
  }
  if (etapasSumidas.length) {
    operacoes.push(prisma.funilEtapa.deleteMany({ where: { workspaceId, id: { in: etapasSumidas } } }));
  }
  if (funisSumidos.length) {
    operacoes.push(prisma.funil.deleteMany({ where: { workspaceId, id: { in: funisSumidos } } }));
  }

  for (const f of funis) {
    const atual = funilPorId.get(f.id);
    if (!atual) {
      operacoes.push(
        prisma.funil.create({ data: { id: f.id, workspaceId, nome: f.nome, responsavel: f.responsavel } }),
      );
    } else if (atual.nome !== f.nome || (atual.responsavel ?? undefined) !== f.responsavel) {
      /*
       * `contaCanal` NÃO ENTRA AQUI, e isso é a regra virando código.
       *
       * "Se eu quiser mudar, eu tenho que excluir esse funil e criar outro." O número é escrito
       * uma vez, na criação. Se ele viajasse neste PUT, uma aba com a tela antiga aberta poderia
       * devolver o valor velho — ou nenhum — e trocar o número de um funil que já tem cards, o que
       * mistura duas caixas de entrada num quadro só.
       */
      operacoes.push(
        prisma.funil.update({ where: { id: f.id }, data: { nome: f.nome, responsavel: f.responsavel } }),
      );
    }
  }

  for (const f of funis) {
    f.colunas.forEach((c, ordemEtapa) => {
      const atual = etapaPorId.get(c.id);
      if (!atual) {
        operacoes.push(
          prisma.funilEtapa.create({
            data: { id: c.id, workspaceId, funilId: f.id, titulo: c.titulo, ordem: ordemEtapa },
          }),
        );
      } else if (atual.funilId !== f.id || atual.titulo !== c.titulo || atual.ordem !== ordemEtapa) {
        operacoes.push(
          prisma.funilEtapa.update({
            where: { id: c.id },
            data: { funilId: f.id, titulo: c.titulo, ordem: ordemEtapa },
          }),
        );
      }
    });
  }

  /*
   * A POSIÇÃO DO CARD DENTRO DA COLUNA NÃO É GRAVADA AQUI. É O SERVIDOR QUE A MANTÉM.
   *
   * Era a origem do "O banco demorou demais pra responder. Parte do funil pode não ter sido salva"
   * que aparecia em QUALQUER alteração do funil, e não só numa grande.
   *
   * Quem move um card grava por `/api/funis/mover`, que põe o card no topo da etapa de destino
   * dando a ele `menor ordem - 1` — número negativo, de propósito, pra não renumerar a coluna
   * inteira a cada arraste. Só que esta rota recalculava `ordem` como o ÍNDICE do card no array que
   * o navegador manda. Aí os dois números discordavam: no banco o card movido tinha -1 e os outros
   * 0, 1, 2…; no payload ele tinha 0 e os outros 1, 2, 3…. A comparação marcava TODOS os cards da
   * coluna como alterados, e um movimento virava trinta e duas instruções. Com o pool de três
   * conexões do Railway, era a transação que estourava o prazo (P2028).
   *
   * E não era só o arraste: a divergência ficava gravada. A alteração seguinte — fechar um negócio,
   * renomear uma etapa, criar um card — remandava o quadro inteiro e repetia a mesma enxurrada,
   * mesmo sem ninguém ter arrastado nada. É exatamente o que a Thaynara relatou: todas as vezes
   * que mexia no funil, o aviso de demora aparecia.
   *
   * Pior: a renumeração sobrescrevia o trabalho de `/api/funis/reordenar-por-atividade`. Uma aba
   * com a tela antiga aberta devolvia a ordem velha e desfazia a reorganização por atividade que o
   * servidor tinha acabado de fazer.
   *
   * A ordem dentro da coluna passa a ter um dono só: o servidor, em `/api/funis/mover`, em
   * `funis/upsert.ts` (lead novo entra no topo) e na reordenação por atividade. O `GET` lê por
   * `ordem` crescente, então o array que chega aqui JÁ reflete a posição gravada — recalculá-lo
   * pelo índice não acrescentava informação nenhuma, só escrita. A tela não tem arrastar-para-
   * reordenar dentro da mesma coluna (`moverCard` desiste quando origem e destino são a mesma), o
   * que significa que nenhuma intenção da pessoa se perde com isto.
   *
   * CARD NOVO continua levando `ordem` (logo abaixo): ele não existe no banco e precisa de uma
   * posição. O índice serve, porque `mover` só cria números MENORES que os existentes — o maior
   * `ordem` da coluna nunca passa de `quantidade - 1`, e o card novo entra com `quantidade`, ou
   * seja, no fim da coluna, que é onde `criarNegocio` o coloca na tela.
   */

  // Cards novos vão todos numa instrução só (`createMany`), em vez de uma por card. É o caso do
  // "Trazer conversas", que pode criar dezenas de uma vez.
  const cardsParaCriar: Prisma.NegocioCardCreateManyInput[] = [];

  for (const f of funis) {
    for (const c of f.colunas) {
      c.cards.forEach((card, ordemCard) => {
        const dataFechamento = card.dataFechamento ? new Date(card.dataFechamento) : null;
        const atual = cardPorId.get(card.id);
        if (!atual) {
          cardsParaCriar.push({
            id: card.id,
            workspaceId,
            etapaId: c.id,
            ordem: ordemCard,
            nome: card.nome,
            valor: card.valor,
            origem: card.origem,
            dias: card.dias,
            data: card.data,
            etiquetas: card.etiquetas ?? undefined,
            responsavel: card.responsavel,
            statusFechamento: card.statusFechamento ?? undefined,
            motivoPerda: card.motivoPerda ?? undefined,
            dataFechamento: dataFechamento ?? undefined,
          });
          return;
        }

        const mudou =
          atual.etapaId !== c.id ||
          atual.nome !== card.nome ||
          atual.valor !== card.valor ||
          atual.origem !== card.origem ||
          atual.dias !== card.dias ||
          atual.data !== card.data ||
          JSON.stringify(atual.etiquetas ?? null) !== JSON.stringify(card.etiquetas ?? null) ||
          (atual.responsavel ?? undefined) !== card.responsavel ||
          (atual.statusFechamento ?? null) !== (card.statusFechamento ?? null) ||
          (atual.motivoPerda ?? null) !== (card.motivoPerda ?? null) ||
          dataFechamentoIso(atual.dataFechamento) !== dataFechamentoIso(card.dataFechamento);
        if (!mudou) return;

        operacoes.push(
          prisma.negocioCard.update({
            where: { id: card.id },
            data: {
              etapaId: c.id,
              nome: card.nome,
              valor: card.valor,
              origem: card.origem,
              dias: card.dias,
              data: card.data,
              etiquetas: card.etiquetas ?? undefined,
              responsavel: card.responsavel,
              statusFechamento: card.statusFechamento ?? null,
              motivoPerda: card.motivoPerda ?? null,
              dataFechamento,
            },
          }),
        );
      });
    }
  }

  if (cardsParaCriar.length) {
    operacoes.push(prisma.negocioCard.createMany({ data: cardsParaCriar }));
  }

  // Card novo no quadro dispara os gatilhos de "criado nesta etapa". Depois da gravação, e sem
  // esperar: automação é efeito secundário de salvar o funil, e uma automação com problema não
  // pode fazer o salvamento falhar.
  const criadosParaGatilho = cardsParaCriar.map((c) => ({ etapaId: c.etapaId, nome: c.nome }));

  // A transação inteira estava sem tratamento de erro: qualquer falha do banco virava um 500 mudo,
  // e a tela só conseguia dizer "Funis não foram salvos: 500": sem nada que apontasse a causa, nem
  // no navegador nem pra quem fosse investigar. O erro real fica no log do servidor, com quantos
  // funis/etapas/cards estavam no payload, que é o que separa "dado inválido num card" de
  // "transação grande demais e estourou o tempo".
  /*
   * NADA MUDOU: não abre transação nenhuma.
   *
   * O quadro manda o estado inteiro a cada mudança, e várias chegam sem diferença de verdade
   * contra o banco (um arrasto que volta pro mesmo lugar, um salvamento disparado pela recarga).
   * Abrir uma transação pra não escrever nada é ocupar uma das três conexões do pool à toa — e é
   * justamente essa disputa que faz o salvamento seguinte esperar.
   */
  if (operacoes.length === 0) return NextResponse.json({ ok: true });

  try {
    /*
     * UMA INSTRUÇÃO SÓ NÃO PRECISA DE TRANSAÇÃO. Renomear uma etapa, mover um card: são uma
     * escrita, e envolvê-la em BEGIN/COMMIT triplica as idas e voltas até um banco que fica em
     * outro continente. Atomicidade de uma instrução é o próprio banco que garante.
     */
    if (operacoes.length === 1) {
      await operacoes[0];
    } else {
      // Em LOTES, não numa transação só.
      //
      // Uma transação única com centenas de instruções estourava o prazo e devolvia "o funil é
      // grande demais": e o pior: não salvava nada, nem a parte que já tinha passado. Um funil
      // que cresce (é o que se espera de um CRM em uso) ficava com um teto invisível a partir do
      // qual parava de salvar.
      //
      // Cada lote é uma transação: dentro dele continua tudo-ou-nada, que é o que importa pra
      // não deixar um card sem etapa. Entre lotes não há atomicidade, e isso é aceitável aqui. O
      // pior caso de uma falha no meio é parte da reordenação ficar pra trás, coisa que o próximo
      // salvamento corrige. Perder o salvamento inteiro é bem pior.
      const TAMANHO_DO_LOTE = 50;
      for (let i = 0; i < operacoes.length; i += TAMANHO_DO_LOTE) {
        await prisma.$transaction(operacoes.slice(i, i + TAMANHO_DO_LOTE), {
          // O padrão do Prisma é 5s de execução e 2s de espera por conexão, e aqui isso é pouco:
          // cada instrução é uma ida e volta até o banco no Railway. O `maxWait` sobe pelo mesmo
          // motivo: o pool tem só 3 conexões, e sob salvamentos seguidos a espera por uma conexão
          // livre estourava antes mesmo de a transação começar.
          timeout: 20_000,
          maxWait: 15_000,
        });
      }
    }
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    // O código do Prisma (P2028 = prazo da transação, P2002 = id repetido, P2003 = chave
    // estrangeira) é o que separa "demorou demais" de "dado inválido". Sem ele, todo problema
    // diferente chegava na tela com o mesmo texto e não dava pra investigar sem o log do servidor.
    const codigo = (erro as { code?: string })?.code;
    console.error("[api/funis] falha ao salvar:", {
      workspaceId,
      funis: funis.length,
      etapas: idsEtapas.length,
      cards: idsCards.length,
      // Quantas instruções a transação realmente levou. Com a comparação contra o banco isto é
      // quase sempre um número pequeno, e um número grande aqui é o sinal de que algo está
      // marcando tudo como alterado a cada salvamento.
      operacoes: operacoes.length,
      codigo,
      mensagem,
    });
    return NextResponse.json(
      {
        erro:
          codigo === "P2028"
            ? "O banco demorou demais pra responder. Parte do funil pode não ter sido salva. Recarregue a página."
            : "Não foi possível salvar o funil agora.",
        // Só o código, nunca a mensagem crua do banco: ela carrega nome de tabela, coluna e às
        // vezes o próprio valor do registro, e isso não pode chegar ao navegador.
        codigo,
      },
      { status: 500 },
    );
  }

  for (const criado of criadosParaGatilho) {
    emSegundoPlano("gatilhos de card criado", () =>
      avisarQueEntrouNaEtapa({
        workspaceId,
        etapaId: criado.etapaId,
        contatoNome: criado.nome,
        evento: "criado",
      }),
    );
  }

  return NextResponse.json({ ok: true });
}
