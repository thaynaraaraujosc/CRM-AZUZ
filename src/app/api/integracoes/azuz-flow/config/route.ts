import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { auditar } from "@/lib/seguranca/auditoria";
import { CANAIS_DO_FLOW, escolherCanalDoFlow, type CanalDoFlow } from "@/lib/integracoes/azuz-flow-canal";
import { conexoesDeWhatsappDoWorkspace } from "@/lib/integracoes/azuz-flow-conexoes";
import { configDoFlow, salvarConfigDoFlow } from "@/lib/integracoes/azuz-flow-config";
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
    const [config, conexoes] = await Promise.all([configDoFlow(workspaceId), conexoesDeWhatsappDoWorkspace(workspaceId)]);
    /*
     * Devolve a ESCOLHA JÁ RESOLVIDA, e não só a opção guardada.
     *
     * A tela precisa dizer o que vai acontecer com o próximo lead, não o que está marcado num
     * seletor. "Só oficial" com o oficial desconectado é um aviso; "automático" com o QR ligado não
     * é. Quem sabe a diferença é a mesma função que o lead usa — então ela responde aqui também,
     * em vez de a tela reimplementar a regra e as duas discordarem.
     */
    const escolha = escolherCanalDoFlow(config.canal, conexoes);
    return NextResponse.json(
      {
        ...config,
        opcoes: CANAIS_DO_FLOW,
        conexoes: { oficial: Boolean(conexoes.oficial), qrcode: Boolean(conexoes.qrcode) },
        conexaoEfetiva: escolha.conexao,
        aviso: escolha.aviso,
      },
      { headers: { "cache-control": "no-store" } },
    );
  });
}

export async function PUT(request: Request) {
  return comRespostaEmJson("azuz-flow/config PUT", async () => {
    const guarda = await exigirAdmin();
    if (!guarda.ok) return guarda.resposta;
    const workspaceId = guarda.sessao.user.workspaceId;

    const corpo = (await request.json().catch(() => ({}))) as { canal?: unknown };
    // Valor fora da lista é recusado em vez de corrigido em silêncio: salvar "automatico" quando
    // pediram outra coisa faria a tela mostrar uma opção e o CRM obedecer outra.
    if (!CANAIS_DO_FLOW.includes(corpo.canal as CanalDoFlow)) {
      return NextResponse.json({ erro: "Canal inválido." }, { status: 400 });
    }

    const config = await salvarConfigDoFlow(workspaceId, { canal: corpo.canal as CanalDoFlow });
    // Fica na auditoria porque muda por onde a empresa fala com quem preenche o formulário — do
    // mesmo nível de conectar ou desconectar um canal.
    await auditar({
      workspaceId,
      membroId: guarda.sessao.user.id,
      acao: "integracao.canal_do_flow_alterado",
      recurso: "azuz_flow",
      detalhe: config.canal,
    }).catch(() => {});
    return NextResponse.json(config, { headers: { "cache-control": "no-store" } });
  });
}
