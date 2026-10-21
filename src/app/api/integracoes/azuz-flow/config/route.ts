import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { auditar } from "@/lib/seguranca/auditoria";
import { CANAIS_DO_FLOW, type CanalDoFlow } from "@/lib/integracoes/azuz-flow-canal";
import { conexoesDeWhatsappDoWorkspace } from "@/lib/integracoes/azuz-flow-conexoes";
import { configDoFlow, salvarConfigDoFlow, type MudancasDoFlow } from "@/lib/integracoes/azuz-flow-config";
import { lerDisjuntor, religarDisjuntor } from "@/lib/integracoes/azuz-flow-disjuntor";
import { montarRespostaDoFlow } from "@/lib/integracoes/azuz-flow-resposta";
import { minutosDoRelogio } from "@/lib/integracoes/azuz-flow-janela";
import { comRespostaEmJson } from "@/lib/integracoes/resposta-em-json";

/**
 * As opções do AZUZ Flow, da tela de Configurações.
 *
 * Só administrador, pela mesma razão da chave: isto decide por qual número a empresa inteira passa
 * a falar com quem preenche o formulário.
 *
 * `comRespostaEmJson` em toda saída: a tela lê o corpo como JSON, e um 500 sem corpo quebrava com
 * "Unexpected end of JSON input" — um erro de JavaScript em inglês no lugar de qualquer pista.
 */
async function exigirAdmin() {
  const sessao = await auth();
  if (!sessao) return { ok: false as const, resposta: NextResponse.json({ erro: "Não autenticado" }, { status: 401 }) };
  if (sessao.user.papelTipo !== "admin" && !sessao.user.superAdmin) {
    return {
      ok: false as const,
      resposta: NextResponse.json(
        { erro: "Só administradores podem mudar as opções do AZUZ Flow." },
        { status: 403 },
      ),
    };
  }
  return { ok: true as const, sessao };
}

export async function GET() {
  return comRespostaEmJson("azuz-flow/config GET", async () => {
    const guarda = await exigirAdmin();
    if (!guarda.ok) return guarda.resposta;
    const workspaceId = guarda.sessao.user.workspaceId;
    return NextResponse.json(await recursoDoFlow(workspaceId), { headers: { "cache-control": "no-store" } });
  });
}

/**
 * O recurso inteiro: a configuração MAIS o que está acontecendo com o canal.
 *
 * Uma função só, usada pelo GET e pelo PUT, porque a tela guarda o que a rota devolve. Enquanto o
 * PUT respondia só com a configuração, salvar qualquer opção trocava o objeto da tela por um pela
 * metade e o render seguinte morria em `canal.disjuntor.pausadoEm`. Ver `azuz-flow-resposta.ts`.
 */
async function recursoDoFlow(workspaceId: string) {
  const [config, conexoes, disjuntor] = await Promise.all([
    configDoFlow(workspaceId),
    conexoesDeWhatsappDoWorkspace(workspaceId),
    lerDisjuntor(workspaceId),
  ]);
  return montarRespostaDoFlow({ config, conexoes, disjuntor });
}

