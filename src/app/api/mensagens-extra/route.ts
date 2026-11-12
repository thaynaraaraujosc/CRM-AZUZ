import { NextResponse } from "next/server";

import type { Prisma } from "@/generated/prisma/client";
import { mensagemEhDaConexao } from "@/lib/conversas/mensagem-da-conexao";
import type { ConvMensagem } from "@/lib/data";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { contasCanalVisiveis, filtroContaCanal } from "@/lib/integracoes/conta-canal";
import { preservarMidiaGuardada, trocarMidiaPorLink } from "@/lib/conversas/midia-mensagem";
import { guardarMidiasDosExtras } from "@/lib/armazenamento/midia";
import { cabecalhosComEtag, clienteJaTem, montarEtag, naoModificado } from "@/lib/conversas/assinatura";

type LinhaMensagem = {
  id: string;
  contato: string;
  tipo: string;
  texto: string;
  hora: string;
  criadoEm: Date | null;
  status: string | null;
  extras: unknown;
  canal: string | null;
  wamid: string | null;
};

/**
 * Teto de linhas trazidas por `GET`. Sem isso, um workspace com uso contínuo (não precisa nem
 * ser flood) acumula histórico o suficiente pra transformar essa busca num table scan gigante a
 * cada abertura de tela e a cada poll de 5s, travando `/conversas` (bug real já visto em produção).
 * Pega as mais recentes primeiro e devolve em ordem cronológica.
 */
const LIMITE_MENSAGENS = 3000;

function paraMensagem(linha: LinhaMensagem): ConvMensagem {
  // O anexo sai daqui como LINK, não embutido: este GET traz o histórico inteiro do workspace de
  // uma vez (e repete a cada 5s no polling), então mandar foto/áudio/vídeo dentro do JSON obrigava
  // o navegador a baixar tudo antes de desenhar a primeira bolha. A demora que aparecia ao
  // atualizar a página. Ver `midia-mensagem.ts`.
  const extras = (linha.extras ? trocarMidiaPorLink(linha.extras, linha.id) : {}) as Partial<ConvMensagem>;
  return {
    ...extras,
    id: linha.id,
    tipo: linha.tipo as ConvMensagem["tipo"],
    texto: linha.texto,
    hora: linha.hora,
    criadoEm: linha.criadoEm ? linha.criadoEm.getTime() : undefined,
    status: (linha.status as ConvMensagem["status"]) ?? undefined,
    canal: linha.canal ?? undefined,
    wamid: linha.wamid ?? undefined,
  };
}

/** GET devolve `Record<contato, ConvMensagem[]>` do workspace de quem está logado, limitado às
 * `LIMITE_MENSAGENS` mais recentes.
 *
 * Responde `304 Not Modified` quando nada mudou desde a última vez que ESTA tela perguntou. E aí
 * a consulta pesada abaixo nem chega a rodar. Ver `src/lib/conversas/assinatura.ts` pro porquê:
 * esta rota, batida a cada 5s por aba aberta, era sozinha responsável por ~1,9 TB saindo do banco
 * num mês. */
