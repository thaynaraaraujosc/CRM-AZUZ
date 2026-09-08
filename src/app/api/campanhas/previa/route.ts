import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { destinoDoContato, opcoesDeAudiencia, resolverAudiencia, type Audiencia } from "@/lib/campanhas/audiencia";
import { RITMO, preverDuracao, type CanalCampanha } from "@/lib/campanhas/ritmo";
import { resolverParametros, variaveisSemValor, type MapeamentoVariavel } from "@/lib/campanhas/variaveis";
import { contaConectada, limiteDiarioDaConta } from "@/lib/integracoes/whatsapp-oficial";

/** GET: as opções pra montar o público (etiquetas, origens, funis e etapas do workspace). */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  return NextResponse.json(await opcoesDeAudiencia(sessao.user.workspaceId), { headers: { "cache-control": "private, no-store" } });
}

/**
 * POST: prévia do disparo, sem criar nada. "327 contatos receberão esta mensagem", quem fica de
 * fora por não ter WhatsApp/e-mail, quem ficaria com variável vazia, e quanto tempo vai levar.
 * Tudo calculado pela MESMA lógica que o disparo de verdade usa.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const corpo = (await request.json()) as { canal?: CanalCampanha; audiencia?: Audiencia; variaveis?: MapeamentoVariavel[] };
  if (!corpo.canal || !RITMO[corpo.canal]) return NextResponse.json({ erro: "Canal inválido." }, { status: 400 });
  if (!corpo.audiencia?.modo) return NextResponse.json({ erro: "Escolha o público." }, { status: 400 });

  const contatos = await resolverAudiencia(workspaceId, corpo.audiencia);
  const variaveis = Array.isArray(corpo.variaveis) ? corpo.variaveis : [];

  const comDestino: { nome: string; destino: string }[] = [];
  const semDestino: string[] = [];
  const semVariavel: string[] = [];
  for (const c of contatos) {
    const destino = destinoDoContato(c, corpo.canal);
    if (!destino) {
      semDestino.push(c.nome);
      continue;
    }
    comDestino.push({ nome: c.nome, destino });
    if (variaveis.length && variaveisSemValor(variaveis, resolverParametros(variaveis, c)).length) semVariavel.push(c.nome);
  }

  let limiteDiario: number | null | undefined;
  let limiteConhecido = false;
  if (corpo.canal === "whatsapp_oficial") {
    const conta = await contaConectada(workspaceId);
    if (conta) {
      const limite = await limiteDiarioDaConta(conta);
      limiteDiario = limite.porDia;
      limiteConhecido = limite.conhecido;
    }
  }
  const previsao = preverDuracao(corpo.canal, comDestino.length, limiteDiario);

  return NextResponse.json({
    total: contatos.length,
    receberao: comDestino.length,
    // Até 500 nomes pra "ver quem": mais que isso a tela não desenha bem e a resposta engorda.
    nomes: comDestino.slice(0, 500).map((c) => c.nome),
    semDestino,
    semVariavel,
    previsao,
    ritmo: RITMO[corpo.canal],
    limiteDiario: limiteConhecido ? limiteDiario : undefined,
  });
}
