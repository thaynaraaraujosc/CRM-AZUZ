import { prisma } from "@/lib/prisma";

/**
 * Identidade de uma conexão de WhatsApp: `<provedor>:<identificador do número>`.
 *
 * Uma conversa pertence a UM número conectado, não ao workspace inteiro. Sem isso, trocar de canal
 * (QR Code → API oficial) ou de número dentro do mesmo canal misturava as duas caixas de entrada
 * sem forma de separar, e a única saída era apagar. Perdendo o histórico do negócio.
 *
 * Com a conexão gravada em cada conversa/mensagem, a dinâmica passa a ser a esperada: desconectou,
 * some da tela (não do banco); reconectou o mesmo número, volta inteiro; conectou outro, começa
 * limpo. Contato e negócio no funil NÃO entram nessa regra de propósito. São patrimônio do CRM e
 * seguem valendo mesmo quem trocar de número.
 */
/** Valor de `MensagemExtra.canal` de cada conexão. Existia como string solta nos webhooks e o
 * comentário do schema divergia do que o código gravava (`whatsapp_baileys` vs
 * `whatsapp_nao_oficial`), o que fez um filtro escrito a partir do comentário não casar nada. */
export const CANAL_NAO_OFICIAL = "whatsapp_nao_oficial";
export const CANAL_OFICIAL = "meta_whatsapp";
export const CANAL_INSTAGRAM = "meta_instagram";

export function contaCanalDaConexao(provedor: string, identificador: string | null | undefined): string | null {
  const limpo = identificador?.toString().trim();
  return limpo ? `${provedor}:${limpo}` : null;
}

export type ContasVisiveis = {
  /** Identificadores exatos das conexões ligadas. `null` representa o histórico sem marca. */
  contas: (string | null)[];
  /** Provedores ligados cujo identificador o CRM não conhece. Ver dentro da função. */
  prefixosSemIdentificador: string[];
};

/**
 * As conexões cujas conversas devem aparecer agora. Só integrações CONECTADAS entram: é isso que
 * faz a caixa de entrada esvaziar ao desconectar sem nada ser apagado.
 *
 * `null` na lista representa as conversas anteriores a esta coluna existir (`contaCanal IS NULL`):
 * todas vieram do QR Code, o único canal que já espelhou histórico até aqui, então só aparecem
 * quando o QR Code está conectado. Sem essa regra, todo o histórico antigo ficaria invisível para
 * sempre depois desta mudança.
 */
export async function contasCanalVisiveis(workspaceId: string): Promise<ContasVisiveis> {
  const integracoes = await prisma.integracao.findMany({
    where: {
      workspaceId,
      status: "conectado",
      // Instagram entra aqui junto com os dois WhatsApp: a regra é a mesma pra qualquer canal de
      // conversa. Deixá-lo de fora fazia a mensagem do Direct ser gravada e nunca aparecer, porque
      // nenhuma conexão ativa reivindicava aquelas linhas.
      provedor: { in: ["whatsapp_nao_oficial", "meta_whatsapp", "meta_instagram"] },
    },
    select: { provedor: true, metadados: true },
  });

  const contas: (string | null)[] = [];
  /**
   * Conexões LIGADAS cujo identificador o CRM não sabe.
   *
   * Acontece de verdade: a conexão está de pé e recebendo, mas os metadados não têm o
   * `phoneNumberId` (ou o `numero`) gravado, porque foram escritos por um caminho antigo ou porque
   * a chamada que os preenche falhou naquele momento. Sem isso registrado, o filtro exato não casa
   * NADA daquela conexão e a caixa de entrada fica vazia enquanto os negócios continuam aparecendo
   * no funil, que usa uma regra mais frouxa. Foi exatamente o que aconteceu: conversa nova no
   * funil e nenhuma no WhatsApp.
   *
   * Nesse caso o certo é mostrar a conversa. Esconder tudo protege contra um problema que não
   * existe (duas contas do mesmo provedor no mesmo workspace) e cria um que existe (a pessoa não vê
   * a mensagem que acabou de chegar).
   */
  const prefixosSemIdentificador: string[] = [];
  for (const integracao of integracoes) {
    const metadados = (integracao.metadados as Record<string, unknown> | null) ?? {};
    if (integracao.provedor === "whatsapp_nao_oficial") {
      const conta = contaCanalDaConexao(CANAL_NAO_OFICIAL, metadados.numero as string | undefined);
      if (conta) contas.push(conta);
      else prefixosSemIdentificador.push(CANAL_NAO_OFICIAL);
      // Histórico anterior a esta coluna. Ver comentário acima.
      contas.push(null);
    } else if (integracao.provedor === "meta_instagram") {
      // "Mostrar mensagens do Instagram nas Conversas", desligado: a conexão deixa de reivindicar
      // as conversas dela, e elas somem da caixa de entrada. Do mesmo jeito que um número
      // desconectado some. Nada é apagado, e religar traz tudo de volta, inclusive o que chegou
      // enquanto estava desligado.
      if (metadados.receberMensagens === false) continue;
      const conta = contaCanalDaConexao(CANAL_INSTAGRAM, metadados.instagramContaId as string | undefined);
      if (conta) contas.push(conta);
      else prefixosSemIdentificador.push(CANAL_INSTAGRAM);
    } else {
      const conta = contaCanalDaConexao(CANAL_OFICIAL, metadados.phoneNumberId as string | undefined);
      if (conta) contas.push(conta);
      else prefixosSemIdentificador.push(CANAL_OFICIAL);
    }
  }
  return {
    contas: contas.filter((c, i) => contas.indexOf(c) === i),
    prefixosSemIdentificador: [...new Set(prefixosSemIdentificador)],
  };
}

