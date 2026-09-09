import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { migrarGatilhosParaEtapa } from "@/lib/funil/migrar-gatilhos";

/**
 * A migração dos gatilhos, pela tela. Só do workspace de quem está logado.
 *
 * GET simula: devolve o que aconteceria, sem gravar nada. É o botão "Ver o que vai mudar".
 * POST executa.
 *
 * Só admin do workspace. Isto reorganiza a automação de TODO o workspace, e não é o tipo de coisa
 * que um atendente deva conseguir disparar por engano.
 */
async function comPermissao() {
  const sessao = await auth();
  if (!sessao) return { erro: NextResponse.json({ erro: "Não autenticado" }, { status: 401 }) };
  if (sessao.user.papelTipo !== "admin" && !sessao.user.superAdmin) {
    return { erro: NextResponse.json({ erro: "Só o administrador do workspace pode migrar." }, { status: 403 }) };
  }
  return { workspaceId: sessao.user.workspaceId };
}

export async function GET() {
  const { erro, workspaceId } = await comPermissao();
  if (erro) return erro;

  const resultado = await migrarGatilhosParaEtapa({ workspaceId: workspaceId!, apenasSimular: true });
  return NextResponse.json(resultado, { headers: { "cache-control": "no-store" } });
}

export async function POST() {
  const { erro, workspaceId } = await comPermissao();
  if (erro) return erro;

  const resultado = await migrarGatilhosParaEtapa({ workspaceId: workspaceId!, apenasSimular: false });
  return NextResponse.json(resultado);
}
