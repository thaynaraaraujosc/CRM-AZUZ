import { describe, expect, it } from "vitest";

import type { AguardarData } from "../types";
import { esperaDoBloco, milissegundosDaEspera, palavraDaUnidade } from "../tempo-de-espera";
import { calcularEspera } from "@/lib/automacoes/motor-estado";

/**
 * O CARTÃO TEM QUE DIZER O TEMPO QUE O MOTOR CUMPRE.
 *
 * O bloco guarda o tempo em dois lugares conforme o modo — `modo`+`valor` no cronômetro simples,
 * `tempoMaximo` na espera pela resposta — e cada tela que refazia essa leitura à mão podia mostrar
 * um número diferente do que o motor usa. Aqui a leitura é uma só, e estes testes são o contrato
 * entre ela e `calcularEspera`.
 */
describe("o tempo que o bloco de espera espera", () => {
  it("lê o cronômetro simples", () => {
    expect(esperaDoBloco({ modo: "segundos", valor: 5 })).toEqual({ valor: 5, unidade: "segundos" });
    expect(esperaDoBloco({ modo: "horas", valor: 2 })).toEqual({ valor: 2, unidade: "horas" });
  });

  it("lê o prazo da espera pela resposta, que mora em outro campo", () => {
    expect(esperaDoBloco({ modo: "ate_resposta", tempoMaximo: { valor: 30, unidade: "minutos" } })).toEqual({
      valor: 30,
      unidade: "minutos",
    });
  });

  it("cai em horas quando o modo não é um tempo (até a data, até a consulta)", () => {
    expect(esperaDoBloco({ modo: "ate_consulta" }).unidade).toBe("horas");
  });

  it("escolhe singular ou plural pela quantidade", () => {
    expect(palavraDaUnidade("segundos", 1)).toBe("segundo");
    expect(palavraDaUnidade("segundos", 5)).toBe("segundos");
    expect(palavraDaUnidade("horas", 1)).toBe("hora");
  });

  it("converte em milissegundos", () => {
    expect(milissegundosDaEspera(5, "segundos")).toBe(5_000);
    expect(milissegundosDaEspera(2, "horas")).toBe(7_200_000);
  });
});

/**
 * SEGUNDOS SÃO SEGUNDOS NO MOTOR TAMBÉM.
 *
 * A unidade é nova: antes dela a menor espera era um minuto, porque quem acorda execução parada é
 * uma varredura de minuto em minuto. Se `calcularEspera` não souber da unidade, o bloco devolve
 * `null` e a execução morre com "Bloco de espera sem tempo configurado" — em silêncio, no meio da
 * conversa.
 */
describe("a conta da espera no motor", () => {
  const agora = new Date("2026-01-01T12:00:00.000Z");
  const espera = (data: AguardarData) => calcularEspera(data, agora)!.getTime() - agora.getTime();

  it("entende segundos", () => {
    expect(espera({ modo: "segundos", valor: 5 })).toBe(5_000);
  });

  it("continua entendendo minutos e horas", () => {
    expect(espera({ modo: "minutos", valor: 3 })).toBe(180_000);
    expect(espera({ modo: "horas", valor: 2 })).toBe(7_200_000);
  });

  it("sem tempo configurado não há espera nenhuma", () => {
    expect(calcularEspera({ modo: "ate_consulta" }, agora)).toBeNull();
  });
});
