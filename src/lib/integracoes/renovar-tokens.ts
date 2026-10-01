import type { PrismaClient } from "@/generated/prisma/client";

import { decriptar, encriptar } from "@/lib/integracoes/crypto";
import { renovarTokenInstagram } from "@/lib/integracoes/instagram-login";

/**
 * Renova os tokens do Instagram que estão perto de vencer.
 *
 * O token de longa duração do Instagram vale 60 dias. Nada o renovava, e o efeito de deixá-lo
 * morrer não se parece com "token expirado": a conta continua marcada como conectada, as mensagens
 * continuam chegando (o webhook não usa o token), mas tudo que precisa falar com a Meta para de
 * funcionar em silêncio — a miniatura do story, a prévia do reel, o anexo e a foto de perfil. Quem
 * usa conclui que o Instagram quebrou, e não há tela nenhuma dizendo o contrário.
 *
 * A Meta só renova um token que ainda está VÁLIDO e tem mais de 24 horas de vida. Token já vencido
 * não se renova: aí o único caminho é refazer a conexão pelo login. Por isso a folga é generosa —
 * renovar no dia do vencimento é apostar que a rodada daquele dia não falhou.
 */
const DIAS_DE_FOLGA = 10;

export async function renovarTokensDoInstagram(cliente: PrismaClient): Promise<{
  renovados: number;
  falharam: number;
}> {
  const limite = new Date(Date.now() + DIAS_DE_FOLGA * 24 * 60 * 60 * 1000);
  const integracoes = await cliente.integracao.findMany({
    where: {
      provedor: "meta_instagram",
      status: "conectado",
      expiraEm: { not: null, lte: limite },
    },
    select: { id: true, workspaceId: true, accessTokenCriptografado: true, expiraEm: true },
  });

  let renovados = 0;
  let falharam = 0;

  for (const integracao of integracoes) {
    if (!integracao.accessTokenCriptografado) continue;
    let tokenAtual: string;
    try {
      tokenAtual = decriptar(integracao.accessTokenCriptografado);
    } catch (erro) {
      console.error(`[instagram] Token ilegível no workspace ${integracao.workspaceId}:`, erro);
      falharam += 1;
      continue;
    }

    const novo = await renovarTokenInstagram(tokenAtual);
    if (!novo) {
      falharam += 1;
      // O erro já foi registrado por `renovarTokenInstagram`. Aqui o que importa é deixar escrito
      // na própria integração, pra tela poder dizer que a reconexão é necessária em vez de só
      // ficar sem miniatura.
      await cliente.integracao.update({
        where: { id: integracao.id },
        data: { erroMensagem: "Não foi possível renovar o acesso ao Instagram. Reconecte a conta." },
      });
      continue;
    }

    await cliente.integracao.update({
      where: { id: integracao.id },
      data: {
        accessTokenCriptografado: encriptar(novo.accessToken),
        expiraEm: novo.expiraEm,
        erroMensagem: null,
      },
    });
    renovados += 1;
  }

  return { renovados, falharam };
}
