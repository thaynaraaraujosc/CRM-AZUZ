import { NOME_DA_CONVERSAO } from "@/lib/integracoes/google-ads-nomes";
import type { EventoDeConversao } from "@/lib/rastreio/eventos-de-conversao";

/**
 * O NOME QUE CADA PLATAFORMA DÁ AO EVENTO DO CRM.
 *
 * Os eventos do CRM são genéricos de propósito (`lead_qualified`, `purchase`) e cada plataforma
 * tem o vocabulário dela. Esta tradução existia como uma CONSTANTE ESCONDIDA nos dois
 * adaptadores: a Meta mandava `event_name: "Purchase"` sempre, e o Google usava uma única ação de
 * conversão de categoria `PURCHASE` pra tudo.
 *
 * Enquanto só a venda ganha era devolvida, dava no mesmo. Deixou de dar quando a qualificação do
 * lead passou a voltar pro anúncio: mandar "lead qualificado" como COMPRA ensina as duas
 * plataformas que um lead qualificado é uma venda. O leilão passa a caçar quem qualifica, não quem
 * compra, e o relatório de receita enche de vendas que nunca existiram. É pior do que não mandar —
 * o mesmo raciocínio que já está escrito em `motivoParaPular` sobre venda com valor zero.
 *
 * AS ESCOLHAS, com a fonte de cada uma (confirmadas na documentação oficial em 11/11/2026):
 *
 * META. Os eventos padrão da Meta são uma lista fechada (Purchase, Lead, Schedule,
 * SubmitApplication, StartTrial…) e NÃO existe um padrão para "lead qualificado". Nome fora da
 * lista é aceito e tratado como evento personalizado — aparece no Gerenciador de Eventos e dá pra
 * montar conversão personalizada em cima dele. Então: padrão onde existe um que descreve o fato, e
 * personalizado em CamelCase (que é o formato que a Meta documenta) onde não existe. Nenhum deles
 * reusa `Purchase`.
 *
 * GOOGLE. Uma AÇÃO DE CONVERSÃO por evento, cada uma com a categoria que descreve o que
 * aconteceu. A categoria `QUALIFIED_LEAD` é exatamente este caso, com as palavras do Google: "lead
 * importado de uma fonte externa que o time de marketing/vendas do anunciante qualificou".
 * `SUBMIT_LEAD_FORM` é o lead cru e `PURCHASE` é a venda.
 *
 * `DEFAULT` nos demais, e isso é deliberado: só entram aqui categorias que eu confirmei existirem
 * no enum da API. Chutar um nome de categoria faria a CRIAÇÃO da ação falhar, e aí a conversão não
 * é enviada por um detalhe de rótulo — `DEFAULT` manda o evento e deixa a categoria para quem
 * quiser ajustá-la no painel.
 */

/** O nome do evento na Meta. Fora da lista de padrões dela, vale como evento personalizado. */
const NA_META: Record<EventoDeConversao, string> = {
  // Padrão: "quando um cadastro é concluído".
  lead_created: "Lead",
  // Personalizado: a Meta não tem padrão pra lead qualificado.
  lead_qualified: "QualifiedLead",
  // Padrão: "agendamento de um horário".
  appointment_scheduled: "Schedule",
  proposal_sent: "ProposalSent",
  // Padrão. É o único que significa dinheiro entrando, e por isso é o único que carrega valor.
  purchase: "Purchase",
  lead_lost: "LeadLost",
};

/**
 * A ação de conversão do Google: nome e categoria.
 *
 * O nome da VENDA é o que já existe na conta dos clientes ("Venda · CRM AZUZ"). Mudá-lo criaria
 * uma ação nova e deixaria o histórico de conversões na antiga, partindo o relatório em dois.
 */
const NO_GOOGLE: Record<EventoDeConversao, { nome: string; categoria: string }> = {
  lead_created: { nome: "Lead · CRM AZUZ", categoria: "SUBMIT_LEAD_FORM" },
  lead_qualified: { nome: "Lead qualificado · CRM AZUZ", categoria: "QUALIFIED_LEAD" },
  appointment_scheduled: { nome: "Agendamento · CRM AZUZ", categoria: "DEFAULT" },
  proposal_sent: { nome: "Proposta enviada · CRM AZUZ", categoria: "DEFAULT" },
  purchase: { nome: NOME_DA_CONVERSAO, categoria: "PURCHASE" },
  lead_lost: { nome: "Venda perdida · CRM AZUZ", categoria: "DEFAULT" },
};

/**
 * SÓ A VENDA CARREGA VALOR.
 *
 * Um lead qualificado não tem preço, e mandar `value: 0` não é "sem valor": é afirmar que vale
 * zero. A Meta e o Google leem isso como dado, e a conta de retorno da campanha passa a dividir
 * receita por um número de conversões que inclui as de valor zero. Ausente é ausente.
 */
export function eventoCarregaValor(evento: string): boolean {
  return evento === "purchase";
}

/** O `event_name` pra Meta. Evento desconhecido vai como ele chegou, nunca como `Purchase`. */
export function eventoNaMeta(evento: string): string {
  return NA_META[evento as EventoDeConversao] ?? evento;
}

/**
 * A ação de conversão do Google pra este evento.
 *
 * Evento desconhecido cai na do lead cru, e não na de VENDA: inventar venda é o erro caro: aqui
 * o pior que acontece é um lead a mais na categoria errada.
 */
export function eventoNoGoogle(evento: string): { nome: string; categoria: string } {
  return NO_GOOGLE[evento as EventoDeConversao] ?? NO_GOOGLE.lead_created;
}
