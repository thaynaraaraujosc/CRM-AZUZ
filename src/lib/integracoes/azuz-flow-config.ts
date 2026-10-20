import { prisma } from "@/lib/prisma";
import { CANAIS_DO_FLOW, type CanalDoFlow } from "@/lib/integracoes/azuz-flow-canal";
import { TEXTO_PADRAO_DA_CONFIRMACAO } from "@/lib/integracoes/azuz-flow-confirmacao-texto";

/**
 * As opções do AZUZ Flow por empresa.
 *
 * Moram em `Preferencia` (`workspaceId` + `chave` + JSON), que já existe no schema e não estava
 * sendo usada por ninguém. Preferir isso a colunas novas não é preguiça: cada opção destas nasce
 * pra ser mexida, e uma coluna por opção significa uma migração por ideia — num banco de produção
 * com cliente em cima, isso é o caminho mais caro possível pra mudar um padrão.
 */

const CHAVE = "azuz-flow";

export type ConfigDoFlow = {
  /** Por qual conexão de WhatsApp o lead ganha conversa. */
  canal: CanalDoFlow;
  /** A confirmação de reunião: liga/desliga e o texto. */
  confirmacao: {
    /**
     * NASCE DESLIGADA, e não é timidez de produto.
     *
     * Ligar isto faz o CRM mandar mensagem, sozinho, pra quem nunca escreveu, por um número que
     * pode ser bloqueado por denúncia. Uma empresa que nunca abriu essa tela não escolheu isso — e
     * um padrão ligado significaria todo mundo começando a disparar na primeira atualização.
     */
    ativa: boolean;
    /** O que a pessoa recebe. Vazio vale como "use o padrão". */
    texto: string;
  };
};

export const CONFIG_PADRAO: ConfigDoFlow = {
  /*
   * `oficial`, que é EXATAMENTE o que o CRM fazia antes desta opção existir.
   *
   * A tentação era `automatico`, porque resolve sozinho o caso de quem só tem o QR. Mas o padrão
   * vale pra toda empresa que nunca abriu essa tela, e trocá-lo significaria passar a mandar lead
   * pelo QR em contas onde ninguém pediu isso — e o envio pelo QR ainda não tem ritmo, janela de
   * horário nem teto diário.
   *
   * Pior: o que segurava uma automação antiga de "formulário preenchido" era a AUSÊNCIA de
   * conversa. Dar conversa a ela por padrão faria disparar, pelo número do QR, mensagens que hoje
   * falham em silêncio. Quem quer o QR escolhe, depois de conferir as automações.
   */
  canal: "oficial",
  confirmacao: { ativa: false, texto: TEXTO_PADRAO_DA_CONFIRMACAO },
};

/**
 * Lê o JSON guardado com desconfiança.
 *
 * Isto veio do banco, e o que veio do banco pode ter qualquer forma: linha escrita por uma versão
 * anterior, valor digitado errado por uma rota, JSON corrompido. Qualquer campo que não bata com o
 * esperado volta pro padrão, em vez de derrubar a entrega de um lead por causa de uma opção de
 * tela.
 *
 * Pura, pra ser provada sem banco.
 */
export function lerConfigDoFlow(dados: unknown): ConfigDoFlow {
  if (typeof dados !== "object" || dados === null) return CONFIG_PADRAO;
  const bruto = dados as Record<string, unknown>;
  const canal = bruto.canal;
  const confirmacao = (typeof bruto.confirmacao === "object" && bruto.confirmacao !== null
    ? bruto.confirmacao
    : {}) as Record<string, unknown>;
  const texto = typeof confirmacao.texto === "string" ? confirmacao.texto.trim() : "";
  return {
    canal: CANAIS_DO_FLOW.includes(canal as CanalDoFlow) ? (canal as CanalDoFlow) : CONFIG_PADRAO.canal,
    confirmacao: {
      // `=== true` e não "truthy": qualquer coisa que não seja o booleano verdadeiro mantém
      // desligado. Ligar por acidente aqui é mandar mensagem pra gente de verdade.
      ativa: confirmacao.ativa === true,
      // Texto vazio vale como padrão. Alguém que apagou tudo no campo não quis mandar mensagem em
      // branco — e mensagem em branco é o que aconteceria.
      texto: texto || CONFIG_PADRAO.confirmacao.texto,
    },
  };
}

/**
 * A configuração desta empresa, com o padrão quando não há nada guardado.
 *
 * NUNCA LANÇA, e isso é o ponto. Esta função é chamada no meio da entrega de um lead, que é um
 * contrato com um produto de fora. Se a tabela não existir neste banco — e a `Preferencia` nunca
 * teve uso, então pode não ter sido aplicada em algum ambiente —, ou se o banco engasgar, o certo é
 * seguir com o padrão e entregar o lead. Uma opção de tela não pode ser motivo pra um lead se
 * perder.
 */
export async function configDoFlow(workspaceId: string): Promise<ConfigDoFlow> {
  try {
    const linha = await prisma.preferencia.findUnique({
      where: { workspaceId_chave: { workspaceId, chave: CHAVE } },
      select: { dados: true },
    });
    return lerConfigDoFlow(linha?.dados);
  } catch (erro) {
    console.error("[azuz-flow] não deu pra ler a configuração; seguindo com o padrão:", erro);
    return CONFIG_PADRAO;
  }
}

/** Grava o que mudou, preservando o resto. Devolve como ficou. */
export async function salvarConfigDoFlow(
  workspaceId: string,
  mudancas: Partial<ConfigDoFlow>,
): Promise<ConfigDoFlow> {
  const atual = await configDoFlow(workspaceId);
  /*
   * Mescla CAMPO A CAMPO no objeto aninhado.
   *
   * `{ ...atual, ...mudancas }` sozinho trocaria `confirmacao` inteira: salvar só o liga/desliga
   * apagaria o texto que a agência escreveu, sem avisar.
   */
  const novo: ConfigDoFlow = {
    ...atual,
    ...mudancas,
    confirmacao: { ...atual.confirmacao, ...(mudancas.confirmacao ?? {}) },
  };
  await prisma.preferencia.upsert({
    where: { workspaceId_chave: { workspaceId, chave: CHAVE } },
    create: { workspaceId, chave: CHAVE, dados: novo },
    update: { dados: novo },
  });
  return novo;
}
