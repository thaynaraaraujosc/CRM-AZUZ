/**
 * A trava de consentimento de WhatsApp.
 *
 * Mora sozinha porque ela vale em mais de um lugar (bloco de automação e campanha) e porque a
 * regra tem uma sutileza que é fácil de errar quando escrita duas vezes: **só o `false` explícito
 * bloqueia**.
 *
 *   - `false`  → a pessoa VIU a caixa num formulário e não marcou. Bloqueia.
 *   - `true`   → consentiu. Passa.
 *   - `null`   → não se sabe. Passa.
 *
 * O `null` é a maioria do banco: todo contato criado antes desta coluna existir, e todo mundo que
 * chegou pelo WhatsApp escrevendo primeiro. Tratar ausência como recusa cortaria o atendimento de
 * clientes que vêm conversando há meses — e quem escreve primeiro já consentiu, pelo próprio gesto.
 *
 * Função pura, com teste: afrouxar isto manda mensagem pra quem disse que não queria, e apertar
 * demais cala o CRM de um cliente inteiro. Os dois erros são caros e nenhum dos dois apareceria num
 * teste de integração.
 */
export function bloqueadoPorFaltaDeConsentimento(consentimento: boolean | null | undefined): boolean {
  return consentimento === false;
}

export const MOTIVO_SEM_CONSENTIMENTO =
  "Sem consentimento de WhatsApp: o lead não marcou a caixa no formulário.";
