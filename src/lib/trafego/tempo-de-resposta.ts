/**
 * QUANTO TEMPO O LEAD ESPERA ATÉ ALGUÉM RESPONDER — por campanha.
 *
 * A campanha que traz lead bom e demora quarenta minutos pra ser atendida perde venda por
 * OPERAÇÃO, não por mídia. Hoje isso não aparece em lugar nenhum: a campanha chega no relatório
 * como "cara, não converte", alguém desliga, e o que estava errado era a fila de atendimento. É o
 * único número desta tela que não fala do anúncio — fala de quem atende o anúncio.
 *
 * O CRM já media isso por contato (`timeline.ts`, no painel de um lead por vez). Faltava ler em
 * agregado, que é onde a informação vira decisão.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * MEDIANA, E NÃO MÉDIA. É a decisão mais importante deste arquivo.
 *
 * Um lead que chegou sexta à noite e foi respondido segunda de manhã acrescenta 3.600 minutos à
 * conta. Em dez leads, a média salta de 6 minutos pra 366 e a campanha inteira passa a parecer
 * mal atendida por causa de um caso. A mediana responde a pergunta que de fato se faz: "quanto um
 * lead desta campanha normalmente espera?".
 *
 * QUEM NUNCA FOI RESPONDIDO NÃO ENTRA NA MEDIANA — e é por isso que ele é contado à parte. Jogar
 * um lead sem resposta como "espera infinita" distorceria o número, e deixá-lo de fora em silêncio
 * seria pior ainda: uma campanha com 10 leads e 9 ignorados mostraria a espera ótima do único que
 * alguém respondeu. Os dois números andam juntos, sempre.
 */

/** Uma mensagem, reduzida ao que importa pra medir: pra que lado foi e quando. */
export type MensagemParaMedir = {
  /** "in" = o lead escreveu; "out" = a empresa escreveu. */
  tipo: string;
  em: Date | null;
};

const MINUTO = 60_000;

/**
 * Minutos entre a PRIMEIRA mensagem do lead e a PRIMEIRA resposta da empresa depois dela.
 *
 * `null` em três casos, e cada um quer dizer uma coisa diferente de "foi rápido":
 *
 *  · o lead nunca escreveu (conversa que a empresa começou e ninguém respondeu);
 *  · ninguém respondeu ainda — este é o caso que vira a contagem de "sem resposta";
 *  · a empresa escreveu primeiro e o lead respondeu depois. Aqui a pergunta se inverte, e chamar
 *    de "tempo de resposta" o que seria tempo de resposta DELE daria um número que mede outra
 *    coisa. Disparo ativo não é lead de anúncio esperando atendimento.
 */
export function minutosAtePrimeiraResposta(mensagens: MensagemParaMedir[]): number | null {
  const comHora = mensagens.filter((m): m is MensagemParaMedir & { em: Date } => m.em instanceof Date);
  if (comHora.length === 0) return null;

  const emOrdem = [...comHora].sort((a, b) => a.em.getTime() - b.em.getTime());
  const primeiraDoLead = emOrdem.find((m) => m.tipo === "in");
  if (!primeiraDoLead) return null;

  // ESTRITAMENTE depois: uma mensagem gravada no mesmo instante não é resposta a ela, é a mesma
  // ida ao banco. Sem o `>`, uma automação que dispara na entrada marcaria zero minuto de espera
  // em toda campanha — e zero é justamente o número que faria ninguém olhar mais pra coluna.
  const resposta = emOrdem.find((m) => m.tipo === "out" && m.em.getTime() > primeiraDoLead.em.getTime());
  if (!resposta) return null;

  return Math.round((resposta.em.getTime() - primeiraDoLead.em.getTime()) / MINUTO);
}

/** A mediana de uma lista de minutos. `null` quando não há nenhum. */
export function medianaDeMinutos(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  // Lista par: a média dos dois centrais, pra mediana de [2, 10] ser 6 e não 2.
  return ordenados.length % 2 === 1 ? ordenados[meio] : Math.round((ordenados[meio - 1] + ordenados[meio]) / 2);
}

/**
 * A espera escrita como alguém diria em voz alta.
 *
 * "73 min" é o tipo de número que obriga quem lê a fazer a conta de cabeça pra entender se é
 * ruim. "1h13" já é a resposta.
 */
export function formatarEspera(minutos: number | null | undefined): string {
  if (minutos === null || minutos === undefined) return "—";
  if (minutos < 1) return "na hora";
  if (minutos < 60) return `${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) {
    const resto = minutos % 60;
    return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, "0")}`;
  }

  const dias = Math.floor(horas / 24);
  const horasRestantes = horas % 24;
  if (dias === 1 && horasRestantes === 0) return "1 dia";
  return horasRestantes === 0 ? `${dias} dias` : `${dias}d ${horasRestantes}h`;
}

/**
 * A espera é boa, aceitável ou ruim?
 *
 * Os cortes não são opinião de design: lead de anúncio respondido nos primeiros 5 minutos é outro
 * negócio, e depois de uma hora a pessoa já conversou com concorrente. O tom existe pra a coluna
 * ser lida de relance — número sozinho numa tabela de nove colunas ninguém compara.
 */
export function tomDaEspera(minutos: number | null | undefined): "bom" | "atencao" | "ruim" | null {
  if (minutos === null || minutos === undefined) return null;
  if (minutos <= 5) return "bom";
  if (minutos <= 60) return "atencao";
  return "ruim";
}
