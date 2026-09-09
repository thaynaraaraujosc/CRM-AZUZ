import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CAPACIDADES, CANAIS_DA_AREA, type CanalId } from "@/lib/canais/capacidades";

/**
 * As conexões da área social deste workspace, agora.
 *
 * Duas perguntas somadas, e as duas precisam de resposta honesta na mesma linha: o canal EXISTE no
 * produto (tabela de capacidades) e ESTÁ LIGADO nesta conta (tabela de integrações). Um canal que
 * não existe aparece dizendo por quê, em vez de sumir ou, pior, virar um botão que não faz nada.
 */
export type ConexaoSocial = {
  canal: CanalId;
  label: string;
  resumo: string;
  /** O canal existe no produto. Falso = não há integração escrita ainda. */
  disponivel: boolean;
  /** A conta deste workspace está conectada agora. */
  conectado: boolean;
  /** @ da conta, quando conectada. */
  detalhe?: string | null;
  /** Por que não dá pra usar: ou o canal não existe, ou a conta não está ligada. */
  motivo?: string;
};

export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const integracao = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId: sessao.user.workspaceId, provedor: "meta_instagram" } },
    select: { status: true, metadados: true, erroMensagem: true },
  });
  const metadados = (integracao?.metadados as { username?: string } | null) ?? {};

  const conexoes: ConexaoSocial[] = CANAIS_DA_AREA.social.map((canal) => {
    const capacidades = CAPACIDADES[canal];
    if (!capacidades.disponivel) {
      return {
        canal,
        label: capacidades.label,
        resumo: capacidades.resumo,
        disponivel: false,
        conectado: false,
        motivo: capacidades.motivoIndisponivel,
      };
    }

    const conectado = integracao?.status === "conectado";
    return {
      canal,
      label: capacidades.label,
      resumo: capacidades.resumo,
      disponivel: true,
      conectado,
      detalhe: metadados.username ? `@${metadados.username}` : null,
      motivo: conectado
        ? undefined
        : (integracao?.erroMensagem ?? "Conecte a conta em Configurações → Outras integrações."),
    };
  });

  return NextResponse.json(conexoes, { headers: { "cache-control": "private, no-store" } });
}
