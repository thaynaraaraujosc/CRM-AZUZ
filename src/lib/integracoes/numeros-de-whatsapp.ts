import { prisma } from "@/lib/prisma";
import {
  CANAL_NAO_OFICIAL,
  CANAL_OFICIAL,
  contaCanalDaConexao,
} from "@/lib/integracoes/conta-canal";
import { formatarNumeroConectado, nomeDaConexao } from "@/lib/integracoes/conexoes-whatsapp";

/**
 * TODOS OS NÚMEROS DE WHATSAPP DA EMPRESA, os dois canais no mesmo lugar.
 *
 * A lista de conexões por QR Code já existia (`conexoes-whatsapp.ts`), mas a caixa de entrada não
 * pode enxergar só metade: quem tem a API oficial conectada E o celular de um vendedor no QR Code
 * tem DOIS números recebendo, e a pergunta "mostre só as conversas deste número" vale igual para
 * os dois. Oferecer o filtro só pro QR Code seria dizer que o número principal da empresa não
 * conta.
 *
 * A CHAVE DE CADA UM é o `contaCanal` — o mesmo texto que está gravado em cada conversa e cada
 * mensagem. Não é o telefone: no canal oficial a identidade é o `phoneNumberId` da Meta, e o
 * telefone é só um rótulo. Filtrar por telefone funcionaria num canal e silenciosamente em nenhum
 * no outro.
 */

export type NumeroDeWhatsApp = {
  /**
   * `contaCanal` desta conexão: é por ele que conversa e mensagem são casadas.
   *
   * Vazio só num caso: conexão de QR Code ligada cujo número o CRM ainda não descobriu. Ela existe
   * e precisa aparecer na lista (é dela que sai o botão de reconectar), mas não dá pra filtrar nem
   * endereçar nada a ela.
   */
  chave: string;
  provedor: typeof CANAL_OFICIAL | typeof CANAL_NAO_OFICIAL;
  /** Posição da conexão de QR Code (1 a 10). A oficial é sempre 1 — só existe uma. */
  slot: number;
  /** O que aparece na tela: o apelido, senão o número, senão o canal. */
  nome: string;
  apelido: string | null;
  numeroLegivel: string;
  status: string;
  erroMensagem: string | null;
  /** O QR Code esperando leitura, quando é o caso. Nunca no canal oficial. */
  qrDataUrl: string | null;
  /**
   * O FUNIL DOS LEADS DESTE NÚMERO.
   *
   * Quem vende com equipe não quer os leads do closer no mesmo quadro dos da vendedora, e quem
   * tem a API oficial no número principal costuma querer um funil só pra ele. `null` = o funil
   * padrão da empresa, que é o comportamento de sempre.
   */
  funilId: string | null;
  /** Quem atende o que chega por este número. `null` = ninguém em especial, como sempre foi. */
  responsavel: string | null;
};

/**
 * O nome de fábrica do número oficial.
 *
 * "WhatsApp oficial" e não o número: a empresa tem um só, e ele é O número da empresa. Quando ela
 * der um apelido, o apelido manda — igual acontece com os do QR Code.
 */
const NOME_PADRAO_OFICIAL = "WhatsApp oficial";

export async function numerosDeWhatsApp(workspaceId: string): Promise<NumeroDeWhatsApp[]> {
  const linhas = await prisma.integracao.findMany({
    where: { workspaceId, provedor: { in: [CANAL_OFICIAL, CANAL_NAO_OFICIAL] } },
    select: { provedor: true, slot: true, status: true, erroMensagem: true, metadados: true },
    orderBy: [{ provedor: "asc" }, { slot: "asc" }],
  });

  const numeros: NumeroDeWhatsApp[] = [];
  for (const linha of linhas) {
    const metadados = (linha.metadados as Record<string, unknown> | null) ?? {};
    const apelido = (metadados.apelido as string | null) ?? null;

    const funilId = (metadados.funilId as string | null) ?? null;
    const responsavel = (metadados.responsavel as string | null) ?? null;

    if (linha.provedor === CANAL_OFICIAL) {
      // A identidade da conexão oficial é o id do número na Meta, e é ele que vai em `contaCanal`.
      const chave = contaCanalDaConexao(CANAL_OFICIAL, metadados.phoneNumberId as string | undefined);
      const exibicao = (metadados.numeroExibicao as string | undefined) ?? "";
      numeros.push({
        chave: chave ?? "",
        provedor: CANAL_OFICIAL,
        slot: linha.slot,
        nome: apelido?.trim() || exibicao.trim() || NOME_PADRAO_OFICIAL,
        apelido,
        numeroLegivel: exibicao.trim(),
        status: linha.status,
        erroMensagem: linha.erroMensagem,
        qrDataUrl: null,
        funilId,
        responsavel,
      });
      continue;
    }

    const numero = (metadados.numero as string | null) ?? null;
    // Conexão por QR Code sem número descoberto fica com a chave vazia: nenhuma conversa carrega
    // uma marca que case com ela, então ela não vira opção de filtro — uma opção que não filtra
    // nada é pior do que opção nenhuma. Na lista ela continua, porque é dela que sai o reconectar.
    const chave = contaCanalDaConexao(CANAL_NAO_OFICIAL, numero ?? undefined) ?? "";
    numeros.push({
      chave,
      provedor: CANAL_NAO_OFICIAL,
      slot: linha.slot,
      nome: nomeDaConexao({ slot: linha.slot, numero, apelido }),
      apelido,
      numeroLegivel: formatarNumeroConectado(numero),
      status: linha.status,
      erroMensagem: linha.erroMensagem,
      qrDataUrl: linha.status === "aguardando_qr" ? ((metadados.qrDataUrl as string | null) ?? null) : null,
      funilId,
      responsavel,
    });
  }
  return numeros;
}
