/**
 * QUAIS MENSAGENS ABREM A JANELA DE 24 HORAS DO WHATSAPP OFICIAL.
 *
 * "Eu tenho muitas conversas na API não oficial. Às vezes eu quero mandar uma mensagem para aquele
 * mesmo contato que eu estou conversando na não oficial, só que através da API oficial. Eu vou lá
 * em contatos, mando mensagem, escolho a API oficial — e não foi."
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * A JANELA É DE UMA CONEXÃO, NÃO DE UMA PESSOA. E era isto que estava errado.
 *
 * A Cloud API da Meta só aceita texto livre nas 24 horas seguintes a a pessoa ter escrito PARA
 * AQUELE NÚMERO. Fora disso, só modelo aprovado. O CRM conferia isso olhando a última mensagem
 * recebida daquele contato — QUALQUER uma, de qualquer conexão.
 *
 * Então, pra quem conversa com a pessoa pelo QR Code: o CRM via as mensagens dela (recentes, pelo
 * aparelho), concluía que a janela do OFICIAL estava aberta, e mandava texto livre pela Cloud API.
 * A Meta recusava — porque pro número oficial aquela pessoa nunca escreveu — e a mensagem não
 * saía. O CRM dizia que dava pra escrever; a Meta dizia que não.
 *
 * O pior do defeito não é a recusa: é que ele ESCONDE O CAMINHO QUE FUNCIONA. Achando a janela
 * aberta, o CRM não oferece o modelo aprovado — que é o único jeito de falar primeiro por um
 * número novo. A pessoa fica tentando o que nunca ia dar certo, sem ver a porta ao lado.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * CANAL NULO CONTA COMO OFICIAL, e isso não é chute: é o que a coluna significa. `MensagemExtra.
 * canal` nasceu junto com a integração não oficial, e está documentado no schema que nulo quer
 * dizer "comportamento antigo, implicitamente Meta oficial". Tratar nulo como não-oficial faria o
 * CRM pedir modelo aprovado pra toda conversa anterior ao QR Code — uma volta atrás silenciosa em
 * contas que atendem por texto livre todo dia.
 *
 * Puro, sem banco: é regra, e regra tem teste.
 */

/*
 * OS NOMES DOS CANAIS ESCRITOS AQUI, e não importados de `conta-canal.ts`.
 *
 * Não é duplicação por descuido: esta regra roda NOS DOIS LADOS — no servidor, pra recusar o
 * envio, e no navegador, pra oferecer o modelo aprovado antes de a pessoa digitar. E
 * `conta-canal.ts` importa o cache de conexões, que usa o banco: trazê-lo pro navegador derruba
 * o build inteiro ("the chunking context does not support external modules"). A tela de Conversas
 * já declara estes mesmos nomes localmente, pelo mesmo motivo.
 *
 * O teste deste arquivo confere que eles continuam iguais aos de `conta-canal.ts` — é lá que a
 * cópia deixa de ser risco e vira uma cópia vigiada.
 */
const CANAL_NAO_OFICIAL = "whatsapp_nao_oficial";
const CANAL_OFICIAL = "meta_whatsapp";

/** 24 horas, a regra da Meta. */
export const JANELA_DO_OFICIAL_MS = 24 * 60 * 60 * 1000;

/** O que esta regra precisa saber de uma mensagem recebida. */
export type MensagemRecebida = {
  /** `null` = anterior à coluna existir, e isso quer dizer Meta oficial. Ver o schema. */
  canal?: string | null;
  /**
   * `Date` no servidor (vem do Prisma) e número no navegador (vem do JSON já convertido).
   *
   * Aceitar os dois é o que permite esta regra rodar nos DOIS lados — e os dois lados precisam
   * dela: o servidor pra recusar o envio, e a tela pra oferecer o modelo aprovado ANTES de a
   * pessoa digitar. Uma cópia em cada lugar é como eles passam a discordar.
   */
  criadoEm?: Date | number | null;
};

function emMilissegundos(quando: Date | number | null | undefined): number | null {
  if (quando === null || quando === undefined) return null;
  const valor = typeof quando === "number" ? quando : quando.getTime();
  return Number.isFinite(valor) ? valor : null;
}

/** Esta mensagem recebida chegou PELO número oficial? */
export function chegouPeloOficial(mensagem: MensagemRecebida): boolean {
  const canal = mensagem.canal ?? null;
  if (canal === null) return true;
  // `whatsapp_baileys` é o nome ANTIGO da conexão não oficial e ainda está gravado em mensagem de
  // automação. Lido como "não é o QR Code", ele abriria a janela do oficial por engano.
  if (canal === CANAL_NAO_OFICIAL || canal === "whatsapp_baileys") return false;
  return canal === CANAL_OFICIAL;
}

/**
 * A janela do oficial está aberta, considerando só o que chegou POR ELE?
 *
 * `agora` entra por parâmetro pra a regra das 24 horas poder ser provada sem depender do relógio.
 */
export function janelaAbertaPelasMensagens(
  recebidas: MensagemRecebida[],
  agora: number = Date.now(),
): boolean {
  for (const mensagem of recebidas) {
    if (!chegouPeloOficial(mensagem)) continue;
    const quando = emMilissegundos(mensagem.criadoEm);
    if (quando === null) continue;
    if (agora - quando < JANELA_DO_OFICIAL_MS) return true;
  }
  return false;
}
