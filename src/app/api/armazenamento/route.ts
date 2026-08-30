import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
  // Quantas mensagens ainda carregam o arquivo embutido, do formato antigo. É o que decide se o
  // botão de mover pra nuvem aparece — some sozinho quando chega a zero, então nenhum cliente vê
  // um botão de manutenção que não tem mais o que fazer.
  const pendentes = r2Configurado()
    ? await prisma.mensagemExtra.count({
        where: { workspaceId: sessao.user.workspaceId, extras: { string_contains: "data:" } },
      })
    : 0;
  const limite = Number(process.env.R2_LIMITE_BYTES ?? LIMITE_PADRAO_BYTES);

  const resposta: Record<string, unknown> = {
    // Quem está respondendo. O Railway injeta isso sozinho em todo container que ele roda, então é
    // a única fonte confiável sobre QUAL serviço atende o domínio — mais confiável do que ler o
    // painel, onde dois projetos com o mesmo nome de serviço são fáceis de confundir. Nada aqui é
    // segredo: são nomes de projeto e o commit que está no ar.
    ondeEstouRodando: {
      projeto: process.env.RAILWAY_PROJECT_NAME ?? "(fora do Railway)",
      servico: process.env.RAILWAY_SERVICE_NAME ?? "—",
      ambiente: process.env.RAILWAY_ENVIRONMENT_NAME ?? "—",
      commit: (process.env.RAILWAY_GIT_COMMIT_SHA ?? "—").slice(0, 7),
    },
    configurado: r2Configurado(),
    usadoBytes: usado,
    limiteBytes: limite,
    percentual: limite > 0 ? Math.min(100, Math.round((usado / limite) * 100)) : 0,
    pendentesNoBanco: pendentes,
  };

  // `?teste=1` grava, lê e apaga um arquivo de verdade. É o único jeito honesto de saber se as
  // quatro variáveis estão certas: ter as variáveis definidas não prova que a chave é válida nem
  // que o bucket existe. Não deixa lixo pra trás.
  if (new URL(request.url).searchParams.get("teste") === "1") {
    resposta.teste = await testarR2(sessao.user.workspaceId);
  }

  // Sem cache: essa rota é usada pra conferir configuração e espaço usado, e uma resposta guardada
  // pelo navegador faria parecer que nada mudou depois de mexer nas variáveis ou apagar arquivo.
  return NextResponse.json(resposta, { headers: { "cache-control": "no-store" } });
}

/**
 * Estado de cada variável, SEM revelar o valor.
 *
 * Diz só se existe e quantos caracteres tem — o suficiente pra separar "não chegou no container"
 * de "chegou com espaço/quebra de linha colada junto", que é invisível na tela do Railway e quebra
 * a assinatura do mesmo jeito. Nenhum pedaço do segredo sai daqui.
 */
function conferirVariaveis(): Record<string, string> {
  const nomes = ["R2_ENDPOINT", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"];
  const estado: Record<string, string> = {};
  for (const nome of nomes) {
    const valor = process.env[nome];
    if (valor === undefined) estado[nome] = "AUSENTE";
    else if (valor.trim() === "") estado[nome] = "VAZIA";
    else if (valor !== valor.trim()) estado[nome] = `${valor.trim().length} caracteres + espaço/quebra de linha sobrando`;
    else estado[nome] = `ok, ${valor.length} caracteres`;
  }
  return estado;
}

async function testarR2(workspaceId: string): Promise<{ ok: boolean; detalhe: string; variaveis?: Record<string, string> }> {
  if (!r2Configurado()) {
    return {
      ok: false,
      detalhe: "O servidor não recebeu as quatro variáveis. Veja abaixo qual está faltando.",
      variaveis: conferirVariaveis(),
    };
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
