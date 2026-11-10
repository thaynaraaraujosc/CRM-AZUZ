"use client";

import { useEffect } from "react";

/**
 * FECHAR O MENU DE "..." DE UMA LINHA — clicando fora dele ou com Esc.
 *
 * Os menus de linha do CRM (os três pontinhos de cada automação, de cada contato do Instagram)
 * abriam e não fechavam: só o mesmo botão que abriu os desligava. Quem clicava fora ficava com a
 * caixa "Abrir / Duplicar / Mover pra pasta / Excluir" grudada por cima da lista, e a saída
 * aparente — clicar em qualquer lugar — não funcionava.
 *
 * Há um hook mais completo no projeto, `useFloatingPosition`, que também fecha sozinho. Ele é pra
 * flutuante portalizado em `document.body`, que precisa ser MEDIDO e posicionado à mão. Estes
 * menus não são: eles são `position: absolute` dentro da própria linha, já nascem no lugar certo e
 * acompanham a rolagem sem conta nenhuma. Trocá-los pelo portal só pra ganhar o fechamento seria
 * refazer o posicionamento de todos pra resolver outra coisa.
 *
 * COMO O HOOK SABE O QUE É "DENTRO": qualquer ancestral do clique com `data-menu-de-linha`. Marcar
 * o elemento que embrulha o BOTÃO e o MENU (e não só o menu) é o que faz o caso chato funcionar —
 * clicar no "..." de outra linha com um menu aberto. O mousedown acontece dentro de uma área
 * marcada, então nada fecha; o clique seguinte troca qual menu está aberto. Se só o menu fosse
 * marcado, o mousedown fecharia e o clique reabriria: o menu piscaria no lugar de trocar.
 */
export const ATRIBUTO_MENU_DE_LINHA = "data-menu-de-linha";

export function useFecharMenuDeLinha(aberto: boolean, fechar: () => void) {
  useEffect(() => {
    if (!aberto) return;

    function aoApontar(evento: MouseEvent) {
      const alvo = evento.target;
      // `closest` só existe em Element: um clique que caia no próprio documento não tem ancestral
      // marcado de qualquer jeito, então fecha.
      if (alvo instanceof Element && alvo.closest(`[${ATRIBUTO_MENU_DE_LINHA}]`)) return;
      fechar();
    }

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") fechar();
    }

    /*
     * `mousedown`, e não `click`: fechar no apertar é o que faz o menu sumir antes de o clique
     * chegar no que está embaixo, que é como todo menu de sistema se comporta.
     *
     * E NA FASE DE CAPTURA, que é o que conserta o menu que não fechava no quadro da automação.
     * O React Flow usa d3-drag pra arrastar bloco e tela, e o d3 chama `stopPropagation` no
     * mousedown: na fase de borbulha, o clique no canvas morria antes de chegar no documento, e o
     * menu aberto continuava lá enquanto a pessoa mexia em tudo. Na captura o documento vê o
     * evento ANTES de quem o interrompe, e aí "clicar em qualquer lugar fecha" volta a ser verdade
     * em todo menu do CRM de uma vez.
     */
    document.addEventListener("mousedown", aoApontar, true);
    document.addEventListener("keydown", aoTeclar, true);
    return () => {
      document.removeEventListener("mousedown", aoApontar, true);
      document.removeEventListener("keydown", aoTeclar, true);
    };
  }, [aberto, fechar]);
}
