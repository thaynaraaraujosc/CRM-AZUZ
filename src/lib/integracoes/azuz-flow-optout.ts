import { prisma } from "@/lib/prisma";
import { ehChaveDuplicada } from "@/lib/prisma-erros";
import { normalizarTelefoneParaComparacao } from "@/lib/telefone";

/**
 * "SAIR" / "PARAR": o jeito de a pessoa desligar a mensagem do lado dela.
 *
 * Isto não é cortesia, é o que separa uma confirmação de reunião de uma mensagem não solicitada. A
 * mensagem que o CRM manda diz de onde a pessoa veio e como parar; aqui é o outro lado dessa
 * promessa — se ela responder pedindo pra parar e o CRM continuar mandando, a promessa era falsa, e
 * é desse tipo de reclamação que número de WhatsApp é banido.
 *
 * O que acontece quando ela pede: o CONSENTIMENTO cai (`consentimentoWhatsApp = false`, que já é
 * lido em `acoes.ts` e na decisão da confirmação), a fila daquele número é cancelada, e a conversa
 * ganha uma bolha de sistema dizendo isso. Nada é apagado.
 */

/** Palavras que, sozinhas, só podem significar "pare". */
const PALAVRAS_DE_PARAR = new Set([
  "sair",
  "sai",
  "parar",
  "pare",
  "para",
  "cancelar",
  "cancela",
  "descadastrar",
  "remover",
  "stop",
  "unsubscribe",
]);

/**
 * Palavras que não mudam o pedido: "parar por favor" é o mesmo pedido que "parar".
 *
 * Existe pra não obrigar a pessoa a escrever a palavra exata e nada mais. Ninguém lê um aviso de
 * rodapé e responde com precisão de comando de terminal — e o custo de errar pra menos aqui é
 * continuar mandando mensagem pra quem pediu pra parar.
 */
const PALAVRAS_NEUTRAS = new Set([
  "por",
  "favor",
  "pf",
  "pfv",
  "quero",
  "queria",
  "gostaria",
  "de",
  "me",
  "nao",
  "mais",
  "receber",
  "mensagem",
  "mensagens",
  "obrigado",
  "obrigada",
  "obg",
  "ja",
  "agora",
  "favo",
]);

/**
 * A mensagem inteira é um pedido pra parar?
 *
 * A regra é sobre a MENSAGEM TODA, nunca sobre conter a palavra. "Vou sair mais cedo hoje" e "pode
 * parar o projeto por enquanto" contêm a palavra e não são pedido nenhum — desligar o WhatsApp de
 * um cliente por causa disso seria pior do que não ter o recurso.
 *
 * Então: tira acento e pontuação, joga fora as palavras neutras, e sobra EXATAMENTE uma palavra da
 * lista de cima. Qualquer coisa a mais e não é um pedido.
 */
export function ehPedidoDeParar(texto: string): boolean {
  const limpo = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Mantém só letras e espaço: emoji, ponto, exclamação e aspas não mudam o pedido.
    .replace(/[^a-z\s]/g, " ")
    .trim();
  if (!limpo || limpo.length > 60) return false;

  const palavras = limpo.split(/\s+/).filter((p) => !PALAVRAS_NEUTRAS.has(p));
  return palavras.length === 1 && PALAVRAS_DE_PARAR.has(palavras[0]);
}

export type ResultadoDoOptOut = {
  /** O consentimento caiu agora (era true ou nulo). */
  desmarcado: boolean;
  /** Quantas confirmações estavam na fila e foram canceladas. */
  canceladas: number;
};

/**
 * Registra o pedido. Chamada depois de a mensagem já estar gravada, e NUNCA pode derrubar o
 * webhook: a mensagem da pessoa tem que aparecer na conversa mesmo que isto falhe.
 */
export async function registrarPedidoDeParar(params: {
  workspaceId: string;
  /** Telefone como chegou no evento. Normalizado aqui dentro. */
  telefone: string;
  contatoId: string | null;
  conversaNome: string;
  contaCanal: string | null;
  /** Id da mensagem que pediu. Vira o id da bolha, então o mesmo pedido não escreve duas vezes. */
  mensagemId: string;
}): Promise<ResultadoDoOptOut> {
  const resultado: ResultadoDoOptOut = { desmarcado: false, canceladas: 0 };
  const telefone = normalizarTelefoneParaComparacao(params.telefone);

  if (params.contatoId) {
    try {
      const contato = await prisma.contato.findUnique({
        where: { id: params.contatoId },
        select: { consentimentoWhatsApp: true },
      });
      // Já estava desmarcado: não reescreve a data. A data do pedido é a do PRIMEIRO pedido, e é
      // ela que vale se alguém perguntar desde quando esta pessoa pediu pra parar.
      if (contato && contato.consentimentoWhatsApp !== false) {
        await prisma.contato.update({
          where: { id: params.contatoId },
          data: {
            consentimentoWhatsApp: false,
            consentimentoWhatsAppEm: new Date(),
            // `consentimentoWhatsAppTexto` fica como está, de propósito: ele guarda a frase que a
            // pessoa ACEITOU um dia. Apagar isso pra escrever a recusa perderia metade da história
            // — a recusa já está no booleano, na data e nesta origem.
            consentimentoWhatsAppOrigem: "revogado-no-whatsapp",
          },
        });
        resultado.desmarcado = true;
      }
    } catch (erro) {
      console.error("[azuz-flow] não deu pra desmarcar o consentimento:", erro);
    }
  }

  try {
    const cancelamento = await prisma.confirmacaoDeReuniao.updateMany({
      where: { workspaceId: params.workspaceId, telefone, situacao: "na_fila" },
      data: {
        situacao: "cancelada",
        motivo: "Confirmação não enviada: a pessoa pediu para parar de receber mensagens.",
      },
    });
    resultado.canceladas = cancelamento.count;
  } catch (erro) {
    // Tabela ainda não aplicada neste banco: o resto do pedido continua valendo.
    console.error("[azuz-flow] não deu pra cancelar a fila deste número:", erro);
  }

  if (resultado.desmarcado || resultado.canceladas > 0) {
    const frase = resultado.canceladas
      ? `A pessoa pediu para parar de receber mensagens. O consentimento de WhatsApp foi desmarcado e ${resultado.canceladas === 1 ? "1 confirmação de reunião foi cancelada" : `${resultado.canceladas} confirmações de reunião foram canceladas`}.`
      : "A pessoa pediu para parar de receber mensagens. O consentimento de WhatsApp foi desmarcado.";
    try {
      await prisma.mensagemExtra.create({
        data: {
          id: `optout-${params.mensagemId}`.slice(0, 190),
          workspaceId: params.workspaceId,
          contato: params.conversaNome,
          tipo: "system",
          texto: frase,
          hora: "",
          criadoEm: new Date(),
          contaCanal: params.contaCanal,
        },
      });
    } catch (erro) {
      if (!ehChaveDuplicada(erro)) {
        console.error("[azuz-flow] não deu pra anotar o pedido de parar na conversa:", erro);
      }
    }
  }

  return resultado;
}
