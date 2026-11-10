/**
 * A BUSCA DAS LISTAS LONGAS DO CRM, num lugar só.
 *
 * O seletor de campo da condição oferece quase cinquenta opções em sete grupos, e o jeito de achar
 * uma é digitar. Mas o filtro olhava só o RÓTULO e o identificador — e aí "começou a me seguir" não
 * achava "É seguidor (segue seu perfil)", que é exatamente o campo procurado. O campo existia e
 * parecia não existir, que é o pior dos dois mundos: a pessoa conclui que o CRM não faz, e vai
 * montar o robô de outro jeito.
 *
 * Então a busca passou a olhar quatro coisas: o rótulo, o identificador, a descrição e os
 * SINÔNIMOS — termos que acham a opção sem aparecer nela. Sinônimo não é um segundo nome: o nome
 * continua um só na tela, pra não haver duas formas de chamar a mesma coisa circulando pelo
 * produto.
 *
 * Mora em `lib` e não no componente porque é regra, não desenho: ela tem teste, e o próximo
 * seletor com busca lê daqui em vez de reescrever o filtro com um detalhe diferente.
 */

/** Minúsculas e sem acento: "Comentário" e "comentario" têm que achar a mesma coisa. */
export function semAcento(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export type OpcaoDeBusca = {
  valor: string;
  label: string;
  descricao?: string;
  sinonimos?: string[];
};

/**
 * Esta opção casa com o que foi digitado?
 *
 * Termo vazio casa com tudo — é a lista inteira, que é o estado inicial do menu. A comparação é
 * "contém", e não "começa com": quem digita "seguir" tem que achar "É seguidor" e "Você segue o
 * contato", que é o que uma busca serve pra fazer.
 */
export function opcaoCasaComBusca(opcao: OpcaoDeBusca, termo: string): boolean {
  const procurado = semAcento(termo.trim());
  if (!procurado) return true;
  if (semAcento(opcao.label).includes(procurado)) return true;
  if (semAcento(opcao.valor).includes(procurado)) return true;
  if (opcao.descricao && semAcento(opcao.descricao).includes(procurado)) return true;
  return (opcao.sinonimos ?? []).some((sin) => semAcento(sin).includes(procurado));
}

/** As opções que casam, na ordem em que estavam. */
export function filtrarOpcoes<T extends OpcaoDeBusca>(opcoes: readonly T[], termo: string): T[] {
  if (!termo.trim()) return [...opcoes];
  return opcoes.filter((o) => opcaoCasaComBusca(o, termo));
}
