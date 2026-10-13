/**
 * Qual das cores de autor cabe a um nome, numa conversa de grupo.
 *
 * Num grupo, toda mensagem recebida chega no mesmo balão branco, e o nome de quem escreveu era
 * sempre da mesma cor. Com seis pessoas falando, achar a fala de alguém exigia LER os nomes um por
 * um. É por isso que o WhatsApp pinta cada participante de uma cor: a vista reconhece quem falou
 * antes de ler.
 *
 * A escolha tem que ser ESTÁVEL: a mesma pessoa, a mesma cor, hoje e amanhã, nesta tela e na
 * próxima — senão a cor não informa nada. Por isso ela sai do nome, e não de um contador de ordem
 * de chegada (que mudaria a cada carregamento) nem de um sorteio.
 *
 * A quantidade de cores é menor que a de pessoas possíveis, então duas pessoas podem repetir cor
 * num grupo grande. Isso é aceito de propósito: o nome continua escrito ao lado, e cores demais
 * voltariam a ser indistinguíveis entre si, que é o problema que elas vieram resolver.
 */
export const TOTAL_DE_CORES_DE_AUTOR = 8;

export function corDoAutor(nome: string): number {
  // djb2. Escolhido por ser estável entre execuções e espalhar bem nomes parecidos ("Ana Paula" e
  // "Ana Carolina" caem em cores diferentes, que é o caso que mais acontece numa agenda real).
  let hash = 5381;
  for (let i = 0; i < nome.length; i += 1) {
    hash = (hash * 33) ^ nome.charCodeAt(i);
  }
  // `>>> 0` tira o sinal: `^` em JavaScript devolve inteiro de 32 bits COM sinal, e `% 8` de um
  // número negativo devolve um índice negativo, que não existe na lista de cores.
  return (hash >>> 0) % TOTAL_DE_CORES_DE_AUTOR;
}
