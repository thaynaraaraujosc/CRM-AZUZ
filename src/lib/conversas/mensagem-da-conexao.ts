/**
 * ESTA MENSAGEM É DESTA CONVERSA, OU É DO OUTRO NÚMERO?
 *
 * "Eu nunca tinha mandado mensagem para esse número, e ele está puxando as mensagens do número do
 * QR Code. Está parecendo como se eu já tivesse conversado com esse contato antes, mas é a
 * primeira vez que eu estou mandando mensagem."
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * O MODELO DO CRM TEM UMA CONVERSA POR PESSOA. A REALIDADE TEM UMA POR PAR DE NÚMEROS.
 *
 * Do lado de quem recebe, uma mensagem vinda de outro número abre um CHAT NOVO no aparelho —
 * sem histórico nenhum, porque com aquele número nunca houve conversa. O CRM guardava tudo sob o
 * nome da pessoa, então ao falar pelo número oficial a tela mostrava, acima da primeira mensagem,
 * meses de conversa que a pessoa nunca viu ali.
 *
 * E o estrago não é estético: quem atende lê a thread pra saber o que já foi dito. Lendo
 * histórico que o outro lado não tem na frente dele, a resposta sai sem contexto — "como
 * combinamos ontem" para alguém que, naquele número, nunca combinou nada.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * A SEPARAÇÃO É CONSERVADORA DE PROPÓSITO. Esconder mensagem é perigoso: "dado vivo escondido por
 * uma mudança de filtro é a pior forma de perder conversa" — é regra desta casa, e está certa.
 * Então aqui só sai da vista o que se SABE ser de outra conexão. Na dúvida, aparece.
 *
 * Três camadas, da mais forte pra mais fraca:
 *
 *  1. `contaCanal` dos dois lados: é a identidade exata da conexão (`<provedor>:<número>`).
 *     Diferentes, a mensagem é de outro número. É o único caso em que dá pra ter certeza com
 *     duas contas do MESMO canal (dois números oficiais, por exemplo).
 *  2. Sem `contaCanal` na mensagem, vale o `canal` — oficial ou QR Code. Separa os dois mundos,
 *     que é o caso dela.
 *  3. Sem nenhum dos dois, aparece. É mensagem anterior às colunas existirem, e sumir com ela
 *     seria esconder o histórico de quem nunca mexeu em nada.
 */

/*
 * Os nomes dos canais escritos aqui, e não importados de `conta-canal.ts`: aquele módulo puxa o
 * cache de conexões (e o banco) junto, e esta regra roda no NAVEGADOR. Mesmo motivo de
 * `janela-do-oficial.ts`, e com o mesmo teste conferindo que continuam iguais.
 */
const CANAL_NAO_OFICIAL = "whatsapp_nao_oficial";
const CANAL_NAO_OFICIAL_ANTIGO = "whatsapp_baileys";
const CANAL_OFICIAL = "meta_whatsapp";

export type MensagemComConexao = {
  /** `meta_whatsapp` | `whatsapp_nao_oficial` | `whatsapp_baileys`. Ausente = antes da coluna. */
  canal?: string | null;
  /** `<provedor>:<identificador>`. Ausente = antes da coluna, ou mensagem só local. */
  contaCanal?: string | null;
};

/** O provedor de uma chave de conexão: `meta_whatsapp:123` → `meta_whatsapp`. */
function provedorDa(chave: string | null | undefined): string | null {
  if (!chave) return null;
  const provedor = chave.split(":")[0];
  return provedor === CANAL_NAO_OFICIAL_ANTIGO ? CANAL_NAO_OFICIAL : (provedor || null);
}

/** O canal de uma mensagem, pelos dois campos e já com o nome antigo traduzido. */
function canalDa(mensagem: MensagemComConexao): string | null {
  const bruto = mensagem.canal ?? provedorDa(mensagem.contaCanal);
  if (!bruto) return null;
  return bruto === CANAL_NAO_OFICIAL_ANTIGO ? CANAL_NAO_OFICIAL : bruto;
}

/**
 * Esta mensagem deve aparecer nesta conversa?
 *
 * `contaCanalDaConversa` é a conexão a que a conversa pertence agora. `null` quer dizer que a
 * conversa não tem dono — e aí tudo aparece, que é o comportamento de sempre.
 */
export function mensagemEhDaConexao(
  mensagem: MensagemComConexao,
  contaCanalDaConversa: string | null | undefined,
): boolean {
  if (!contaCanalDaConversa) return true;

  // 1. Identidade exata dos dois lados.
  if (mensagem.contaCanal) {
    return normalizar(mensagem.contaCanal) === normalizar(contaCanalDaConversa);
  }

  // 2. Só o canal: separa oficial de QR Code, que é a divisão que de fato muda o que o outro lado
  //    enxerga no aparelho dele.
  const canalDaMensagem = canalDa(mensagem);
  const canalDaConversa = provedorDa(contaCanalDaConversa);
  if (canalDaMensagem && canalDaConversa) return canalDaMensagem === canalDaConversa;

  // 3. Na dúvida, aparece.
  return true;
}

/** `whatsapp_baileys:` e `whatsapp_nao_oficial:` são a mesma conexão com dois nomes. */
function normalizar(chave: string): string {
  return chave.startsWith(`${CANAL_NAO_OFICIAL_ANTIGO}:`)
    ? chave.replace(`${CANAL_NAO_OFICIAL_ANTIGO}:`, `${CANAL_NAO_OFICIAL}:`)
    : chave;
}

/** Quantas mensagens desta pessoa ficaram de fora por serem de outra conexão. */
export function quantasDeOutraConexao(
  mensagens: MensagemComConexao[],
  contaCanalDaConversa: string | null | undefined,
): number {
  if (!contaCanalDaConversa) return 0;
  return mensagens.filter((m) => !mensagemEhDaConexao(m, contaCanalDaConversa)).length;
}

export const CANAIS_PARA_TESTE = { CANAL_OFICIAL, CANAL_NAO_OFICIAL, CANAL_NAO_OFICIAL_ANTIGO };
