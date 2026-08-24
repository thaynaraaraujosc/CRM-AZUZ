import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import { chamarGraph, ehTokenInvalido, MENSAGEM_POR_CODIGO_META } from "@/lib/integracoes/meta";

/**
 * Verificação diária de saúde de TODAS as conexões oficiais (Cloud API) — roda por cron da Vercel,
 * não por sessão de usuário. Existe porque a conexão quebra em silêncio: o cliente revoga a
 * permissão pelo WhatsApp Manager, o cartão dele vence, o número é banido — e sem isso o CRM segue
 * mostrando "conectado" enquanto nada mais funciona.
 *
 * Autenticado pelo header `Authorization: Bearer ${CRON_SECRET}` (padrão do Vercel Cron). Sem esse
 * segredo configurado, a rota recusa — não pode ficar aberta na internet.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    return NextResponse.json({ erro: "CRON_SECRET não configurado no servidor." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  const integracoes = await prisma.integracao.findMany({
    where: { provedor: "meta_whatsapp", status: "conectado" },
  });

  let verificadas = 0;
  let desconectadas = 0;

  for (const integracao of integracoes) {
    const { phoneNumberId } = (integracao.metadados as { phoneNumberId?: string } | null) ?? {};
    if (!phoneNumberId || !integracao.accessTokenCriptografado) continue;

    try {
      const numero = await chamarGraph<{ quality_rating?: string; status?: string; throughput?: { level?: string } }>(
        `/${phoneNumberId}?fields=quality_rating,status,throughput`,
        decriptar(integracao.accessTokenCriptografado),
      );
      const metadados = {
        ...((integracao.metadados as Record<string, unknown> | null) ?? {}),
        qualityRating: numero.quality_rating,
        statusNumero: numero.status,
        ...(numero.throughput?.level ? { limiteEnvio: numero.throughput.level } : {}),
        ultimaVerificacaoSaude: new Date().toISOString(),
      };
      await prisma.integracao.update({
        where: { id: integracao.id },
        data: { metadados: metadados as never },
      });
      verificadas += 1;
    } catch (erro) {
      const codigoMeta = (erro as Error & { codigoMeta?: number }).codigoMeta;
      if (ehTokenInvalido(codigoMeta)) {
        // Token revogado/expirado: marca como desconectado pra tela pedir reconexão em vez de
        // seguir "verde" mandando erro em silêncio.
        await prisma.integracao.update({
          where: { id: integracao.id },
          data: { status: "desconectado", erroMensagem: MENSAGEM_POR_CODIGO_META[190] },
        });
        desconectadas += 1;
      } else {
        console.error(`[saude whatsapp] falha ao verificar ${phoneNumberId}:`, erro);
      }
    }
  }

  return NextResponse.json({ ok: true, verificadas, desconectadas });
}
