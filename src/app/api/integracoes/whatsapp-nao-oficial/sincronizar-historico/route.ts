import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { processarMensagemRecebida } from "@/app/api/webhooks/evolution/route";
import { avancarHistorico } from "@/lib/integracoes/historico-passo";
import {
  lerMetadados,
  salvarHistorico,
  trazerMaisAntigas,
  type HistoricoSync,
} from "@/lib/integracoes/historico-whatsapp";

/**
 * A importação do histórico do WhatsApp por QR Code, do lado da tela.
 *
 * O trabalho de verdade mora em `historico-passo.ts`, porque ele tem DOIS donos: esta rota, que a
 * tela chama em laço enquanto está aberta, e o relógio do servidor, que continua com a aba fechada.
 * Antes só existia este lado, e quem conectava e saía da tela ficava com as primeiras conversas e
 * mais nada, sem aviso nenhum.
 */
/** PATCH pausa/retoma a sincronização sem perder o progresso. Dá controle pra usuária, caso
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

  // A tela chama isto em laço enquanto estiver aberta, com um intervalo entre chamadas. O mesmo
  // passo roda no relógio do servidor (ver `rodarHistoricosPendentes`), então quem fecha a aba não
  // perde a importação: ela continua sozinha, mais devagar. Os dois mexem no mesmo progresso.
  const resultado = await avancarHistorico(sessao.user.workspaceId, {
    // Uma conversa por chamada, como antes: quem está com a tela aberta vê o número subir de pouco
    // em pouco, e a sessão do WhatsApp não leva uma rajada.
    limiteMs: 1,
    processarMensagem: (workspaceId, item) =>
      processarMensagemRecebida(workspaceId, item, { permitirHistorico: true }).then(() => undefined),
  });
  if (!resultado) return NextResponse.json({ historico: null });
  const status = resultado.historico.status === "erro" ? 502 : 200;
  return NextResponse.json({ historico: resultado.historico }, { status });
}

/** "Trazer conversas mais antigas": devolve pra fila o que a primeira leva deixou de lado. */
export async function PUT() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const historico = await trazerMaisAntigas(sessao.user.workspaceId);
  return NextResponse.json({ historico });
}
