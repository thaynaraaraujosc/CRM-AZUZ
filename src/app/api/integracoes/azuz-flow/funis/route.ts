import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { autenticarChaveDoFlow } from "@/lib/integracoes/azuz-flow-chave";
import { comRespostaEmJson } from "@/lib/integracoes/resposta-em-json";
import { contarChamada, ipDeQuemChamou } from "@/lib/seguranca/limite-de-uso";

/**
 * PRA ONDE O FLOW PODE MANDAR UMA COLUNA: os funis desta empresa e as etapas de cada um.
 *
 * O Flow mostra isso num menu ("Enviar ao CRM…" no ⋯ da coluna) pra a pessoa escolher funil e
 * etapa — é NA ETAPA que mora a automação que vai aquecer aquelas pessoas.
 *
 * SÓ ID E NOME. Esta rota responde "pra onde", não "o que tem lá": card, contato e valor são do
 * CRM e não têm por que atravessar a rede pra montar um menu. Mandar o que não é preciso é só
 * aumentar o que vaza no dia em que uma chave vazar.
 */

const POR_CHAVE = { maximo: 60, janelaSegundos: 60 };
const POR_IP = { maximo: 120, janelaSegundos: 60 };

function recusar(status: number, erro: string, cabecalhos?: Record<string, string>) {
  return NextResponse.json({ ok: false, erro }, { status, headers: { "cache-control": "no-store", ...cabecalhos } });
}

export async function GET(request: Request) {
  // O envelope porque a autenticação também consulta o banco: com a tabela de chaves fora do ar,
  // ela estourava e o Flow recebia um 500 de corpo vazio — exatamente o que estas rotas existem
  // pra nunca fazer.
  return comRespostaEmJson("azuz-flow/funis", () => listar(request));
}

async function listar(request: Request) {
  const ip = await ipDeQuemChamou();
  const porIp = contarChamada(`flow-funis:ip:${ip}`, POR_IP);
  if (!porIp.permitido) {
    return recusar(429, "Muitas chamadas. Tente de novo em instantes.", {
      "retry-after": String(porIp.esperarSegundos),
    });
  }

  const autenticado = await autenticarChaveDoFlow(request.headers.get("authorization"));
  // Mesma frase pra chave ausente, desconhecida e revogada: distinguir conta a quem está sondando
  // se o palpite acertou, e não ajuda quem é legítimo.
  if (!autenticado) return recusar(401, "Chave de integração inválida.");

  const porChave = contarChamada(`flow-funis:chave:${autenticado.chaveId}`, POR_CHAVE);
  if (!porChave.permitido) {
    return recusar(429, "Muitas chamadas. Tente de novo em instantes.", {
      "retry-after": String(porChave.esperarSegundos),
    });
  }

  const funis = await prisma.funil.findMany({
    where: { workspaceId: autenticado.workspaceId },
    select: {
      id: true,
      nome: true,
      // A ordem da TELA, não a do banco: é a lista que a pessoa reconhece do quadro dela.
      etapas: { select: { id: true, titulo: true }, orderBy: { ordem: "asc" } },
    },
    orderBy: { nome: "asc" },
  });

  /*
   * FUNIL SEM ETAPA NÃO VEM. Ele não tem destino possível — escolhê-lo no menu levaria a uma
   * segunda escolha vazia, e aí a pessoa volta sem entender o que fez de errado.
   *
   * Funil de número de WhatsApp VEM, e isso é de propósito: ele é um funil como outro qualquer, e
   * mandar uma coluna pra lá é legítimo (a agência pode querer que a reativação saia pelo número
   * do closer). O que o `contaCanal` do funil governa é de onde o lead CHEGA sozinho, não pra
   * onde alguém pode mandá-lo de propósito.
   */
  return NextResponse.json(
    {
      ok: true,
      versao: 1,
      funis: funis.filter((f) => f.etapas.length > 0),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
