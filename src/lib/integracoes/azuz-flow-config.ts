import { prisma } from "@/lib/prisma";
import { CANAIS_DO_FLOW, type CanalDoFlow } from "@/lib/integracoes/azuz-flow-canal";
import { TEXTO_PADRAO_DA_CONFIRMACAO } from "@/lib/integracoes/azuz-flow-confirmacao-texto";
import { JANELA_PADRAO, minutosDoRelogio, type JanelaDeEnvio } from "@/lib/integracoes/azuz-flow-janela";

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
    /**
     * "Pausar confirmações do Flow": o freio de mão.
     *
     * Separado do liga/desliga porque são gestos diferentes. Desligar é "não quero isso"; pausar é
     * "pare AGORA e me deixe pensar", sem perder o texto nem a configuração. Quem percebe que algo
     * saiu errado precisa de um botão que para tudo num clique e não apaga nada.
     */
    pausada: boolean;
    /** De quando a quando pode sair, no horário de Brasília. */
    janela: JanelaDeEnvio;
    /**
     * Quantas PRIMEIRAS mensagens por dia, no canal.
     *
     * 30 é conservador de propósito e não vem de documentação — não existe documentação pro canal
     * não oficial. O risco real é o número ser bloqueado, e quem paga é o cliente.
     */
    tetoDiario: number;
    /** Quantas confirmações o MESMO número pode receber em 24h. */
    tetoPorNumero: number;
    /** Quantas falhas seguidas pausam o canal sozinho. */
    falhasParaPausar: number;
  };
  /**
   * O FORMULÁRIO DO PRÓPRIO CRM, que nem todo cliente troca pelo AZUZ Flow.
   *
   * Só o TEXTO é separado, e foi escolha da agência: cada origem fala com quem preencheu com as
   * palavras dela. As PROTEÇÕES acima continuam valendo para as duas — janela, tetos, pausa e
   * disjuntor existem pra proteger o NÚMERO, não a origem do lead, e dois conjuntos protegeriam
   * pela metade.
   */
  formulario: {
    confirmacao: {
      /** Nasce desligada, pela mesma razão da outra: ligar faz o CRM mandar mensagem sozinho. */
      ativa: boolean;
      texto: string;
    };
  };
  /**
   * A CONFIRMAÇÃO DE CADA FORMULÁRIO DO FLOW, quando ela é diferente da geral.
   *
   * A chave é o id do formulário no Flow. Só entra aqui o formulário que a pessoa configurou na
   * tela de Automações › Formulários do Flow; quem não está aqui segue a configuração geral acima.
   *
   * SOBRESCREVER, E NÃO SUBSTITUIR, é a decisão que impede um apagão: a agência que já tem a
   * confirmação ligada com um texto escrito há meses continua exatamente como está, para todos os
   * formulários, até escolher mudar um deles. Se a configuração geral deixasse de valer no dia em
   * que esta coluna nasceu, a confirmação simplesmente pararia de sair, sem erro em lugar nenhum.
   *
   * As PROTEÇÕES (janela, tetos, pausa, disjuntor) continuam só na geral, de propósito: elas
   * protegem o NÚMERO, não o formulário. Uma por formulário protegeria pela metade — cinco
   * formulários com teto de 30 são 150 primeiras mensagens no mesmo número, no mesmo dia.
   */
  porFormulario: Record<string, { confirmacao: { ativa: boolean; texto: string } }>;
  /**
   * O mesmo, para os formulários DO PRÓPRIO CRM.
   *
   * Mapa separado do de cima, e não um só com prefixo, por uma razão prática: `porFormulario` já
   * está gravado em produção com o id cru do Flow. Mudar o formato da chave agora tornaria órfã a
   * configuração de quem já salvou alguma — e o sintoma seria a mensagem voltar sozinha pro texto
   * geral, sem nada explicando.
   */
  porFormularioDoCrm: Record<string, { confirmacao: { ativa: boolean; texto: string } }>;
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
  confirmacao: {
    ativa: false,
    texto: TEXTO_PADRAO_DA_CONFIRMACAO,
    pausada: false,
    janela: JANELA_PADRAO,
    tetoDiario: 30,
    tetoPorNumero: 3,
    falhasParaPausar: 5,
  },
  formulario: { confirmacao: { ativa: false, texto: TEXTO_PADRAO_DA_CONFIRMACAO } },
  porFormulario: {},
  porFormularioDoCrm: {},
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
      // Pausa é o contrário: o valor inseguro é continuar mandando. Qualquer coisa que não seja
      // `false` explícito mantém pausado.
      pausada: confirmacao.pausada === true,
      janela: lerJanela(confirmacao.janela),
      tetoDiario: numeroEntre(confirmacao.tetoDiario, 1, 500, CONFIG_PADRAO.confirmacao.tetoDiario),
      tetoPorNumero: numeroEntre(confirmacao.tetoPorNumero, 1, 20, CONFIG_PADRAO.confirmacao.tetoPorNumero),
      falhasParaPausar: numeroEntre(confirmacao.falhasParaPausar, 1, 50, CONFIG_PADRAO.confirmacao.falhasParaPausar),
    },
    formulario: lerFormulario(bruto.formulario),
    porFormulario: lerPorFormulario(bruto.porFormulario),
    porFormularioDoCrm: lerPorFormulario(bruto.porFormularioDoCrm),
  };
}

