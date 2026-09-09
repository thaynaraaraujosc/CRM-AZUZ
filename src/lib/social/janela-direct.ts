import { prisma } from "@/lib/prisma";
import { CANAL_INSTAGRAM } from "@/lib/integracoes/conta-canal";

/**
 * A janela de 24 horas do Direct.
 *
 * O Instagram só deixa mandar mensagem livre por 24 horas depois da ÚLTIMA mensagem da pessoa.
 * Fora disso a API recusa. Não existe modelo aprovado como no WhatsApp oficial: a janela fechou,
 * acabou.
 *
 * Por isso "disparo em massa no Instagram" só existe de uma forma legítima: falar com quem falou
 * com você nas últimas 24 horas. Qualquer coisa além disso é mensagem que não sai, ou conta
 * denunciada. O produto não vai fingir que dá.
 *
 * A checagem acontece DUAS vezes de propósito: ao montar o público e de novo na hora de enviar
 * cada mensagem. Entre uma e outra passam minutos ou horas, e a janela de alguém fecha nesse meio.
 * Sem a segunda checagem, o fim de uma campanha seria uma sequência de recusas da Meta, cada uma
 * contando como falha do CRM.
 */
export const JANELA_HORAS = 24;

function inicioDaJanela(agora = new Date()): Date {
  return new Date(agora.getTime() - JANELA_HORAS * 60 * 60 * 1000);
}

export type PessoaNaJanela = {
  /** Chave da conversa: o @ quando conhecido, senão o IGSID. */
  contatoNome: string;
  /** Última mensagem DELA. É daqui que a janela conta. */
  ultimaMensagemEm: Date;
  /** Quando a janela fecha. */
  fechaEm: Date;
};

/**
 * Quem escreveu no Direct dentro da janela, com a hora da última mensagem de cada um.
 *
 * `tipo: "in"` é o que separa a mensagem DELA da nossa. Contar a nossa reabriria uma janela que na
 * verdade está fechada: responder alguém não dá direito de falar por mais 24 horas.
 */
export async function pessoasNaJanela(workspaceId: string, agora = new Date()): Promise<PessoaNaJanela[]> {
  const desde = inicioDaJanela(agora);

  const recebidas = await prisma.mensagemExtra.groupBy({
    by: ["contato"],
    where: { workspaceId, canal: CANAL_INSTAGRAM, tipo: "in", criadoEm: { gte: desde } },
    _max: { criadoEm: true },
  });

  return recebidas
    .map((linha) => {
      const ultima = linha._max.criadoEm;
      if (!ultima) return null;
      return {
        contatoNome: linha.contato,
        ultimaMensagemEm: ultima,
        fechaEm: new Date(ultima.getTime() + JANELA_HORAS * 60 * 60 * 1000),
      };
    })
    .filter((p): p is PessoaNaJanela => p !== null)
    .sort((a, b) => b.ultimaMensagemEm.getTime() - a.ultimaMensagemEm.getTime());
}

/**
 * Esta pessoa ainda está dentro da janela, AGORA?
 *
 * Chamado imediatamente antes de cada envio. Devolver `false` faz o destinatário ser marcado como
 * "janela fechada" em vez de virar uma recusa da Meta: a mesma coisa acontece, mas a explicação
 * fica certa no relatório, e a conta não acumula erro de API por algo previsível.
 */
export async function dentroDaJanelaDirect(
  workspaceId: string,
  contatoNome: string,
  agora = new Date(),
): Promise<boolean> {
  const recebida = await prisma.mensagemExtra.findFirst({
    where: {
      workspaceId,
      canal: CANAL_INSTAGRAM,
      tipo: "in",
      contato: contatoNome,
      criadoEm: { gte: inicioDaJanela(agora) },
    },
    select: { id: true },
  });
  return !!recebida;
}