export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  // Mesmo filtro por conexão das conversas. Mensagem de um número desconectado some da tela sem
  // sair do banco (ver `conta-canal.ts`).
  const visiveis = await contasCanalVisiveis(sessao.user.workspaceId);
  const where = { workspaceId: sessao.user.workspaceId, ...filtroContaCanal(visiveis) };

  // A pergunta barata, ANTES da cara: dois MAX e um COUNT sobre índice, resposta em bytes.
  const resumo = await prisma.mensagemExtra.aggregate({
    where,
    _count: { _all: true },
    _max: { criadoEm: true, atualizadoEm: true },
  });
  const etag = montarEtag([
    sessao.user.workspaceId,
    // O recorte entra na assinatura: conectar/desconectar um canal muda o que a tela deve ver sem
    // mexer em mensagem nenhuma, e sem isto a tela continuaria com a lista antiga.
    [...visiveis.contas, ...visiveis.prefixosSemIdentificador].join(","),
    resumo._count._all,
    resumo._max.criadoEm,
    resumo._max.atualizadoEm,
  ]);
  if (clienteJaTem(request, etag)) return naoModificado(etag);

  // Sincronização INCREMENTAL. Sem isto, toda vez que UMA mensagem chegava (ou mudava de status),
  // a tela baixava as 3.000 mais recentes de novo. O custo de cada mensagem nova era proporcional
  // ao tamanho do histórico, e com muitos clientes cada um com milhares de mensagens isso não
  // escala. Com `desde`, a tela diz até que instante ela já está em dia e recebe só o que foi
  // criado ou alterado depois disso: o custo de uma mensagem nova passa a ser o dela.
  //
  // `>=` e não `>`: a marca é o maior instante que o servidor já viu, e uma linha gravada no MESMO
  // milissegundo da marca poderia ficar de fora com `>`. Re-mandar a linha da borda custa nada.
  //
  // Apagamento não aparece num delta. Por isso a resposta leva a contagem TOTAL: a tela compara
  // com o que ela conhece e, se não bater, pede a lista inteira (ver `mensagens-extra-context`).
  /*
   * UMA CONVERSA SÓ, pedida pelo nome.
   *
   * "Não chegou as mensagens no funil dos clientes que já tem mensagem com a gente lá no chat.
   * Não faz nenhum sentido eu abrir e não ter nenhuma mensagem."
   *
   * A tela carrega as mensagens em BLOCO: as 3.000 mais recentes do workspace inteiro, uma vez, e
   * daí em diante só o que muda. Isso é o certo pra caixa de entrada, onde se lê o que é recente.
   * Mas quem abre um card do funil de alguém que parou de escrever há tempos está pedindo uma
   * conversa que pode estar inteira FORA dessas 3.000 — e a tela, sem nada a mostrar, dizia
   * "nenhuma mensagem ainda", que é a frase de quem nunca falou com a pessoa.
   *
   * Com `?contato=`, a janela da conversa pede o histórico DELA quando não tem nada em mãos. É uma
   * consulta por índice (`[workspaceId, contato]`), pontual, e só acontece quando falta.
   */
  const deUmContato = new URL(request.url).searchParams.get("contato");
  if (deUmContato) {
    const daConversa = await mensagensDeUmContato(sessao.user.workspaceId, deUmContato, where);
    return NextResponse.json(daConversa, { headers: { "cache-control": "no-store" } });
  }

  const desdeMs = Number(new URL(request.url).searchParams.get("desde"));
  const parcial = Number.isFinite(desdeMs) && desdeMs > 0;
  const desde = parcial ? new Date(desdeMs) : null;

  const linhas = await prisma.mensagemExtra.findMany({
    where: desde ? { ...where, OR: [{ criadoEm: { gte: desde } }, { atualizadoEm: { gte: desde } }] } : where,
    orderBy: { criadoEm: "desc" },
    take: LIMITE_MENSAGENS,
  });
  linhas.reverse();

  const porContato: Record<string, ConvMensagem[]> = {};
  for (const linha of linhas) {
    (porContato[linha.contato] ??= []).push(paraMensagem(linha));
  }
  const marca = Math.max(resumo._max.criadoEm?.getTime() ?? 0, resumo._max.atualizadoEm?.getTime() ?? 0);
  return NextResponse.json(porContato, {
    headers: {
      ...cabecalhosComEtag(etag),
      "x-mensagens-total": String(resumo._count._all),
      "x-mensagens-marca": String(marca),
      "x-mensagens-parcial": parcial ? "1" : "0",
    },
  });
}

type ItemUpsert = { contato: string; idFinal: string; mensagem: ConvMensagem };

/**
 * PUT recebe só a DIFERENÇA (mensagens novas/alteradas + ids apagados) calculada no cliente
 * (`mensagens-extra-context.tsx`): nunca mais o `Record` inteiro. A versão antiga reconciliava a
 * tabela inteira do workspace a cada mudança (um upsert por mensagem existente + delete em massa),
 * o que virava uma transação gigante disparada a cada 5s pelo polling; era a mesma causa raiz do
 * flood de WhatsApp que já tinha derrubado essa tela antes, só que estrutural em vez de pontual.
 */
