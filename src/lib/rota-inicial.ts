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

/**
 * A ROTA QUE CADA RESTRIÇÃO PROTEGE, e a ordem em que elas são oferecidas a quem é barrado.
 *
 * É a mesma informação que o proxy usa pra bloquear. Ela mora aqui, e não só lá, porque bloquear
 * sem saber PRA ONDE mandar a pessoa foi o que produziu um laço infinito: quem não tinha
 * permissão de Conversas era mandado pra `/conversas`, que era justamente a rota barrada — e o
 * navegador desistia com "redireções em excesso".
 *
 * A ordem é a de utilidade pra quem foi barrado em Conversas: o funil, os contatos, e por aí.
 */
export const ROTAS_RESTRITAS: { rota: string; permissao: string }[] = [
  { rota: "/conversas", permissao: "wa_visualizar" },
  { rota: "/funil", permissao: "funil_visualizar" },
  { rota: "/contatos", permissao: "contatos_visualizar" },
  // Os módulos que ganharam permissão própria depois. Entram na lista de destinos pelo mesmo
  // motivo das outras: quem só pode Instagram precisa ter pra onde ir.
  { rota: "/instagram", permissao: "insta_visualizar" },
  { rota: "/social-seller", permissao: "social_visualizar" },
  { rota: "/automacoes", permissao: "auto_visualizar" },
  { rota: "/formularios", permissao: "form_visualizar" },
  { rota: "/relatorios", permissao: "rel_visualizar" },
  { rota: "/equipe", permissao: "equipe_visualizar" },
  { rota: "/configuracoes", permissao: "config_visualizar" },
];

/** Onde quem não pode ver NADA vai parar. Não é a tela de pagamento: o problema é outro. */
export const ROTA_SEM_PERMISSAO = "/sem-permissao";

/**
 * A primeira rota que esta pessoa consegue abrir.
 *
 * Admin da conta vê tudo — restringir o dono dela não faz sentido. Pra todo o resto, devolve a
 * primeira rota da lista cuja permissão ela tem, e `null` quando não há nenhuma: aí não existe
 * destino possível dentro do produto, e mandá-la pra qualquer lugar seria o laço de novo.
 */
export function primeiraRotaPermitida(params: {
  superAdmin?: boolean;
  papelTipo: string;
  permissoes: string[];
}): string | null {
  if (params.superAdmin || params.papelTipo === "admin") return ROTA_INICIAL;
  const achada = ROTAS_RESTRITAS.find((r) => params.permissoes.includes(r.permissao));
  return achada?.rota ?? null;
}
