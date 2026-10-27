/**
 * QUANTO TEMPO A MENSAGEM LEVA DA MÃO DE QUEM ESCREVEU ATÉ A TELA.
 *
 * Isto existe porque a pergunta não tinha resposta: "está demorando" e "está rápido" eram as duas
 * opiniões disponíveis, e nenhuma das duas dizia ONDE a demora estava. E a demora tem três pernas
 * com consertos completamente diferentes:
 *
 *  1. TRANSPORTE — de quem mandou até o webhook bater aqui. É a Meta (ou a Evolution). Não há
 *     conserto no CRM; o que há é saber que a demora é lá, e parar de procurar aqui.
 *  2. PROCESSAMENTO — do webhook bater até a mensagem ficar gravada. É nosso, inteiro. Cada
 *     consulta ao banco e cada chamada à Meta no caminho entram nesta conta.
 *  3. ESPERA DA TELA — da gravação até a tela buscar de novo. Não se mede, se calcula: é o
 *     intervalo do polling, entre zero e `INTERVALO_POLLING_MS`. Em média, metade dele.
 *
 * SOBRE OS RELÓGIOS, que é o detalhe que invalida a medição ingênua: `criadoEm` é o carimbo que o
 * provedor manda, e ele nasce no APARELHO de quem escreveu. Um celular com o relógio dois segundos
 * adiantado produz transporte negativo; um atrasado produz transporte inflado. Então o transporte
 * aqui é uma estimativa com a margem declarada (quantas amostras saíram por relógio impossível),
 * nunca um número apresentado como exato. Já o processamento usa dois carimbos NOSSOS, do mesmo
 * relógio: esse é confiável, e é também o único que dá pra consertar.
 *
 * Mediana e não média: uma única mensagem com mídia grande, ou um cold start, levanta a média e
 * esconde como é o dia normal. A mediana diz como é quase sempre; o p90 e o pior dizem quão ruim
 * fica quando fica ruim.
 */

/** Uma mensagem recebida, com os três carimbos que interessam. Entra assim do banco. */
export type AmostraDeChegada = {
  canal: string | null;
  /** Carimbo do provedor (relógio de quem mandou). */
  criadoEm: Date | null;
  /** Webhook bateu aqui (relógio nosso). */
  recebidoEm: Date | null;
  /** Linha gravada (relógio nosso). */
  gravadoEm: Date | null;
};

export type Faixa = {
  mediana: number;
  p90: number;
  pior: number;
};

export type ResumoDoCanal = {
  canal: string;
  /** Quantas mensagens entraram na conta deste canal. */
  amostras: number;
  /** Da mão de quem escreveu até o webhook bater aqui. Nulo quando nenhuma amostra serviu. */
  transporte: Faixa | null;
  /** Do webhook bater até a linha estar gravada. O que é nosso. */
  processamento: Faixa | null;
  /**
   * As duas pernas medidas somadas, POR MENSAGEM.
   *
   * Existe porque somar a mediana do transporte com a mediana do processamento não dá a mediana da
   * soma — são estatísticas diferentes, e no p90 a diferença é grande: somar dois p90 descreve uma
   * mensagem que teve as duas pernas ruins ao mesmo tempo, que é mais raro que 10%. Aqui a soma é
   * feita em cada mensagem e só depois ordenada, então o p90 é de uma mensagem que existiu.
   */
  total: Faixa | null;
  /**
   * Quantas amostras saíram da conta do TRANSPORTE porque o relógio de quem mandou estava
   * adiantado (transporte negativo). Declarado, não escondido: é a margem de erro desta medição.
   */
  relogioAdiantado: number;
};

/**
 * Nome de canal pra mostrar. As mensagens gravam `canal` cru, e a tela não deve mostrar nenhum
 * desses valores.
 *
 * `whatsapp_baileys` É O NOME ANTIGO da conexão por QR Code, e ainda está gravado em mensagem de
 * saída: ver `provedorDoCanal` em `conta-canal.ts`, que normaliza os dois. Aqui a mesma regra está
 * repetida de propósito, e não por descuido: `conta-canal.ts` importa o Prisma no topo, e este
 * arquivo é puro pra poder ser provado por teste sem banco. Copiar três linhas custa menos do que
 * arrastar o cliente do banco pra dentro de um teste de aritmética — mas a divergência entre as
 * duas cópias é um risco real, e é por isso que ela está escrita aqui.
 */
export function nomeDoCanal(canal: string | null): string {
  const normalizado = canal?.toLowerCase();
  if (normalizado === "meta_instagram" || normalizado === "instagram") return "Instagram";
  if (normalizado === "whatsapp_nao_oficial" || normalizado === "whatsapp_baileys") {
    return "WhatsApp (QR Code)";
  }
  if (normalizado === "meta_whatsapp") return "WhatsApp (API oficial)";
  // "WhatsApp" com maiúscula é o rótulo da CONVERSA, não do provedor, e `null` é o histórico
  // anterior à coluna. Nos dois casos é WhatsApp sem saber qual conexão — o que é verdade, e é
  // melhor do que inventar uma.
  return "WhatsApp";
}

