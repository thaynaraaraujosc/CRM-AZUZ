import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buscarChats, buscarMensagensDoChat } from "@/lib/integracoes/evolution";
import { processarMensagemRecebida } from "@/app/api/webhooks/evolution/route";
import { lerMetadados, salvarHistorico, type HistoricoSync } from "@/lib/integracoes/historico-whatsapp";

/**
 * Processa UM lote pequeno de conversas por chamada — nunca o histórico inteiro de uma vez (foi
 * exatamente isso que floodou o banco numa conexão real, ver comentário em
 * `desativarSincronizacaoDeHistorico` em evolution.ts). Chamada repetidamente pelo front
 * (`useIntegracaoNaoOficial`, com um pequeno intervalo entre chamadas) até `status` virar
 * "concluido" — se a pessoa fechar a aba no meio, o progresso fica salvo em
 * `Integracao.metadados.historico` e retoma do ponto certo da próxima vez que a tela abrir.
 */
// 1 conversa por chamada (não 5+) — cada mensagem processada é um roundtrip sequencial no banco
// (dedupe + criação + upsert da conversa, igual o webhook ao vivo processa uma de cada vez), e uma
// conversa só já pode ter até `MENSAGENS_POR_CHAT` delas. Mais que isso por chamada arrisca estourar
// o tempo limite de uma função serverless num chat bem movimentado.
const CHATS_POR_LOTE = 1;
const MENSAGENS_POR_CHAT = 200;

/** PATCH pausa/retoma a sincronização sem perder o progresso — dá controle pra usuária, caso
 * desconfie que a sincronização está sobrecarregando a conexão do WhatsApp. */
export async function PATCH(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const { status } = (await request.json()) as { status?: "pausado" | "em_andamento" };
  if (status !== "pausado" && status !== "em_andamento") {
    return NextResponse.json({ erro: "status inválido" }, { status: 400 });
  }

  const metadados = await lerMetadados(workspaceId);
  const historico = metadados.historico as HistoricoSync | undefined;
  if (!historico || historico.status === "concluido" || historico.status === "erro") {
    return NextResponse.json({ historico: historico ?? null });
  }

  const atualizado: HistoricoSync = { ...historico, status };
  await salvarHistorico(workspaceId, metadados, atualizado);
  return NextResponse.json({ historico: atualizado });
}

export async function POST() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const metadados = await lerMetadados(workspaceId);
  let historico = metadados.historico as HistoricoSync | undefined;
  // Sem `historico` nenhum ainda: normalmente só acontece antes da PRIMEIRA conexão (o webhook
  // inicia sozinho no evento `connection.update`/`open`) — mas quem já estava conectado ANTES
  // dessa funcionalidade existir nunca recebeu esse evento de novo, então nunca ganhou uma
  // sincronização. Iniciar aqui também (sob demanda, chamado pelo próprio front ao detectar que
  // está conectado mas sem histórico) cobre esse caso sem exigir desconectar e reconectar.
  if (!historico) {
    historico = { status: "em_andamento", totalChats: null, chatsProcessados: 0, filaRestante: null };
  } else if (historico.status !== "em_andamento") {
    return NextResponse.json({ historico });
  }

  try {
    // Primeira chamada: ainda não tem a lista de conversas do celular — busca uma vez só (1
    // chamada) e guarda a fila inteira, sem processar mensagem nenhuma ainda.
    if (historico.filaRestante === null) {
      const chats = await buscarChats(workspaceId);
      historico = {
        ...historico,
        totalChats: chats.length,
        filaRestante: chats.map((c) => ({ remoteJid: c.remoteJid, arquivada: c.arquivada })),
      };
      await salvarHistorico(workspaceId, metadados, historico);
      return NextResponse.json({ historico });
    }

    const proximoLote = historico.filaRestante.slice(0, CHATS_POR_LOTE);
    const resto = historico.filaRestante.slice(CHATS_POR_LOTE);

    for (const chat of proximoLote) {
      const mensagens = await buscarMensagensDoChat(workspaceId, chat.remoteJid, MENSAGENS_POR_CHAT);
      for (const item of mensagens) {
        // Já sabemos de QUAL conversa essa mensagem é — pedimos ela pelo remoteJid de `chat`. Não
        // confia no `key.remoteJid` que vem dentro de cada mensagem: era isso que fazia mensagem de
        // grupo importada pelo histórico virar conversa avulsa (algumas respostas de
        // `findMessages` trazem o JID de quem mandou dentro do grupo, não o JID do grupo em si, no
        // campo que a gente esperava ser sempre o do chat).
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
        await processarMensagemRecebida(workspaceId, corrigido, { permitirHistorico: true }).catch((erro) =>
          console.error(`[sincronizar-historico] Falha ao processar mensagem de ${chat.remoteJid}:`, erro),
        );
      }
      // Reflete o estado "arquivada" de verdade do celular — sem isso, uma conversa/grupo arquivado
      // no WhatsApp aparecia solto em "Tudo" assim que a primeira mensagem dele fosse importada.
      // `contato` guarda o JID inteiro pra grupo (`@g.us`) e só os dígitos do número pra conversa
      // individual (mesma convenção usada no webhook ao vivo, ver `processarMensagemRecebida`).
      const ehGrupo = chat.remoteJid.endsWith("@g.us");
      const contatoNoBanco = ehGrupo ? chat.remoteJid : chat.remoteJid.split("@")[0];
      await prisma.conversa
        .updateMany({
          where: { workspaceId, contato: contatoNoBanco, ehGrupo },
          data: { arquivada: chat.arquivada },
        })
        .catch((erro) =>
          console.error(`[sincronizar-historico] Falha ao marcar arquivada de ${chat.remoteJid}:`, erro),
        );
    }

    historico = {
      ...historico,
      filaRestante: resto,
      chatsProcessados: historico.chatsProcessados + proximoLote.length,
      status: resto.length === 0 ? "concluido" : "em_andamento",
    };
    await salvarHistorico(workspaceId, metadados, historico);
    return NextResponse.json({ historico });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha na sincronização de histórico";
    const historicoComErro: HistoricoSync = { ...historico, status: "erro", erro: mensagem };
    await salvarHistorico(workspaceId, metadados, historicoComErro).catch(() => {});
    return NextResponse.json({ historico: historicoComErro }, { status: 502 });
  }
}
