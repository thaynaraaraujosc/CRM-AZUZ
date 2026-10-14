import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { conferirEstruturaDoBanco, resumoDoEstado, temCredencialDeMigracao } from "@/lib/saude/estrutura-do-banco";

/**
 * O banco deste ambiente tem a ESTRUTURA que o código no ar espera?
 *
 * Mora aqui, e não em `/api/saude/banco`, por uma razão aprendida do jeito ruim: aquela rota é
 * PÚBLICA de propósito — a tela de login a consulta antes de existir sessão, só pra saber se mostra
 * "senha incorreta" ou "o banco está fora". Esta aqui exige administrador, porque lista nome de
 * tabela e de coluna.
 *
 * Juntar as duas numa só fez a rota pública passar a exigir sessão, e a tela de login passou a
 * dizer "não consigo falar com o banco" em QUALQUER falha de entrada — inclusive numa senha errada,
 * e inclusive com o banco perfeitamente de pé. Duas perguntas diferentes, com públicos diferentes,
 * precisam de duas rotas.
 *
 * Responde 503 quando falta estrutura, pra um monitor externo acusar sem ler o corpo.
 */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (sessao.user.papelTipo !== "admin" && !sessao.user.superAdmin) {
    return NextResponse.json({ erro: "Só administradores podem ver a saúde do banco." }, { status: 403 });
  }

  const estado = await conferirEstruturaDoBanco();
  return NextResponse.json(
    { ...estado, resumo: resumoDoEstado(estado), credencialDeMigracao: temCredencialDeMigracao() },
    { status: estado.ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
