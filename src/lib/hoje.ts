/**
 * A data de "hoje" do app, em ISO (`AAAA-MM-DD`).
 *
 * Calculada UMA vez, quando o app carrega, pra que todas as telas da mesma sessão concordem sobre
 * o que é "hoje". Se cada lugar chamasse `new Date()` na hora de usar, uma aba aberta de madrugada
 * passaria a discordar de si mesma no meio de uma operação — o card diria um dia e o funil outro.
 *
 * Morava em `agenda-context`, que deixou de existir quando a Agenda saiu do produto. O valor nunca
 * foi "da Agenda": é do app inteiro, e só estava hospedado lá por acidente de ordem de construção.
 */
export const HOJE_ISO = new Date().toISOString().slice(0, 10);
