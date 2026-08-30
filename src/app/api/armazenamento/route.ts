import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { espacoUsado } from "@/lib/armazenamento/midia";
import { apagarDoR2, chaveDeArquivo, guardarNoR2, lerDoR2, r2Configurado } from "@/lib/armazenamento/r2";

/**
 * Quanto espaço o workspace ocupa — e, sob pedido, se a nuvem está mesmo respondendo.
 *
 * O número vem da tabela de registro, não de uma listagem no R2: listar objeto é cobrado e um
 * cliente com anos de conversa tem dezenas de milhares deles. Ver `ArquivoArmazenado` no schema.
 */
export const dynamic = "force-dynamic";

/** Cortesia inicial por workspace. Casa com os 10 GB gratuitos do R2 — daqui pra cima é plano pago. */
const LIMITE_PADRAO_BYTES = 5 * 1024 * 1024 * 1024;

export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const usado = await espacoUsado(sessao.user.workspaceId);
  const limite = Number(process.env.R2_LIMITE_BYTES ?? LIMITE_PADRAO_BYTES);

  const resposta: Record<string, unknown> = {
    configurado: r2Configurado(),
    usadoBytes: usado,
    limiteBytes: limite,
    percentual: limite > 0 ? Math.min(100, Math.round((usado / limite) * 100)) : 0,
  };

  // `?teste=1` grava, lê e apaga um arquivo de verdade. É o único jeito honesto de saber se as
  // quatro variáveis estão certas: ter as variáveis definidas não prova que a chave é válida nem
  // que o bucket existe. Não deixa lixo pra trás.
  if (new URL(request.url).searchParams.get("teste") === "1") {
    resposta.teste = await testarR2(sessao.user.workspaceId);
  }

  return NextResponse.json(resposta);
}

async function testarR2(workspaceId: string): Promise<{ ok: boolean; detalhe: string }> {
  if (!r2Configurado()) {
    return { ok: false, detalhe: "Faltam variáveis: R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID ou R2_SECRET_ACCESS_KEY." };
  }

  const chave = chaveDeArquivo({ workspaceId, id: `teste-${Date.now()}`, extensao: "txt" });
  const conteudo = Buffer.from("teste de conexao do crm azuz");

  try {
    await guardarNoR2({ chave, conteudo, mimeType: "text/plain" });
    const lido = await lerDoR2(chave);
    if (!lido || !lido.conteudo.equals(conteudo)) {
      return { ok: false, detalhe: "Gravou, mas o arquivo voltou diferente do que foi enviado." };
    }
    return { ok: true, detalhe: "Gravação, leitura e exclusão funcionaram." };
  } catch (erro) {
    return { ok: false, detalhe: erro instanceof Error ? erro.message : "Falha desconhecida." };
  } finally {
    await apagarDoR2(chave).catch(() => {});
  }
}
