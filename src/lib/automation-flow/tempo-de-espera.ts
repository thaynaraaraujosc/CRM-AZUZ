import type { AguardarData } from "./types";

/**
 * QUANTO O BLOCO DE ESPERA ESPERA, numa forma que a tela sabe escrever.
 *
 * O bloco guarda o tempo em dois lugares diferentes conforme o modo: um cronômetro simples usa
 * `modo` + `valor` ("horas", 2), e a espera pela resposta usa `tempoMaximo` ({ valor, unidade }).
 * Cada tela que queria escrever "Aguardar 5 segundos" refazia essa leitura à mão, e bastava uma
 * delas esquecer de um dos dois formatos pra o cartão mostrar um tempo que não é o que o motor
 * cumpre.
 *
 * Mora em `lib` porque é regra de leitura do dado, e regra é o que tem teste.
 */
export type UnidadeDeEspera = "segundos" | "minutos" | "horas" | "dias";

const UNIDADES: UnidadeDeEspera[] = ["segundos", "minutos", "horas", "dias"];

/** As duas formas da palavra. A tela traduz; aqui só se escolhe singular ou plural. */
const PALAVRA: Record<UnidadeDeEspera, [string, string]> = {
  segundos: ["segundo", "segundos"],
  minutos: ["minuto", "minutos"],
  horas: ["hora", "horas"],
  dias: ["dia", "dias"],
};

export function ehUnidadeDeEspera(valor: unknown): valor is UnidadeDeEspera {
  return typeof valor === "string" && (UNIDADES as string[]).includes(valor);
}

/** O número e a unidade que o bloco espera hoje, venham de `valor`/`modo` ou de `tempoMaximo`. */
export function esperaDoBloco(data: AguardarData | undefined): { valor: number; unidade: UnidadeDeEspera } {
  const d = data ?? ({} as AguardarData);
  if (d.modo === "ate_resposta") {
    const unidade = ehUnidadeDeEspera(d.tempoMaximo?.unidade) ? d.tempoMaximo.unidade : "horas";
    return { valor: d.tempoMaximo?.valor ?? 2, unidade };
  }
  const unidade = ehUnidadeDeEspera(d.modo) ? d.modo : "horas";
  return { valor: d.valor ?? 1, unidade };
}

/** "segundo"/"segundos", conforme o número. Quem chama traduz a palavra. */
export function palavraDaUnidade(unidade: UnidadeDeEspera, valor: number): string {
  const [singular, plural] = PALAVRA[unidade];
  return Math.abs(valor) === 1 ? singular : plural;
}

/** Quanto tempo aquilo é, em milissegundos. */
export function milissegundosDaEspera(valor: number, unidade: UnidadeDeEspera): number {
  const fator =
    unidade === "segundos" ? 1_000 : unidade === "minutos" ? 60_000 : unidade === "horas" ? 3_600_000 : 86_400_000;
  return valor * fator;
}
