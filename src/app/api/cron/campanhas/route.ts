import { NextResponse } from "next/server";

import { rodarRodadaDeCampanhas } from "@/lib/campanhas/worker";
import { retomarEsperasVencidas } from "@/lib/automacoes/iniciar";
import { rodarGatilhosDeTempo } from "@/lib/automacoes/gatilhos-tempo";
import { rodarGatilhosDiarios } from "@/lib/funil/gatilhos-etapa";
import { adotarOrfasDeTodosOsWorkspaces } from "@/lib/conversas/adotar-orfas";

/**
 * Batida do relógio das campanhas.
 *
 * Chamada pelo cron da plataforma (ver `vercel.json`), NÃO por navegador. É o que faz o disparo
 * acontecer com a aba fechada e o agendamento valer de verdade.
 *
 * `maxDuration` acompanha a janela que o worker usa: sem isso a função seria cortada no meio de um
 * envio, e o destinatário ficaria preso em "enviando" até a próxima rodada.
 *
 * A mesma batida retoma as automações que estavam esperando o relógio ("aguardar 2 horas"). É de
 * propósito que não seja um cron separado: cada cron é uma função a mais rodando a cada minuto, e
 * as duas tarefas cabem folgadas na mesma chamada.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  // Esta rota não passa pela checagem de sessão do `proxy.ts`. Não pode, o cron não faz login.
  // Então o segredo compartilhado é a ÚNICA defesa dela. Por isso ele é obrigatório: antes a
  // verificação só valia `if (segredo)`, e sem a variável configurada a rota ficava aberta pra
  // qualquer um na internet acelerar as campanhas de todos os clientes chamando a URL em laço.
  // Recusar quando falta configuração é o lado seguro do erro.
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    return NextResponse.json({ erro: "CRON_SECRET não configurado no servidor." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  /*
   * ORDEM IMPORTA, e ela é esta de propósito.
   *
   * As automações vêm PRIMEIRO. Antes vinham depois do disparo em massa, e isso era uma bomba
   * armada: `rodarRodadaDeCampanhas` tem orçamento de 50 segundos dentro de um limite total de 60.
   * Com campanha ativa, sobravam 10 segundos pra tudo mais, e a retomada das automações podia ser
   * cortada no meio pela plataforma. O sintoma seria o pior possível: follow-up que não sai,
   * silenciosamente, e só nos dias em que houvesse disparo rodando.
   *
   * Retomar automação é barato quando não há nada vencido (uma consulta por índice que volta
   * vazia), então pôr na frente não atrasa campanha nenhuma na prática.
   */
  const automacoes = await retomarEsperasVencidas().catch((erro) => {
    console.error("[cron] falha ao retomar automações:", erro);
    return { retomadas: 0, erros: 1 };
  });

  // Uma falha nas campanhas não pode esconder o resultado das automações (nem o contrário): as
  // duas tarefas são independentes e o relatório mostra as duas.
  const resultado = await rodarRodadaDeCampanhas().catch((erro) => {
    console.error("[cron] falha na rodada de campanhas:", erro);
    return { campanhas: 0 };
  });

  // Gatilhos de relógio (aniversário, lead parado, horário programado). Sai barato quando ninguém
  // usa: a varredura procura FLUXOS primeiro e só toca em contato/card se existir um fluxo desses.
  const porTempo = await rodarGatilhosDeTempo().catch((erro) => {
    console.error("[cron] falha nos gatilhos de tempo:", erro);
    return { disparados: 0 };
  });

  // Os gatilhos "Diariamente às HH:MM" das etapas do funil. Só olha o minuto exato, então na
  // maioria das batidas a consulta não devolve nada e sai de graça.
  const diarios = await rodarGatilhosDiarios().catch((erro) => {
    console.error("[cron] falha nos gatilhos diários do funil:", erro);
    return { gatilhos: 0, leads: 0 };
  });

  // Mensagem gravada que não aparece na conversa: o CRM conserta sozinho, sem botão em lugar
  // nenhum. Uma vez por hora basta, porque órfã NOVA não existe mais (o defeito que as criava está
  // corrigido) e o que resta é histórico. Fora desse minuto a rodada nem consulta.
  const orfas =
    new Date().getUTCMinutes() === 7
      ? await adotarOrfasDeTodosOsWorkspaces().catch((erro) => {
          console.error("[cron] falha ao adotar mensagens órfãs:", erro);
          return { workspaces: 0, adotadas: 0 };
        })
      : { workspaces: 0, adotadas: 0 };

  return NextResponse.json({ ok: true, ...resultado, automacoes, porTempo, diarios, orfas });
}
