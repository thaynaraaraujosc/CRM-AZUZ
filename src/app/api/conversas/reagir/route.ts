import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import { enviarReacaoWhatsAppNaoOficial } from "@/lib/integracoes/evolution";
import { reagirNoDirectInstagram } from "@/lib/integracoes/instagram-login";

/**
 * Curte (ou descurte) uma mensagem. O duplo clique na bolha, em `/conversas`.
 *
 * DOIS CANAIS: o Direct do Instagram e o WhatsApp conectado por QR CODE. Os dois têm o que o
 * recurso exige — conseguem ENTREGAR a reação do outro lado e avisam quando a outra pessoa
 * reage. Num canal em que o CRM não conseguisse entregar, pintar um coração na tela seria
 * mentira: ficaria bonito aqui e a pessoa do outro lado nunca saberia.
 *
 * A API OFICIAL DA META FICA DE FORA, e isso é escolha, não esquecimento: lá a reação é uma
 * mensagem nova do tipo `reaction`, que consome a janela de 24 horas e conta como mensagem
 * enviada. Um duplo clique sem querer viraria cobrança e gastaria a janela de atendimento.
 *
 * O token nunca sai daqui: o cliente manda só o id da mensagem, e quem fala com o outro lado é o
 * servidor, com a integração do workspace da sessão.
 */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const { mensagemId, curtir } = (await request.json()) as { mensagemId?: string; curtir?: boolean };
  if (!mensagemId) return NextResponse.json({ erro: "mensagemId é obrigatório" }, { status: 400 });

  // A mensagem precisa ser deste workspace. Sem esta checagem, um id adivinhado reagiria na
  // conversa de outra empresa.
  const mensagem = await prisma.mensagemExtra.findUnique({ where: { id: mensagemId } });
  if (!mensagem || mensagem.workspaceId !== workspaceId) {
    return NextResponse.json({ erro: "Mensagem não encontrada" }, { status: 404 });
  }

  const conversa = await prisma.conversa.findUnique({
    where: { workspaceId_nome: { workspaceId, nome: mensagem.contato } },
  });
  if (!conversa?.contato) {
    return NextResponse.json({ erro: "Conversa não encontrada." }, { status: 404 });
  }

  const porQrCode =
    conversa.contaCanal?.startsWith("whatsapp_nao_oficial:") ||
    conversa.contaCanal?.startsWith("whatsapp_baileys:") ||
    // Conversa anterior a esta coluna existir: no WhatsApp, só o QR Code já espelhou histórico,
    // então ela é dele. Ver `conta-canal.ts`.
    (conversa.canal === "WhatsApp" && !conversa.contaCanal);

  if (conversa.canal !== "Instagram" && !porQrCode) {
    return NextResponse.json(
      { erro: "Curtir mensagem está disponível no Instagram e no WhatsApp conectado por QR Code." },
      { status: 400 },
    );
  }

  try {
    if (conversa.canal === "Instagram") {
      const integracao = await prisma.integracao.findUnique({
        where: { workspaceId_provedor: { workspaceId, provedor: "meta_instagram" } },
      });
      if (!integracao?.accessTokenCriptografado) {
        return NextResponse.json({ erro: "Instagram não está conectado." }, { status: 400 });
      }
      await reagirNoDirectInstagram(
        decriptar(integracao.accessTokenCriptografado),
        conversa.contato,
        mensagemId,
        curtir ? "❤️" : null,
      );
    } else {
      /*
       * O ID QUE O WHATSAPP CONHECE NÃO É SEMPRE O NOSSO.
       *
       * Em mensagem RECEBIDA, o id da linha já é o id do WhatsApp (é ele que o webhook usa como
       * chave). Em mensagem ENVIADA PELO CRM, o id nasce no navegador e o do WhatsApp chega
       * depois, no `wamid`. Mandar o id interno faz a Evolution procurar uma mensagem que não
       * existe — e a reação some sem erro nenhum, que é o jeito mais caro de falhar.
       */
      const ehNossa = mensagem.tipo === "out";
      const idNoWhatsApp = ehNossa ? mensagem.wamid : mensagem.id;
      if (!idNoWhatsApp) {
        return NextResponse.json(
          { erro: "Esta mensagem ainda não tem identificação no WhatsApp. Tente de novo em instantes." },
          { status: 409 },
        );
      }
      // Emoji vazio é como o WhatsApp DESFAZ a reação: não existe chamada própria pra remover.
      await enviarReacaoWhatsAppNaoOficial(
        workspaceId,
        conversa.contato,
        idNoWhatsApp,
        curtir ? "❤️" : "",
        ehNossa,
      );
    }
  } catch (erro) {
    const texto = erro instanceof Error ? erro.message : "Falha ao curtir a mensagem.";
    return NextResponse.json({ erro: texto }, { status: 502 });
  }

  // Só grava depois que o outro lado aceitou: um coração salvo aqui que não chegou lá é pior
  // do que nenhum, porque some no próximo carregamento sem explicação nenhuma.
  const extras = (mensagem.extras as Record<string, unknown> | null) ?? {};
  await prisma.mensagemExtra.update({
    where: { id: mensagemId },
    data: { extras: { ...extras, reacaoMinha: curtir ? "❤️" : undefined } as object },
  });

  return NextResponse.json({ ok: true });
}
