import { NextResponse } from "next/server";

import { autenticarChaveDoFlow } from "@/lib/integracoes/azuz-flow-chave";
import { dependenciasReais, receberLeadDoFlow } from "@/lib/integracoes/azuz-flow-lead";
import { LIMITES, validarPayloadDoFlow } from "@/lib/integracoes/azuz-flow-payload";
import {
  contarChamada,
  corpoGrandeDemais,
  ipDeQuemChamou,
  respostaDeCorpoGrande,
} from "@/lib/seguranca/limite-de-uso";
import { comRespostaEmJson } from "@/lib/integracoes/resposta-em-json";

/**
 * A porta de entrada dos leads do AZUZ Flow. Rota fina de propósito: ela cuida de HTTP (autenticar,
 * medir, recusar) e entrega o resto pra `receberLeadDoFlow`, que é testável sem servidor.
 *
 * Quem chama é uma máquina, então ela está em `rotas-publicas.ts` — sem isso o proxy devolveria 307
 * pro /login e o Flow registraria "entregue" numa rota que nunca rodou. A defesa é a chave,
 * conferida aqui dentro.
 */

/** Dois limites, porque eles protegem coisas diferentes: a chave contra um laço no Flow de um
 *  cliente, o IP contra alguém martelando a rota de fora com chave inválida (aí não há chave pra
 *  contar). */
const POR_CHAVE = { maximo: 120, janelaSegundos: 60 };
const POR_IP = { maximo: 240, janelaSegundos: 60 };

function recusar(status: number, erro: string, cabecalhos?: Record<string, string>) {
  return NextResponse.json({ ok: false, erro }, { status, headers: { "cache-control": "no-store", ...cabecalhos } });
}

export async function POST(request: Request) {
  /*
   * O envelope existe porque a parte de CIMA desta rota também pode lançar, e lançava.
   *
   * O `try` de baixo cobria só `receberLeadDoFlow`. `autenticarChaveDoFlow` fica antes dele e faz
   * uma consulta ao banco — com a tabela de chaves ausente, ela estourava e o Flow recebia 500 com
   * corpo vazio, que é justamente o que esta rota existe pra nunca fazer.
   */
  return comRespostaEmJson("azuz-flow/leads", () => receber(request));
}

async function receber(request: Request) {
  const ip = await ipDeQuemChamou();
  const porIp = contarChamada(`flow-leads:ip:${ip}`, POR_IP);
  if (!porIp.permitido) {
    return recusar(429, "Muitas chamadas. Tente de novo em instantes.", {
      "retry-after": String(porIp.esperarSegundos),
    });
  }

  if (corpoGrandeDemais(request, LIMITES.corpoBytes)) return respostaDeCorpoGrande();

  const autenticado = await autenticarChaveDoFlow(request.headers.get("authorization"));
  // Mensagem idêntica pra chave ausente, desconhecida e revogada: distinguir conta a quem está
  // sondando se o palpite acertou, e não ajuda quem é legítimo — a agência vê o estado da chave na
  // tela do CRM.
  if (!autenticado) return recusar(401, "Chave de integração inválida.");

  const porChave = contarChamada(`flow-leads:chave:${autenticado.chaveId}`, POR_CHAVE);
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

  const validado = validarPayloadDoFlow(bruto);
  if (!validado.ok) return recusar(400, validado.erro);

  try {
    const resultado = await receberLeadDoFlow({
      workspaceId: autenticado.workspaceId,
      lead: validado.lead,
      deps: dependenciasReais(autenticado.workspaceId),
    });
    return NextResponse.json(resultado, {
      // 201 só quando o contato nasceu agora. Entrega repetida e contato que já existia são 200:
      // nada foi criado.
      status: resultado.criado && !resultado.duplicado ? 201 : 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (erro) {
    // O id da entrega e o da empresa bastam pra investigar. O conteúdo do lead (nome, telefone,
    // e-mail, respostas) nunca entra em log: é dado de uma pessoa que não é cliente nosso.
    console.error(
      `[azuz-flow] falha ao receber lead (workspace ${autenticado.workspaceId}, entrega ${validado.lead.respostaId}):`,
      erro instanceof Error ? erro.message : erro,
    );
    return recusar(500, "Não deu pra receber o lead agora.");
  }
}