/** Teto de formulários configurados à parte. Protege a coluna JSON; o Flow também corta em 300. */
const MAX_POR_FORMULARIO = 300;

/** As exceções por formulário, com a mesma desconfiança do resto: veio do banco, pode ter qualquer
 *  forma. Entrada sem id ou sem objeto é descartada — ela não teria a que se aplicar. */
function lerPorFormulario(dados: unknown): ConfigDoFlow["porFormulario"] {
  if (typeof dados !== "object" || dados === null) return {};
  const saida: ConfigDoFlow["porFormulario"] = {};
  for (const [id, valor] of Object.entries(dados as Record<string, unknown>)) {
    if (!id.trim() || typeof valor !== "object" || valor === null) continue;
    const bruto = valor as Record<string, unknown>;
    const confirmacao = (typeof bruto.confirmacao === "object" && bruto.confirmacao !== null
      ? bruto.confirmacao
      : {}) as Record<string, unknown>;
    const texto = typeof confirmacao.texto === "string" ? confirmacao.texto.trim() : "";
    saida[id.trim()] = {
      confirmacao: {
        // `=== true` pelo mesmo motivo das outras duas: ligar por acidente é mandar mensagem pra
        // gente de verdade.
        ativa: confirmacao.ativa === true,
        texto: texto || CONFIG_PADRAO.confirmacao.texto,
      },
    };
    if (Object.keys(saida).length >= MAX_POR_FORMULARIO) break;
  }
  return saida;
}

/**
 * A confirmação que vale PARA ESTE FORMULÁRIO.
 *
 * O formulário configurado à parte manda; o resto segue a geral. É a regra inteira, e ela mora
 * aqui — numa função pura — porque é ela que decide se uma mensagem sai para o WhatsApp de uma
 * pessoa de verdade, e isso precisa ser provável sem banco.
 */
export function confirmacaoDoFormulario(
  config: ConfigDoFlow,
  formularioId: string | null | undefined,
): { ativa: boolean; texto: string; doFormulario: boolean } {
  const id = formularioId?.trim();
  const proprio = id ? config.porFormulario[id] : undefined;
  if (proprio) return { ...proprio.confirmacao, doFormulario: true };
  return { ativa: config.confirmacao.ativa, texto: config.confirmacao.texto, doFormulario: false };
}

/**
 * A mesma regra, para um formulário DO CRM.
 *
 * A geral de onde ela cai é outra (`formulario.confirmacao`, o texto que a agência escreve pros
 * formulários do próprio CRM), e é isso que justifica a segunda função em vez de um parâmetro: as
 * duas origens falam com públicos diferentes, e foi a pedido que os textos gerais ficaram
 * separados desde o começo.
 */
export function confirmacaoDoFormularioDoCrm(
  config: ConfigDoFlow,
  formularioId: string | null | undefined,
): { ativa: boolean; texto: string; doFormulario: boolean } {
  const id = formularioId?.trim();
  const proprio = id ? config.porFormularioDoCrm[id] : undefined;
  if (proprio) return { ...proprio.confirmacao, doFormulario: true };
  return {
    ativa: config.formulario.confirmacao.ativa,
    texto: config.formulario.confirmacao.texto,
    doFormulario: false,
  };
}

/** O bloco do formulário do CRM, com a mesma desconfiança do resto: veio do banco, pode ter
 *  qualquer forma. */
function lerFormulario(dados: unknown): ConfigDoFlow["formulario"] {
  const bruto = (typeof dados === "object" && dados !== null ? dados : {}) as Record<string, unknown>;
  const confirmacao = (typeof bruto.confirmacao === "object" && bruto.confirmacao !== null
    ? bruto.confirmacao
    : {}) as Record<string, unknown>;
  const texto = typeof confirmacao.texto === "string" ? confirmacao.texto.trim() : "";
  return {
    confirmacao: {
      // `=== true` e não "truthy": ligar por acidente aqui é mandar mensagem pra gente de verdade.
      ativa: confirmacao.ativa === true,
      texto: texto || CONFIG_PADRAO.formulario.confirmacao.texto,
    },
  };
}

/** Número dentro de limites, ou o padrão. Teto absurdo guardado por engano não pode virar mil
 *  mensagens num dia: o limite aqui é a última defesa antes do número do cliente. */
