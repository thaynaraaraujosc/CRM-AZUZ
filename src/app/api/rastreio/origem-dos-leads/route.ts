import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { previaDaOrigem, type PreviaDaOrigem } from "@/lib/rastreio/tag-de-origem";
import { chaveDeContato } from "@/lib/contatos/chave-nome";

/**
 * DE ONDE VEIO CADA LEAD, pronto pra virar etiqueta na linha da conversa e no card do funil.
 *
 * "Eu preciso saber se o lead que entrou no meu chat e no meu funil veio de onde. Veio do
 * Instagram? Veio do anúncio? Preciso que apareça uma tag."
 *
 * ROTA PRÓPRIA, e não mais um campo em `/api/contatos`. `OrigemDoLead` tem colunas `@db.Text`
 * (página de entrada, referrer, o JSON bruto de tudo que chegou): pendurá-la na listagem de
 * contatos faria toda abertura da agenda baixar isso, pra usar três campos. Aqui a leitura é
 * recortada e o que sai é a DECISÃO — o rótulo e o detalhe —, não o rastreio inteiro.
 *
 * A CHAVE É O NOME DO CONTATO, porque é por nome que a conversa, o card do funil e o contato se
 * encontram no CRM inteiro. Normalizado do mesmo jeito em que o resto casa os três (ver
 * `chaveDeContato`), senão "Thais " com espaço e "thais" seriam duas pessoas.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  /*
   * UM CONTATO SÓ, quando quem pergunta é uma conversa aberta.
   *
   * A janela do funil abre UMA conversa por vez: baixar a origem do workspace inteiro pra mostrar
   * a de uma seria pagar o quadro pra ler a linha. A caixa de entrada é o contrário — ela mostra a
   * etiqueta em todas as linhas, e lá a lista inteira é a consulta certa.
   *
   * A busca é pelo nome NORMALIZADO, que é como conversa, contato e card se encontram no CRM.
   */
  const deUmContato = chaveDeContato(new URL(request.url).searchParams.get("contato"));

  const linhas = await prisma.origemDoLead.findMany({
    where: { workspaceId: sessao.user.workspaceId },
    select: {
      contato: { select: { nome: true } },
      tipoDoClique: true,
      cliqueId: true,
      leadgenId: true,
      caminho: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      campanhaNome: true,
      anuncioNome: true,
      palavraChave: true,
      metaSource: true,
      // `referrer` e `paginaEntrada` entram só pra responder "passou por um site": o conteúdo
      // deles nunca sai daqui, e por isso o que vai pro navegador é um booleano.
      referrer: true,
      paginaEntrada: true,
      /*
       * O `referral` INTEIRO, como a Meta mandou. É daqui que sai a prévia do criativo: título,
       * texto, miniatura e link da peça. Ele é LIDO aqui e não sai daqui — o que vai pro navegador
       * é só a prévia montada, que são quatro campos curtos.
       */
      bruto: true,
      formularioId: true,
    },
  });

  /*
   * O NOME DO FORMULÁRIO, numa consulta só.
   *
   * "Se ela veio pelo formulário, aparece 'veio através do formulário tal', aí o nome do
   * formulário." O nome mora em `Formulario` e muda quando a empresa renomeia — por isso a origem
   * guarda só o id, e o nome é buscado na hora.
   */
  const idsDeFormulario = [...new Set(linhas.map((l) => l.formularioId).filter((id): id is string => !!id))];
  const nomeDoFormulario = new Map<string, string>(
    idsDeFormulario.length
      ? (
          await prisma.formulario.findMany({
            where: { workspaceId: sessao.user.workspaceId, id: { in: idsDeFormulario } },
            select: { id: true, nome: true },
          })
        ).map((f) => [f.id, f.nome])
      : [],
  );

  const porContato: Record<string, PreviaDaOrigem> = {};
  for (const linha of linhas) {
    const chave = chaveDeContato(linha.contato?.nome);
    if (!chave) continue;
    const previa = previaDaOrigem(linha, linha.formularioId ? nomeDoFormulario.get(linha.formularioId) : null);
    if (previa) porContato[chave] = previa;
  }

  // Pedido de um contato só: devolve `previa` (podendo ser nula), e não o mapa inteiro. Quem
  // pergunta por um não deve receber a agenda de rastreio da empresa.
  if (deUmContato) {
    return NextResponse.json(
      { previa: porContato[deUmContato] ?? null },
      { headers: { "cache-control": "no-store" } },
    );
  }

  return NextResponse.json({ porContato }, { headers: { "cache-control": "no-store" } });
}
