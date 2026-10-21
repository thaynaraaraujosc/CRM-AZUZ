import { CANAL_NAO_OFICIAL, CANAL_OFICIAL, contaCanalDaConexao } from "@/lib/integracoes/conta-canal";

/**
 * Por qual conexão de WhatsApp o lead do AZUZ Flow ganha conversa.
 *
 * Antes disto a resposta era fixa: só o canal OFICIAL. O lead entrava sem conversa sempre que ele
 * não estivesse conectado — e, sem conversa, qualquer automação que fosse falar com a pessoa
 * falhava com "conversa sem destinatário". Enquanto o WhatsApp oficial está em revisão na Meta,
 * isso é o produto inteiro parado pra quem usa o QR Code.
 *
 * A ESCOLHA É DO CLIENTE, e por isso ela é uma opção e não uma esperteza do código: uma agência
 * pode ter os dois canais ligados e querer que o formulário caia só no oficial (porque é o número
 * comercial) ou só no QR (porque o oficial é usado por outra equipe). "Automático" é o padrão e
 * resolve o caso comum.
 *
 * Puro de propósito: decide com o que recebe, sem tocar no banco. É a regra que mais vai mudar de
 * ideia com o tempo, então ela precisa ser provável sem subir nada.
 */

export const CANAIS_DO_FLOW = ["automatico", "oficial", "qrcode"] as const;
export type CanalDoFlow = (typeof CANAIS_DO_FLOW)[number];

export const ROTULO_CANAL_DO_FLOW: Record<CanalDoFlow, string> = {
  automatico: "Automático (oficial se conectado, senão QR Code)",
  oficial: "Só o WhatsApp oficial",
  qrcode: "Só o WhatsApp QR Code",
};

/** O que cada conexão oferece agora, ou `null` quando ela não está ligada. */
export type ConexoesDoWorkspace = {
  /** `phoneNumberId` da conta na Cloud API. */
  oficial: string | null;
  /**
   * O QR Code: `null` quando não está ligado.
   *
   * LIGADO, ele vem como objeto — e o `numero` pode ser `null` DENTRO dele. A distinção existe por
   * causa de um defeito real (21/10/2026): o número da conexão só é aprendido no evento
   * `connection.update` da Evolution, e esse evento se perde (instância recriada, webhook fora do
   * ar no momento certo, servidor restaurado). Quando se perde, o CRM fica com a conexão de pé,
   * recebendo e mandando mensagem normalmente, e sem saber o número dela.
   *
   * Antes isso era tratado como "não conectado", e o lead do Flow entrava SEM CONVERSA — sem
   * conversa não há confirmação, e a pessoa que preencheu o formulário não recebia nada. O canal
   * estava funcionando o tempo todo.
   *
   * O número serve pra MARCAR o dono da conversa, não pra mandar. Conversa sem dono já é um caso
   * previsto no produto: `contasCanalVisiveis` mostra as não marcadas quando o QR está ligado.
   */
  qrcode: { numero: string | null } | null;
};

export type EscolhaDeCanal = {
  /** O que vai em `Conversa.contaCanal`. `null` quando não há conexão utilizável. */
  contaCanal: string | null;
  conexao: "oficial" | "qrcode" | null;
  /**
   * A frase que o Flow mostra na tela de Respostas quando não dá pra criar conversa.
   *
   * Em português e curta, porque quem lê é a agência no painel do Flow, não um desenvolvedor no
   * log. Diz o que está faltando, não "erro".
   */
  aviso: string | null;
};

/**
 * Por onde este lead é atendido.
 *
 * DUAS FONTES, e a ordem entre elas é o ponto: o pedido do FORMULÁRIO manda sobre a opção da
 * empresa. A mesma agência pode ter um formulário institucional caindo no número oficial e um de
 * campanha caindo no QR — a empresa escolhe o padrão, o formulário escolhe a exceção.
 *
 * E o pedido do formulário NÃO TEM PLANO B. Se ele pede o QR e o QR está fora, o lead entra sem
 * conversa, e não pelo oficial. Quem escolheu um canal escolheu contra o outro: cair no outro
 * mandaria a mensagem pelo número errado, que é pior do que não mandar — e silenciosamente, porque
 * ninguém olha um lead que "deu certo".
 */
export function escolherCanalDoFlow(
  preferenciaDaEmpresa: CanalDoFlow,
  conexoes: ConexoesDoWorkspace,
  pedidoDoFormulario?: "qrcode" | "oficial" | null,
): EscolhaDeCanal {
  const oficial = (): EscolhaDeCanal | null =>
    conexoes.oficial
      ? { contaCanal: contaCanalDaConexao(CANAL_OFICIAL, conexoes.oficial), conexao: "oficial", aviso: null }
      : null;

  const qrcode = (): EscolhaDeCanal | null =>
    conexoes.qrcode
      ? {
          // `contaCanal` nulo quando o número é desconhecido: a conversa nasce sem marca de dono,
          // que é como todo o histórico anterior a essa coluna existir já é tratado. O que importa
          // é que ela NASCE — o canal está de pé e a mensagem sai por ele.
          contaCanal: contaCanalDaConexao(CANAL_NAO_OFICIAL, conexoes.qrcode.numero),
          conexao: "qrcode",
          aviso: null,
        }
      : null;

  if (pedidoDoFormulario === "oficial") {
    return oficial() ?? semConexao("O formulário pediu o WhatsApp oficial, que não está conectado; o lead entrou sem conversa.");
  }
  if (pedidoDoFormulario === "qrcode") {
    return qrcode() ?? semConexao("O formulário pediu o WhatsApp QR Code, que não está conectado; o lead entrou sem conversa.");
  }

  if (preferenciaDaEmpresa === "oficial") {
    return oficial() ?? semConexao("O WhatsApp oficial não está conectado, então o lead entrou sem conversa.");
  }

  if (preferenciaDaEmpresa === "qrcode") {
    return qrcode() ?? semConexao("O WhatsApp QR Code não está conectado, então o lead entrou sem conversa.");
  }

  /*
   * Automático. O oficial vem primeiro, e isso é deliberado: ele é o canal declarado, com janela de
   * 24h, modelo aprovado e número que não corre risco de bloqueio. O QR é a saída quando ele não
   * está disponível, não a preferência.
   */
  return (
    oficial() ??
    qrcode() ??
    semConexao("Nenhum WhatsApp está conectado, então o lead entrou sem conversa.")
  );
}

function semConexao(aviso: string): EscolhaDeCanal {
  return { contaCanal: null, conexao: null, aviso };
}
