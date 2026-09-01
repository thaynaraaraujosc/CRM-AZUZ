import { prisma } from "@/lib/prisma";

/**
 * Identidade de uma conexão de WhatsApp: `<provedor>:<identificador do número>`.
 *
 * Uma conversa pertence a UM número conectado, não ao workspace inteiro. Sem isso, trocar de canal
 * (QR Code → API oficial) ou de número dentro do mesmo canal misturava as duas caixas de entrada
 * sem forma de separar, e a única saída era apagar — perdendo o histórico do negócio.
 *
 * Com a conexão gravada em cada conversa/mensagem, a dinâmica passa a ser a esperada: desconectou,
 * some da tela (não do banco); reconectou o mesmo número, volta inteiro; conectou outro, começa
 * limpo. Contato e negócio no funil NÃO entram nessa regra de propósito — são patrimônio do CRM e
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

/**
 * As conexões cujas conversas devem aparecer agora. Só integrações CONECTADAS entram — é isso que
 * faz a caixa de entrada esvaziar ao desconectar sem nada ser apagado.
 *
 * `null` na lista representa as conversas anteriores a esta coluna existir (`contaCanal IS NULL`):
 * todas vieram do QR Code, o único canal que já espelhou histórico até aqui, então só aparecem
 * quando o QR Code está conectado. Sem essa regra, todo o histórico antigo ficaria invisível para
 * sempre depois desta mudança.
 */
export async function contasCanalVisiveis(workspaceId: string): Promise<(string | null)[]> {
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
  for (const integracao of integracoes) {
    const metadados = (integracao.metadados as Record<string, unknown> | null) ?? {};
    if (integracao.provedor === "whatsapp_nao_oficial") {
      contas.push(contaCanalDaConexao(CANAL_NAO_OFICIAL, metadados.numero as string | undefined));
      // Histórico anterior a esta coluna — ver comentário acima.
      contas.push(null);
    } else if (integracao.provedor === "meta_instagram") {
      // "Mostrar mensagens do Instagram nas Conversas", desligado: a conexão deixa de reivindicar
      // as conversas dela, e elas somem da caixa de entrada — do mesmo jeito que um número
      // desconectado some. Nada é apagado, e religar traz tudo de volta, inclusive o que chegou
      // enquanto estava desligado.
      if (metadados.receberMensagens === false) continue;
      contas.push(contaCanalDaConexao(CANAL_INSTAGRAM, metadados.instagramContaId as string | undefined));
    } else {
      contas.push(contaCanalDaConexao(CANAL_OFICIAL, metadados.phoneNumberId as string | undefined));
    }
  }
  return contas.filter((c, i) => contas.indexOf(c) === i);
}

/**
 * Monta o `where` do Prisma pra filtrar por conexão visível.
 *
 * A regra vale pro WhatsApp, que é onde ela nasceu: trocar de número precisa zerar a caixa de
 * entrada sem apagar nada. O Instagram tem UMA conta por workspace — ali o filtro não protege de
 * nada e só cria risco: basta o identificador gravado na mensagem divergir por um fio do que está
 * nos metadados da integração pra mensagem ser gravada e nunca aparecer. Isso já aconteceu duas
 * vezes, e o sintoma (conversa na lista, "sem mensagens ainda" dentro) não aponta pra causa.
 *
 * Então: canal de WhatsApp entra na regra; qualquer outro aparece enquanto seu canal existir.
 *
 * Lista vazia (nada conectado) devolve um filtro que não casa nada — caixa de entrada vazia, que é
 * o comportamento certo.
 */
export function filtroContaCanal(contas: (string | null)[]) {
  if (!contas.length) return { contaCanal: { in: ["__nenhuma-conexao-ativa__"] } };
  const valores = contas.filter((c): c is string => c !== null);
  const incluiNulo = contas.includes(null);
  // `in` do Prisma não casa NULL, então NULL precisa de um ramo próprio no OR.
  return {
    OR: [
      ...(valores.length ? [{ contaCanal: { in: valores } }] : []),
      ...(incluiNulo ? [{ contaCanal: null }] : []),
      // Escape pros canais que não são WhatsApp — ver o comentário acima. Só vale quando o
      // Instagram está entre as contas visíveis: sem esta condição, o escape reintroduzia as
      // conversas do Direct mesmo com o switch de exibição desligado, e o botão não fazia nada.
      ...(contas.some((c) => c?.startsWith(`${CANAL_INSTAGRAM}:`))
        ? [{ contaCanal: { startsWith: `${CANAL_INSTAGRAM}:` } }]
        : []),
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
    select: { provedor: true, metadados: true },
  });
  return integracoes
    .filter((i) => {
      // "Levar as conversas do Instagram para o funil", desligado: os cards de origem Instagram
      // somem do funil enquanto estiver assim. Some da TELA — o negócio continua no banco, com
      // histórico, valor e etapa, e volta inteiro ao religar. É a mesma regra que já vale pra um
      // número de WhatsApp desconectado.
      if (i.provedor !== CANAL_INSTAGRAM) return true;
      const metadados = (i.metadados as Record<string, unknown> | null) ?? {};
      return metadados.entrarNoFunil !== false;
    })
    .map((i) => i.provedor);
}

/**
 * Filtro por conexão para NEGÓCIOS do funil — parecido com o das conversas, mas com duas regras
 * diferentes de propósito:
 *
 * 1. `contaCanal` nulo aparece SEMPRE. No funil, nulo quer dizer "card criado à mão" ou "card
 *    anterior a esta coluna" — não pertence a conexão nenhuma. Reusar o filtro das conversas aqui
 *    escondeu todos os cards antigos de uma vez, porque lá o nulo só aparece quando o WhatsApp por
 *    QR Code está conectado.
 *
 * 2. Compara pelo PROVEDOR, não pelo identificador exato da conta. Um negócio não precisa da
 *    precisão de "qual número exatamente" — e casar o identificador exato já fez mensagem
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
