import { NextResponse } from "next/server";

import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { guardarMidiasDosExtras } from "@/lib/armazenamento/midia";
import { r2Configurado } from "@/lib/armazenamento/r2";

/**
 * Move pro R2 os anexos que ainda estão gravados em base64 dentro das mensagens.
 *
 * Em lotes, de propósito. Um workspace com anos de conversa tem milhares de arquivos somando
 * gigabytes; tentar mover tudo numa requisição só estouraria o tempo limite no meio do caminho — e
 * pior, sem deixar claro o que já tinha sido movido e o que não. Cada lote é independente e
 * definitivo: se a chamada morrer, o que já subiu está subido, e a próxima continua de onde parou.
 *
 * A mensagem só é reescrita DEPOIS de o arquivo estar no R2 (`guardarMidiasDosExtras` devolve a
 * data URL original se a subida falhar). Nunca existe um instante em que a mensagem aponta pra um
 * arquivo que não existe.
 */
export const dynamic = "force-dynamic";

/** Quantas mensagens por chamada. Baixo porque cada uma pode carregar um vídeo de vários MB. */
const TAMANHO_DO_LOTE = 25;

export async function POST() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (!r2Configurado()) return NextResponse.json({ erro: "Armazenamento na nuvem não configurado." }, { status: 400 });

  const workspaceId = sessao.user.workspaceId;

  // `string_contains` procura o texto dentro do JSON gravado. É uma varredura, não um índice — por
  // isso vem limitada ao lote e filtrada por workspace antes de tudo.
  const pendentes = await prisma.mensagemExtra.findMany({
    where: { workspaceId, extras: { string_contains: "data:" } },
    select: { id: true, extras: true },
    take: TAMANHO_DO_LOTE,
  });

  let migradas = 0;
  let falhas = 0;

  for (const mensagem of pendentes) {
    try {
      const novos = await guardarMidiasDosExtras(mensagem.extras, workspaceId);
      // Comparar antes de gravar evita reescrever mensagem que não mudou — e, mais importante,
      // evita marcar como migrada uma cujo upload falhou e voltou a data URL original.
      if (JSON.stringify(novos) === JSON.stringify(mensagem.extras)) {
        falhas += 1;
        continue;
      }
      await prisma.mensagemExtra.update({
        where: { id: mensagem.id },
        data: { extras: novos as Prisma.InputJsonValue },
      });
      migradas += 1;
    } catch (erro) {
      console.error(`[migrar] Falha na mensagem ${mensagem.id}:`, erro);
      falhas += 1;
    }
  }

  const restantes = await prisma.mensagemExtra.count({
    where: { workspaceId, extras: { string_contains: "data:" } },
  });

  return NextResponse.json({ migradas, falhas, restantes }, { headers: { "cache-control": "no-store" } });
}
