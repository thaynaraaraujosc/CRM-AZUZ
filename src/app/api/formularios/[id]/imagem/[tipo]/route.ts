import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { guardarArquivo, lerArquivo } from "@/lib/armazenamento/midia";
import type { TemaFormulario } from "@/lib/formularios-context";

/**
 * As imagens do formulário: logo, banner e imagem de fundo.
 *
 * As três eram campos de endereço. Quem monta um formulário tem os arquivos no computador, não
 * hospedados com link público, então pedir uma URL é pedir que a pessoa resolva um problema de
 * hospedagem antes de conseguir usar o produto. Na prática os campos ficavam vazios.
 *
 * Uma rota só pras três porque a diferença entre elas é o campo do tema onde a referência é
 * guardada, e nada mais: mesma checagem, mesmo limite, mesmo armazenamento. Três rotas iguais
 * divergiriam na primeira correção feita em só uma delas.
 */

/** Só o que dá pra desenhar com segurança. SVG fica de fora de propósito: é um documento que
 *  executa script, e servi-lo do domínio do CRM abriria XSS no formulário público. */
const TIPOS_ACEITOS = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const LIMITE_BYTES = 2 * 1024 * 1024;

/** O campo do tema onde a referência de cada imagem mora. */
const CAMPO_POR_TIPO = {
  logo: "logoArquivo",
  banner: "bannerArquivo",
  fundo: "fundoArquivo",
} as const;

type TipoImagem = keyof typeof CAMPO_POR_TIPO;

function ehTipoValido(valor: string): valor is TipoImagem {
  return valor in CAMPO_POR_TIPO;
}

function temaDoFormulario(valor: unknown): TemaFormulario & Record<string, unknown> {
  return (valor ?? {}) as TemaFormulario & Record<string, unknown>;
}

/**
 * GET entrega a imagem. SEM sessão: quem abre o formulário é um lead sem login, e a imagem faz
 * parte da página que ele vê. Não devolve nada além da própria imagem publicada.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/formularios/[id]/imagem/[tipo]">) {
  const { id, tipo } = await ctx.params;
  if (!ehTipoValido(tipo)) return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });

  const formulario = await prisma.formulario.findUnique({ where: { id }, select: { tema: true } });
  const referencia = temaDoFormulario(formulario?.tema)[CAMPO_POR_TIPO[tipo]];
  if (typeof referencia !== "string" || !referencia) {
    return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
  }

  const arquivo = await lerArquivo(referencia);
  if (!arquivo) return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });

  return new NextResponse(new Uint8Array(arquivo.conteudo), {
    headers: {
      "content-type": arquivo.mimeType,
      // O endereço carrega `?v=` com o instante do envio, então trocar a imagem troca o endereço e
      // o cache antigo deixa de ser consultado.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

/**
 * POST recebe a imagem. EXIGE sessão e confere o workspace: o id do formulário é público, está no
 * link compartilhado, então sem essa conferência qualquer pessoa trocaria as imagens do formulário
 * de outra empresa.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/formularios/[id]/imagem/[tipo]">) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id, tipo } = await ctx.params;
  if (!ehTipoValido(tipo)) return NextResponse.json({ erro: "Tipo de imagem inválido." }, { status: 400 });

  const formulario = await prisma.formulario.findUnique({ where: { id }, select: { workspaceId: true } });
  if (!formulario || formulario.workspaceId !== sessao.user.workspaceId) {
    // Mesma resposta pra "não existe" e "não é seu", pra não virar um jeito de descobrir quais ids
    // existem em outras empresas.
    return NextResponse.json({ erro: "Formulário não encontrado" }, { status: 404 });
  }

  const body = (await request.json()) as { dataUrl?: string };
  const dataUrl = body.dataUrl ?? "";
  const cabecalho = /^data:([^;]+);base64,/.exec(dataUrl);
  if (!cabecalho) return NextResponse.json({ erro: "Arquivo inválido." }, { status: 400 });

  const mimeType = cabecalho[1];
  if (!TIPOS_ACEITOS.has(mimeType)) {
    return NextResponse.json({ erro: "Formato não aceito. Use PNG, JPG, WEBP ou GIF." }, { status: 400 });
  }

  // O tamanho é conferido no conteúdo decodificado, não no comprimento do texto: base64 infla o
  // texto em cerca de 33%, e medir ali recusaria arquivo que cabe no limite.
  const bytes = Buffer.from(dataUrl.slice(cabecalho[0].length), "base64");
  if (bytes.length > LIMITE_BYTES) {
    return NextResponse.json(
      { erro: `A imagem tem ${(bytes.length / 1024 / 1024).toFixed(1)} MB. O limite é 2 MB.` },
      { status: 400 },
    );
  }

  const referencia = await guardarArquivo({
    workspaceId: formulario.workspaceId,
    dataUrl,
    origem: "logo",
  });

  return NextResponse.json({
    arquivo: referencia,
    url: `/api/formularios/${id}/imagem/${tipo}?v=${Date.now()}`,
  });
}
