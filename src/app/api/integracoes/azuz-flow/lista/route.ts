import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { autenticarChaveDoFlow } from "@/lib/integracoes/azuz-flow-chave";
import { comRespostaEmJson } from "@/lib/integracoes/resposta-em-json";
import { receberListaDoFlow, type RespostaDaLista } from "@/lib/integracoes/azuz-flow-lista";
import { LIMITES_DA_LISTA, validarListaDoFlow } from "@/lib/integracoes/azuz-flow-lista-payload";
import { dependenciasReaisDaLista } from "@/lib/integracoes/azuz-flow-lista-reais";
import { ehChaveDuplicada } from "@/lib/prisma-erros";
import {
  contarChamada,
  corpoGrandeDemais,
  ipDeQuemChamou,
  respostaDeCorpoGrande,
} from "@/lib/seguranca/limite-de-uso";

/**
 * UMA COLUNA DO QUADRO DO FLOW ENTRANDO NO CRM.
 *
 * A agência clica no ⋯ de "No show", escolhe funil e etapa, e o Flow manda a coluna em lotes de
 * até 50. Daqui pra frente quem conversa com essas pessoas é o CRM — a automação mora na etapa.
 *
 * ROTA NOVA, e não um campo a mais na `/leads`: o validador de lá ignora campo desconhecido, então
 * um CRM sem esta atualização receberia a lista inteira, jogaria todo mundo no primeiro funil e
 * dispararia `formulario_preenchido` pra gente que não preencheu formulário. Separada, o CRM
 * desatualizado responde 404 e o Flow lê isso como "ainda não dá": nenhum lead sai do lugar.
 *
 * Pelo mesmo motivo, esta rota nunca responde 200 vazio nem redireciona. Um 200 mentiria.
 */

/** 50 leads com escrita no banco cada. O Flow espera 30 s por lote; o orçamento aqui é 25. */
export const maxDuration = 60;

const POR_CHAVE = { maximo: 60, janelaSegundos: 60 };
const POR_IP = { maximo: 120, janelaSegundos: 60 };

/** A origem com que as entregas desta rota são guardadas. Separada da `/leads` de propósito: são
 *  duas conversas diferentes com o mesmo produto, e misturá-las faria uma achar a entrega da
 *  outra pela chave. */
const ORIGEM_LISTA = "azuz_flow_lista";

function recusar(status: number, erro: string, cabecalhos?: Record<string, string>) {
  return NextResponse.json({ ok: false, erro }, { status, headers: { "cache-control": "no-store", ...cabecalhos } });
}

export async function POST(request: Request) {
  return comRespostaEmJson("azuz-flow/lista", () => receber(request));
}

async function receber(request: Request) {
  const comecou = Date.now();

  const ip = await ipDeQuemChamou();
  const porIp = contarChamada(`flow-lista:ip:${ip}`, POR_IP);
  if (!porIp.permitido) {
    return recusar(429, "Muitas chamadas. Tente de novo em instantes.", {
      "retry-after": String(porIp.esperarSegundos),
    });
  }

  if (corpoGrandeDemais(request, LIMITES_DA_LISTA.corpoBytes)) return respostaDeCorpoGrande();

  const autenticado = await autenticarChaveDoFlow(request.headers.get("authorization"));
  if (!autenticado) return recusar(401, "Chave de integração inválida.");

  const porChave = contarChamada(`flow-lista:chave:${autenticado.chaveId}`, POR_CHAVE);
  if (!porChave.permitido) {
    return recusar(429, "Muitas chamadas. Tente de novo em instantes.", {
      "retry-after": String(porChave.esperarSegundos),
    });
  }

  let bruto: unknown;
  try {
    bruto = await request.json();
  } catch {
    return recusar(400, "O corpo não é um JSON válido.");
  }

  const validado = validarListaDoFlow(bruto);
  if (!validado.ok) return recusar(400, validado.erro);

  /*
   * IDEMPOTÊNCIA DE LOTE.
   *
   * O Flow reenvia a lista inteira quando a pessoa clica de novo, e repete o lote quando a rede
   * cai no meio. A mesma chave devolve o MESMO resultado sem reprocessar nada — e é o que impede
   * um gatilho de etapa de disparar duas vezes pra quem já recebeu a sequência.
   *
   * A chave é opcional só na forma: sem ela, cada clique vira um processamento novo. Não recusamos
   * por falta dela porque a segunda tranca (contato por telefone, card por funil) já segura a
   * duplicação do que importa; o que se perde é só o trabalho repetido.
   */
  const chaveIdem = request.headers.get("idempotency-key")?.trim()?.slice(0, 190) || null;
  if (chaveIdem) {
    const anterior = await prisma.leadRecebido.findUnique({
      where: {
        workspaceId_origem_chaveExterna: {
          workspaceId: autenticado.workspaceId,
          origem: ORIGEM_LISTA,
          chaveExterna: chaveIdem,
        },
      },
      select: { resultado: true },
    });
    if (anterior?.resultado) {
      return NextResponse.json(
        { ok: true, versao: 1, ...(anterior.resultado as object) },
        { headers: { "cache-control": "no-store" } },
      );
    }
  }

  const resultado = await receberListaDoFlow({
    payload: validado.payload,
    deps: dependenciasReaisDaLista(autenticado.workspaceId),
  });

  // Destino que não é desta empresa, ou etapa que não é do funil: 422, e nada foi escrito.
  if ("erro" in resultado) return recusar(422, resultado.erro);

  if (chaveIdem) {
    /*
     * Gravada DEPOIS do trabalho, e com a falha engolida: perder o registro faz o próximo reenvio
     * reprocessar (que é idempotente de qualquer jeito, pelas travas de contato e de card);
     * estourar aqui transformaria uma entrega que deu certo num 500, e o Flow repetiria tudo.
     */
    await prisma.leadRecebido
      .create({
        data: {
          workspaceId: autenticado.workspaceId,
          origem: ORIGEM_LISTA,
          chaveExterna: chaveIdem,
          contatoId: null,
          conversaId: null,
          confirmacaoId: null,
          resultado: resultado as unknown as object,
        },
      })
      .catch((erro) => {
        // Chave repetida aqui quer dizer que dois lotes idênticos correram juntos: a outra gravou
        // primeiro, e o resultado dela é equivalente ao nosso. Não é erro.
        if (!ehChaveDuplicada(erro)) {
          console.error("[azuz-flow/lista] não deu pra guardar a chave de idempotência:", erro);
        }
      });
  }

  // Nada do conteúdo dos leads entra em log: são pessoas que não são clientes nossos.
  console.log(
    `[azuz-flow/lista] ${validado.payload.leads.length} leads (workspace ${autenticado.workspaceId}, ` +
      `lista ${validado.payload.origem.listaId}): ${Date.now() - comecou}ms`,
  );

  return NextResponse.json(
    { ok: true, versao: 1, ...(resultado as RespostaDaLista) },
    { headers: { "cache-control": "no-store" } },
  );
}
