import { conexoesDeConversa } from "@/lib/integracoes/conexoes-cache";
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

/** `whatsapp_baileys:` é o nome antigo do canal de QR Code, ainda gravado em conversa de antes. */
function normalizar(contaCanal: string): string {
  return contaCanal.startsWith("whatsapp_baileys:")
    ? `${CANAL_NAO_OFICIAL}:${contaCanal.slice("whatsapp_baileys:".length)}`
    : contaCanal;
}

export async function destinoDoNumero(
  workspaceId: string,
  contaCanal: string | null | undefined,
): Promise<DestinoDoNumero> {
  if (!contaCanal) return SEM_DESTINO;
  const alvo = normalizar(contaCanal);

  // A leitura passa pelo cache de conexões (poucos segundos de memória): isto roda a cada mensagem
  // de contato novo, e uma consulta a mais por lead, no mesmo minuto em que o webhook já faz várias
  // chamadas à Meta, é exatamente o tipo de custo que ninguém vê e todo mundo sente.
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
      funilId: (metadados.funilId as string | null) ?? null,
      responsavel: (metadados.responsavel as string | null) ?? null,
    };
  }
  return SEM_DESTINO;
}