/**
 * Monta o `where` do Prisma pra filtrar por conexão visível.
 *
 * A regra vale pro WhatsApp, que é onde ela nasceu: trocar de número precisa zerar a caixa de
 * entrada sem apagar nada. O Instagram tem UMA conta por workspace. Ali o filtro não protege de
 * nada e só cria risco: basta o identificador gravado na mensagem divergir por um fio do que está
 * nos metadados da integração pra mensagem ser gravada e nunca aparecer. Isso já aconteceu duas
 * vezes, e o sintoma (conversa na lista, "sem mensagens ainda" dentro) não aponta pra causa.
 *
 * Então: canal de WhatsApp entra na regra; qualquer outro aparece enquanto seu canal existir.
 *
 * Lista vazia (nada conectado) devolve um filtro que não casa nada. Caixa de entrada vazia, que é
 * o comportamento certo.
 */
export function filtroContaCanal(visiveis: ContasVisiveis) {
  const { contas, prefixosSemIdentificador } = visiveis;
  if (!contas.length && !prefixosSemIdentificador.length) {
    return { contaCanal: { in: ["__nenhuma-conexao-ativa__"] } };
  }
  const valores = contas.filter((c): c is string => c !== null);
  const incluiNulo = contas.includes(null);
  // `in` do Prisma não casa NULL, então NULL precisa de um ramo próprio no OR.
  return {
    OR: [
      ...(valores.length ? [{ contaCanal: { in: valores } }] : []),
      ...(incluiNulo ? [{ contaCanal: null }] : []),
      // Escape pros canais que não são WhatsApp. Ver o comentário acima. Só vale quando o
      // Instagram está entre as contas visíveis: sem esta condição, o escape reintroduzia as
      // conversas do Direct mesmo com o switch de exibição desligado, e o botão não fazia nada.
      ...(contas.some((c) => c?.startsWith(`${CANAL_INSTAGRAM}:`))
        ? [{ contaCanal: { startsWith: `${CANAL_INSTAGRAM}:` } }]
        : []),
      // Conexão ligada cujo identificador o CRM não sabe: vale o provedor inteiro. É a mesma regra
      // que o funil sempre usou pros negócios, e é o que faz as duas telas contarem a mesma
      // história em vez de uma mostrar o card e a outra esconder a conversa.
      ...prefixosSemIdentificador.map((prefixo) => ({ contaCanal: { startsWith: `${prefixo}:` } })),
    ],
  };
}


/**
 * Provedores de conversa CONECTADOS agora (`meta_instagram`, `meta_whatsapp`,
 * `whatsapp_nao_oficial`).
 */
export async function provedoresConectados(workspaceId: string): Promise<string[]> {
  const integracoes = await prisma.integracao.findMany({
    where: {
      workspaceId,
      status: "conectado",
      provedor: { in: [CANAL_NAO_OFICIAL, CANAL_OFICIAL, CANAL_INSTAGRAM] },
    },
    select: { provedor: true },
  });
  return integracoes.map((i) => i.provedor);
}

/**
 * Provedores cujos negócios aparecem no FUNIL COMERCIAL. É `provedoresConectados` menos o
 * Instagram, sempre.
 *
 * O funil comercial é do WhatsApp. Instagram não entra, e isso não é mais uma preferência que se
 * liga e desliga: era, e ter as duas coisas no mesmo quadro fazia o funil deixar de responder à
 * pergunta que ele existe pra responder. Quem respondeu um story não está no mesmo momento de quem
 * pediu orçamento, e o vendedor gastava o dia separando um do outro na mão.
 *
 * O acompanhamento do Instagram tem lugar próprio: caixa de entrada do Direct, aba de contatos com
 * etiqueta e o painel de Automações > Instagram e TikTok, que conta evento e execução de robô.
 *
 * Cards de origem Instagram criados antes desta regra somem da TELA do funil, não do banco: o
 * negócio continua com histórico, valor e etapa. É a mesma regra que já valia pra um número de
 * WhatsApp desconectado, e é o que permite voltar atrás sem ter perdido nada.
 */
export async function provedoresDeNegocio(workspaceId: string): Promise<string[]> {
  const provedores = await provedoresConectados(workspaceId);
  return provedores.filter((p) => p !== CANAL_INSTAGRAM);
}

/**
 * Filtro por conexão para NEGÓCIOS do funil. Parecido com o das conversas, mas com duas regras
 * diferentes de propósito:
 *
 * 1. `contaCanal` nulo aparece SEMPRE. No funil, nulo quer dizer "card criado à mão" ou "card
 *    anterior a esta coluna": não pertence a conexão nenhuma. Reusar o filtro das conversas aqui
 *    escondeu todos os cards antigos de uma vez, porque lá o nulo só aparece quando o WhatsApp por
 *    QR Code está conectado.
 *
 * 2. Compara pelo PROVEDOR, não pelo identificador exato da conta. Um negócio não precisa da
 *    precisão de "qual número exatamente". E casar o identificador exato já fez mensagem
 *    desaparecer duas vezes por divergir de um fio. Aqui o custo de errar é esconder o trabalho
 *    comercial da pessoa, que é pior.
 */
export function filtroConexaoDeNegocio(provedores: string[]) {
  return {
    OR: [
      { contaCanal: null },
      ...provedores.map((provedor) => ({ contaCanal: { startsWith: `${provedor}:` } })),
    ],
  };
}
