/**
 * A reunião, do tamanho que as variáveis de mensagem precisam.
 *
 * Num arquivo só dela, e sem Prisma, porque `src/lib/campanhas/variaveis.ts` é puro de propósito
 * (é o que permite testar cada regra sem banco) e precisa deste tipo. Quem lê do banco é o
 * `proxima-reuniao.ts`, que importa daqui — assim o módulo puro não passa a depender do Prisma só
 * por causa de um `type`.
 */
export type ReuniaoParaVariaveis = {
  /** "YYYY-MM-DD", hora local de Brasília (é como o `Compromisso` guarda). */
  dataIso: string;
  /** "HH:MM", hora local de Brasília. */
  hora: string;
  /** O `local` do compromisso quando é um endereço de reunião. Pode não existir. */
  link: string | null;
};
