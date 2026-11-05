import type { PaginaFormulario, PerguntaFormulario } from "@/lib/formularios-context";

/**
 * UM FORMULÁRIO, UMA PÁGINA.
 *
 * As páginas saíram do construtor a pedido da Thaynara: "a gente já não usa mais essas páginas".
 * Elas pareciam organização pra quem monta e viravam ETAPA pra quem responde — e cada etapa é
 * uma chance de a pessoa parar no meio. O formulário que se manda pro cliente é um só.
 *
 * O QUE ERA PÁGINA VIRA SEÇÃO: um campo de título no meio da lista. Separa assunto sem quebrar o
 * formulário, e quem responde rola em vez de clicar "próxima".
 *
 * NADA SE PERDE. Formulário antigo, com páginas, é juntado na ORDEM em que estava, e o título de
 * cada página vira o título da seção. Título automático ("Página 2") não vira nada: seria uma
 * linha de ruído no meio do formulário do cliente.
 *
 * Função pura, sem banco: quem grava é o construtor, e quem confere é o teste ao lado. É a parte
 * que não pode errar — ela mexe em formulário já publicado, de cliente que já está respondendo.
 */

/**
 * Título que o próprio produto deu, e que portanto não diz nada a quem responde.
 *
 * Usado nos dois lados: aqui, pra não virar seção ao juntar; e no formulário público, pra não
 * imprimir "Página 1" como cabeçalho em cima da primeira pergunta do cliente.
 */
export function tituloAutomatico(titulo: string): boolean {
  return /^\s*p[áa]gina\s*\d*\s*$/i.test(titulo ?? "");
}

export function temMaisDeUmaPagina(paginas: PaginaFormulario[] | undefined): boolean {
  return (paginas?.length ?? 0) > 1;
}

export function juntarEmUmaPagina(paginas: PaginaFormulario[], novoId: () => string): PaginaFormulario[] {
  if (!Array.isArray(paginas) || paginas.length <= 1) return paginas;

  const perguntas: PerguntaFormulario[] = [];
  for (const pagina of paginas) {
    if (!tituloAutomatico(pagina.titulo) && pagina.perguntas.length > 0) {
      perguntas.push({
        id: novoId(),
        tipo: "titulo",
        rotulo: pagina.titulo,
        obrigatoria: false,
        oculta: false,
        somenteLeitura: false,
        largura: "total",
      });
    }
    perguntas.push(...pagina.perguntas);
  }

  /*
   * O id da PRIMEIRA página é mantido de propósito: é ele que a tela já tem selecionado, e
   * trocá-lo faria o construtor perder a página aberta no meio da junção.
   *
   * O TÍTULO VIRA AUTOMÁTICO porque ele já entrou na lista como seção: mantê-lo aqui faria o
   * cliente ler o mesmo texto duas vezes seguidas — uma como cabeçalho da página, outra como
   * título da primeira seção.
   */
  return [{ id: paginas[0].id, titulo: "Página 1", perguntas }];
}
