import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { gerarCodigo, marcarMensagem } from "@/lib/rastreio/codigo";
import { lerConsentimento, lerOrigemDaUrl } from "@/lib/rastreio/origem";

/**
 * A ponte entre o site do cliente e a conversa no WhatsApp.
 *
 * O PROBLEMA QUE ELA RESOLVE. O código do clique do Google só existe no navegador, na página em
 * que a pessoa caiu. Quando ela aperta o botão de WhatsApp e troca de aplicativo, esse código
 * morre: a conversa nasce sem nenhuma ligação com o anúncio que a trouxe. É por isso que o Google
 * enxerga "alguém clicou no botão" e nunca "aquele clique virou uma venda".
 *
 * COMO ELA RESOLVE. O botão do site aponta pra cá em vez de apontar direto pro WhatsApp. Esta rota
 * lê a marca do anúncio, guarda, inventa um código curto e manda a pessoa pro WhatsApp com esse
 * código dentro da mensagem pronta. Quando a mensagem chega, o webhook acha o código e cola a
 * origem no contato.
 *
 * POR QUE É UM LINK, E NÃO UM SCRIPT. Trocar o endereço de um botão é coisa que qualquer pessoa faz
 * no Wix, no WordPress ou no Instagram, sem programador e sem medo de quebrar o site. O CRM vai ser
 * vendido pra gente que nunca vai abrir o código da própria página, e rastreamento que exige
 * instalação técnica é rastreamento que a maioria nunca vai ter.
 *
 * NUNCA FALHA NA CARA DE QUEM CLICOU. Se o rastreio der errado por qualquer motivo, a pessoa é
 * mandada pro WhatsApp assim mesmo. Perder a atribuição é ruim; perder o lead é muito pior.
 */
export const dynamic = "force-dynamic";

const MENSAGEM_PADRAO = "Olá! Vim pelo anúncio e quero saber mais.";

function soDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * O número que recebe a conversa, tirado da conexão de WhatsApp do workspace.
 *
 * Prefere a API oficial e cai pro QR Code: são os dois jeitos de o CRM ter um número, e do ponto
 * de vista de quem clica no botão não faz diferença nenhuma.
 */
async function numeroDoWorkspace(workspaceId: string): Promise<string | null> {
  const conexoes = await prisma.integracao.findMany({
    where: { workspaceId, provedor: { in: ["meta_whatsapp", "whatsapp_nao_oficial"] }, status: "conectado" },
    select: { provedor: true, metadados: true },
  });
  const ordenadas = conexoes.sort((a) => (a.provedor === "meta_whatsapp" ? -1 : 1));
  for (const conexao of ordenadas) {
    const dados = (conexao.metadados as Record<string, unknown> | null) ?? {};
    const numero = (dados.numeroExibicao ?? dados.numero ?? dados.telefone) as string | undefined;
    if (numero && soDigitos(numero).length >= 10) return soDigitos(numero);
  }
  return null;
}

export async function GET(request: Request, contexto: { params: Promise<{ slug: string }> }) {
  const { slug } = await contexto.params;
  const url = new URL(request.url);

  const workspace = await prisma.workspace.findUnique({ where: { slug }, select: { id: true } });
  // Link de uma empresa que não existe mais. Manda pra home em vez de mostrar erro: quem clicou
  // não tem nada a ver com isso e não sabe o que é um slug.
  if (!workspace) return NextResponse.redirect(new URL("/", url.origin));

  const numero = await numeroDoWorkspace(workspace.id);
  if (!numero) return NextResponse.redirect(new URL("/", url.origin));

  const mensagemBase = url.searchParams.get("m")?.slice(0, 300) || MENSAGEM_PADRAO;
  let mensagem = mensagemBase;

  /*
   * Só grava quando há marca de anúncio de verdade. Visita orgânica que passa por este link não
   * vira registro nenhum: gravaria lixo no banco e, pior, poria um código na mensagem de alguém
   * que não veio de anúncio — e esse código depois atribuiria a pessoa a uma campanha que ela
   * nunca viu.
   */
  const origem = lerOrigemDaUrl(url.searchParams, url.searchParams.get("p") ?? undefined);
  if (origem) {
    try {
      const codigo = gerarCodigo();
      await prisma.cliqueRastreado.create({
        data: {
          id: `clique-${randomBytes(12).toString("hex")}`,
          workspaceId: workspace.id,
          codigo,
          // O consentimento viaja junto do clique: ele é lido AQUI, na página em que a pessoa
          // estava, e não existe mais quando a conversa começa do outro lado.
          dados: {
            ...origem,
            consentimento: lerConsentimento(url.searchParams),
          } as unknown as Prisma.InputJsonValue,
        },
      });
      mensagem = marcarMensagem(mensagemBase, codigo);
    } catch (erro) {
      // Banco fora, código repetido, o que for: a pessoa segue pro WhatsApp sem marca. Ela não
      // pode ficar parada numa tela de erro porque o nosso rastreio tropeçou.
      console.error("[rastreio] falha ao registrar o clique:", erro);
    }
  }

  const destino = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
  return NextResponse.redirect(destino, {
    // 307 e sem cache: cada clique traz uma marca diferente, e um redirecionamento guardado pelo
    // navegador mandaria todo mundo com o código da primeira pessoa que clicou.
    status: 307,
    headers: { "cache-control": "no-store" },
  });
}
