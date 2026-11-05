import { NextResponse } from "next/server";

import { scriptDoSite } from "@/lib/rastreio/script-do-site";

/**
 * O script de rastreamento, servido pro site do cliente.
 *
 * PÚBLICO E SEM SESSÃO de propósito: ele roda no site de terceiro, onde ninguém está logado no
 * CRM. Não recebe workspace, não aceita parâmetro e não devolve nada que dependa de quem pede —
 * é o mesmo arquivo pra todo mundo, e por isso pode ser guardado em cache por muito tempo.
 *
 * Quem amarra o dado ao workspace é o FORMULÁRIO, lá na hora de enviar: o id do formulário é que
 * diz de quem é o lead. Aceitar workspace aqui não acrescentaria nada e seria mais uma coisa que
 * um site qualquer poderia escrever.
 */
export async function GET() {
  return new NextResponse(scriptDoSite(), {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      // Uma hora no navegador, um dia na borda: o conteúdo só muda quando o CRM é publicado, e
      // uma hora é o bastante pra uma correção chegar no mesmo dia sem bater no servidor a cada
      // visita de cada site de cada cliente.
      "cache-control": "public, max-age=3600, s-maxage=86400",
      // Ele é feito pra ser carregado de outro domínio: é esse o trabalho dele.
      "access-control-allow-origin": "*",
    },
  });
}
