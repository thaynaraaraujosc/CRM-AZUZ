import { useSyncExternalStore } from "react";

/**
 * A LARGURA EM QUE O CRM VIRA UM APLICATIVO DE CELULAR.
 *
 * É a mesma de `@media (max-width: 820px)` no `globals.css`, e as duas têm que continuar iguais:
 * abaixo dela o menu vira barra horizontal, o funil vira uma etapa por tela e a caixa de entrada
 * vira um painel por tela.
 */
export const LARGURA_DE_CELULAR = 820;

const CONSULTA = `(max-width: ${LARGURA_DE_CELULAR}px)`;

function assinar(aoMudar: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(CONSULTA);
  mq.addEventListener("change", aoMudar);
  return () => mq.removeEventListener("change", aoMudar);
}

function ler(): boolean {
  return typeof window !== "undefined" && window.matchMedia(CONSULTA).matches;
}

/**
 * Diz se a tela está na largura de celular, e reavalia quando ela muda.
 *
 * `useSyncExternalStore` e não `useState` + `useEffect` de propósito: o valor vive FORA do React
 * (é o navegador quem sabe a largura), e é exatamente pra isso que este gancho existe. De quebra
 * ele resolve sozinho a hidratação — no servidor devolve `false`, que é o mesmo que o HTML gerado
 * assume — sem precisar gravar estado dentro de efeito, que o lint do projeto proíbe e com razão.
 */
export function useTelaEstreita(): boolean {
  return useSyncExternalStore(assinar, ler, () => false);
}
