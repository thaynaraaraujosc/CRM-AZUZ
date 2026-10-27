import { formatarTelefoneParaExibicao } from "@/lib/telefone";

/**
 * O nome de uma conversa ainda é um identificador cru: só dígitos, cinco ou mais.
 *
 * Acontece nos dois canais, por motivos diferentes, e é essa diferença que importa:
 *
 * - **Instagram**: é o id interno da thread (`3984605438508218`). Não diz nada a ninguém e não
 *   serve nem pra achar a pessoa no Instagram. O CRM o usa como nome pra não perder a mensagem
 *   quando a busca do @ falha.
 * - **WhatsApp**: é o TELEFONE de quem escreveu (`556294361377`), que é um dado de verdade sobre
 *   uma pessoa de verdade.
 *
 * Mora neste arquivo porque tanto a tela quanto o webhook precisam dela.
 */
export function nomeAindaEhIdCru(nome: string | null | undefined): boolean {
  return !!nome && /^\d{5,}$/.test(nome);
}

/**
 * Como o nome de uma conversa aparece na tela.
 *
 * O CANAL É OBRIGATÓRIO, e isto é o conserto de um defeito que estava em produção: esta função
 * devolvia "Contato do Instagram" pra QUALQUER nome só de dígitos. Um telefone do WhatsApp é só de
 * dígitos. Resultado: toda conversa de WhatsApp de um número sem nome salvo aparecia na caixa de
 * entrada do WhatsApp rotulada como contato do Instagram — o CRM afirmando o canal errado, com
 * todas as letras, justamente na linha que existe pra dizer quem é.
 *
 * E o estrago não era só estético: quem atende decide por onde responder olhando essa linha.
 *
 * Agora cada canal recebe o tratamento que faz sentido pra ele. O id do Instagram vira um rótulo
 * neutro, porque não há o que mostrar. O telefone do WhatsApp vira um telefone formatado, porque
 * há: `+55 (62) 9436-1377` identifica a pessoa e dá pra conferir, copiar e ligar.
 *
 * O valor cru não é apagado em nenhum dos dois casos: ele continua na conversa e aparece no painel
 * lateral. Aqui é só a vitrine.
 */
export function nomeExibido(nome: string, canal?: string | null): string {
  if (!nomeAindaEhIdCru(nome)) return nome;
  // Só o Instagram usa id interno como nome. Qualquer outro canal (WhatsApp, e o histórico sem
  // canal gravado, que é WhatsApp) tem um telefone ali.
  if (canal === "Instagram") return "Contato do Instagram";
  // `?? nome` porque o formatador devolve `null` de propósito pro que ele não reconhece como
  // telefone (um LID de grupo, por exemplo). Nesse caso os dígitos crus são mais honestos do que
  // uma máscara inventada. Ver `telefone.ts`.
  return formatarTelefoneParaExibicao(nome) ?? nome;
}

/**
 * Iniciais do avatar.
 *
 * "@" só no Instagram, e pelo mesmo motivo do nome: ali o id cru viraria "39", que não ajuda
 * ninguém, e o arroba ao menos diz de qual rede é. Num telefone de WhatsApp o arroba era mentira —
 * dizia Instagram num contato que nunca passou por lá.
 */
export function iniciaisExibidas(nome: string, initials: string, canal?: string | null): string {
  return nomeAindaEhIdCru(nome) && canal === "Instagram" ? "@" : initials;
}
