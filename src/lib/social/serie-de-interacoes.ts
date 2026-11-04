import {
  dataIsoEmBrasilia,
  dataPorExtenso,
  diaDaSemanaEmBrasilia,
  formatarDia,
  horaEmBrasilia,
  somarDias,
} from "@/lib/agenda/fuso";

/**
 * A SÉRIE DE INTERAÇÕES DO INSTAGRAM: contar por tempo, e reagrupar depois.
 *
 * Duas metades que vivem em lugares diferentes e por isso moram aqui juntas. O servidor fecha os
 * baldes finos — um por hora quando o período é de um dia, um por dia no resto — porque é ele que
 * tem os instantes de cada evento. A tela reagrupa esses baldes em semana ou mês quando a pessoa
 * pede, porque é ela que sabe o que a pessoa pediu. Mandar os três recortes prontos pela rede
 * seria mandar a mesma contagem três vezes.
 *
 * TUDO NO FUSO DA CONTA. O servidor roda em UTC: `getDate()` numa interação das 22h de Brasília
 * devolveria o dia seguinte, e o gráfico contaria a noite de terça como quarta.
 */

export type Granularidade = "hora" | "dia";
export type Agrupamento = "hora" | "dia" | "semana" | "mes";

export type Ponto = { chave: string; total: number };
/** Um ponto pronto pra virar barra: o rótulo que vai embaixo e o título do balde inteiro. */
export type PontoRotulado = Ponto & { rotulo: string; titulo: string };

/**
 * Os baldes do período, todos abertos em zero.
 *
 * Abrir antes de contar é o que garante o zero no gráfico. Um dia sem interação tem que virar
 * barra no chão, não barra ausente: as duas coisas parecem iguais e não são — "ninguém falou
 * comigo na terça" é resposta, "a terça não existe" não é.
 */
export function baldesVazios(
  granularidade: Granularidade,
  primeiroDia: string,
  ultimoDia: string,
): Map<string, number> {
  const baldes = new Map<string, number>();
  if (granularidade === "hora") {
    for (let h = 0; h < 24; h += 1) baldes.set(String(h).padStart(2, "0"), 0);
    return baldes;
  }
  // Comparar "YYYY-MM-DD" como texto é comparar a data: o formato foi feito pra isso. O teto de
  // voltas é defesa contra data inválida, que faria `somarDias` devolver sempre a mesma string e
  // o laço nunca terminar.
  let dia = primeiroDia;
  for (let volta = 0; dia <= ultimoDia && volta < 400; volta += 1) {
    baldes.set(dia, 0);
    dia = somarDias(dia, 1);
  }
  return baldes;
}

/** Os instantes de cada interação viram a contagem por balde. */
export function montarSerie(
  instantes: readonly Date[],
  granularidade: Granularidade,
  primeiroDia: string,
  ultimoDia: string,
): Ponto[] {
  const baldes = baldesVazios(granularidade, primeiroDia, ultimoDia);
  for (const instante of instantes) {
    const chave =
      granularidade === "hora" ? horaEmBrasilia(instante).slice(0, 2) : dataIsoEmBrasilia(instante);
    // Fora dos baldes só cai se o relógio virar o dia entre o cálculo do recorte e a leitura do
    // banco. Ignorar é melhor que pendurar um balde solto no fim do gráfico.
    if (baldes.has(chave)) baldes.set(chave, (baldes.get(chave) ?? 0) + 1);
  }
  return Array.from(baldes, ([chave, total]) => ({ chave, total }));
}

/**
 * A segunda-feira da semana de "YYYY-MM-DD".
 *
 * Segunda e não domingo: é como se conta semana de trabalho aqui, e é o corte que faz o fim de
 * semana ficar junto em vez de abrir a barra seguinte.
 */
export function segundaDaSemana(dataIso: string): string {
  const diaDaSemana = diaDaSemanaEmBrasilia(dataIso);
  if (diaDaSemana === null) return dataIso;
  // 0 = domingo. Domingo pertence à semana que começou na segunda anterior, seis dias antes.
  return somarDias(dataIso, -((diaDaSemana + 6) % 7));
}

/**
 * Quais agrupamentos fazem sentido no período escolhido.
 *
 * Um recorte de sete dias agrupado "por mês" é uma barra só: tecnicamente certo e visualmente
 * inútil. Em vez de desenhar o botão e deixar a pessoa descobrir que ele não serve, o botão não
 * aparece — e quando sobra um agrupamento só, ele vira legenda em vez de botão.
 */
export function agrupamentosPossiveis(
  granularidade: Granularidade,
  periodoDias: number,
): Agrupamento[] {
  if (granularidade === "hora") return ["hora"];
  const possiveis: Agrupamento[] = ["dia"];
  if (periodoDias >= 14) possiveis.push("semana");
  if (periodoDias >= 60) possiveis.push("mes");
  return possiveis;
}

/** Soma os baldes finos no agrupamento pedido, já com os rótulos que a barra mostra. */
export function agrupar(pontos: readonly Ponto[], agrupamento: Agrupamento): PontoRotulado[] {
  if (agrupamento === "hora") {
    return pontos.map((p) => ({
      ...p,
      rotulo: `${p.chave}h`,
      titulo: `${p.chave}:00 às ${p.chave}:59`,
    }));
  }
  if (agrupamento === "dia") {
    return pontos.map((p) => ({
      ...p,
      rotulo: formatarDia(p.chave, { day: "2-digit", month: "2-digit" }),
      titulo: dataPorExtenso(p.chave),
    }));
  }

  const somas = new Map<string, { total: number; primeiro: string; ultimo: string }>();
  for (const ponto of pontos) {
    const chave = agrupamento === "semana" ? segundaDaSemana(ponto.chave) : ponto.chave.slice(0, 7);
    const atual = somas.get(chave);
    if (!atual) {
      somas.set(chave, { total: ponto.total, primeiro: ponto.chave, ultimo: ponto.chave });
    } else {
      atual.total += ponto.total;
      // Os pontos chegam em ordem, mas o mínimo e o máximo são baratos e não dependem disso.
      if (ponto.chave < atual.primeiro) atual.primeiro = ponto.chave;
      if (ponto.chave > atual.ultimo) atual.ultimo = ponto.chave;
    }
  }

  return Array.from(somas, ([chave, { total, primeiro, ultimo }]) => {
    if (agrupamento === "mes") {
      return {
        chave,
        total,
        rotulo: formatarDia(`${chave}-01`, { month: "short" }).replace(".", ""),
        titulo: formatarDia(`${chave}-01`, { month: "long", year: "numeric" }),
      };
    }
    const curto = (dia: string) => formatarDia(dia, { day: "2-digit", month: "2-digit" });
    return {
      chave,
      total,
      // O rótulo é o começo da semana; o intervalo inteiro fica no título, que aparece ao passar
      // o mouse. Duas datas embaixo de cada barra não cabem sem virar sopa de números.
      rotulo: curto(chave),
      titulo: `Semana de ${curto(primeiro)} a ${curto(ultimo)}`,
    };
  });
}
