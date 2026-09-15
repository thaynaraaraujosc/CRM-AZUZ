/**
 * Pra onde vai quem acabou de entrar.
 *
 * Era `/inicio`, um painel de resumo com pendências e atalhos. Ele saiu, e a razão é honesta: nem
 * quem construiu o CRM abria aquilo pra ver o que estava pendente. Quem compra um CRM de
 * atendimento entra pra fazer uma coisa — ler e responder mensagem — e uma tela de resumo entre a
 * pessoa e o trabalho é um clique cobrado de todo mundo, todo dia, em troca de nada.
 *
 * Constante, e não o texto espalhado: o destino aparecia em doze lugares (proxy, login, paywall,
 * painel de admin, página de erro), e mudar isso de novo sem um lugar só significaria achar os
 * doze outra vez — e esquecer um, que é como se cria uma tela órfã.
 */
export const ROTA_INICIAL = "/conversas";
