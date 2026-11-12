import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { autenticarChaveDoFlow, PROVEDOR_FLOW } from "@/lib/integracoes/azuz-flow-chave";
import { configDoFlow, type ConfirmacaoDeFormulario } from "@/lib/integracoes/azuz-flow-config";
import {
  formulariosDoFlow,
  guardarFormulariosDoFlow,
  lerListaDeFormularios,
  type ListaDeFormularios,
} from "@/lib/integracoes/azuz-flow-formularios";
import { prisma } from "@/lib/prisma";
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

/** O que a tela precisa, numa chamada só. Ver o tipo no topo do arquivo da tela. */
export type RecursoDosFormularios = ListaDeFormularios & {
  /** Existe chave do Flow ativa nesta empresa? É o que decide se a aba aparece. */
  conectado: boolean;
  /** A confirmação GERAL dos formulários do Flow, pro que não tem regra própria. */
  geral: ConfirmacaoDeFormulario;
  /** As exceções, por id de formulário do Flow. */
  porFormulario: Record<string, { confirmacao: ConfirmacaoDeFormulario }>;
  /** A geral dos formulários DO CRM. Texto separado desde sempre: cada origem fala com o público
   *  dela com as palavras da agência. */
  geralDoCrm: ConfirmacaoDeFormulario;
  /** As exceções, por id de formulário do CRM. */
  porFormularioDoCrm: Record<string, { confirmacao: ConfirmacaoDeFormulario }>;
};

export async function GET() {
  return comRespostaEmJson("azuz-flow/formularios GET", async () => {
    const sessao = await auth();
    if (!sessao) return recusar(401, "Não autenticado");
    const workspaceId = sessao.user.workspaceId;

    /*
     * TUDO NUMA CHAMADA SÓ. A tela precisa das três coisas ao mesmo tempo — a lista, a
     * configuração de cada formulário e a geral que vale pro resto — e três chamadas criariam o
     * instante em que ela já desenhou os cartões e ainda não sabe quais estão configurados, que é
     * quando um cartão pisca dizendo o contrário do que vai dizer um segundo depois.
     */
    const [lista, config, chave] = await Promise.all([
      formulariosDoFlow(workspaceId),
      configDoFlow(workspaceId),
      prisma.chaveDeIntegracao
        .findFirst({ where: { workspaceId, provedor: PROVEDOR_FLOW, revogadaEm: null }, select: { id: true } })
        .catch(() => null),
    ]);

    const recurso: RecursoDosFormularios = {
      ...lista,
      conectado: Boolean(chave),
      // A geral não escolhe número nem modelo: ela é o texto de quem nunca abriu esta tela.
      geral: { ativa: config.confirmacao.ativa, texto: config.confirmacao.texto, contaCanal: null, templateId: null },
      porFormulario: config.porFormulario,
      geralDoCrm: {
        ativa: config.formulario.confirmacao.ativa,
        texto: config.formulario.confirmacao.texto,
        contaCanal: null,
        templateId: null,
      },
      porFormularioDoCrm: config.porFormularioDoCrm,
    };
    return NextResponse.json(recurso, { headers: { "cache-control": "no-store" } });
  });
}
