/**
 * O TAMANHO DA LOGO DA AGÊNCIA, em contas puras: sem React e sem navegador.
 *
 * Existe num arquivo só porque TRÊS lugares precisam concordar no mesmo número — a tela que reduz a
 * imagem, o quadradinho do topo do menu e a prévia em Configurações. Uma conta repetida em três
 * arquivos é o jeito garantido de a prévia mostrar uma coisa e o menu mostrar outra.
 */

/**
 * O espaço é o QUADRADINHO DA MARCA no topo do menu, ao lado de "azuz crm" — o lugar do "a".
 *
 * Quadrado como o "a" que ele substitui, e um pouco maior (32 px contra 28) pro símbolo da agência
 * aparecer com nitidez. O nome do produto CONTINUA ao lado, com ou sem logo: a agência põe a marca
 * dela no quadradinho, não no lugar do nome do sistema.
 */
export const LOGO_SLOT = { largura: 32, altura: 32 } as const;

/** O respiro de cada lado. Logo encostada na borda do quadradinho parece recortada. */
export const LOGO_RESPIRO = { horizontal: 3, vertical: 3 } as const;

export const LOGO_AREA = {
  largura: LOGO_SLOT.largura - 2 * LOGO_RESPIRO.horizontal,
  altura: LOGO_SLOT.altura - 2 * LOGO_RESPIRO.vertical,
} as const;

/** Pixels de imagem por pixel de tela. 3 aguenta a tela de alta densidade do celular e do Mac. */
export const LOGO_DENSIDADE = 3;

/**
 * O tamanho final da imagem guardada: reduz até caber na área do espaço em `LOGO_DENSIDADE`×,
 * mantendo a proporção.
 *
 * Imagem que JÁ CABE não é ampliada. Esticar uma logo pequena não a melhora — só deixa borrada, e
 * ainda ocupa mais bytes em cada carregamento de página.
 */
export function tamanhoDaLogo(largura: number, altura: number): { largura: number; altura: number } {
  const maxLargura = LOGO_AREA.largura * LOGO_DENSIDADE;
  const maxAltura = LOGO_AREA.altura * LOGO_DENSIDADE;
  const escala = Math.min(maxLargura / largura, maxAltura / altura, 1);
  return { largura: Math.max(1, Math.round(largura * escala)), altura: Math.max(1, Math.round(altura * escala)) };
}

/**
 * O teto do que pode ser guardado na coluna, em caracteres do data URL.
 *
 * A imagem reduzida dá uns poucos KB, então isto nunca é alcançado por um arquivo normal. Existe
 * contra o caso em que o preparo foi pulado (um pedido feito fora da tela): sem teto, a coluna
 * aceitaria um PNG de 8 MB que viajaria em TODA leitura do workspace, em toda página.
 */
export const LIMITE_DA_LOGO = 200_000;
