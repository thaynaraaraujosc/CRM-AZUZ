/**
 * ONDE A CAIXA "ADICIONAR PRÓXIMO PASSO" ABRE, em pixels de tela.
 *
 * Ela abre COLADA no que a chamou — o "+" de uma saída, ou a pastilha "Iniciar robô" — e um fio
 * curto liga uma coisa à outra. Sem isso a caixa parece ter aparecido do nada, e num fluxo com
 * dez blocos não dá pra saber de qual saída ela é.
 *
 * A conta mora aqui, fora do componente, por dois motivos: ela é a MESMA pros dois casos (um fio
 * solto num deles foi exatamente o defeito relatado), e assim ela pode ser testada sem montar o
 * editor inteiro.
 */

export const LARGURA_DA_LISTA = 250;
export const ALTURA_MAXIMA_DA_LISTA = 430;
const MARGEM = 12;

/**
 * A ALTURA DO FIO DENTRO DA CAIXA, em pixels a partir do topo dela.
 *
 * O fio é desenhado na borda da caixa, a 26px do topo dela (ver `.pp-fio` no globals.css), e são
 * 28 aqui por causa dos 2px que a borda da caixa e a metade da espessura do traço somam — medidos
 * no navegador, não deduzidos. Pra o fio sair exatamente do meio da pastilha/do botão, é a CAIXA
 * que se desloca: o topo dela é o centro da âncora menos esta distância. Era "topo da âncora menos
 * 10", que acertava por acaso num botão de 20px e errava em tudo que fosse mais alto.
 */
const ALTURA_DO_FIO = 28;

export type AncoraDaLista = { top: number; left: number; right: number; bottom: number };

export type PosicaoDaLista = {
  top: number;
  left: number;
  /** A caixa virou pra esquerda da âncora: o fio tem que sair da direita dela, não da esquerda. */
  fioNaDireita: boolean;
};

/**
 * Posição da caixa pra uma âncora, aparada aos limites da janela.
 *
 * Perto da borda direita ela vira pra ESQUERDA da âncora; perto do rodapé ela sobe. Metade da
 * caixa fora da tela é pior do que a caixa um pouco fora do lugar ideal.
 */
export function posicaoDaLista(
  ancora: AncoraDaLista,
  janela: { largura: number; altura: number },
): PosicaoDaLista {
  const cabeDireita = ancora.right + MARGEM + LARGURA_DA_LISTA <= janela.largura - MARGEM;
  const left = cabeDireita
    ? ancora.right + MARGEM
    : Math.max(MARGEM, ancora.left - MARGEM - LARGURA_DA_LISTA);

  const centro = ancora.top + (ancora.bottom - ancora.top) / 2;
  const top = Math.max(
    MARGEM,
    Math.min(centro - ALTURA_DO_FIO, janela.altura - MARGEM - ALTURA_MAXIMA_DA_LISTA),
  );

  return { top, left, fioNaDireita: !cabeDireita };
}
