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
      provedor: { in: ["whatsapp_nao_oficial", "meta_whatsapp"] },
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
    } else {
      contas.push(contaCanalDaConexao(CANAL_OFICIAL, metadados.phoneNumberId as string | undefined));
    }
  }
  return contas.filter((c, i) => contas.indexOf(c) === i);
}

/** Monta o `where` do Prisma pra filtrar por conexão visível. Lista vazia (nada conectado) devolve
 * um filtro que não casa nada — a caixa de entrada fica vazia, que é o comportamento certo. */
export function filtroContaCanal(contas: (string | null)[]) {
  if (!contas.length) return { contaCanal: { in: ["__nenhuma-conexao-ativa__"] } };
  const valores = contas.filter((c): c is string => c !== null);
  const incluiNulo = contas.includes(null);
  // `in` do Prisma não casa NULL, então NULL precisa de um ramo próprio no OR.
  return {
    OR: [
      ...(valores.length ? [{ contaCanal: { in: valores } }] : []),
      ...(incluiNulo ? [{ contaCanal: null }] : []),
    ],
  };
}
