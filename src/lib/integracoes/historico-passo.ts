import { prisma } from "@/lib/prisma";
import { buscarChats, buscarMensagensDoChat } from "@/lib/integracoes/evolution";
import {
  lerMetadados,
  salvarHistorico,
  type HistoricoSync,
} from "@/lib/integracoes/historico-whatsapp";
import { separarPrimeiraLeva } from "@/lib/integracoes/historico-tipos";

/**
 * Um passo da importação do histórico do WhatsApp por QR Code.
 *
 * Antes isto morava só na rota, e a rota só era chamada pelo NAVEGADOR, em laço, enquanto a tela
 * Configurações → WhatsApp estivesse aberta. Quem conectava e saía da tela ficava com as primeiras
 * conversas e mais nada, sem nenhum aviso de que a importação tinha parado no meio. Era o motivo
 * de "conectei e minhas conversas antigas não apareceram".
 *
 * Agora é uma função, e quem chama são dois: a tela (rápido, enquanto ela está aberta) e o relógio
 * do servidor (devagar, com a aba fechada). Os dois mexem no mesmo progresso gravado, então
 * qualquer um pode continuar de onde o outro parou.
 *
 * O ritmo continua deliberadamente lento. Uma sessão de WhatsApp recém-conectada é sensível a
 * comportamento automatizado, e a própria WhatsApp derruba quem parece robô batendo sem parar. E
 * puxar tudo de uma vez já derrubou o CRM numa conexão real, com 41 mil mensagens de enfiada.
 */

/** Quantas mensagens trazer de cada conversa. Cobre meses numa conta comercial. */
const MENSAGENS_POR_CHAT = 200;

export type ResultadoPasso = {
  historico: HistoricoSync;
  chatsFeitos: number;
};

/**
 * Avança a importação de UM workspace até acabar a fila ou o orçamento de tempo.
 *
 * `limiteMs` existe porque este passo divide o mesmo minuto de função com as campanhas e as
 * automações. Sem teto, uma conta com muita conversa comeria o tempo das outras tarefas e o
 * follow-up de alguém deixaria de sair. Passar do teto no meio de um chat não perde nada: o
 * progresso é gravado a cada conversa.
 */
