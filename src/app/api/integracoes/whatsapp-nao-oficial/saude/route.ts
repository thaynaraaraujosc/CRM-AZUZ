import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { conferirCanalQrCode } from "@/lib/integracoes/saude-qrcode";

export const dynamic = "force-dynamic";

/**
 * "Chega mensagem no meu celular e não chega no CRM": esta rota responde por quê.
 *
 * OLHAR NÃO MEXE EM NADA. Este GET era um conserto disfarçado de consulta: ele reconfigurava o
 * webhook da instância na Evolution e reescrevia a conexão dona de mensagens já gravadas. Quem
 * abria Configurações disparava tudo isso sem saber (é a `SaudeQrCode` que busca aqui ao abrir a
 * tela), e quem desconfiava e evitava abrir estava certo: uma consulta que muda o comportamento do
 * sistema não pode ser usada pra investigar o sistema, porque ela mesma vira variável do problema.
 *
 * O conserto não se perdeu, só voltou pro lugar certo: o relógio roda
 * `conferirCanalQrCodeDeTodosOsWorkspaces` e `corrigirDonosDivergentes` de hora em hora, em todo
 * workspace, sem ninguém precisar abrir nada. Era assim que já estava documentado.
 */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const saude = await conferirCanalQrCode(sessao.user.workspaceId, { reparar: false });
  return NextResponse.json(saude, { headers: { "cache-control": "no-store" } });
}
