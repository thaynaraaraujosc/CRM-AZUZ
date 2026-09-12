/**
 * Quem entra no CRM antes de pagar. A regra do paywall, num lugar só e testável.
 *
 * O que estava errado, e não era um detalhe:
 *
 * 1. `/api` ficava INTEIRAMENTE de fora do bloqueio. A intenção era não quebrar os provedores da
 *    casca enquanto a pessoa navegava, mas o CRM é feito de telas que leem tudo por `/api`. Na
 *    prática o produto inteiro respondia a quem nunca pagou: bastava a página carregar uma vez.
 *
 * 2. Quem não pagou e é administrador era mandado pra `/configuracoes`, que é a tela de
 *    Configurações completa: conexões, equipe, expediente, armazenamento. Chamar isso de bloqueio
 *    é otimismo. Era acesso ao produto sem pagamento.
 *
 * Agora quem não pagou tem exatamente um lugar pra ir: a tela de pagamento, se for o dono da conta,
 * ou o aviso, se for alguém da equipe. Nada mais responde, nem página nem API.
 *
 * Função pura de propósito. É a regra que decide se alguém usa o produto ou não, e é ela que
 * precisa de teste: no `proxy.ts` ela dependeria de sessão, banco e requisição pra ser exercitada.
 */

/** Onde o dono da conta paga. Único lugar que responde pra um workspace sem assinatura ativa. */
export const ROTA_PAGAMENTO = "/assinatura";
/** Onde quem não é dono da conta é avisado. Ele não tem como pagar; só quem administra tem. */
export const ROTA_AVISO = "/acesso-bloqueado";

export type DecisaoDeAcesso =
  | { liberado: true }
  /** Página: manda pra cá. */
  | { liberado: false; destino: string; ehApi: false }
  /** API: responde 402, nunca redireciona. Um `fetch` que recebe redirecionamento pra uma página
   *  HTML devolve o HTML como se fosse resposta boa, e a tela mostra erro de formato em vez de
   *  dizer que o pagamento está pendente. */
  | { liberado: false; destino: string; ehApi: true };

/**
 * As rotas que continuam respondendo mesmo sem assinatura ativa.
 *
 * Sem esta lista o bloqueio se morde: a tela de pagamento não conseguiria carregar o plano nem
 * enviar o pagamento, e ninguém conseguiria sair da conta pra entrar em outra. Cada item aqui
 * existe pra que o caminho de REGULARIZAR funcione, nunca pra liberar uso do produto.
 */
const LIBERADAS_SEM_PAGAMENTO = [
  // A própria sessão: sem isso não dá nem pra sair.
  "/api/auth",
  // Ler a assinatura e criar o pagamento. É o caminho de regularizar.
  "/api/assinatura",
  // A tela de login consulta pra distinguir senha errada de banco fora do ar.
  "/api/saude/banco",
];

function ehRotaDePagamento(pathname: string): boolean {
  return LIBERADAS_SEM_PAGAMENTO.some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`),
  );
}

export function decidirAcesso(params: {
  pathname: string;
  /** Super-admin da plataforma não pertence a workspace nenhum pra fins de cobrança. */
  superAdmin: boolean;
  /** "admin" é o dono da conta: o único que consegue pagar. */
  papelTipo: string;
  /** `null` quando não existe linha de assinatura. Tratado como não pago, nunca como liberado:
   *  ausência de registro não pode virar acesso grátis. */
  statusAssinatura: string | null;
}): DecisaoDeAcesso {
  const { pathname, superAdmin, papelTipo, statusAssinatura } = params;

  if (superAdmin) return { liberado: true };
  if (statusAssinatura === "ativa") return { liberado: true };

  // Daqui pra baixo: pendente, atrasada, cancelada ou sem assinatura nenhuma.
  if (ehRotaDePagamento(pathname)) return { liberado: true };

  const ehApi = pathname.startsWith("/api");
  const destino = papelTipo === "admin" ? ROTA_PAGAMENTO : ROTA_AVISO;

  // Já está no lugar pra onde iria: deixa carregar, senão vira um redirecionamento em laço.
  if (!ehApi && pathname === destino) return { liberado: true };

  return { liberado: false, destino, ehApi };
}

/** A frase que a tela mostra pra cada situação. Separada da decisão porque texto muda mais que
 * regra, e porque um mesmo bloqueio tem causas bem diferentes pra quem está lendo. */
export function motivoDoBloqueio(statusAssinatura: string | null): string {
  switch (statusAssinatura) {
    case "atrasada":
      return "O pagamento da sua assinatura está atrasado. Regularize pra voltar a usar o CRM.";
    case "cancelada":
      return "Sua assinatura foi cancelada. Assine de novo pra voltar a usar o CRM.";
    default:
      return "Falta confirmar o pagamento pra liberar o seu CRM.";
  }
}
