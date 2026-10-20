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

/** O identificador de cada conexão, ou `null` quando ela não está ligada. */
export type ConexoesDoWorkspace = {
  /** `phoneNumberId` da conta na Cloud API. */
  oficial: string | null;
  /** Número conectado por QR Code. */
  qrcode: string | null;
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

export function escolherCanalDoFlow(preferencia: CanalDoFlow, conexoes: ConexoesDoWorkspace): EscolhaDeCanal {
  const oficial = (): EscolhaDeCanal | null =>
    conexoes.oficial
      ? { contaCanal: contaCanalDaConexao(CANAL_OFICIAL, conexoes.oficial), conexao: "oficial", aviso: null }
      : null;

  const qrcode = (): EscolhaDeCanal | null =>
    conexoes.qrcode
      ? { contaCanal: contaCanalDaConexao(CANAL_NAO_OFICIAL, conexoes.qrcode), conexao: "qrcode", aviso: null }
      : null;

  if (preferencia === "oficial") {
    return oficial() ?? semConexao("O WhatsApp oficial não está conectado, então o lead entrou sem conversa.");
  }

  if (preferencia === "qrcode") {
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
