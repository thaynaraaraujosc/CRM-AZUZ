import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { lerMidiaNoCaminho } from "@/lib/conversas/midia-mensagem";
import { lerArquivo, urlDiretaDoArquivo } from "@/lib/armazenamento/midia";

/**
 * Serve UM anexo de UMA mensagem, como arquivo de verdade.
 *
 * O anexo continua guardado embutido na mensagem (data URL, ver `midia-mensagem.ts`); o que muda é
 * a entrega. Antes ele viajava dentro do JSON de `GET /api/mensagens-extra`, que traz o histórico
 * inteiro do workspace de uma vez. O navegador precisava baixar todos os anexos antes de desenhar
 * a primeira bolha. Aqui cada `<img>`/`<audio>` busca o seu, sob demanda e em paralelo.
 *
 * ---
 *
 * POR QUE ELA REDIRECIONA EM VEZ DE MANDAR OS BYTES
 *
 * Esta rota carregava o arquivo do R2 pra dentro da função e devolvia o conteúdo. Funciona, e é
 * caro de um jeito que não aparece até chegar a fatura: cada byte atravessa a Vercel duas vezes,
 * entrando e saindo, e ela cobra por isso. Em setembro de 2026 deu 142 GB e quase quinze dólares
 * com UMA pessoa usando o CRM — o item mais caro do produto, acima de tudo que ele faz de útil.
 *
 * Agora a função confere quem está pedindo, confere de quem é o arquivo, e devolve um
 * redirecionamento para um endereço assinado e temporário do R2. O navegador baixa direto da
 * Cloudflare, que não cobra saída de dados. Trafegam algumas centenas de bytes no lugar de vários
 * megabytes, e quem usa o CRM não vê diferença nenhuma.
 *
 * A checagem de dono continua ANTES e continua igual: sem sessão válida e sem ser o workspace
 * dono da mensagem, nenhuma assinatura é emitida. O que mudou foi por onde o arquivo viaja, não
 * quem pode pedir.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const parametros = new URL(request.url).searchParams;
  const id = parametros.get("id");
  const campo = parametros.get("campo");
  if (!id || !campo) return NextResponse.json({ erro: "id e campo são obrigatórios" }, { status: 400 });

  const mensagem = await prisma.mensagemExtra.findUnique({ where: { id } });
  // Mensagem de outro workspace responde igual a mensagem inexistente. Um id adivinhado não pode
  // virar um jeito de ler anexo de outra empresa, nem de descobrir que ele existe.
  if (!mensagem || mensagem.workspaceId !== sessao.user.workspaceId) {
    return NextResponse.json({ erro: "Anexo não encontrado" }, { status: 404 });
  }

  const guardado = lerMidiaNoCaminho(mensagem.extras, campo);
  if (!guardado) return NextResponse.json({ erro: "Anexo não encontrado" }, { status: 404 });

  /*
   * O caminho barato, e o normal desde que o R2 existe.
   *
   * Vem DEPOIS das checagens acima de propósito: a assinatura só nasce pra quem já provou ser dono
   * do arquivo. O prazo curto é o que a torna descartável — se o endereço vazar de um histórico de
   * navegação ou de um print, ele já não serve mais.
   */
  // `baixar` só chega no link de documento (ver `midia-mensagem.ts`). É o nome que o navegador
  // deve dar ao arquivo salvo; vai limpo pro cabeçalho em `r2.ts`.
  const nomeParaBaixar = parametros.get("baixar") ?? undefined;
  const urlDireta = urlDiretaDoArquivo(guardado, { nomeParaBaixar });
  if (urlDireta) {
    return NextResponse.redirect(urlDireta, {
      // 307 e não 302: preserva o método e, principalmente, NÃO é cacheável por padrão. Um
      // redirecionamento permanente guardado pelo navegador apontaria pra uma assinatura vencida
      // depois de dez minutos, e o anexo pararia de abrir sem explicação.
      status: 307,
      headers: { "cache-control": "private, max-age=60" },
    });
  }

  // O formato antigo (anexo em base64 dentro da própria mensagem) não tem arquivo pra apontar: o
  // conteúdo ESTÁ no banco, então a única entrega possível é esta, mandando os bytes. Continua
  // valendo enquanto houver mensagem antiga; ver `armazenamento/midia.ts`.
  const arquivo = await lerArquivo(guardado);
  if (!arquivo) return NextResponse.json({ erro: "Anexo não encontrado" }, { status: 404 });
  const bytes = arquivo.conteudo;

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": arquivo.mimeType,
      "content-length": String(bytes.length),
      // O conteúdo de uma mensagem já enviada nunca muda, então o navegador pode guardar pra
      // sempre: é o que faz a segunda visita à conversa não baixar nada de novo. `private` porque
      // é conteúdo de um workspace só: nenhum cache compartilhado pode reter isso.
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
}
