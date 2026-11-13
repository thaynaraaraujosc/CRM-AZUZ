import { chaveDeContato } from "@/lib/contatos/chave-nome";
import type { Funil } from "@/lib/data";

/**
 * TIRAR UM NEGÓCIO DO QUADRO QUE ESTÁ NA TELA.
 *
 * "Eu apago o card, às vezes eu quero apagar o contato e aí ele volta."
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * POR QUE VOLTAVA. Apagar um card era só tirá-lo do estado do navegador; quem gravava era o PUT de
 * estado completo do quadro, e esse caminho tem como desfazer a exclusão de duas maneiras:
 *
 *  1. PUT que FALHA relê o banco, pra tela não seguir mostrando o que não foi gravado. Só que o
 *     card apagado ainda está no banco nessa hora — a releitura o traz de volta pra tela.
 *  2. PUT que DÁ CERTO cria o que o navegador tem e o banco não (`cardsParaCriar`). Então o card
 *     apagado em outra tela — a conversa excluída leva o card junto, no servidor — renascia no
 *     salvamento seguinte do quadro.
 *
 * A correção é apagar por rota própria (`DELETE /api/funis/cards/[id]`) e mexer na tela com
 * `aplicarSemGravar`. Estas duas funções são a parte de mexer na tela, separadas do React porque
 * é aqui que mora o detalhe que erra calado: o `total` da coluna.
 *
 * O `total` é o número que o cabeçalho da etapa mostra. Ele NÃO é derivado na renderização — é um
 * campo gravado —, então tirar um card sem corrigi-lo deixa a coluna dizendo "8" com sete cards
 * dentro. E a coluna que não perdeu card nenhum é devolvida COMO ESTÁ, mesmo objeto: é o que
 * permite ao React não redesenhar as outras colunas do quadro.
 */

/** Tira UM card, pelo id. Resto do quadro intocado. */
export function tirarCardPorId(funis: Funil[], cardId: string): Funil[] {
  if (!cardId) return funis;
  return tirar(funis, (nome, id) => id === cardId);
}

/**
 * Tira TODOS os cards daquela pessoa, de todos os funis.
 *
 * Pelo nome porque é assim que o resto do CRM casa card, contato e conversa: quem apagou a conversa
 * não tem o id do card em mãos. E de todos os funis porque dois cards do mesmo lead em quadros
 * diferentes são o mesmo lead — ela pediu pra apagar o lead, não um dos cartões dele.
 */
export function tirarCardsDoContato(funis: Funil[], nome: string): Funil[] {
  const chave = chaveDeContato(nome);
  if (!chave) return funis;
  return tirar(funis, (nomeDoCard) => chaveDeContato(nomeDoCard) === chave);
}

function tirar(funis: Funil[], ehOAlvo: (nome: string, id: string) => boolean): Funil[] {
  let mudouAlgumFunil = false;

  const novos = funis.map((funil) => {
    let mudouAlgumaColuna = false;

    const colunas = funil.colunas.map((coluna) => {
      const cards = coluna.cards.filter((card) => !ehOAlvo(card.nome, card.id));
      if (cards.length === coluna.cards.length) return coluna;
      mudouAlgumaColuna = true;
      /*
       * O `total` acompanha. Ele pode estar MAIOR que `cards.length` de propósito — a coluna mostra
       * uma página de cards e conta o resto —, e nesse caso baixar pelo tamanho da lista visível
       * apagaria do contador os cards que não estão na tela. Então desconta um por card removido,
       * em vez de reescrever o número.
       */
      const removidos = coluna.cards.length - cards.length;
      return { ...coluna, cards, total: Math.max(cards.length, coluna.total - removidos) };
    });

    if (!mudouAlgumaColuna) return funil;
    mudouAlgumFunil = true;
    return { ...funil, colunas };
  });

  // Nada saiu: devolve o MESMO array. Um array novo faria o React redesenhar o quadro inteiro por
  // uma exclusão que não encontrou nada (clique repetido, card que outra aba já tirou).
  return mudouAlgumFunil ? novos : funis;
}
