import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { conferirEstruturaDoBanco, resumoDoEstado } from "@/lib/saude/estrutura-do-banco";

/**
 * Diz se o banco deste ambiente tem a estrutura que o código no ar espera.
 *
 * Só administrador: a resposta lista nome de tabela e de coluna, que é informação de dentro. Quem
 * administra já vê o schema inteiro na tela de integrações; para os outros não serve de nada.
 *
 * Login NÃO depende das tabelas conferidas aqui (ele lê `Membro` e `Usuario`), então esta rota
 * continua alcançável justamente no estado em que ela é útil: schema atrasado e telas quebrando.
 *
 * Responde 503 quando falta estrutura, não 200: assim um monitor externo acusa sozinho, sem
 * ninguém precisar ler o corpo.
 */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (sessao.user.papelTipo !== "admin" && !sessao.user.superAdmin) {
    return NextResponse.json({ erro: "Só administradores podem ver a saúde do banco." }, { status: 403 });
  }

  const estado = await conferirEstruturaDoBanco();
  return NextResponse.json(
    { ...estado, resumo: resumoDoEstado(estado) },
    { status: estado.ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
