import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import {
  limparAnexosInvalidosInstagram,
  limparDadosDoWhatsApp,
  removerGruposViradosContato,
} from "@/lib/integracoes/limpar-dados-whatsapp";

/**
 * Limpeza avulsa do espelho do WhatsApp, para quando o canal JÁ foi desconectado antes de a
 * limpeza existir — nesse caso os dados ficaram para trás e não há mais um "desconectar" para
 * pendurar a limpeza. Mesma regra de escopo do desconectar (ver `limparDadosDoWhatsApp`): só apaga
 * o que veio do canal, nunca o que foi criado à mão.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (sessao.user.papelTipo !== "admin") {
    return NextResponse.json({ erro: "Só o admin do workspace pode apagar esses dados." }, { status: 403 });
  }

  const { conexao, acao } = (await request.json().catch(() => ({}))) as {
    conexao?: "nao_oficial" | "oficial";
    acao?: "canal" | "grupos" | "anexos_instagram";
  };

  // Entulho das tentativas de baixar anexo do Instagram sem autenticação: página HTML guardada
  // como se fosse arquivo. Tira só o anexo inválido, o texto da mensagem fica.
  if (acao === "anexos_instagram") {
    const corrigidas = await limparAnexosInvalidosInstagram(sessao.user.workspaceId);
    return NextResponse.json({ ok: true, corrigidas });
  }

  // "grupos": tira da carteira e do funil os GRUPOS que viraram contato/card por um bug antigo —
  // é lixo em qualquer cenário, não depende de canal nem apaga conversa nenhuma.
  if (acao === "grupos") {
    const grupos = await removerGruposViradosContato(sessao.user.workspaceId);
    return NextResponse.json({ ok: true, grupos });
  }

  if (conexao !== "nao_oficial" && conexao !== "oficial") {
    return NextResponse.json({ erro: "Informe a conexão: 'nao_oficial' ou 'oficial'." }, { status: 400 });
  }

  const limpeza = await limparDadosDoWhatsApp(sessao.user.workspaceId, conexao);
  return NextResponse.json({ ok: true, limpeza });
}
