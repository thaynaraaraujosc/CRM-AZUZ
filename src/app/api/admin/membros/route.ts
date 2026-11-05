import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { exigirSuperAdmin } from "@/lib/admin/guard";
import { ehCortesia, statusEfetivo } from "@/lib/assinatura/cortesia";

/** GET lista todo mundo que tem login no CRM, de qualquer workspace: "todos os usuários" que o
 * super-admin pediu pra enxergar num lugar só. */
export async function GET() {
  const guarda = await exigirSuperAdmin();
  if (!guarda.ok) return guarda.resposta;

  const membros = await prisma.membro.findMany({
    orderBy: { criadoEm: "desc" },
    select: {
      id: true,
      nome: true,
      email: true,
      papel: true,
      papelTipo: true,
      ativo: true,
      convitePendente: true,
      criadoEm: true,
      ultimoAcesso: true,
      /*
       * A SITUAÇÃO DE PAGAMENTO DA EMPRESA vem junto, e é o que faltava nesta tela.
       *
       * "Este usuário paga?" é a pergunta que decide se uma conta velha é cliente ou sobra de
       * teste — e ela não se responde olhando o usuário, porque quem paga é a EMPRESA. Sem isso,
       * a única forma de saber era abrir cada empresa, uma por uma.
       */
      workspace: {
        select: {
          id: true,
          nome: true,
          assinatura: {
            select: { status: true, cortesia: true, cortesiaAte: true, asaasSubscriptionId: true, valor: true },
          },
        },
      },
    },
  });

  return NextResponse.json(
    membros.map((m) => {
      const a = m.workspace.assinatura;
      return {
        ...m,
        workspace: {
          id: m.workspace.id,
          nome: m.workspace.nome,
          // Três estados que a tela precisa distinguir: paga de verdade, está de cortesia (usa e
          // não paga, de propósito), ou não paga e não deveria estar usando.
          pagamento: !a
            ? "sem-assinatura"
            : ehCortesia(a)
              ? "cortesia"
              : statusEfetivo(a) === "ativa" && a.asaasSubscriptionId?.trim()
                ? "pagando"
                : statusEfetivo(a),
          cortesiaAte: a?.cortesiaAte ?? null,
        },
      };
    }),
  );
}
