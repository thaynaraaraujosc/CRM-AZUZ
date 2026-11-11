import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A ORDEM DO CARD DENTRO DA COLUNA É DO SERVIDOR. O PUT do quadro inteiro não a reescreve.
 *
 * Teste estático, de leitura do arquivo, e não de comportamento: a rota precisa de sessão e de
 * banco, e o que se quer travar aqui é uma linha de código que já voltou uma vez e custou caro.
 *
 * O que ela causava: `/api/funis/mover` grava o card no topo da etapa de destino com
 * `menor ordem - 1` (negativo, pra não renumerar a coluna a cada arraste). O PUT recalculava
 * `ordem` como o índice do card no array do navegador. Os dois números discordavam, a comparação
 * marcava TODOS os cards da coluna como alterados, e um único arraste virava dezenas de
 * instruções numa transação só — que estourava o prazo no pool de três conexões do Railway e
 * devolvia "O banco demorou demais pra responder. Parte do funil pode não ter sido salva".
 *
 * A divergência ficava gravada, então a alteração SEGUINTE repetia a enxurrada mesmo sem ninguém
 * arrastar nada. E a renumeração desfazia o que `/api/funis/reordenar-por-atividade` tinha
 * acabado de organizar.
 *
 * Card NOVO continua levando `ordem` no `createMany`: ele não existe no banco e precisa de uma
 * posição. O que não pode voltar é `ordem` no `update` de card que já existe.
 */
describe("ordem do card no salvamento do quadro inteiro", () => {
  const rota = readFileSync(join(process.cwd(), "src/app/api/funis/route.ts"), "utf8");

  /** O corpo do `negocioCard.update`, do `data: {` até o fecho do objeto. */
  function dadosDoUpdateDeCard(): string {
    const inicio = rota.indexOf("prisma.negocioCard.update(");
    expect(inicio, "o PUT do funil deixou de atualizar cards").toBeGreaterThan(-1);
    const abre = rota.indexOf("data: {", inicio);
    expect(abre, "`negocioCard.update` sem bloco `data`").toBeGreaterThan(-1);

    let profundidade = 0;
    for (let i = rota.indexOf("{", abre); i < rota.length; i += 1) {
      if (rota[i] === "{") profundidade += 1;
      if (rota[i] === "}") {
        profundidade -= 1;
        if (profundidade === 0) return rota.slice(abre, i + 1);
      }
    }
    throw new Error("não achei o fim do bloco `data` do update de card");
  }

  it("não grava `ordem` ao atualizar um card que já existe", () => {
    expect(dadosDoUpdateDeCard()).not.toMatch(/\bordem\s*:/);
  });

  it("não marca o card como alterado por causa da posição no array", () => {
    const inicio = rota.indexOf("const mudou =");
    expect(inicio).toBeGreaterThan(-1);
    const comparacao = rota.slice(inicio, rota.indexOf(";", inicio));
    expect(comparacao).not.toMatch(/atual\.ordem/);
  });

  it("card novo continua entrando com uma posição", () => {
    const inicio = rota.indexOf("cardsParaCriar.push(");
    expect(inicio).toBeGreaterThan(-1);
    expect(rota.slice(inicio, rota.indexOf("});", inicio))).toMatch(/\bordem\s*:/);
  });
});