/**
 * Percentil por interpolação linear, no mesmo método que `numpy.percentile` usa por padrão.
 *
 * Importa qual método porque a amostra aqui é pequena (algumas centenas de mensagens): com 10
 * valores, "o p90" pelo método do índice arredondado é literalmente o segundo maior, o que faz o
 * número pular a cada mensagem nova. A lista precisa vir ORDENADA.
 */
export function percentil(ordenados: number[], p: number): number {
  if (!ordenados.length) throw new Error("percentil de lista vazia");
  if (ordenados.length === 1) return ordenados[0];
  const posicao = (ordenados.length - 1) * p;
  const abaixo = Math.floor(posicao);
  const acima = Math.ceil(posicao);
  if (abaixo === acima) return ordenados[abaixo];
  return ordenados[abaixo] + (ordenados[acima] - ordenados[abaixo]) * (posicao - abaixo);
}

function faixa(valores: number[]): Faixa | null {
  if (!valores.length) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  return {
    mediana: Math.round(percentil(ordenados, 0.5)),
    p90: Math.round(percentil(ordenados, 0.9)),
    pior: ordenados[ordenados.length - 1],
  };
}

/**
 * Teto do processamento considerado medição, e não lixo.
 *
 * Uma função que estourou e foi reexecutada pela Meta, ou uma linha gravada por uma importação de
 * histórico, produz um "processamento" de minutos ou horas que não descreve o caminho normal de
 * uma mensagem. Cinco minutos é folgado o suficiente pra caber o pior caso real (mídia grande num
 * cold start) e apertado o suficiente pra não deixar um disparate definir o pior caso.
 */
const TETO_PROCESSAMENTO_MS = 5 * 60 * 1000;

/** Mesmo motivo do teto acima, do outro lado: transporte de horas é relógio errado, não demora. */
const TETO_TRANSPORTE_MS = 30 * 60 * 1000;

/**
 * Agrupa por canal e resume. Canais sem nenhuma amostra utilizável não aparecem: uma linha
 * dizendo "Instagram: —" não informa nada e dá a impressão de medição quebrada.
 */
export function resumirTempoDeChegada(amostras: AmostraDeChegada[]): ResumoDoCanal[] {
  const porCanal = new Map<
    string,
    {
      transporte: number[];
      processamento: number[];
      /** Transporte + processamento da MESMA mensagem. Ver o comentário de `total` em `ResumoDoCanal`. */
      total: number[];
      relogioAdiantado: number;
      medidas: number;
    }
  >();

  for (const a of amostras) {
    if (!a.recebidoEm || !a.gravadoEm) continue;
    const nome = nomeDoCanal(a.canal);
    const acc =
      porCanal.get(nome) ??
      { transporte: [], processamento: [], total: [], relogioAdiantado: 0, medidas: 0 };
    porCanal.set(nome, acc);

    const processamento = a.gravadoEm.getTime() - a.recebidoEm.getTime();
    // Dois carimbos do mesmo relógio: negativo aqui é impossível, não é relógio alheio. Se
    // aparecer, é dado corrompido e não entra.
    const processamentoVale = processamento >= 0 && processamento <= TETO_PROCESSAMENTO_MS;
    if (processamentoVale) {
      acc.processamento.push(processamento);
      acc.medidas += 1;
    }

    if (a.criadoEm) {
      const transporte = a.recebidoEm.getTime() - a.criadoEm.getTime();
      if (transporte < 0) acc.relogioAdiantado += 1;
      else if (transporte <= TETO_TRANSPORTE_MS) {
        acc.transporte.push(transporte);
        if (processamentoVale) acc.total.push(transporte + processamento);
      }
    }
  }

  return [...porCanal.entries()]
    .map(([canal, acc]) => ({
      canal,
      amostras: acc.medidas,
      transporte: faixa(acc.transporte),
      processamento: faixa(acc.processamento),
      total: faixa(acc.total),
      relogioAdiantado: acc.relogioAdiantado,
    }))
    .filter((r) => r.amostras > 0)
    .sort((a, b) => b.amostras - a.amostras);
}

/**
 * Da gravação até a tela mostrar. NÃO é medido, é o intervalo do polling: a tela pergunta de
 * tantos em tantos segundos, então uma mensagem gravada logo depois de uma pergunta espera o
 * ciclo inteiro e uma gravada logo antes não espera nada.
 *
 * Está aqui, junto do resto, porque sem esta perna o total que a tela mostra fica menor do que a
 * experiência de quem usa — e aí a medição desmente quem está certo.
 */
export function esperaDaTela(intervaloPollingMs: number): { media: number; pior: number } {
  return { media: Math.round(intervaloPollingMs / 2), pior: intervaloPollingMs };
}
