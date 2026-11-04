"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * O LUGAR ONDE UMA PÁGINA PÕE OS BOTÕES DELA NA BARRA DE CIMA DO CRM.
 *
 * Toda tela tinha duas faixas no topo: a do CRM (busca, idioma, sino) e a da página (o título e
 * os botões). Duas faixas empilhadas custam uns 120px de altura em cima de telas que são grades e
 * listas — e a de cima ficava com metade vazia enquanto a de baixo repetia um título que o menu
 * lateral já dizia.
 *
 * Agora a página manda os botões PRA FAIXA DO CRM, e some com a sua.
 *
 * POR QUE PORTAL, e não um estado com o conteúdo dentro. Os botões de cada tela são vivos: eles
 * abrem diálogos, ligam e desligam conforme o que a tela carregou, contam itens selecionados.
 * Guardar JSX num estado compartilhado significaria regravá-lo a cada mudança desses valores,
 * com lista de dependências à mão em cada página — o tipo de coisa que funciona no dia em que se
 * escreve e dessincroniza um mês depois. Com portal, os botões são renderizados pela própria
 * página, no render dela, com o estado dela; só o DESTINO é emprestado.
 *
 * O alvo é guardado por uma ref callback (`ref={definirAlvo}` no cabeçalho), e não por efeito:
 * assim ele existe já no commit em que o cabeçalho aparece, e não um quadro depois.
 */
type Valor = {
  alvo: HTMLElement | null;
  definirAlvo: (no: HTMLElement | null) => void;
};

const TopoDaPaginaContext = createContext<Valor | null>(null);

export function TopoDaPaginaProvider({ children }: { children: ReactNode }) {
  const [alvo, definirAlvo] = useState<HTMLElement | null>(null);
  const valor = useMemo(() => ({ alvo, definirAlvo }), [alvo]);
  return <TopoDaPaginaContext.Provider value={valor}>{children}</TopoDaPaginaContext.Provider>;
}

/** Só o cabeçalho usa: é ele que oferece o espaço. */
export function useDestinoDoTopo() {
  return useContext(TopoDaPaginaContext);
}

/**
 * Põe o que estiver aqui dentro na barra de cima do CRM.
 *
 * Enquanto a barra não existe (o primeiro render, e as telas que não a têm — Conversas é em tela
 * cheia), não desenha nada. Nada de "quase lá": ou os botões estão no lugar certo, ou não estão.
 */
export function AcoesNoTopo({ children }: { children: ReactNode }) {
  const ctx = useContext(TopoDaPaginaContext);
  if (!ctx?.alvo) return null;
  return createPortal(children, ctx.alvo);
}
