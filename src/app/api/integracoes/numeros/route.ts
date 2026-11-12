import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { esquecerConexoes } from "@/lib/integracoes/conexoes-cache";
import { CANAL_NAO_OFICIAL, CANAL_OFICIAL } from "@/lib/integracoes/conta-canal";
import { grafiasDoContaCanal } from "@/lib/integracoes/conta-canal-normalizar";
import { ESCOPOS, escopoPermitido } from "@/lib/configuracoes/permissoes";
import { LIMITE_DE_NUMEROS, listarConexoesWhats, proximoSlotLivre } from "@/lib/integracoes/conexoes-whatsapp";
import { numerosDeWhatsApp } from "@/lib/integracoes/numeros-de-whatsapp";

/**
 * Os números de WhatsApp da empresa, dos DOIS canais.
 *
 * Rota própria, e não mais um campo na de QR Code: esta pergunta não é sobre um canal, é sobre a
 * empresa. A caixa de entrada e o funil perguntam "quais números existem aqui?" — e a resposta
 * certa inclui o oficial.
 */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const workspaceId = sessao.user.workspaceId;
  const [numeros, conexoesQr, funis] = await Promise.all([
    numerosDeWhatsApp(workspaceId),
    listarConexoesWhats(workspaceId),
    // Os funis vão junto porque a tela precisa deles pra oferecer "o funil deste número" — e uma
    // segunda chamada só pra isso seria mais uma ida ao banco por abertura de tela.
    // `contaCanal` vai junto porque a tela mostra DE QUAL FUNIL é cada número — a pergunta
    // invertida da que o funil responde. Ver `funilDoNumero`.
    prisma.funil.findMany({
      where: { workspaceId },
      select: { id: true, nome: true, contaCanal: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  /*
   * O RECORTE DE NÚMEROS TAMBÉM VALE AQUI, e esta era a falha que ela viu no print.
   *
   * "Coloquei que ele não poderia ficar com os dois WhatsApp, somente um, mas tá mostrando que ele
   * tá com acesso do WhatsApp" — e estava: a LISTA de conversas já respeitava o recorte
   * (`/api/conversas`), mas a lista de NÚMEROS não. Resultado: as abas em cima da caixa de entrada
   * mostravam os dois telefones, com o número completo de cada um, pra quem só podia ver um.
   *
   * O mesmo recorte, no servidor, e pela mesma razão de lá: esconder na tela é esconder de quem
   * olha, não de quem pede.
   *
   * Nada marcado = vê todos, que é o comportamento de sempre para quem nunca teve recorte.
   */
  const numerosPermitidos = escopoPermitido(sessao.user.permissoes, ESCOPOS.numerosDeWhatsApp);
  const numerosNoRecorte = numerosPermitidos
    ? numeros.filter((n) => numerosPermitidos.some((p) => grafiasDoContaCanal(p).includes(n.chave)))
    : numeros;

  return NextResponse.json(
    {
      numeros: numerosNoRecorte,
      funis,
      limite: LIMITE_DE_NUMEROS,
      proximoLivre: proximoSlotLivre(conexoesQr.map((c) => c.slot)),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

/**
 * Nomeia um número, e diz pra onde vão os leads dele.
 *
 * Os três campos moram nos metadados da conexão, e não em colunas: são rótulo e preferência, e
 * cada um deles nasce pra ser mexido. Uma coluna por ideia num banco com cliente em cima é o
 * caminho mais caro possível pra mudar um padrão.
 */
export async function PATCH(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (sessao.user.papelTipo !== "admin" && !sessao.user.superAdmin) {
    return NextResponse.json({ erro: "Só administradores podem mexer nas conexões." }, { status: 403 });
  }

  const corpo = (await request.json().catch(() => ({}))) as {
    provedor?: string;
    slot?: number;
    apelido?: string | null;
    funilId?: string | null;
    responsavel?: string | null;
  };

  const provedor = corpo.provedor === CANAL_OFICIAL ? CANAL_OFICIAL : CANAL_NAO_OFICIAL;
  const slot = Number.isInteger(corpo.slot) && (corpo.slot as number) >= 1 ? (corpo.slot as number) : 1;

  const workspaceId = sessao.user.workspaceId;
  const linha = await prisma.integracao.findUnique({
    where: { workspaceId_provedor_slot: { workspaceId, provedor, slot } },
    select: { metadados: true },
  });
  if (!linha) return NextResponse.json({ erro: "Esse número não existe nesta conta." }, { status: 404 });

  /*
   * O FUNIL PRECISA SER DESTA EMPRESA.
   *
   * Sem esta conferência, um id qualquer no corpo mandaria os leads deste número pro funil de
   * outro cliente — e o lead simplesmente não apareceria pra ninguém aqui, sem erro nenhum.
   */
  let funilId = linha.metadados && typeof linha.metadados === "object"
    ? ((linha.metadados as Record<string, unknown>).funilId as string | null) ?? null
    : null;
  /*
   * O FUNIL NÃO É MAIS ESCOLHIDO AQUI, mas o campo continua sendo aceito — e por um motivo só:
   * limpar.
   *
   * O vínculo mudou de lado (quem escolhe é o funil, na criação dele). O metadado antigo segue
   * valendo como segunda opção em `destinoDoNumero`, pra conta já configurada não perder o destino
   * de uma hora pra outra. Aceitar `null` deixa desfazer um vínculo antigo; aceitar um id novo
   * reporia a direção errada, em que dois números apontam pro mesmo quadro.
   */
  if (corpo.funilId !== undefined) {
    if (corpo.funilId === null || corpo.funilId === "") {
      funilId = null;
    } else {
      return NextResponse.json(
        { erro: "O funil de um número é escolhido ao criar o funil, não aqui." },
        { status: 400 },
      );
    }
  }

  const metadados = { ...((linha.metadados as Record<string, unknown> | null) ?? {}) };
  // Mescla campo a campo: `metadados` é Json e o Prisma troca a coluna inteira. Escrever só o que
  // mudou apagaria o número conectado, o rastro do webhook e o progresso da importação de uma vez.
  if (corpo.apelido !== undefined) metadados.apelido = (corpo.apelido ?? "").trim().slice(0, 60) || null;
  if (corpo.responsavel !== undefined) metadados.responsavel = (corpo.responsavel ?? "").trim().slice(0, 80) || null;
  metadados.funilId = funilId;

  await prisma.integracao.update({
    where: { workspaceId_provedor_slot: { workspaceId, provedor, slot } },
    data: { metadados: metadados as object },
  });
  esquecerConexoes(workspaceId);

  return NextResponse.json({ ok: true });
}
