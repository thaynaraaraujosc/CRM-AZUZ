import { describe, expect, it } from "vitest";

import { decidirConcorrencia } from "../limites";
import { ordemDeDisparo } from "@/lib/automation-flow/disparar-no-servidor";

/**
 * O CONTATO EM DUAS AUTOMAÇÕES AO MESMO TEMPO.
 *
 * Até aqui toda automação que casava com o evento rodava: um comentário que bate com o robô de
 * comentário, o de palavra-chave e o de boas-vindas mandava três mensagens em cima da outra, de
 * três conversas que não sabem uma da outra. A chave nova decide isso, e a tabela de decisão é
 * esta — pura, porque uma regra que cancela execução de verdade não pode depender de leitura de
 * tela pra ser conferida.
 */
const outra = [{ id: "exec-1", fluxoId: "fluxo-b" }];
const duasOutras = [
  { id: "exec-1", fluxoId: "fluxo-b" },
  { id: "exec-2", fluxoId: "fluxo-c" },
];

describe("a regra de outras automações ao mesmo tempo", () => {
  it("permitir deixa começar, com quantas outras houver", () => {
    expect(decidirConcorrencia("permitir", duasOutras)).toEqual({ pode: true, encerrar: [] });
  });

  it("sem nenhuma outra viva, qualquer modo deixa começar e não encerra nada", () => {
    expect(decidirConcorrencia("nao_iniciar", [])).toEqual({ pode: true, encerrar: [] });
    expect(decidirConcorrencia("encerrar_as_outras", [])).toEqual({ pode: true, encerrar: [] });
  });

  it("nao_iniciar barra e diz por quê, no singular e no plural", () => {
    expect(decidirConcorrencia("nao_iniciar", outra)).toEqual({
      pode: false,
      encerrar: [],
      motivo: "o contato já está em outra automação",
    });
    expect(decidirConcorrencia("nao_iniciar", duasOutras).motivo).toBe(
      "o contato já está em outras 2 automações",
    );
  });

  it("encerrar_as_outras começa e devolve TODAS as execuções a derrubar", () => {
    expect(decidirConcorrencia("encerrar_as_outras", duasOutras)).toEqual({
      pode: true,
      encerrar: ["exec-1", "exec-2"],
    });
  });
});

/**
 * A ORDEM PASSA A TER CONSEQUÊNCIA.
 *
 * Com as automações todas rodando, a ordem não mudava nada. Agora a primeira a começar é a que
 * fica viva, e as seguintes encontram o contato ocupado: sortear isso pela ordem do banco seria
 * sortear qual robô atende o cliente a cada evento.
 */
describe("a ordem de disparo", () => {
  const linha = (nome: string, prioridade?: string) => ({ nome, configuracoes: { prioridade } });

  it("alta vem antes de normal, e normal antes de baixa", () => {
    const ordem = ordemDeDisparo([linha("C", "baixa"), linha("A", "normal"), linha("B", "alta")]);
    expect(ordem.map((l) => l.nome)).toEqual(["B", "A", "C"]);
  });

  it("sem prioridade escrita vale normal", () => {
    const ordem = ordemDeDisparo([linha("Sem nada"), linha("Alta", "alta"), linha("Baixa", "baixa")]);
    expect(ordem.map((l) => l.nome)).toEqual(["Alta", "Sem nada", "Baixa"]);
  });

  it("empate vai por nome, pra a ordem ser a mesma em todo disparo", () => {
    const ordem = ordemDeDisparo([linha("Zebra", "alta"), linha("Abelha", "alta")]);
    expect(ordem.map((l) => l.nome)).toEqual(["Abelha", "Zebra"]);
  });

  it("não mexe na lista recebida", () => {
    const original = [linha("Z", "baixa"), linha("A", "alta")];
    ordemDeDisparo(original);
    expect(original.map((l) => l.nome)).toEqual(["Z", "A"]);
  });
});
