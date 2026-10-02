import { prisma } from "@/lib/prisma";
import { ESPERA_ENTRE_REINICIOS_MS, type HistoricoSync } from "./historico-tipos";

/**
 * Progresso da sincronização de histórico sob demanda (ver `POST
 * .../whatsapp-nao-oficial/sincronizar-historico`): guardado dentro de
 * `Integracao.metadados` (não uma tabela própria: é estado transitório de UMA sincronização, não
 * um dado de negócio que precise de histórico/relacionamentos próprios).
 *
 * `filaRestante === null` significa "ainda não buscou a lista de conversas do celular" (primeira
 * chamada do batch busca a lista inteira uma vez e preenche isso); depois disso, cada chamada tira
 * um lote pequeno da fila e processa, até esvaziar.
 */
export type { ChatNaFila, HistoricoSync } from "./historico-tipos";
export { CHATS_NA_PRIMEIRA_LEVA } from "./historico-tipos";

export async function lerMetadados(workspaceId: string): Promise<Record<string, unknown>> {
  const linha = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId, provedor: "whatsapp_nao_oficial" } },
    select: { metadados: true },
  });
  return (linha?.metadados as Record<string, unknown>) ?? {};
}

export async function salvarHistorico(
  workspaceId: string,
  metadadosAtuais: Record<string, unknown>,
  historico: HistoricoSync,
): Promise<void> {
  await prisma.integracao.update({
    where: { workspaceId_provedor: { workspaceId, provedor: "whatsapp_nao_oficial" } },
    data: { metadados: { ...metadadosAtuais, historico } },
  });
}

/**
 * Põe na fila as conversas antigas que tinham ficado guardadas.
 *
 * É o "trazer conversas mais antigas": não busca nada de novo no celular, só devolve pra fila o que
 * a primeira leva deixou de lado, e o relógio processa como processou as primeiras.
 */
export async function trazerMaisAntigas(workspaceId: string): Promise<HistoricoSync | null> {
  const metadados = await lerMetadados(workspaceId);
  const historico = metadados.historico as HistoricoSync | undefined;
  if (!historico) return null;
  const guardadas = historico.filaGuardada ?? [];
  if (!guardadas.length) return historico;

  const atualizado: HistoricoSync = {
    ...historico,
    status: "em_andamento",
    filaRestante: [...(historico.filaRestante ?? []), ...guardadas],
    filaGuardada: [],
    totalChats: (historico.totalChats ?? 0) + guardadas.length,
  };
  await salvarHistorico(workspaceId, metadados, atualizado);
  return atualizado;
}

/**
 * Chamado assim que a conexão abre. Garante que CONECTAR sempre traga as conversas recentes.
 *
 * A regra antiga era "não faz nada se já existe qualquer histórico registrado", pra uma reconexão
 * comum (celular caiu e voltou) não reprocessar tudo de novo. A intenção estava certa, mas ela
 * também travava o caso em que a importação anterior NÃO TROUXE NADA: uma sessão recém-lida demora
 * pra montar a lista de conversas do celular, e quando ela esgota as tentativas a importação fica
 * gravada como "concluída com zero conversa". Daí em diante, reconectar não tentava de novo —
 * nunca. O CRM ficava permanentemente sem as conversas do celular, e a única coisa que aparecia
 * era mensagem nova, uma a uma, conforme alguém escrevesse.
 *
 * Agora uma tentativa que acabou SEM CONVERSA NENHUMA (ou em erro) não conta como feita: conectar
 * recomeça. É isso que faz "desconectei e reconectei" trazer as conversas recentes de novo,
 * independentemente de quando foi a última tentativa. Uma importação que trouxe conversa de
 * verdade continua intocada, que é o que evita reprocessar tudo a cada queda de sinal.
 */
export async function iniciarHistoricoSeNecessario(workspaceId: string): Promise<void> {
  const metadados = await lerMetadados(workspaceId);
  if (!precisaTentarDeNovo(metadados.historico as HistoricoSync | undefined)) return;
  await salvarHistorico(workspaceId, metadados, {
    status: "em_andamento",
    totalChats: null,
    chatsProcessados: 0,
    filaRestante: null,
    reiniciadoEm: new Date().toISOString(),
  });
}

/**
 * Vale (re)começar a importação deste workspace?
 *
 * Sim quando nunca houve nenhuma, quando a anterior falhou, e quando ela terminou sem trazer
 * conversa nenhuma — os três casos em que o celular ficou de fora do CRM. Não quando há uma em
 * andamento/pausada (seria atropelar o progresso) nem quando uma concluída trouxe conversa de
 * verdade (seria reprocessar tudo a cada reconexão).
 *
 * Pura, e separada, porque é a decisão que mantinha a conexão presa pra sempre sem conversa nenhuma.
 */
