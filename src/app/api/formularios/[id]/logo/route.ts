import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { guardarArquivo, lerArquivo } from "@/lib/armazenamento/midia";
import type { TemaFormulario } from "@/lib/formularios-context";

/**
 * A logo do formulário.
 *
 * Antes só dava pra colar um endereço de imagem. Quem monta um formulário tem a logo como ARQUIVO
 * no computador, não hospedada em algum lugar com link público: pedir uma URL é pedir que a pessoa
 * resolva um problema de hospedagem antes de conseguir usar o produto, e na prática o campo ficava
 * vazio. Colar link continua valendo, e é o caminho de quem já tem a marca num CDN.
 *
 * O arquivo em si vai pro R2 pelo mesmo caminho de qualquer mídia do CRM (`guardarArquivo`), que
 * já sabe cair de volta pro banco quando o R2 não está configurado ou pisca.
 */

/** Só o que dá pra desenhar com segurança. SVG fica de fora de propósito: é um documento que
 *  executa script, e servi-lo do domínio do CRM abriria XSS no formulário público. */
const TIPOS_ACEITOS = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const LIMITE_BYTES = 2 * 1024 * 1024;

function temaDoFormulario(valor: unknown): TemaFormulario {
  return (valor ?? {}) as TemaFormulario;
}

/**
 * GET entrega a logo. SEM sessão: quem abre o formulário é um lead sem login, e a imagem faz parte
 * da página que ele vê. Não vaza nada além da própria logo, que é justamente o que foi publicado.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/formularios/[id]/logo">) {
  const { id } = await ctx.params;

  const formulario = await prisma.formulario.findUnique({ where: { id }, select: { tema: true } });
  const referencia = temaDoFormulario(formulario?.tema).logoArquivo;
  if (!referencia) return NextResponse.json({ erro: "Sem logo" }, { status: 404 });

  const arquivo = await lerArquivo(referencia);
  if (!arquivo) return NextResponse.json({ erro: "Sem logo" }, { status: 404 });

  return new NextResponse(new Uint8Array(arquivo.conteudo), {
    headers: {
      "content-type": arquivo.mimeType,
      // O endereço carrega `?v=` com o instante do envio, então trocar a logo troca o endereço e
      // o cache antigo deixa de ser consultado. Sem isso, um cache longo mostraria a logo velha
      // por horas depois da troca.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

/**
 * POST recebe a logo. EXIGE sessão e confere o workspace: sem isso, qualquer pessoa com o id de um
 * formulário (que é público, está no link compartilhado) poderia trocar a marca do formulário de
 * outra empresa.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/formularios/[id]/logo">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const formulario = await prisma.formulario.findUnique({ where: { id }, select: { workspaceId: true } });
  if (!formulario || formulario.workspaceId !== sessao.user.workspaceId) {
    // Mesma resposta pra "não existe" e "não é seu", pra não virar um jeito de descobrir quais ids
    // existem em outras empresas.
    return NextResponse.json({ erro: "Formulário não encontrado" }, { status: 404 });
  }

  const body = (await request.json()) as { dataUrl?: string };
  const dataUrl = body.dataUrl ?? "";
  const cabecalho = /^data:([^;]+);base64,/.exec(dataUrl);
  if (!cabecalho) {
    return NextResponse.json({ erro: "Arquivo inválido." }, { status: 400 });
  }

  const mimeType = cabecalho[1];
  if (!TIPOS_ACEITOS.has(mimeType)) {
    return NextResponse.json(
      { erro: "Formato não aceito. Use PNG, JPG, WEBP ou GIF." },
      { status: 400 },
    );
  }

  // O tamanho é conferido no conteúdo decodificado, não no comprimento do texto: base64 infla o
  // texto em cerca de 33%, e medir ali recusaria arquivo que cabe no limite.
  const bytes = Buffer.from(dataUrl.slice(cabecalho[0].length), "base64");
  if (bytes.length > LIMITE_BYTES) {
    return NextResponse.json(
      { erro: `A logo tem ${(bytes.length / 1024 / 1024).toFixed(1)} MB. O limite é 2 MB.` },
      { status: 400 },
    );
  }

  const referencia = await guardarArquivo({
    workspaceId: formulario.workspaceId,
    dataUrl,
    origem: "logo",
  });

  return NextResponse.json({
    logoArquivo: referencia,
    logoUrl: `/api/formularios/${id}/logo?v=${Date.now()}`,
  });
}
