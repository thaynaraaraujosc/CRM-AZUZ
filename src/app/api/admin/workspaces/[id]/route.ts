import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { esquecerStatus } from "@/lib/assinatura/status-cache";
import { exigirSuperAdmin } from "@/lib/admin/guard";
import { PLANOS } from "@/lib/assinatura/planos";
import { diasDeCortesia, ehCortesia, fimDaCortesia, statusEfetivo } from "@/lib/assinatura/cortesia";
import { apagarWorkspace } from "@/lib/admin/apagar-workspace";
import { auditar } from "@/lib/seguranca/auditoria";

/** GET traz o workspace inteiro: membros (com papel/permissões), integrações conectadas e a
 * assinatura: a "visão 360°" de uma empresa cliente pro super-admin. */
export async function GET(_request: Request, ctx: RouteContext<"/api/admin/workspaces/[id]">) {
  const guarda = await exigirSuperAdmin();
  if (!guarda.ok) return guarda.resposta;

  const { id } = await ctx.params;
  const workspace = await prisma.workspace.findUnique({
    where: { id },
    // Lista fechada nos dois pontos sensíveis. `membros: true` trazia o hash da senha de cada
    // pessoa, e `integracoes: true` trazia os tokens criptografados da Meta. Mesmo numa tela de
    // super-admin, o que não trafega não vaza: nem por log, nem por cache, nem por aba esquecida
    // aberta. A tela precisa de quem é quem e do que está conectado, não dos segredos.
    include: {
      membros: {
        orderBy: { criadoEm: "asc" },
        select: {
          id: true,
          nome: true,
          email: true,
          papel: true,
          papelTipo: true,
          permissoes: true,
          ativo: true,
          convitePendente: true,
          criadoEm: true,
          ultimoAcesso: true,
          /* Só pra saber se o botão "ver senha" tem o que mostrar. A senha em si sai por uma rota
             própria, chamada no clique: ver `/api/admin/membros/[id]/senha`. */
          senhaEntregue: true,
        },
      },
      integracoes: {
        select: { id: true, provedor: true, status: true, erroMensagem: true, atualizadoEm: true },
      },
      assinatura: true,
    },
  });
  if (!workspace) return NextResponse.json({ erro: "Workspace não encontrado" }, { status: 404 });

  /*
   * OS DIAS QUE FALTAM SÃO CONTADOS AQUI, no servidor.
   *
   * A tela não pode fazer essa conta: ler o relógio durante o render é proibido pelo compilador
   * do React (o resultado muda a cada renderização sem o estado ter mudado). E o servidor é o
   * único lugar em que o relógio é o mesmo pra todo mundo.
   */
  return NextResponse.json({
    ...workspace,
    // A senha nunca trafega aqui: só o fato de existir uma guardada por nós.
    membros: workspace.membros.map(({ senhaEntregue, ...m }) => ({ ...m, temSenhaNossa: Boolean(senhaEntregue) })),
    assinatura: workspace.assinatura
      ? {
          ...workspace.assinatura,
          status: statusEfetivo(workspace.assinatura),
          diasDeCortesia: diasDeCortesia(workspace.assinatura),
          ehCortesia: ehCortesia(workspace.assinatura),
        }
      : null,
  });
}

type CorpoAtualizarWorkspace = {
  assinatura?: {
    status?: string;
    /** Liga/desliga a cortesia. Ausente não mexe nela. */
    cortesia?: boolean;
    /** Meses a partir de hoje, quando a cortesia é COM prazo. 0 ou ausente = sem prazo. */
    cortesiaMeses?: number;
  };
};

