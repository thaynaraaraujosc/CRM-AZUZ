import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slotDeEnvio, slotEscolhidoParaEnvio, slotPadraoDeEnvio } from "@/lib/integracoes/conexoes-whatsapp";
import { enviarMensagemWhatsAppNaoOficial, enviarAudioWhatsAppNaoOficial } from "@/lib/integracoes/evolution";

/** POST manda uma mensagem de texto (ou áudio) pelo WhatsApp não oficial (Evolution API).
 * Chamada pela tela de Conversas quando o atendente responde numa conversa desse canal. */
export async function POST(request: Request) {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { destinatario, texto, audioBase64, conversa, conexao } = (await request.json()) as {
    destinatario?: string;
    texto?: string;
    audioBase64?: string;
    /** O nome da conversa aberta na tela. É por ele que se descobre QUAL número responde. */
    conversa?: string;
    /**
     * O número ESCOLHIDO na tela, quando quem atende escolheu um.
     *
     * Vem no mesmo formato do `contaCanal` da conversa. Só existe quando a escolha foi explícita:
     * sem ele, vale a regra de sempre — responde o número que recebeu.
     */
    conexao?: string;
  };
  if (!destinatario || (!texto?.trim() && !audioBase64)) {
    return NextResponse.json({ erro: "destinatario e (texto ou audioBase64) são obrigatórios" }, { status: 400 });
  }

  // JID de grupo (`<id>@g.us`) precisa ir inteiro pra Evolution. Só numeral vira número de
  // telefone pra ela, não acha o grupo. Telefone de pessoa continua só-dígitos como sempre.
  const numeroOuJid = destinatario.endsWith("@g.us") ? destinatario : destinatario.replace(/\D/g, "");

  const workspaceId = sessao.user.workspaceId;

  /*
   * A RESPOSTA SAI PELO NÚMERO QUE RECEBEU.
   *
   * Com um número só, "o WhatsApp da empresa" e "o número desta conversa" eram a mesma coisa e
   * esta rota não precisava perguntar nada. Com vendedora e closer conectados ao mesmo CRM, são
   * coisas diferentes: responder pelo número errado faz a conversa do cliente trocar de remetente
   * no meio, e ele responde pro número de quem nunca falou com ele.
   *
   * A conexão é lida da CONVERSA, e não do que o navegador mandar: quem atende não escolhe por
   * onde sai, a conversa é que já pertence a um número.
   */
  /*
   * A ESCOLHA EXPLÍCITA GANHA DA CONVERSA — e só ela.
   *
   * "Preciso da opção de escolher aqui o número que eu vou mandar mensagem, mesmo já tendo falado
   * com o contato por outro número." É um caso real: a closer assume o lead que a vendedora abriu.
   *
   * Continua sendo exceção, não padrão: sem `conexao` no corpo, nada muda e a conversa manda. E
   * continua sendo o navegador propondo, não decidindo — `slotEscolhidoParaEnvio` confere que
   * aquele número é deste workspace e está conectado agora.
   */
  const escolha = conexao ? await slotEscolhidoParaEnvio(workspaceId, conexao) : null;
  if (escolha && escolha.slot === null) {
    return NextResponse.json({ erro: escolha.motivo }, { status: 409 });
  }

  const linha = conversa
    ? await prisma.conversa.findUnique({
        where: { workspaceId_nome: { workspaceId, nome: conversa } },
        select: { contaCanal: true },
      })
    : await prisma.conversa.findFirst({
        where: { workspaceId, contato: numeroOuJid },
        select: { contaCanal: true },
      });

  /*
   * Conversa que o CRM não acha é conversa que ainda não existe: é o atendente escrevendo pra
   * alguém pela primeira vez. Aí não há "número que recebeu", e vale a mesma regra de quando a
   * automação inicia — sai pelo primeiro número conectado.
   */
  const { slot, motivo } = escolha
    ? escolha
    : linha
      ? await slotDeEnvio(workspaceId, linha.contaCanal)
      : { slot: await slotPadraoDeEnvio(workspaceId), motivo: "nenhum número de WhatsApp conectado" };

  if (slot === null) return NextResponse.json({ erro: motivo }, { status: 409 });

  try {
    if (audioBase64) {
      await enviarAudioWhatsAppNaoOficial(workspaceId, numeroOuJid, audioBase64, slot);
    } else {
      await enviarMensagemWhatsAppNaoOficial(workspaceId, numeroOuJid, texto!, slot);
    }
  } catch (erro) {
    return NextResponse.json(
      { erro: erro instanceof Error ? erro.message : "Falha ao enviar mensagem" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
