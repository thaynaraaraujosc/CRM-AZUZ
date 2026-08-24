import { randomInt } from "node:crypto";

import { NextResponse } from "next/server";

import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encriptar } from "@/lib/integracoes/crypto";
import { META_GRAPH_URL, chamarGraph, type ErroGraph } from "@/lib/integracoes/meta";

/**
 * Finaliza a conexão do WhatsApp Business oficial (Cloud API) depois do Embedded Signup — o popup
 * da Meta devolve `code` + os ids dos recursos criados, e é aqui que isso vira uma integração
 * usável de verdade.
 *
 * São QUATRO passos em sequência, e cada um pode falhar por conta própria. O passo alcançado fica
 * gravado em `metadados.passoConexao`, então uma nova tentativa (mesmo `code` já gasto não serve —
 * mas os ids sim) retoma de onde parou, sem obrigar a pessoa a refazer o popup inteiro.
 */
const PASSOS = ["token", "inscrever_waba", "registrar_numero", "metadados"] as const;
type Passo = (typeof PASSOS)[number];

type CorpoConectar = {
  code?: string;
  wabaId?: string;
  phoneNumberId?: string;
  businessId?: string;
  /** Informado pela pessoa quando o número já tinha sido registrado antes com outro PIN. */
  pinExistente?: string;
};

/** `metadados` é Json (união de formatos por provedor) — o cast é só pro TS, o valor já é JSON puro. */
function comoJson(valor: Record<string, unknown>): Prisma.InputJsonValue {
  return valor as Prisma.InputJsonValue;
}

/**
 * Passo 1 — troca o `code` do Embedded Signup pelo token de negócio DAQUELE cliente. Server-to-
 * server obrigatoriamente: leva o `client_secret`, que nunca pode aparecer no navegador.
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

type NumeroWaba = {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
  code_verification_status?: string;
};

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

  // Retry: sem `code` novo (já gasto na tentativa anterior), reaproveita o token já guardado.
  let accessToken: string | null = null;
  let passo: Passo = "token";

  async function salvarFalha(mensagem: string, passoAtual: Passo, extras: Record<string, unknown> = {}) {
    await prisma.integracao.upsert({
      where: { workspaceId_provedor: { workspaceId, provedor: "meta_whatsapp" } },
      create: {
        id: `integracao-${workspaceId}-meta_whatsapp`,
        workspaceId,
        provedor: "meta_whatsapp",
        status: "erro",
        erroMensagem: mensagem,
        metadados: comoJson({ ...metadadosAnteriores, ...extras, wabaId, phoneNumberId, businessId, passoConexao: passoAtual }),
        ...(accessToken ? { accessTokenCriptografado: encriptar(accessToken) } : {}),
      },
      update: {
        status: "erro",
        erroMensagem: mensagem,
        metadados: comoJson({ ...metadadosAnteriores, ...extras, wabaId, phoneNumberId, businessId, passoConexao: passoAtual }),
        ...(accessToken ? { accessTokenCriptografado: encriptar(accessToken) } : {}),
      },
    });
  }

  try {
    // ---- Passo 1: code -> token de negócio (longa duração, vinculado a ESTE cliente) ----
    if (code) {
      accessToken = await trocarCodePorTokenDeNegocio(code, appId, appSecret);
    } else if (existente?.accessTokenCriptografado) {
      const { decriptar } = await import("@/lib/integracoes/crypto");
      accessToken = decriptar(existente.accessTokenCriptografado);
    }
    if (!accessToken) {
      return NextResponse.json({ erro: "Autorização não recebida — refaça a conexão." }, { status: 400 });
    }

    // ---- Passo 2: inscrever o app na WABA do cliente ----
    // SEM ISSO O WEBHOOK NUNCA DISPARA pra esse cliente: tudo parece conectado, e nenhuma mensagem
    // chega. É inscrição por WABA, não algo que o OAuth faça sozinho.
    passo = "inscrever_waba";
    await chamarGraph(`/${wabaId}/subscribed_apps`, accessToken, { method: "POST" });

    // ---- Passo 3: registrar o número na Cloud API ----
    passo = "registrar_numero";
    // PIN de 6 dígitos gerado aqui (nunca no navegador) — guardado criptografado e mostrado uma
    // única vez na resposta, pra pessoa anotar. Numa retentativa com `pinExistente`, usa o que ela
    // informou (número já registrado antes com outro PIN recusa um PIN novo).
    const pin = pinExistente ?? String(randomInt(0, 1_000_000)).padStart(6, "0");
    let pinJaRegistrado = false;
    try {
      await chamarGraph(`/${phoneNumberId}/register`, accessToken, {
        method: "POST",
        body: { messaging_product: "whatsapp", pin },
      });
    } catch (erro) {
      // Número já registrado com outro PIN: não é motivo pra abortar a conexão inteira — o resto
      // funciona, e a tela pede o PIN antigo pra completar esse passo depois.
      const codigoMeta = (erro as Error & { codigoMeta?: number }).codigoMeta;
      if (codigoMeta === 133005 || codigoMeta === 133010) {
        pinJaRegistrado = true;
      } else {
        throw erro;
      }
    }

    // ---- Passo 4: buscar e salvar os metadados da conta ----
    passo = "metadados";
    const waba = await chamarGraph<{ id: string; name?: string; currency?: string; timezone_id?: string }>(
      `/${wabaId}?fields=id,name,currency,timezone_id`,
      accessToken,
    );
    const numeros = await chamarGraph<{ data?: NumeroWaba[] }>(
      `/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status`,
      accessToken,
    );
    const numero = numeros.data?.find((n) => n.id === phoneNumberId) ?? numeros.data?.[0];

    const metadadosFinal = comoJson({
      ...metadadosAnteriores,
      businessId,
      wabaId,
      wabaNome: waba.name,
      moeda: waba.currency,
      fusoHorario: waba.timezone_id,
      phoneNumberId,
      numeroExibicao: numero?.display_phone_number,
      numeroVerificado: numero?.verified_name,
      qualityRating: numero?.quality_rating,
      verificacaoNumero: numero?.code_verification_status,
      registerPinCriptografado: pinJaRegistrado ? metadadosAnteriores.registerPinCriptografado : encriptar(pin),
      pinPendente: pinJaRegistrado,
      passoConexao: "concluido",
      ultimaVerificacaoSaude: new Date().toISOString(),
    });

    await prisma.integracao.upsert({
      where: { workspaceId_provedor: { workspaceId, provedor: "meta_whatsapp" } },
      create: {
        id: `integracao-${workspaceId}-meta_whatsapp`,
        workspaceId,
        provedor: "meta_whatsapp",
        status: "conectado",
        accessTokenCriptografado: encriptar(accessToken),
        metadados: metadadosFinal,
        erroMensagem: null,
      },
      update: {
        status: "conectado",
        accessTokenCriptografado: encriptar(accessToken),
        metadados: metadadosFinal,
        erroMensagem: null,
      },
    });

    // O PIN só sai daqui nesta resposta, uma vez — depois disso fica só criptografado no banco.
    return NextResponse.json({ ok: true, pin: pinJaRegistrado ? null : pin, pinPendente: pinJaRegistrado });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha ao conectar o WhatsApp Business.";
    await salvarFalha(mensagem, passo).catch(() => {});
    return NextResponse.json({ erro: mensagem, passo }, { status: 502 });
  }
}
