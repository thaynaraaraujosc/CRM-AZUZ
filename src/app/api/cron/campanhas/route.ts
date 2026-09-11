import { NextResponse } from "next/server";

import { rodarRodadaDeCampanhas } from "@/lib/campanhas/worker";
import { retomarEsperasVencidas } from "@/lib/automacoes/iniciar";
import { rodarGatilhosDeTempo } from "@/lib/automacoes/gatilhos-tempo";
import { rodarGatilhosDiarios } from "@/lib/funil/gatilhos-etapa";
import { adotarOrfasDeTodosOsWorkspaces } from "@/lib/conversas/adotar-orfas";
import { rodarHistoricosPendentes } from "@/lib/integracoes/historico-passo";
import { padronizarNomesDeTodosOsWorkspaces } from "@/lib/funis/consolidar";
import { reconciliarTodosOsWorkspaces } from "@/lib/conversas/reconciliar";
import { conferirCanalQrCodeDeTodosOsWorkspaces } from "@/lib/integracoes/saude-qrcode";
import { corrigirDonosDeTodosOsWorkspaces } from "@/lib/conversas/dono-divergente";
import { iniciarHistoricosQueFaltam } from "@/lib/integracoes/historico-whatsapp";
import { processarMensagemRecebida } from "@/app/api/webhooks/evolution/route";

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
  const comecoDaRodada = Date.now();

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

  // Mensagem que entrou por uma conexão e ficou marcada como sendo de outra. Enquanto as duas
  // estão ligadas ninguém vê diferença; ao desconectar uma, some da tela o que a outra recebeu.
  // Roda logo depois da adoção de órfãs, que era o caminho que produzia a divergência. Só escreve
  // em quem está divergente: no estado normal a rodada lê e não escreve nada.
  const donos =
    new Date().getUTCMinutes() === 8
      ? await corrigirDonosDeTodosOsWorkspaces().catch((erro) => {
          console.error("[cron] falha ao corrigir donos divergentes:", erro);
          return { workspaces: 0, mensagensCorrigidas: 0, conversasCorrigidas: 0 };
        })
      : { workspaces: 0, mensagensCorrigidas: 0, conversasCorrigidas: 0 };

  // Nome do mesmo contato escrito de jeitos diferentes em contato, negócio e conversa. O defeito
  // que gerava isso está corrigido, mas o que já está gravado precisa ser alinhado, senão o envio
  // continua não achando a conversa daquela pessoa. Uma vez por hora, e só escreve em quem está
  // fora do padrão: no estado normal a rodada lê e não escreve nada. Não apaga linha nenhuma.
  const nomes =
    new Date().getUTCMinutes() === 23
      ? await padronizarNomesDeTodosOsWorkspaces().catch((erro) => {
          console.error("[cron] falha ao padronizar nomes:", erro);
          return { workspaces: 0, renomeados: 0 };
        })
      : { workspaces: 0, renomeados: 0 };

  // Funil e Conversas contando a mesma história: quem está num lado tem que estar no outro. Roda
  // logo depois da padronização de nomes, de propósito: com os nomes já alinhados, a comparação
  // acha o par certo em vez de criar registro repetido. Só CRIA o lado que falta, nunca apaga.
  const reconciliacao =
    new Date().getUTCMinutes() === 24
      ? await reconciliarTodosOsWorkspaces().catch((erro) => {
          console.error("[cron] falha ao reconciliar funil e conversas:", erro);
          return { workspaces: 0, cardsCriados: 0, conversasCriadas: 0 };
        })
      : { workspaces: 0, cardsCriados: 0, conversasCriadas: 0 };

  // O elo que fica FORA deste banco: o aviso de mensagem nova registrado do lado da Evolution.
  // Se ele se perder (instância recriada, servidor restaurado, endereço do CRM mudado), o WhatsApp
  // continua perfeito no celular, a conexão continua marcada como conectada, e nenhuma mensagem
  // chega. Uma vez por hora o CRM pergunta pro outro lado o que ele tem registrado e conserta
  // sozinho. Ninguém que compra um CRM deve precisar saber o que é isso pra receber as mensagens.
  const canalQrCode =
    new Date().getUTCMinutes() === 25
      ? await conferirCanalQrCodeDeTodosOsWorkspaces().catch((erro) => {
          console.error("[cron] falha ao conferir o canal do QR Code:", erro);
          return { conferidos: 0, reparados: [] as string[] };
        })
      : { conferidos: 0, reparados: [] as string[] };

  /*
   * A importação do histórico do WhatsApp por QR Code, com a aba fechada.
   *
   * Ela existia só no navegador: andava enquanto a tela Configurações → WhatsApp estivesse aberta e
   * parava no instante em que a pessoa saía dali, sem avisar. Conectar e não ver as conversas
   * antigas aparecerem era exatamente isso.
   *
   * Vem por ÚLTIMO e com o tempo que sobrou, nunca mais que 8 segundos. Importar histórico é a
   * tarefa menos urgente daqui: campanha e follow-up têm hora pra sair, conversa de meses atrás
   * não. Se o minuto acabar no meio, o progresso já está gravado conversa a conversa e o próximo
   * minuto continua de onde parou.
   */
  // Quem já estava conectado antes do espelhamento existir nunca passou pelo momento em que a
  // fila é criada, e por isso nunca espelhou conversa nenhuma: nada acontecia, para sempre, sem
  // erro nenhum. Cria a fila pra quem falta, antes da rodada abaixo processá-la.
  const espelhamentosIniciados = await iniciarHistoricosQueFaltam().catch((erro) => {
    console.error("[cron] falha ao iniciar espelhamentos que faltavam:", erro);
    return { iniciados: 0 };
  });

  const gastos = Date.now() - comecoDaRodada;
  const sobra = Math.min(8_000, 55_000 - gastos);
  const historico =
    sobra > 1_000
      ? await rodarHistoricosPendentes({
          limiteMs: sobra,
          processarMensagem: (workspaceId, item) =>
            processarMensagemRecebida(workspaceId, item, { permitirHistorico: true }).then(() => undefined),
        }).catch((erro) => {
          console.error("[cron] falha ao importar histórico do WhatsApp:", erro);
          return { workspaces: 0, chats: 0 };
        })
      : { workspaces: 0, chats: 0 };

  return NextResponse.json({ ok: true, ...resultado, automacoes, porTempo, diarios, orfas, historico, nomes, reconciliacao, canalQrCode, donos, espelhamentosIniciados });
}
