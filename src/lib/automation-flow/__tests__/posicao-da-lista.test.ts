import { describe, expect, it } from "vitest";

import {
  ALTURA_MAXIMA_DA_LISTA,
  LARGURA_DA_LISTA,
  posicaoDaLista,
  type AncoraDaLista,
} from "../posicao-da-lista";

const JANELA = { largura: 1440, altura: 900 };

/** A pastilha "Iniciar robô": 150x40, no meio da tela. */
const pastilha: AncoraDaLista = { left: 300, top: 400, right: 450, bottom: 440 };

describe("onde a caixa de próximo passo abre", () => {
  it("abre à direita da âncora, com uma folga pro fio", () => {
    const p = posicaoDaLista(pastilha, JANELA);
    expect(p.left).toBe(462); // 450 + 12
    expect(p.fioNaDireita).toBe(false);
  });

  it("o fio sai do MEIO da âncora, seja ela alta ou baixa", () => {
    // O fio é desenhado perto do topo da caixa, então o topo da caixa é o centro da âncora menos
    // essa distância — é isto que faz o traço encostar no meio da pastilha em vez de perto da
    // quina de cima. O 28 (e não 26) sai da medida no navegador: a borda da caixa e a metade da
    // espessura do traço somam dois pixels.
    expect(posicaoDaLista(pastilha, JANELA).top).toBe(420 - 28);

    const botaoBaixinho: AncoraDaLista = { left: 300, top: 400, right: 320, bottom: 420 };
    expect(posicaoDaLista(botaoBaixinho, JANELA).top).toBe(410 - 28);
  });

  it("perto da borda direita, vira pra esquerda e o fio troca de lado", () => {
    const naBorda: AncoraDaLista = { left: 1300, top: 400, right: 1400, bottom: 440 };
    const p = posicaoDaLista(naBorda, JANELA);
    expect(p.fioNaDireita).toBe(true);
    expect(p.left).toBe(1300 - 12 - LARGURA_DA_LISTA);
  });

  it("não deixa a caixa passar do rodapé", () => {
    const embaixo: AncoraDaLista = { left: 300, top: 860, right: 450, bottom: 900 };
    const p = posicaoDaLista(embaixo, JANELA);
    expect(p.top).toBe(JANELA.altura - 12 - ALTURA_MAXIMA_DA_LISTA);
  });

  it("nem passar do topo", () => {
    const emCima: AncoraDaLista = { left: 300, top: 0, right: 450, bottom: 20 };
    expect(posicaoDaLista(emCima, JANELA).top).toBe(12);
  });

  it("numa janela estreita, encosta na margem esquerda em vez de sair da tela", () => {
    const estreita = { largura: 420, altura: 900 };
    const p = posicaoDaLista({ left: 200, top: 100, right: 350, bottom: 140 }, estreita);
    expect(p.fioNaDireita).toBe(true);
    expect(p.left).toBe(12);
  });
});
