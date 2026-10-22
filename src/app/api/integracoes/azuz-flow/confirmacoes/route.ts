import { NextResponse } from "next/server";

import { autenticarChaveDoFlow } from "@/lib/integracoes/azuz-flow-chave";
import { MAXIMO_DE_IDS, situacaoDasConfirmacoes } from "@/lib/integracoes/azuz-flow-confirmacoes-consulta";
import { comRespostaEmJson } from "@/lib/integracoes/resposta-em-json";
import { contarChamada, ipDeQuemChamou } from "@/lib/seguranca/limite-de-uso";

/**
 * "O que aconteceu com estas respostas?" — o AZUZ Flow perguntando pelo lote de leads que mandou.
 *
 * Existe porque a tela de Respostas dele ficava parada em "Confirmação de reunião na fila para
 * envio.": a mensagem sai minutos depois, pelo cron, e o Flow nunca era avisado. A agência via "na
 * fila" numa mensagem que já tinha chegado no WhatsApp.
 *
 * Mesma chave e mesmos erros das outras rotas do Flow. Está em `rotas-publicas.ts` porque quem
 * chama é um servidor, sem navegador nem sessão — e a lista é por CAMINHO, não por prefixo, então
 * uma rota nova que não entre nela recebe 307 pro /login e o Flow lê uma página de login como se
 * fosse a resposta.
 */
export async function GET(request: Request) {
  return comRespostaEmJson("azuz-flow/confirmacoes", () => responder(request));
}

function recusar(status: number, erro: string, cabecalhos?: Record<string, string>) {
  return NextResponse.json({ ok: false, erro }, { status, headers: { "cache-control": "no-store", ...cabecalhos } });
}

async function responder(request: Request) {
  const ip = await ipDeQuemChamou();
  const limite = contarChamada(`flow-confirmacoes:ip:${ip}`, { maximo: 120, janelaSegundos: 60 });
  if (!limite.permitido) {
    return recusar(429, "Muitas chamadas. Tente de novo em instantes.", {
      "retry-after": String(limite.esperarSegundos),
    });
  }

  const autenticado = await autenticarChaveDoFlow(request.headers.get("authorization"));
  // Mensagem idêntica pra chave ausente, desconhecida e revogada, como nas outras rotas:
  // distinguir conta a quem está sondando se o palpite acertou.
  if (!autenticado) return recusar(401, "Chave de integração inválida.");

  const bruto = new URL(request.url).searchParams.get("respostaIds") ?? "";
  const ids = bruto.split(",").map((id) => id.trim()).filter(Boolean);
  if (!ids.length) return recusar(400, "Informe `respostaIds` separados por vírgula.");
  if (ids.length > MAXIMO_DE_IDS) {
    return recusar(400, `São no máximo ${MAXIMO_DE_IDS} respostas por consulta.`);
  }

  const confirmacoes = await situacaoDasConfirmacoes(autenticado.workspaceId, ids);
  return NextResponse.json({ ok: true, confirmacoes }, { headers: { "cache-control": "no-store" } });
}
