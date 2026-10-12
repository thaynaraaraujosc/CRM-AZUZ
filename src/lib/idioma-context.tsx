"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { TRADUCOES_EN } from "@/lib/traducoes/en";

export type Idioma = "pt" | "en";

const CHAVE_ARMAZENAMENTO = "azuz-idioma";

/* ---------------------------------------------------------------------------------------------
 * A preferência mora no `localStorage`, que é estado DE FORA do React: não existe no servidor e
 * pode mudar noutra aba. Por isso ela é lida com `useSyncExternalStore` em vez de `useState` mais
 * efeito. O jeito com efeito funcionava, mas renderizava uma vez em português e então chamava
 * `setState` pra corrigir — cascata de renderização que a regra `react-hooks/set-state-in-effect`
 * barra, com razão. Aqui o React pergunta o valor na hora de renderizar e sabe que o servidor
 * responde "pt", sem divergência de hidratação e sem renderização extra.
 * ------------------------------------------------------------------------------------------- */

const ouvintes = new Set<() => void>();

function avisarOuvintes() {
  for (const ouvinte of ouvintes) ouvinte();
}

function assinar(aoMudar: () => void): () => void {
  ouvintes.add(aoMudar);
  // Trocar o idioma numa aba vale para as outras: o evento `storage` só dispara nas DEMAIS abas,
  // então a que fez a troca é avisada por `avisarOuvintes` e as outras por aqui.
  window.addEventListener("storage", aoMudar);
  return () => {
    ouvintes.delete(aoMudar);
    window.removeEventListener("storage", aoMudar);
  };
}

function lerDoNavegador(): Idioma {
  try {
    return window.localStorage.getItem(CHAVE_ARMAZENAMENTO) === "en" ? "en" : "pt";
  } catch {
    // Navegador com armazenamento bloqueado (aba anônima, dados de site desligados): cai no padrão
    // em vez de derrubar a aplicação inteira por causa de uma preferência.
    return "pt";
  }
}

/** No servidor não existe `localStorage`: o HTML sai sempre em português e o cliente ajusta. */
function lerNoServidor(): Idioma {
  return "pt";
}

type ValorContexto = {
  idioma: Idioma;
  definirIdioma: (idioma: Idioma) => void;
  /** Traduz um texto em português. Sem tradução cadastrada, devolve o original. `valores` troca
   * marcadores `{nome}` depois de traduzir, pra frase com número no meio não precisar ser quebrada
   * em pedaços (o que daria ordem de palavras errada em inglês). */
  t: (textoEmPortugues: string, valores?: Record<string, string | number>) => string;
  /** Locale pra `toLocaleString` de número e data. Acompanha o idioma: um painel em inglês com
   * "1.234" e "12/10/2026" se lê errado pra quem espera "1,234" e "10/12/2026". */
  localeNumero: string;
};

const IdiomaContext = createContext<ValorContexto | null>(null);

function traduzir(
  idioma: Idioma,
  textoEmPortugues: string,
  valores?: Record<string, string | number>,
): string {
  const base =
    idioma === "en" ? (TRADUCOES_EN[textoEmPortugues] ?? textoEmPortugues) : textoEmPortugues;
  if (!valores) return base;
  return Object.entries(valores).reduce(
    (texto, [chave, valor]) => texto.replaceAll(`{${chave}}`, String(valor)),
    base,
  );
}

/**
 * Idioma da interface. Português é o padrão e continua sendo: o inglês é uma escolha de quem está
 * usando, guardada no navegador, não uma troca do produto.
 *
 * Existe por causa da análise da Meta, que exige a interface em inglês na gravação de tela e cujo
 * analista entra no CRM para testar as permissões. Traduzir o sistema inteiro para inglês atenderia
 * a Meta e quebraria o produto para quem o usa de verdade; um seletor atende os dois.
 */
export function IdiomaProvider({ children }: { children: ReactNode }) {
  const idioma = useSyncExternalStore(assinar, lerDoNavegador, lerNoServidor);

  // `lang` do documento acompanha a escolha: é o que leitor de tela e tradutor automático usam pra
  // saber em que idioma o conteúdo está.
  useEffect(() => {
    document.documentElement.lang = idioma === "en" ? "en" : "pt-BR";
  }, [idioma]);

  const definirIdioma = useCallback((novo: Idioma) => {
    try {
      window.localStorage.setItem(CHAVE_ARMAZENAMENTO, novo);
    } catch {
      // Sem conseguir persistir, a troca não acontece em vez de acontecer pela metade (tela em
      // inglês que volta pro português no próximo carregamento, sem explicação).
    }
    avisarOuvintes();
  }, []);

  const valor = useMemo(
    () => ({
      idioma,
      definirIdioma,
      t: (texto: string, valores?: Record<string, string | number>) =>
        traduzir(idioma, texto, valores),
      localeNumero: idioma === "en" ? "en-US" : "pt-BR",
    }),
    [idioma, definirIdioma],
  );

  return <IdiomaContext.Provider value={valor}>{children}</IdiomaContext.Provider>;
}

/**
 * Fora do provider (tela pública, componente renderizado no servidor), devolve português sem
 * traduzir em vez de estourar. Nenhuma tela deve quebrar por causa de idioma.
 */
export function useIdioma(): ValorContexto {
  const contexto = useContext(IdiomaContext);
  if (contexto) return contexto;
  return {
    idioma: "pt",
    definirIdioma: () => {},
    t: (texto: string, valores?: Record<string, string | number>) => traduzir("pt", texto, valores),
    localeNumero: "pt-BR",
  };
}