function numeroEntre(valor: unknown, minimo: number, maximo: number, padrao: number): number {
  const n = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(n)) return padrao;
  return Math.min(maximo, Math.max(minimo, Math.round(n)));
}

/** A janela guardada, com o padrão quando ela não faz sentido. Fim antes do início é descartado
 *  inteiro: uma janela invertida nunca abre, e a fila ficaria parada sem ninguém entender por quê. */
function lerJanela(valor: unknown): JanelaDeEnvio {
  if (typeof valor !== "object" || valor === null) return JANELA_PADRAO;
  const bruto = valor as Record<string, unknown>;
  const inicio = typeof bruto.inicio === "string" ? bruto.inicio : "";
  const fim = typeof bruto.fim === "string" ? bruto.fim : "";
  const minutosInicio = minutosDoRelogio(inicio);
  const minutosFim = minutosDoRelogio(fim);
  if (minutosInicio === null || minutosFim === null || minutosFim <= minutosInicio) return JANELA_PADRAO;
  return { inicio, fim };
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

/**
 * O que uma tela pode mandar mudar.
 *
 * `confirmacao` é PARCIAL de propósito, e o tipo diz isso em vez de a rota mentir com um `as`:
 * salvar só o liga/desliga é o caso normal, e exigir o objeto inteiro obrigaria a tela a reenviar
 * o texto e os tetos a cada clique — qualquer um deles desatualizado sobrescreveria o que outra
 * pessoa acabou de salvar.
 */
export type MudancasDoFlow = Partial<
  Omit<ConfigDoFlow, "confirmacao" | "formulario" | "porFormulario" | "porFormularioDoCrm">
> & {
  confirmacao?: Partial<ConfigDoFlow["confirmacao"]>;
  formulario?: { confirmacao?: Partial<ConfigDoFlow["formulario"]["confirmacao"]> };
  /**
   * A confirmação de UM formulário. Um por vez, de propósito: a tela edita um cartão por vez, e
   * mandar o mapa inteiro faria duas abas abertas apagarem o trabalho uma da outra.
   *
   * `null` em `confirmacao` APAGA a exceção — o formulário volta a seguir a geral. É a diferença
   * entre "desligado neste formulário" e "sem regra própria", e sem ela não haveria como desfazer.
   */
  umFormulario?: { id: string; confirmacao: { ativa: boolean; texto: string } | null };
  /** O mesmo, para um formulário do próprio CRM. */
  umFormularioDoCrm?: { id: string; confirmacao: { ativa: boolean; texto: string } | null };
};

/** Grava o que mudou, preservando o resto. Devolve como ficou. */
export async function salvarConfigDoFlow(
  workspaceId: string,
  mudancas: MudancasDoFlow,
): Promise<ConfigDoFlow> {
  const atual = await configDoFlow(workspaceId);
  /*
   * Mescla CAMPO A CAMPO no objeto aninhado.
   *
   * `{ ...atual, ...mudancas }` sozinho trocaria `confirmacao` inteira: salvar só o liga/desliga
   * apagaria o texto que a agência escreveu, sem avisar.
   */
  const porFormulario = { ...atual.porFormulario };
  if (mudancas.umFormulario?.id.trim()) {
    const { id, confirmacao } = mudancas.umFormulario;
    if (confirmacao) porFormulario[id.trim()] = { confirmacao };
    else delete porFormulario[id.trim()];
  }

  const porFormularioDoCrm = { ...atual.porFormularioDoCrm };
  if (mudancas.umFormularioDoCrm?.id.trim()) {
    const { id, confirmacao } = mudancas.umFormularioDoCrm;
    if (confirmacao) porFormularioDoCrm[id.trim()] = { confirmacao };
    else delete porFormularioDoCrm[id.trim()];
  }

  const novo: ConfigDoFlow = {
    ...atual,
    ...mudancas,
    confirmacao: { ...atual.confirmacao, ...(mudancas.confirmacao ?? {}) },
    formulario: {
      confirmacao: { ...atual.formulario.confirmacao, ...(mudancas.formulario?.confirmacao ?? {}) },
    },
    porFormulario,
    porFormularioDoCrm,
  };
  // Instrução de mudança, não campo guardado: sem isto elas iriam parar no banco junto com o resto
  // por causa do espalhamento de `mudancas` acima.
  delete (novo as Partial<MudancasDoFlow>).umFormulario;
  delete (novo as Partial<MudancasDoFlow>).umFormularioDoCrm;
  await prisma.preferencia.upsert({
    where: { workspaceId_chave: { workspaceId, chave: CHAVE } },
    create: { workspaceId, chave: CHAVE, dados: novo },
    update: { dados: novo },
  });
  return novo;
}
