/**
 * Ritmo de envio por canal.
 *
 * Este arquivo é onde moram os únicos números "mágicos" do disparo, reunidos num lugar só e com o
 * porquê de cada um escrito ao lado. Espalhados pelo código, eles viram chute que ninguém revisa.
 *
 * O modelo NÃO é "lote de 30". Lote significa 30 requisições ao mesmo tempo, e o resultado é um
 * pico seguido de silêncio — exatamente o padrão que faz um número ser sinalizado. O modelo é
 * gotejamento: uma mensagem por vez, por conexão, num intervalo constante.
 */

export type CanalCampanha = "whatsapp_oficial" | "whatsapp_nao_oficial" | "email";

export type RitmoCanal = {
  /** Quantas mensagens podem sair por minuto, numa mesma conexão. */
  porMinuto: number;
  /**
   * Teto por dia. `null` = quem manda é o limite da própria conta, lido do provedor.
   *
   * No WhatsApp oficial esse número existe e é dela: a Meta define quantas PESSOAS DIFERENTES a
   * conta pode iniciar conversa a cada 24h (250 / 1.000 / 10.000 / ilimitado, conforme o nível), e
   * ele sobe sozinho com o histórico de qualidade. Chutar um valor aqui seria pior que não ter: ou
   * segura uma conta que já podia mais, ou deixa passar do que ela pode e a Meta recusa.
   */
  porDia: number | null;
  /**
   * Variação aleatória aplicada ao intervalo, em porcentagem. Existe só no canal não oficial: ali
   * um intervalo exato e repetido é justamente a assinatura de robô que os sistemas antifraude
   * procuram. Nos outros dois o envio é por API declarada — não há nada a disfarçar, e variar só
   * tornaria a campanha mais lenta sem motivo.
   */
  variacao: number;
  /** Como explicar o limite pra quem está montando a campanha. */
  explicacao: string;
};

export const RITMO: Record<CanalCampanha, RitmoCanal> = {
  /**
   * WhatsApp oficial (Cloud API).
   *
   * A API aguenta 80 mensagens por segundo — velocidade não é o gargalo aqui, e é por isso que um
   * número alto neste campo não ajudaria em nada. O gargalo é a cota de 24h da conta.
   *
   * 20 por minuto é ritmo de segurança, não de capacidade: mantém a campanha lenta o bastante pra
   * dar tempo de PARAR quando a Meta começa a recusar ou a nota de qualidade cai. Uma campanha que
   * despeja mil mensagens em um minuto já queimou a conta antes de alguém ler o primeiro erro.
   */
  whatsapp_oficial: {
    porMinuto: 20,
    porDia: null,
    variacao: 0,
    explicacao:
      "A Meta limita quantas pessoas diferentes sua conta pode iniciar conversa a cada 24 horas. " +
      "Esse limite é da conta e sobe conforme o histórico de qualidade.",
  },

  /**
   * WhatsApp não oficial (Evolution / WhatsApp Web automatizado).
   *
   * Não existe limite publicado porque não existe API: é o aplicativo sendo operado por fora. O
   * risco real é o número ser bloqueado, e quem paga isso é o cliente.
   *
   * 3 por minuto (um a cada ~20s, com variação) e teto de 200 por dia são números conservadores
   * escolhidos por precaução, não por documentação — não há documentação. Ficam aqui em vez de
   * escondidos no worker justamente pra poderem ser discutidos e ajustados com o que a prática
   * mostrar.
   */
  whatsapp_nao_oficial: {
    porMinuto: 3,
    porDia: 200,
    variacao: 0.35,
    explicacao:
      "Esta conexão não é uma API oficial — é o WhatsApp comum sendo operado pelo CRM. " +
      "Volume alto é o motivo mais comum de bloqueio de número, então o envio é bem mais lento.",
  },

  /**
   * E-mail (Resend).
   *
   * A API aceita 2 requisições por segundo. 100 por minuto deixa folga sobre esse teto e ainda
   * assim entrega 5.000 mensagens em menos de uma hora. O limite que importa aqui é o do PLANO
   * contratado (o gratuito é 100 por dia), e esse a gente lê do provedor, não chuta.
   */
  email: {
    porMinuto: 100,
    porDia: null,
    variacao: 0,
    explicacao: "O limite depende do plano contratado no provedor de e-mail.",
  },
};

/** Intervalo entre duas mensagens, em milissegundos, já com a variação do canal aplicada. */
export function intervaloEntreEnvios(canal: CanalCampanha): number {
  const ritmo = RITMO[canal];
  const base = 60_000 / ritmo.porMinuto;
  if (!ritmo.variacao) return base;
  // Varia pra cima e pra baixo em torno do intervalo, mantendo a média no ritmo configurado.
  const desvio = base * ritmo.variacao;
  return Math.round(base - desvio + Math.random() * desvio * 2);
}

/**
 * Previsão de duração, pra tela poder avisar ANTES de a campanha começar.
 *
 * Sem isto, alguém seleciona cinco mil pessoas no WhatsApp oficial achando que vai disparar hoje e
 * descobre dias depois que a conta entrega 250 por dia. O aviso é o que transforma um limite numa
 * informação em vez de numa surpresa.
 */
export function preverDuracao(
  canal: CanalCampanha,
  destinatarios: number,
  /** Limite de 24h da conta, quando ele é conhecido (WhatsApp oficial). */
  limiteDiarioDaConta?: number | null,
): { minutos: number; dias: number; limitadoPorCota: boolean } {
  const ritmo = RITMO[canal];
  const porDia = limiteDiarioDaConta ?? ritmo.porDia;
  const minutosPorRitmo = destinatarios / ritmo.porMinuto;

  if (!porDia || destinatarios <= porDia) {
    return { minutos: Math.ceil(minutosPorRitmo), dias: 0, limitadoPorCota: false };
  }

  // Passou da cota diária: o que manda é quantos dias de cota a lista consome.
  const dias = Math.ceil(destinatarios / porDia);
  return { minutos: Math.ceil(minutosPorRitmo), dias, limitadoPorCota: true };
}
