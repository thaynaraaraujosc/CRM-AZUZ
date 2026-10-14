import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/seguranca/auditoria";
import {
  chaveAtivaDoFlow,
  gerarChaveDoFlow,
  revogarChaveDoFlow,
} from "@/lib/integracoes/azuz-flow-chave";
import { destinoDoLead, } from "@/lib/integracoes/azuz-flow-destino";
import { ORIGEM_FLOW } from "@/lib/integracoes/azuz-flow-lead";
import { contaConectada } from "@/lib/integracoes/whatsapp-oficial";
import { comRespostaEmJson } from "@/lib/integracoes/resposta-em-json";

/**
 * Gestão da chave do AZUZ Flow, da tela de Configurações.
 *
 * Só administrador: a chave dá a quem tiver ela o poder de criar contato e disparar automação na
 * empresa inteira. É o mesmo nível de uma conexão de canal, e as conexões já são restritas assim.
 */
async function exigirAdmin() {
  const sessao = await auth();
  if (!sessao) return { ok: false as const, resposta: NextResponse.json({ erro: "Não autenticado" }, { status: 401 }) };
  if (sessao.user.papelTipo !== "admin" && !sessao.user.superAdmin) {
    return {
      ok: false as const,
      resposta: NextResponse.json({ erro: "Só administradores podem mexer na chave do AZUZ Flow." }, { status: 403 }),
    };
  }
  return { ok: true as const, sessao };
}

export async function GET() {
  return comRespostaEmJson("azuz-flow/chave GET", lerEstado);
}

async function lerEstado() {
  const guarda = await exigirAdmin();
  if (!guarda.ok) return guarda.resposta;
  const workspaceId = guarda.sessao.user.workspaceId;

  const [chave, conta, destino, ultimoLead] = await Promise.all([
    chaveAtivaDoFlow(workspaceId),
    contaConectada(workspaceId),
    destinoDoLead(workspaceId),
    prisma.leadRecebido.findFirst({
      where: { workspaceId, origem: ORIGEM_FLOW },
      orderBy: { criadoEm: "desc" },
      select: { criadoEm: true },
    }),
  ]);

  return NextResponse.json({
    chave,
    whatsappOficialConectado: Boolean(conta),
    destino,
    ultimoLeadEm: ultimoLead?.criadoEm ?? null,
  });
}

export async function POST() {
  return comRespostaEmJson("azuz-flow/chave POST", gerar);
}

async function gerar() {
  const guarda = await exigirAdmin();
  if (!guarda.ok) return guarda.resposta;
  const { sessao } = guarda;

  const gerada = await gerarChaveDoFlow({
    workspaceId: sessao.user.workspaceId,
    criadaPor: sessao.user.name ?? sessao.user.email ?? "—",
  });

  await auditar({
    workspaceId: sessao.user.workspaceId,
    membroId: sessao.user.id,
    email: sessao.user.email,
    acao: "integracao.chave_gerada",
    recurso: "azuz_flow",
    // O prefixo, nunca a chave. O registro serve pra saber QUAL chave foi gerada, não pra
    // reconstruir o acesso a partir do log de auditoria.
    detalhe: gerada.prefixo,
  });

  // A chave inteira sai UMA vez, aqui. `no-store` porque um proxy guardando esta resposta entregaria
  // a chave a quem viesse depois.
  return NextResponse.json(gerada, { headers: { "cache-control": "no-store" } });
}

export async function DELETE() {
  return comRespostaEmJson("azuz-flow/chave DELETE", revogar);
}

async function revogar() {
  const guarda = await exigirAdmin();
  if (!guarda.ok) return guarda.resposta;
  const { sessao } = guarda;

  const revogadas = await revogarChaveDoFlow(sessao.user.workspaceId);

  await auditar({
    workspaceId: sessao.user.workspaceId,
    membroId: sessao.user.id,
    email: sessao.user.email,
    acao: "integracao.chave_revogada",
    recurso: "azuz_flow",
  });

  return NextResponse.json({ ok: true, revogadas });
}
