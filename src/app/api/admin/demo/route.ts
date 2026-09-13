import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { exigirSuperAdmin } from "@/lib/admin/guard";
import { auditar } from "@/lib/seguranca/auditoria";
import { esquecerStatus } from "@/lib/assinatura/status-cache";
import { semearDemo } from "@/lib/demo/semear";
import {
  EMAIL_DEMO,
  EMPRESA_DEMO,
  WORKSPACE_DEMO,
  resumoDaDemo,
} from "@/lib/demo/dados-demo";

/**
 * Monta (e remonta) a conta de demonstração.
 *
 * Existe porque demonstrar o CRM hoje significa abrir a conta real e deixar nome, telefone e
 * conversa de cliente de verdade na tela, seja numa reunião de venda, seja na gravação do vídeo de
 * apresentação. Isso é exposição de dado pessoal de terceiro, e não é reversível depois que o
 * vídeo está publicado.
 *
 * Remontar é a operação principal, não a exceção: depois de cada demonstração a conta fica com
 * card arrastado, conversa lida e tarefa concluída. Um botão que devolve tudo ao estado inicial é
 * o que faz a conta continuar servindo na décima vez.
 *
 * A TRAVA: remontar APAGA, e apagar é a operação mais perigosa que existe aqui. Por isso o
 * workspace alvo não vem do cliente em nenhuma hipótese: é a constante `WORKSPACE_DEMO`, e a
 * checagem abaixo recusa qualquer outro valor. Não existe caminho, nem por engano nem por
 * requisição forjada, que faça esta rota apagar dado de cliente pagante.
 */
export const dynamic = "force-dynamic";

/** Cinto e suspensório: se alguém um dia trocar a constante por algo perigoso, isto barra. */
const IDS_PROIBIDOS = new Set(["", "principal", "azuz", "producao", "production", "main"]);

function alvoSeguro(): boolean {
  return WORKSPACE_DEMO === "demonstracao" && !IDS_PROIBIDOS.has(WORKSPACE_DEMO);
}

export async function POST(request: Request) {
  const guarda = await exigirSuperAdmin();
  if (!guarda.ok) return guarda.resposta;
  const { sessao } = guarda;

  if (!alvoSeguro()) {
    return NextResponse.json({ erro: "Alvo da demonstração inválido. Operação recusada." }, { status: 500 });
  }

  const corpo = (await request.json().catch(() => ({}))) as { senha?: string };
  const senha = corpo.senha?.trim();
  if (!senha || senha.length < 8) {
    return NextResponse.json({ erro: "Informe uma senha de pelo menos 8 caracteres." }, { status: 400 });
  }

  // Se já existe outra conta com este e-mail FORA da demonstração, parar: é sinal de que alguém
  // usou o endereço pra uma conta de verdade, e sobrescrever apagaria o acesso dessa pessoa.
  const conflito = await prisma.membro.findUnique({
    where: { email: EMAIL_DEMO },
    select: { workspaceId: true },
  });
  if (conflito && conflito.workspaceId !== WORKSPACE_DEMO) {
    return NextResponse.json(
      { erro: `O e-mail ${EMAIL_DEMO} já pertence a outra conta. Operação recusada.` },
      { status: 409 },
    );
  }

  const agora = new Date();
  const senhaHash = await bcrypt.hash(senha, 10);

  await semearDemo(prisma, senhaHash, agora);

  esquecerStatus(WORKSPACE_DEMO);

  await auditar({
    workspaceId: sessao.user.workspaceId,
    membroId: sessao.user.id,
    acao: "demo.remontada",
    recurso: WORKSPACE_DEMO,
    detalhe: `${resumoDaDemo().contatos} contatos, ${resumoDaDemo().mensagens} mensagens`,
  });

  return NextResponse.json({
    ok: true,
    workspaceId: WORKSPACE_DEMO,
    empresa: EMPRESA_DEMO,
    email: EMAIL_DEMO,
    resumo: resumoDaDemo(),
  });
}
