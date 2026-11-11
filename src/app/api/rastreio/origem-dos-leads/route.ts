import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tagDeOrigemDoLead } from "@/lib/rastreio/tag-de-origem";
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

export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

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
    },
  });

  const porContato: Record<string, { rotulo: string; detalhe: string; pago: boolean }> = {};
  for (const linha of linhas) {
    const chave = chaveDeContato(linha.contato?.nome);
    if (!chave) continue;
    const tag = tagDeOrigemDoLead(linha);
    if (tag) porContato[chave] = tag;
  }

  return NextResponse.json({ porContato }, { headers: { "cache-control": "no-store" } });
}