/**
 * PATCH altera o status da assinatura de um workspace **direto no banco**, sem chamar a Asaas:
 * é uma sobrescrita manual do super-admin (ex.: cortesia, correção de um caso, bloqueio manual),
 * não substitui o fluxo de cobrança real. Plano é sempre "completo" (plano único do CRM. Ver
 * `src/lib/assinatura/planos.ts`), não tem o que escolher aqui.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/workspaces/[id]">) {
  const guarda = await exigirSuperAdmin();
  if (!guarda.ok) return guarda.resposta;

  const { id: workspaceId } = await ctx.params;
  const corpo = (await request.json()) as CorpoAtualizarWorkspace;

  const status = corpo.assinatura?.status;
  const cortesia = corpo.assinatura?.cortesia;
  const cortesiaMeses = Number(corpo.assinatura?.cortesiaMeses ?? 0);
  const mexeNaCortesia = cortesia !== undefined;

  if (!status && !mexeNaCortesia) return NextResponse.json({ erro: "Nada para atualizar." }, { status: 400 });
  if (status && !["pendente", "ativa", "atrasada", "cancelada"].includes(status)) {
    return NextResponse.json({ erro: "Status inválido." }, { status: 400 });
  }
  if (mexeNaCortesia && (!Number.isFinite(cortesiaMeses) || cortesiaMeses < 0 || cortesiaMeses > 36)) {
    return NextResponse.json({ erro: "Prazo de cortesia inválido." }, { status: 400 });
  }

  /*
   * CORTESIA É SIM/NÃO; O PRAZO É OUTRA PERGUNTA.
   *
   * Sim COM prazo: a data vai pra `cortesiaAte`, o acesso vira "ativa" e o primeiro vencimento
   * passa a ser o fim da cortesia — é dessa data que a cobrança parte.
   * Sim SEM prazo: acesso "ativa" e nenhuma data. É a conta dada pra sempre, que no banco é
   * exatamente isto: liberada, sem nada cobrando.
   * Não: a data sai e o acesso vira "pendente", que é o que manda a pessoa pra tela de pagamento.
   * Sem limpar a data, o prazo continuaria valendo por cima do acesso.
   */
  const dadosDaCortesia = !mexeNaCortesia
    ? {}
    : cortesia
      ? cortesiaMeses > 0
        ? { cortesiaAte: fimDaCortesia(cortesiaMeses), proximoVencimento: fimDaCortesia(cortesiaMeses), status: "ativa" }
        : { cortesiaAte: null, proximoVencimento: null, status: "ativa" }
      : { cortesiaAte: null, status: status ?? "pendente" };

  const dados = { ...(status ? { status } : {}), ...dadosDaCortesia };

  const assinatura = await prisma.assinatura.upsert({
    where: { workspaceId },
    create: {
      id: `assinatura-${workspaceId}`,
      workspaceId,
      plano: "completo",
      valor: PLANOS.completo.valor,
      status: dados.status ?? "pendente",
      asaasCustomerId: "",
      cortesiaAte: dadosDaCortesia.cortesiaAte ?? null,
    },
    update: dados,
  });
  // O status mudou: o cache do paywall não pode continuar servindo o valor antigo.
  esquecerStatus(workspaceId);

  return NextResponse.json({ assinatura });
}

/**
 * DELETE apaga a empresa inteira: todos os dados dela, todas as pessoas dela, e a própria conta.
 *
 * NÃO TEM VOLTA, e por isso ele exige o nome digitado. Não é cerimônia: o super-admin vê a lista
 * de todas as empresas da plataforma numa tela só, e a diferença entre apagar uma conta de teste
 * e apagar um cliente que paga é uma linha de distância do ponteiro. Digitar o nome é o que
 * obriga a olhar DE QUAL conta se está falando.
 *
 * Existe porque a base nasceu cheia de conta de teste, e conta de teste não é só sujeira visual:
 * ela faz o painel dizer "4 assinaturas" quando nada foi vendido.
 */
export async function DELETE(request: Request, ctx: RouteContext<"/api/admin/workspaces/[id]">) {
  const guarda = await exigirSuperAdmin();
  if (!guarda.ok) return guarda.resposta;
  const { sessao } = guarda;

  const { id: workspaceId } = await ctx.params;
  const corpo = (await request.json().catch(() => ({}))) as { confirmacao?: string };

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { nome: true } });
  if (!workspace) return NextResponse.json({ erro: "Workspace não encontrado" }, { status: 404 });

  const digitado = (corpo.confirmacao ?? "").trim().toLowerCase();
  if (digitado !== workspace.nome.trim().toLowerCase()) {
    return NextResponse.json(
      { erro: `Pra apagar, digite o nome da empresa exatamente como ele está: "${workspace.nome}".` },
      { status: 400 },
    );
  }

  /*
   * A AUDITORIA VEM ANTES DA EXCLUSÃO.
   *
   * O registro de auditoria daquele workspace é apagado junto com ele — e deve ser mesmo, é dado
   * da empresa. Mas o registro de que ALGUÉM apagou a empresa não é dela: é da plataforma, e
   * precisa sobreviver. Por isso ele é gravado antes, no workspace de quem apagou.
   */
  await auditar({
    acao: "workspace.alterado",
    workspaceId: sessao.user.workspaceId ?? workspaceId,
    membroId: sessao.user.id,
    email: sessao.user.email,
    recurso: workspaceId,
    detalhe: `empresa "${workspace.nome}" apagada por completo`,
  });

  const resultado = await apagarWorkspace(prisma, workspaceId);
  esquecerStatus(workspaceId);

  return NextResponse.json({ ok: true, ...resultado });
}
