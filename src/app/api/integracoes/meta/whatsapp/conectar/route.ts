import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ErroConexao,
  finalizarConexaoWhatsapp,
  salvarFalhaConexao,
  type Passo,
} from "@/lib/integracoes/conectar-whatsapp-oficial";
import { META_GRAPH_URL, type ErroGraph } from "@/lib/integracoes/meta";

/**
 * Finaliza a conexão do WhatsApp Business oficial (Cloud API) depois do Embedded Signup — o popup
 * da Meta devolve `code` + os ids dos recursos criados, e é aqui que isso vira uma integração
 * usável de verdade.
 *
 * Esta rota cuida só do PRIMEIRO passo (trocar o `code` por um token de negócio); do token em
 * diante é `finalizarConexaoWhatsapp`, compartilhado com a conexão direta por token
 * (`../conectar-manual`), porque dali pra frente os dois caminhos são idênticos.
 */
type CorpoConectar = {
  code?: string;
  wabaId?: string;
  phoneNumberId?: string;
  businessId?: string;
  /** Informado pela pessoa quando o número já tinha sido registrado antes com outro PIN. */
  pinExistente?: string;
};

/**
 * Troca o `code` do Embedded Signup pelo token de negócio DAQUELE cliente. Server-to-server
 * obrigatoriamente: leva o `client_secret`, que nunca pode aparecer no navegador.
 */
async function trocarCodePorTokenDeNegocio(code: string, appId: string, appSecret: string): Promise<string> {
  const resposta = await fetch(
    `${META_GRAPH_URL}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${encodeURIComponent(code)}`,
  );
  const corpo = (await resposta.json()) as { access_token?: string } & ErroGraph;
  if (!resposta.ok || !corpo.access_token) {
    throw new Error(corpo.error?.message ?? `Falha ao trocar o código pelo token (${resposta.status})`);
  }
  return corpo.access_token;
}

export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const { code, wabaId, phoneNumberId, businessId, pinExistente } = (await request.json()) as CorpoConectar;
  if (!wabaId || !phoneNumberId) {
    return NextResponse.json({ erro: "wabaId e phoneNumberId são obrigatórios" }, { status: 400 });
  }

  const appId = process.env.META_APP_ID ?? process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.json({ erro: "Integração não configurada no servidor." }, { status: 500 });
  }

  const existente = await prisma.integracao.findUnique({
    where: { workspaceId_provedor: { workspaceId, provedor: "meta_whatsapp" } },
  });
  const metadadosAnteriores = (existente?.metadados as Record<string, unknown> | null) ?? {};

  let accessToken: string | null = null;
  try {
    // Retry: sem `code` novo (já gasto na tentativa anterior), reaproveita o token já guardado.
    if (code) {
      accessToken = await trocarCodePorTokenDeNegocio(code, appId, appSecret);
    } else if (existente?.accessTokenCriptografado) {
      const { decriptar } = await import("@/lib/integracoes/crypto");
      accessToken = decriptar(existente.accessTokenCriptografado);
    }
    if (!accessToken) {
      return NextResponse.json({ erro: "Autorização não recebida — refaça a conexão." }, { status: 400 });
    }
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha ao obter a autorização da Meta.";
    await salvarFalhaConexao({
      workspaceId,
      mensagem,
      passo: "token",
      wabaId,
      phoneNumberId,
      businessId,
      metadadosAnteriores,
    }).catch(() => {});
    return NextResponse.json({ erro: mensagem, passo: "token" satisfies Passo }, { status: 502 });
  }

  try {
    const resultado = await finalizarConexaoWhatsapp({
      workspaceId,
      accessToken,
      wabaId,
      phoneNumberId,
      businessId,
      pinExistente,
      metadadosAnteriores,
      metadadosExtras: { conexao: "embedded_signup" },
    });
    return NextResponse.json(resultado);
  } catch (erro) {
    const passo = erro instanceof ErroConexao ? erro.passo : "metadados";
    const mensagem = erro instanceof Error ? erro.message : "Falha ao conectar o WhatsApp Business.";
    await salvarFalhaConexao({
      workspaceId,
      mensagem,
      passo,
      wabaId,
      phoneNumberId,
      businessId,
      accessToken,
      metadadosAnteriores,
    }).catch(() => {});
    return NextResponse.json({ erro: mensagem, passo }, { status: 502 });
  }
}