export async function PUT(request: Request) {
  return comRespostaEmJson("azuz-flow/config PUT", async () => {
    const guarda = await exigirAdmin();
    if (!guarda.ok) return guarda.resposta;
    const workspaceId = guarda.sessao.user.workspaceId;

    const corpo = (await request.json().catch(() => ({}))) as {
      canal?: unknown;
      confirmacao?: {
        ativa?: unknown;
        texto?: unknown;
        pausada?: unknown;
        janela?: { inicio?: unknown; fim?: unknown };
        tetoDiario?: unknown;
        tetoPorNumero?: unknown;
        falhasParaPausar?: unknown;
      };
      religar?: unknown;
    };

    const mudancas: MudancasDoFlow = {};

    /*
     * Religar o disjuntor vem no mesmo pedido, e isto não é preguiça de rota.
     *
     * Religar é sempre o mesmo gesto da mesma pessoa no mesmo cartão: ela leu "pausado porque X" e
     * decidiu que pode voltar. Separar num endpoint próprio só criaria o estado em que a pausa foi
     * tirada e a opção ao lado não salvou (ou o contrário).
     *
     * Não é "config": o disjuntor é o que está ACONTECENDO com o canal, não uma escolha. Por isso
     * mora em outra chave e é tratado aqui à parte, antes de qualquer validação de opção.
     */
    const religou = corpo.religar === true;
    if (religou) await religarDisjuntor(workspaceId);

    if (corpo.canal !== undefined) {
      // Valor fora da lista é recusado em vez de corrigido em silêncio: salvar "automatico" quando
      // pediram outra coisa faria a tela mostrar uma opção e o CRM obedecer outra.
      if (!CANAIS_DO_FLOW.includes(corpo.canal as CanalDoFlow)) {
        return NextResponse.json({ erro: "Canal inválido." }, { status: 400 });
      }
      mudancas.canal = corpo.canal as CanalDoFlow;
    }

    if (corpo.confirmacao !== undefined) {
      const confirmacao: NonNullable<MudancasDoFlow["confirmacao"]> = {};
      if (corpo.confirmacao.ativa !== undefined) {
        if (typeof corpo.confirmacao.ativa !== "boolean") {
          return NextResponse.json({ erro: "O liga/desliga da confirmação precisa ser true ou false." }, { status: 400 });
        }
        confirmacao.ativa = corpo.confirmacao.ativa;
      }
      if (corpo.confirmacao.texto !== undefined) {
        if (typeof corpo.confirmacao.texto !== "string") {
          return NextResponse.json({ erro: "O texto da confirmação precisa ser texto." }, { status: 400 });
        }
        // Teto generoso, mas teto: o WhatsApp recusa mensagem muito longa, e sem limite aqui o
        // erro só apareceria na hora do envio, uma por uma.
        if (corpo.confirmacao.texto.length > 2000) {
          return NextResponse.json({ erro: "O texto da confirmação passou de 2000 caracteres." }, { status: 400 });
        }
        confirmacao.texto = corpo.confirmacao.texto;
      }

      if (corpo.confirmacao.pausada !== undefined) {
        if (typeof corpo.confirmacao.pausada !== "boolean") {
          return NextResponse.json({ erro: "A pausa precisa ser true ou false." }, { status: 400 });
        }
        confirmacao.pausada = corpo.confirmacao.pausada;
      }

      if (corpo.confirmacao.janela !== undefined) {
        const bruto = corpo.confirmacao.janela ?? {};
        const inicio = typeof bruto.inicio === "string" ? bruto.inicio : "";
        const fim = typeof bruto.fim === "string" ? bruto.fim : "";
        const minutosInicio = minutosDoRelogio(inicio);
        const minutosFim = minutosDoRelogio(fim);
        if (minutosInicio === null || minutosFim === null) {
          return NextResponse.json({ erro: "Os horários da janela precisam estar no formato HH:MM." }, { status: 400 });
        }
        // Janela invertida é recusada aqui, com a frase inteira, em vez de descartada em silêncio
        // pela leitura: quem digitou 21:00–08:00 quis dizer "à noite", e precisa saber que isso
        // não é o que o campo faz.
        if (minutosFim <= minutosInicio) {
          return NextResponse.json(
            { erro: "A janela precisa terminar depois de começar. Para enviar à noite, use por exemplo 18:00 às 21:00." },
            { status: 400 },
          );
        }
        confirmacao.janela = { inicio, fim };
      }

      const tetos = [
        { campo: "tetoDiario" as const, valor: corpo.confirmacao.tetoDiario, minimo: 1, maximo: 500, nome: "O limite por dia" },
        { campo: "tetoPorNumero" as const, valor: corpo.confirmacao.tetoPorNumero, minimo: 1, maximo: 20, nome: "O limite por número" },
        { campo: "falhasParaPausar" as const, valor: corpo.confirmacao.falhasParaPausar, minimo: 1, maximo: 50, nome: "As falhas até pausar" },
      ];
      for (const teto of tetos) {
        if (teto.valor === undefined) continue;
        const n = typeof teto.valor === "number" ? teto.valor : Number(teto.valor);
        if (!Number.isFinite(n) || !Number.isInteger(n) || n < teto.minimo || n > teto.maximo) {
          return NextResponse.json(
            { erro: `${teto.nome} precisa ser um número inteiro entre ${teto.minimo} e ${teto.maximo}.` },
            { status: 400 },
          );
        }
        confirmacao[teto.campo] = n;
      }

      if (Object.keys(confirmacao).length) mudancas.confirmacao = confirmacao;
    }

    if (!Object.keys(mudancas).length) {
      // Religar sozinho é um pedido legítimo e não tem nada pra salvar: responde com o estado
      // atual em vez de 400.
      if (religou) {
        await auditar({
          workspaceId,
          membroId: guarda.sessao.user.id,
          acao: "integracao.canal_do_flow_alterado",
          recurso: "azuz_flow",
          detalhe: "confirmações religadas depois da pausa automática",
        }).catch(() => {});
        return NextResponse.json(await recursoDoFlow(workspaceId), { headers: { "cache-control": "no-store" } });
      }
      return NextResponse.json({ erro: "Nada pra salvar." }, { status: 400 });
    }

    const config = await salvarConfigDoFlow(workspaceId, mudancas);
    // Fica na auditoria porque muda por onde a empresa fala com quem preenche o formulário — do
    // mesmo nível de conectar ou desconectar um canal.
    await auditar({
      workspaceId,
      membroId: guarda.sessao.user.id,
      acao: "integracao.canal_do_flow_alterado",
      recurso: "azuz_flow",
      detalhe:
        `canal=${config.canal} confirmacao=${config.confirmacao.ativa ? "ligada" : "desligada"}` +
        `${config.confirmacao.pausada ? " pausada" : ""}${religou ? " religada" : ""}`,
    }).catch(() => {});
    // O recurso INTEIRO, igual ao GET: a tela substitui o que tem pelo que chega, e meia resposta
    // deixava `disjuntor` e `aviso` de fora.
    return NextResponse.json(await recursoDoFlow(workspaceId), { headers: { "cache-control": "no-store" } });
  });
}
