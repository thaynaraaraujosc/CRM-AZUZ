import { NextResponse } from "next/server";
import type { Session } from "next-auth";

import { auth } from "@/lib/auth";

/**
 * Autorização do lado do servidor, num lugar só.
 *
 * O CRM já bloqueava por papel e por permissão, mas SÓ na navegação de páginas (ver `proxy.ts`,
 * que ignora `/api` de propósito). Quem fala com a API direto não passa por nada disso: até aqui,
 * qualquer pessoa logada podia chamar qualquer rota, inclusive as de administração do workspace.
 * Esconder um botão é bom pra experiência e não é autorização nenhuma.
 *
 * Estas funções são a autorização de verdade, e existem pra ser chamadas na PRIMEIRA linha do
 * handler. Todas devolvem a sessão já conferida, então quem chama nunca precisa reler o papel do
 * corpo da requisição: `workspaceId`, `papelTipo` e `permissoes` saem do token da sessão, jamais
 * de algo que o navegador mandou.
 */

export type Sessao = Session;

type Negado = { ok: false; resposta: NextResponse };
type Aprovado = { ok: true; sessao: Sessao; workspaceId: string };
export type Resultado = Negado | Aprovado;

function negar(mensagem: string, status: number): Negado {
  return { ok: false, resposta: NextResponse.json({ erro: mensagem }, { status }) };
}

/** Só exige estar logado. O piso de toda rota privada. */
export async function exigirSessao(): Promise<Resultado> {
  const sessao = await auth();
  if (!sessao) return negar("Não autenticado", 401);
  return { ok: true, sessao, workspaceId: sessao.user.workspaceId };
}

/**
 * Exige ser administrador DO PRÓPRIO workspace (ou super-admin da plataforma).
 *
 * É o que protege gestão de equipe, papéis, permissões, assinatura e conexões: sem isso, um membro
 * comum promovia a si mesmo a admin, desativava o dono da conta ou desconectava o WhatsApp da
 * empresa, e nenhuma dessas ações passava por conferência nenhuma no servidor.
 */
export async function exigirAdmin(): Promise<Resultado> {
  const base = await exigirSessao();
  if (!base.ok) return base;
  if (base.sessao.user.papelTipo !== "admin" && !base.sessao.user.superAdmin) {
    return negar("Essa ação é só para administradores do workspace.", 403);
  }
  return base;
}

/**
 * Exige uma permissão de módulo (as mesmas chaves de Configurações → Usuários, ex.:
 * `config_visualizar`). Admin do workspace passa sempre: restringir o dono da conta dele mesmo não
 * faz sentido, e é a mesma regra que a navegação de páginas já aplica.
 */
export async function exigirPermissao(chave: string): Promise<Resultado> {
  const base = await exigirSessao();
  if (!base.ok) return base;
  const { papelTipo, permissoes, superAdmin } = base.sessao.user;
  if (papelTipo === "admin" || superAdmin) return base;
  if (!permissoes.includes(chave)) {
    return negar("Você não tem permissão para essa área.", 403);
  }
  return base;
}
