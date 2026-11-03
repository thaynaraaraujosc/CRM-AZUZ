import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { autenticarChaveDoFlow } from "@/lib/integracoes/azuz-flow-chave";
import {
  formulariosDoFlow,
  guardarFormulariosDoFlow,
  lerListaDeFormularios,
} from "@/lib/integracoes/azuz-flow-formularios";
import { comRespostaEmJson } from "@/lib/integracoes/resposta-em-json";
import { contarChamada, corpoGrandeDemais, respostaDeCorpoGrande } from "@/lib/seguranca/limite-de-uso";

/**
 * A LISTA DE FORMULÁRIOS QUE O AZUZ FLOW MANDA.
 *
 * `POST`: quem chama é o Flow, com a mesma chave dos leads. Entra em `rotas-publicas.ts` pelo mesmo
 * motivo da rota de leads — quem chama é uma máquina, e a defesa é a chave, conferida aqui dentro.
 *
 * `GET`: quem chama é a tela de Automações › Formulários do Flow, com sessão de verdade.
 *
 * As duas direções numa rota só porque é um recurso só: "quais formulários existem". Separá-las em
 * duas rotas faria a tela e o Flow discordarem sobre a forma do mesmo dado no dia em que uma das
 * duas mudasse.
 *
 * Ver `azuz-flow-formularios.ts` pro motivo de ser o Flow quem manda, e não o CRM quem pergunta.
 */

/** Teto do corpo: uma lista de formulários é pequena; megabytes aqui é payload estranho. */
const TETO_DO_CORPO = 256 * 1024;

/** Sincronizar é barato e raro. O limite existe contra um laço no Flow de um cliente. */
const POR_CHAVE = { maximo: 60, janelaSegundos: 60 };

function recusar(status: number, erro: string) {
  return NextResponse.json({ ok: false, erro }, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  return comRespostaEmJson("azuz-flow/formularios POST", async () => {
    const credencial = await autenticarChaveDoFlow(request.headers.get("authorization"));
    if (!credencial) return recusar(401, "Chave inválida ou revogada.");

    const limite = contarChamada(`flow-formularios:${credencial.chaveId}`, POR_CHAVE);
    if (!limite.permitido) return recusar(429, "Muitas sincronizações seguidas. Tente de novo em instantes.");

    if (corpoGrandeDemais(request, TETO_DO_CORPO)) return respostaDeCorpoGrande();

    let corpo: unknown;
    try {
      corpo = await request.json();
    } catch {
      return recusar(400, "O corpo precisa ser JSON.");
    }

    // A validação é a MESMA função que lê o que está no banco. Duas validações para o mesmo dado é
    // como se cria o caso em que entra pela rota o que a tela depois não consegue ler.
    const lista = lerListaDeFormularios(corpo);
    const guardada = await guardarFormulariosDoFlow(credencial.workspaceId, lista.formularios);

    return NextResponse.json(
      { ok: true, recebidos: guardada.formularios.length },
      { headers: { "cache-control": "no-store" } },
    );
  });
}

export async function GET() {
  return comRespostaEmJson("azuz-flow/formularios GET", async () => {
    const sessao = await auth();
    if (!sessao) return recusar(401, "Não autenticado");
    return NextResponse.json(await formulariosDoFlow(sessao.user.workspaceId), {
      headers: { "cache-control": "no-store" },
    });
  });
}
