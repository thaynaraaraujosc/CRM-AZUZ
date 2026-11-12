import { prisma } from "@/lib/prisma";
import { conexoesDeConversa } from "@/lib/integracoes/conexoes-cache";
import { normalizarContaCanal } from "@/lib/integracoes/conta-canal-normalizar";
import { CANAL_NAO_OFICIAL, CANAL_OFICIAL, contaCanalDaConexao } from "@/lib/integracoes/conta-canal";

/**
 * PRA ONDE VAI O LEAD QUE CHEGOU POR ESTE NÚMERO.
 *
 * Com um número, "o funil da empresa" e "o funil deste número" eram a mesma coisa. Com a API
 * oficial no número principal e o celular do closer no QR Code, deixam de ser: os leads do closer
 * no mesmo quadro dos da vendedora é exatamente o amontoado que o funil existe pra evitar, e quem
 * atende perde o dia separando um do outro na mão.
 *
 * Duas respostas, e as duas são opcionais:
 *
 * - `funilId`: em qual funil o card nasce. `null` = o funil padrão da empresa, como sempre foi.
 * - `responsavel`: quem atende o que chega por aqui. `null` = ninguém em especial, como sempre foi.
 *
 * Nulo NÃO é falha: é a configuração que a conta tem hoje, e precisa continuar funcionando sem
 * ninguém abrir tela nenhuma.
 */

export type DestinoDoNumero = { funilId: string | null; responsavel: string | null };

const SEM_DESTINO: DestinoDoNumero = { funilId: null, responsavel: null };

export async function destinoDoNumero(
  workspaceId: string,
  contaCanal: string | null | undefined,
): Promise<DestinoDoNumero> {
  if (!contaCanal) return SEM_DESTINO;
  const alvo = normalizarContaCanal(contaCanal);

  /*
   * O FUNIL É QUEM DIZ DE QUAL NÚMERO ELE É — não o contrário.
   *
   * O vínculo morava só nos metadados da conexão (`metadados.funilId`): o NÚMERO apontava pro
   * funil. Nessa direção, dois números podiam apontar pro mesmo quadro, o que a regra proíbe
   * ("nenhum funil pode ter mais do que um número; não pode receber mensagens de WhatsApps
   * diferentes"). Agora quem manda é a coluna `Funil.contaCanal`, escrita uma vez na criação.
   *
   * Uma consulta por lead novo, com índice em `[workspaceId, contaCanal]`.
   */
  /*
   * DUAS FONTES, PORQUE UM FUNIL PODE TER VÁRIOS NÚMEROS AGORA.
   *
   * `FunilNumero` é o formato novo; `Funil.contaCanal` é o dos funis criados antes dele. A busca
   * nova vem PRIMEIRO porque é a que a pessoa acabou de configurar — e, com a chave única
   * `[workspaceId, contaCanal]`, ela devolve no máximo uma linha: um número continua pertencendo a
   * um funil só. Ver `numeros-do-funil.ts`.
   */
  const vinculo = await prisma.funilNumero.findUnique({
    where: { workspaceId_contaCanal: { workspaceId, contaCanal: alvo } },
    select: { funilId: true },
  });
  const funil = vinculo
    ? { id: vinculo.funilId }
    : await prisma.funil.findFirst({ where: { workspaceId, contaCanal: alvo }, select: { id: true } });

  // O RESPONSÁVEL continua vindo da conexão: ele é de quem atende por aquele número, e não do
  // quadro. A leitura passa pelo cache de conexões (poucos segundos de memória) porque isto roda a
  // cada mensagem de contato novo, no mesmo minuto em que o webhook já faz várias chamadas à Meta.
  const conexoes = await conexoesDeConversa(workspaceId);
  for (const conexao of conexoes) {
    const metadados = (conexao.metadados as Record<string, unknown> | null) ?? {};
    const chave =
      conexao.provedor === CANAL_OFICIAL
        ? contaCanalDaConexao(CANAL_OFICIAL, metadados.phoneNumberId as string | undefined)
        : conexao.provedor === CANAL_NAO_OFICIAL
          ? contaCanalDaConexao(CANAL_NAO_OFICIAL, metadados.numero as string | undefined)
          : null;
    if (chave !== alvo) continue;
    return {
      /*
       * `metadados.funilId` fica como SEGUNDA opção, e não some ainda: é o que as contas já
       * configuradas têm gravado, e apagá-lo numa mesma leva mandaria os leads delas pro quadro
       * padrão sem aviso. Funil novo nasce com a coluna; funil antigo continua pelo metadado até
       * ser recriado com número.
       */
      funilId: funil?.id ?? ((metadados.funilId as string | null) ?? null),
      responsavel: (metadados.responsavel as string | null) ?? null,
    };
  }

  // Número sem conexão correspondente (desconectado, por exemplo): o funil dele ainda vale.
  return funil ? { funilId: funil.id, responsavel: null } : SEM_DESTINO;
}