export async function PUT(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const corpo = (await request.json()) as { upserts?: ItemUpsert[]; deletarIds?: string[] };
  const upserts = corpo.upserts ?? [];
  const deletarIds = corpo.deletarIds ?? [];

  // O cliente nunca recebeu o conteúdo dos anexos (só um link pra eles), então não pode ser fonte
  // de verdade sobre eles: sem isto, o primeiro PUT depois de um GET gravaria o link por cima da
  // data URL e o arquivo se perderia. Busca o que já está guardado pra restaurar esses campos.
  const guardadas = upserts.length
    ? await prisma.mensagemExtra.findMany({
        where: { workspaceId, id: { in: upserts.map((u) => u.idFinal) } },
        select: { id: true, extras: true },
      })
    : [];
  const extrasGuardados = new Map(guardadas.map((m) => [m.id, m.extras]));

  // Os anexos sobem pro R2 ANTES da transação: subir arquivo é uma chamada de rede que pode levar
  // segundos, e uma transação aberta esse tempo todo segura conexão do banco à toa. Foi assim que
  // essa mesma rota já travou `/conversas` antes. Aqui a transação só grava texto e referência.
  // De qual conexão é cada conversa. As mensagens que a tela envia chegam aqui SEM `contaCanal`.
  // O navegador não sabe (nem deve saber) por qual número a conversa fala. Sem preencher isso, a
  // mensagem enviada nascia com a marca vazia e sumia da tela na primeira recarga em que o QR Code
  // não estivesse conectado: o filtro por conexão não a reivindicava, e ela ficava gravada e
  // invisível, do mesmo jeito que já aconteceu antes com o Instagram.
  const nomesDeConversa = [...new Set(upserts.map((u) => u.contato))];
  const conversas = nomesDeConversa.length
    ? await prisma.conversa.findMany({
        where: { workspaceId, nome: { in: nomesDeConversa } },
        select: { nome: true, contaCanal: true },
      })
    : [];
  const contaCanalPorConversa = new Map(conversas.map((c) => [c.nome, c.contaCanal]));

  /**
   * A CONVERSA SÓ MARCA A MENSAGEM QUANDO O CANAL DELA CONCORDA.
   *
   * O `contaCanal` vinha da conversa e mais nada. Mas a conversa MUDA DE CASA no mesmo instante em
   * que alguém manda por outro número, e este PUT chega com atraso (o sincronismo da tela junta as
   * mensagens antes de mandar). Nessa fresta, a mensagem que saiu pelo oficial era gravada com a
   * conexão do QR Code — uma linha que diz, ela mesma, duas coisas diferentes: `canal` oficial,
   * `contaCanal` do QR Code.
   *
   * E uma linha contraditória não é só feia: era ela que fazia a mensagem recém-enviada sumir da
   * thread onde a pessoa acabou de escrevê-la.
   *
   * Discordando, grava sem marca. É o estado que a regra de leitura trata como "não sei": a
   * mensagem continua visível e o `canal` — escrito na hora do envio, sem corrida nenhuma — faz a
   * separação. Inventar uma conexão que o servidor não viu seria pior do que admitir que não sabe.
   */
  const marcaDaConversa = (contato: string, canal: string | null | undefined) => {
    const daConversa = contaCanalPorConversa.get(contato) ?? null;
    return mensagemEhDaConexao({ canal }, daConversa) ? daConversa : null;
  };

  const preparados = await Promise.all(
    upserts.map(async ({ contato, idFinal, mensagem }) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- só pra excluir `id` de `extras`, já vira a coluna própria
      const { id: _id, tipo, texto, hora, criadoEm, status, canal, wamid, ...extras } = mensagem;
      const preservados = preservarMidiaGuardada(extras, extrasGuardados.get(idFinal));
      return {
        idFinal,
        dados: {
          contato,
          tipo,
          texto,
          hora,
          criadoEm: criadoEm ? new Date(criadoEm) : null,
          status: status ?? null,
          canal: canal ?? null,
          wamid: wamid ?? null,
          contaCanal: marcaDaConversa(contato, canal),
          extras: (await guardarMidiasDosExtras(preservados, workspaceId)) as Prisma.InputJsonValue,
        },
      };
    }),
  );

  const operacoes = [
    ...(deletarIds.length ? [prisma.mensagemExtra.deleteMany({ where: { workspaceId, id: { in: deletarIds } } })] : []),
    ...preparados.map(({ idFinal, dados }) =>
      prisma.mensagemExtra.upsert({
        where: { id: idFinal },
        create: { id: idFinal, workspaceId, ...dados },
        update: dados,
      }),
    ),
  ];

  if (operacoes.length) await prisma.$transaction(operacoes);

  return NextResponse.json({ ok: true });
}

/** Quantas mensagens de UMA conversa a janela carrega de uma vez. */
const LIMITE_DE_UMA_CONVERSA = 500;

/**
 * As mensagens de uma conversa, pelo nome dela — e, não achando nada, PELO TELEFONE.
 *
 * O segundo caminho existe pelo mesmo motivo que o funil passou a procurar a conversa pelo
 * telefone: o CRM casa mensagem com conversa pelo NOME, e os dois saem de sincronia sozinhos
 * quando a conversa é batizada depois de já ter histórico. Nesse caso as mensagens continuam
 * gravadas sob o nome antigo — que é o telefone — e procurar só pelo nome novo não acha nada.
 *
 * Devolve no mesmo formato da lista inteira (`{ [nome]: mensagens }`), com a chave sendo o nome
 * PEDIDO: é por ele que a tela guarda, e devolver a chave antiga faria a janela continuar vazia.
 */
async function mensagensDeUmContato(
  workspaceId: string,
  nome: string,
  filtro: Record<string, unknown>,
): Promise<Record<string, ConvMensagem[]>> {
  const buscar = (contato: string) =>
    prisma.mensagemExtra.findMany({
      where: { ...filtro, contato },
      orderBy: { criadoEm: "desc" },
      take: LIMITE_DE_UMA_CONVERSA,
    });

  let linhas = await buscar(nome);

  if (!linhas.length) {
    const conversa = await prisma.conversa.findUnique({
      where: { workspaceId_nome: { workspaceId, nome } },
      select: { contato: true, ehGrupo: true },
    });
    const antigo = conversa?.contato;
    // Grupo fica de fora: lá `contato` é o JID do grupo, e as mensagens sempre estiveram sob o
    // nome do grupo — procurar pelo JID não acharia nada e custaria uma consulta à toa.
    if (antigo && !conversa?.ehGrupo && antigo !== nome) linhas = await buscar(antigo);
  }

  linhas.reverse();
  return { [nome]: linhas.map((linha) => paraMensagem(linha)) };
}