export async function avancarHistorico(
  workspaceId: string,
  opcoes: { limiteMs: number; processarMensagem: (workspaceId: string, item: unknown) => Promise<void> },
): Promise<ResultadoPasso | null> {
  const comeco = Date.now();
  const metadados = await lerMetadados(workspaceId);
  let historico = metadados.historico as HistoricoSync | undefined;
  if (!historico) {
    historico = { status: "em_andamento", totalChats: null, chatsProcessados: 0, filaRestante: null };
  } else if (historico.status !== "em_andamento") {
    return { historico, chatsFeitos: 0 };
  }

  try {
    // Primeira passada: pega a lista de conversas do celular, uma vez só, e separa as recentes das
    // antigas. Nenhuma mensagem é processada ainda.
    if (historico.filaRestante === null) {
      const chats = await buscarChats(workspaceId);
      const { primeiras, guardadas } = separarPrimeiraLeva(chats.map((c) => ({ remoteJid: c.remoteJid })));
      historico = {
        ...historico,
        totalChats: primeiras.length,
        filaRestante: primeiras,
        filaGuardada: guardadas,
      };
      await salvarHistorico(workspaceId, metadados, historico);
      return { historico, chatsFeitos: 0 };
    }

    let chatsFeitos = 0;
    // A partir daqui a fila existe: o ramo acima devolve cedo quando ela ainda é `null`. O
    // TypeScript não acompanha isso através das reatribuições, então o estreitamento é explícito.
    let fila: { remoteJid: string }[] = historico.filaRestante;
    // SEMPRE ao menos uma conversa por chamada, e depois disso só enquanto couber no orçamento.
    // A tela chama isto com orçamento mínimo de propósito: ela quer uma conversa por vez, com uma
    // pausa entre as chamadas, pra não parecer robô batendo na sessão do WhatsApp. Se a condição
    // de tempo fosse checada antes da primeira, esse caminho não processaria nada nunca.
    while (fila.length > 0 && (chatsFeitos === 0 || Date.now() - comeco < opcoes.limiteMs)) {
      const chat = fila[0];
      const mensagens = await buscarMensagensDoChat(workspaceId, chat.remoteJid, MENSAGENS_POR_CHAT);
      for (const item of mensagens) {
        // Já sabemos de QUAL conversa a mensagem é: pedimos por este `remoteJid`. Não dá pra
        // confiar no que vem dentro de cada mensagem, porque algumas respostas trazem o JID de quem
        // falou dentro do grupo em vez do JID do grupo, e a mensagem virava conversa avulsa.
        const corrigido =
          item && typeof item === "object"
            ? {
                ...(item as Record<string, unknown>),
                key: {
                  ...((item as { key?: Record<string, unknown> }).key ?? {}),
                  remoteJid: chat.remoteJid,
                },
              }
            : item;
        await opcoes.processarMensagem(workspaceId, corrigido).catch((erro) =>
          console.error(`[historico] falha ao processar mensagem de ${chat.remoteJid}:`, erro),
        );
      }

      fila = fila.slice(1);
      historico = {
        ...historico,
        filaRestante: fila,
        chatsProcessados: historico.chatsProcessados + 1,
      };
      chatsFeitos += 1;
      // Grava a CADA conversa, não no fim: a função pode ser cortada pela plataforma a qualquer
      // momento, e progresso perdido significa reprocessar mensagem que já entrou.
      await salvarHistorico(workspaceId, metadados, historico);
    }

    if (fila.length === 0) {
      historico = { ...historico, status: "concluido" };
      await salvarHistorico(workspaceId, metadados, historico);
    }
    return { historico, chatsFeitos };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha na importação do histórico";
    const comErro: HistoricoSync = { ...historico, status: "erro", erro: mensagem };
    await salvarHistorico(workspaceId, metadados, comErro).catch(() => {});
    return { historico: comErro, chatsFeitos: 0 };
  }
}

/**
 * Avança a importação de todo mundo que tem uma em andamento. Chamado pelo relógio.
 *
 * A consulta que descobre quem precisa lê uma tabela pequena (uma linha de integração por
 * workspace) e o filtro do estado é feito em memória, porque o progresso mora dentro de um JSON e
 * não dá pra indexar. Sem ninguém importando nada, a rodada custa essa consulta e mais nada.
 */
export async function rodarHistoricosPendentes(opcoes: {
  limiteMs: number;
  processarMensagem: (workspaceId: string, item: unknown) => Promise<void>;
}): Promise<{ workspaces: number; chats: number }> {
  const comeco = Date.now();
  const conexoes = await prisma.integracao.findMany({
    where: { provedor: "whatsapp_nao_oficial", status: "conectado" },
    select: { workspaceId: true, metadados: true },
  });

  const pendentes = conexoes.filter((c) => {
    const h = (c.metadados as { historico?: HistoricoSync } | null)?.historico;
    return h?.status === "em_andamento";
  });
  if (!pendentes.length) return { workspaces: 0, chats: 0 };

  let chats = 0;
  let atendidos = 0;
  for (const conexao of pendentes) {
    const restante = opcoes.limiteMs - (Date.now() - comeco);
    if (restante <= 500) break;
    // O orçamento é dividido entre quem está esperando, pra uma conta com muita conversa não
    // segurar a fila das outras.
    const fatia = Math.max(1000, Math.floor(restante / (pendentes.length - atendidos)));
    const r = await avancarHistorico(conexao.workspaceId, {
      limiteMs: Math.min(fatia, restante),
      processarMensagem: opcoes.processarMensagem,
    }).catch((erro) => {
      console.error(`[historico] falha no workspace ${conexao.workspaceId}:`, erro);
      return null;
    });
    chats += r?.chatsFeitos ?? 0;
    atendidos += 1;
  }
  return { workspaces: pendentes.length, chats };
}
