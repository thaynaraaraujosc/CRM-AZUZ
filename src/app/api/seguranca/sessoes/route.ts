import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { descreverDispositivo } from "@/lib/sessoes";

/**
 * GET — sessões de verdade do Membro logado (`SessaoAtiva`, criada no login em `src/lib/auth.ts`),
 * não mais o mock fixo de 3 linhas. `atual` marca a sessão de quem está fazendo a requisição agora
 * (comparando o `jti` desta sessão, exposto pelo callback `session`).
 */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const sessoes = await prisma.sessaoAtiva.findMany({
    where: { membroId: sessao.user.id, revogadaEm: null },
    orderBy: { criadoEm: "desc" },
  });

  return NextResponse.json(
    sessoes.map((s) => ({
      id: s.id,
      dispositivo: descreverDispositivo(s.userAgent),
      ip: s.ip,
      criadoEm: s.criadoEm,
      atual: s.jti === sessao.jti,
    })),
  );
}