export function precisaTentarDeNovo(
  historico: HistoricoSync | undefined | null,
  opcoes: { respeitarEspera?: boolean; agora?: number } = {},
): boolean {
  if (!historico) return true;
  const vazia = historico.status === "erro" || (historico.status === "concluido" && !historico.totalChats);
  if (!vazia) return false;
  // Conectar é ação de alguém: não espera carência. O relógio espera, pra não ficar recomeçando de
  // minuto em minuto numa conta cujo celular não vai devolver lista nenhuma.
  if (!opcoes.respeitarEspera) return true;
  const desde = historico.reiniciadoEm ? Date.parse(historico.reiniciadoEm) : 0;
  return (opcoes.agora ?? Date.now()) - desde >= ESPERA_ENTRE_REINICIOS_MS;
}

/**
 * Começa o espelhamento nas conexões que já estavam ligadas antes disso existir.
 *
 * `iniciarHistoricoSeNecessario` só é chamado quando a conexão ABRE. Quem já estava conectado
 * quando essa funcionalidade entrou nunca passou por esse momento, e por isso nunca espelhou
 * conversa nenhuma: a fila jamais foi criada, então o relógio não tinha o que processar e o
 * sintoma era simplesmente nada acontecer, para sempre, sem erro nenhum.
 *
 * A única saída era desconectar e ler o QR de novo, o que é pedir pro cliente consertar o produto.
 * Esta passada cria a fila pra quem está conectado e nunca começou. Idempotente: quem já tem
 * histórico (em andamento ou concluído) não é tocado.
 */
export async function iniciarHistoricosQueFaltam(): Promise<{ iniciados: number }> {
  const conexoes = await prisma.integracao.findMany({
    where: { provedor: "whatsapp_nao_oficial", status: "conectado" },
    select: { workspaceId: true, metadados: true },
  });
  let iniciados = 0;
  for (const conexao of conexoes) {
    const metadados = (conexao.metadados as Record<string, unknown> | null) ?? {};
    // Mesma regra do `connection.update`, mas COM carência: uma importação que terminou sem
    // conversa nenhuma é recomeçada aqui também, senão a conexão ficaria presa pra sempre sem as
    // conversas do celular e sem ninguém pra apertar nada. Ver `precisaTentarDeNovo`.
    if (!precisaTentarDeNovo(metadados.historico as HistoricoSync | undefined, { respeitarEspera: true })) continue;
    await salvarHistorico(conexao.workspaceId, metadados, {
      status: "em_andamento",
      totalChats: null,
      chatsProcessados: 0,
      filaRestante: null,
      reiniciadoEm: new Date().toISOString(),
    }).catch((erro) => console.error(`[historico] falha ao iniciar no workspace ${conexao.workspaceId}:`, erro));
    iniciados += 1;
  }
  return { iniciados };
}

/**
 * Roda a importação DE NOVO, buscando a lista de conversas do celular outra vez.
 *
 * O buraco que isto fecha: só as 30 conversas mais recentes vinham sozinhas, e as outras ficavam
 * em `filaGuardada`, atrás do botão "Trazer as mais antigas". Mas esse botão só existe enquanto
 * sobrou algo guardado. Quando a importação terminava com a fila vazia — ou terminou antes de um
 * grupo existir, ou antes de o CRM saber tratar grupo — não havia NENHUM caminho de volta: a
 * conversa antiga só apareceria se alguém escrevesse nela de novo. O único escape era desconectar
 * e ler o QR Code outra vez, que é pedir pra cliente consertar o produto.
 *
 * `filaRestante: null` é o que diz "ainda não busquei a lista": o próximo passo consulta a
 * Evolution de novo (`buscarChats`, que traz grupo e pessoa) e remonta a fila do zero.
 *
 * REPETIR NÃO DUPLICA NADA. Mensagem já gravada é reconhecida pelo id do WhatsApp e ignorada antes
 * de qualquer escrita; contato e conversa são upsert por chave. E importação não conta como não
 * lida nem dispara automação, então rodar de novo não enche a tela de badge falso nem manda
 * resposta automática pra conversa encerrada.
 */
export async function reimportarHistorico(workspaceId: string): Promise<HistoricoSync> {
  const metadados = await lerMetadados(workspaceId);
  const anterior = metadados.historico as HistoricoSync | undefined;
  const historico: HistoricoSync = {
    status: "em_andamento",
    totalChats: null,
    // Preserva a contagem do que já passou: o número na tela não pode voltar a zero e dar a
    // impressão de que o trabalho anterior foi perdido.
    chatsProcessados: anterior?.chatsProcessados ?? 0,
    filaRestante: null,
    filaGuardada: [],
    tentativasSemChats: 0,
    reiniciadoEm: new Date().toISOString(),
  };
  await salvarHistorico(workspaceId, metadados, historico);
  return historico;
}
