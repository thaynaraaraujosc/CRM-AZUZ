/**
 * Mandar ou não a confirmação de reunião — e, quando não, POR QUÊ, numa frase que serve pra tela.
 *
 * Separado do envio de propósito. Esta é a parte que decide sobre a mensagem que vai pro WhatsApp
 * de uma pessoa de verdade, e toda regra aqui precisa ser provável sem banco, sem rede e sem
 * relógio de verdade.
 *
 * O MOTIVO É PARTE DO RESULTADO, não um detalhe de log. Ele aparece em dois lugares — na bolha de
 * sistema dentro da conversa e nos `avisos` que o Flow mostra na tela de Respostas —, então é
 * escrito em português, curto, e dizendo o que aconteceu em vez de um código.
 */

export type DecisaoDaConfirmacao =
  /** Grava na fila. O envio é de quem processa a fila, não daqui. */
  | { acao: "enfileirar" }
  /** Não se aplica: nada é gravado e nada é dito. Não é falha. */
  | { acao: "nao_se_aplica" }
  /** Não vai sair, e a razão precisa aparecer. */
  | { acao: "nao_enviar"; motivo: string };

export type ContextoDaConfirmacao = {
  /** A chave "Confirmação de reunião do Flow" desta empresa. Nasce desligada. */
  ativa: boolean;
  /** O início da reunião, em UTC. `null` quando o lead não trouxe reunião. */
  inicio: Date | null;
  /** `consentimento.whatsapp.aceitou` do corpo. Só `true` libera. */
  consentiu: boolean;
  /** Telefone normalizado. `null` quando o lead não trouxe WhatsApp utilizável. */
  telefone: string | null;
  /** A conversa onde a mensagem sairia. `null` quando o lead ficou sem conversa. */
  conversa: { nome: string; canal: string } | null;
  agora: Date;
};

export function decidirConfirmacao(ctx: ContextoDaConfirmacao): DecisaoDaConfirmacao {
  // Sem reunião não há o que confirmar. É a maioria dos leads, e silêncio é a resposta certa:
  // gravar "não enviada" pra todo formulário sem agendamento encheria a tela de não-notícia.
  if (!ctx.inicio) return { acao: "nao_se_aplica" };

  // Desligada também é silêncio. A empresa escolheu não mandar; isso não é uma falha pra reportar
  // em cada lead.
  if (!ctx.ativa) return { acao: "nao_se_aplica" };

  /*
   * CONSENTIMENTO ESTRITO, e só aqui.
   *
   * A guarda geral do CRM (`bloqueadoPorFaltaDeConsentimento`) bloqueia apenas o `false` explícito,
   * e tem que continuar assim: a coluna é opcional e todo contato criado antes dela existir tem
   * `null` — endurecer lá calaria mensagem pra quase toda a base de todos os clientes.
   *
   * Aqui é diferente. Esta mensagem parte do CRM para quem NUNCA escreveu, por um número que pode
   * ser bloqueado por denúncia. Pra iniciar conversa, "não se sabe" tem que valer como não.
   */
  if (ctx.consentiu !== true) {
    return { acao: "nao_enviar", motivo: "Confirmação não enviada: sem consentimento." };
  }

  if (!ctx.telefone) {
    return { acao: "nao_enviar", motivo: "Confirmação não enviada: o lead não trouxe um WhatsApp válido." };
  }

  if (!ctx.conversa) {
    return {
      acao: "nao_enviar",
      motivo: "Confirmação não enviada: o lead ficou sem conversa, então não há por onde mandar.",
    };
  }

  /*
   * Conversa que não é de WhatsApp.
   *
   * Quem chegou pelo Direct do Instagram e depois preencheu um formulário: o atendimento é por lá.
   * Mandar por outro canal criaria uma segunda frente de conversa com a mesma pessoa, pelo número
   * que pode ser bloqueado, sem ela ter pedido.
   */
  if (ctx.conversa.canal !== "WhatsApp") {
    return {
      acao: "nao_enviar",
      motivo: `Confirmação não enviada: este contato é atendido por ${ctx.conversa.canal}.`,
    };
  }

  /*
   * Reunião que já começou.
   *
   * Acontece com entrega repetida pelo Flow horas depois, e com formulário preenchido em cima da
   * hora. Confirmar uma reunião que já passou não ajuda ninguém e faz o CRM parecer quebrado.
   */
  if (ctx.inicio.getTime() <= ctx.agora.getTime()) {
    return { acao: "nao_enviar", motivo: "Confirmação não enviada: a reunião já havia começado." };
  }

  return { acao: "enfileirar" };
}
