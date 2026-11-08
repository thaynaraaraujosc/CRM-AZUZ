"use client";

import { useState } from "react";
import { useIdioma } from "@/lib/idioma-context";

const CHAVE_TEMA = "azuz-crm-tema";
type Tema = "light" | "dark";

/** Ler e escrever o tema num lugar só: as duas formas do controle (chips e lista) usam as mesmas. */
function temaAtual(): Tema {
  if (typeof window === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function aplicarTema(novoTema: Tema) {
  document.documentElement.setAttribute("data-theme", novoTema);
  try {
    localStorage.setItem(CHAVE_TEMA, novoTema);
  } catch {
    // localStorage indisponível (modo privado etc.): só não persiste entre sessões
  }
}

/** Tela clara ou escura: vale só nesse navegador (guardado em localStorage, lido no boot por
 * `src/app/layout.tsx` antes do primeiro paint). Sem "Sistema": só as duas opções que a pessoa
 * escolhe de fato. */
export function ThemeToggle() {
  const { t: traduzir } = useIdioma();
  const [tema, setTema] = useState<Tema>(temaAtual);

  function escolher(novoTema: Tema) {
    setTema(novoTema);
    aplicarTema(novoTema);
  }

  return (
    <div className="filters-row">
      <button
        type="button"
        className={`fchip${tema === "light" ? " active" : ""}`}
        aria-pressed={tema === "light"}
        onClick={() => escolher("light")}
      >
        {traduzir("Claro")}
      </button>
      <button
        type="button"
        className={`fchip${tema === "dark" ? " active" : ""}`}
        aria-pressed={tema === "dark"}
        onClick={() => escolher("dark")}
      >
        {traduzir("Escuro")}
      </button>
    </div>
  );
}

/**
 * O MESMO TEMA, EM LISTA — a forma que "Meu perfil" usa.
 *
 * Duas chips lado a lado funcionam numa tela de preferências com uma pergunta só; na página de
 * perfil, em que toda linha é rótulo à esquerda e campo à direita, elas seriam o único controle
 * fora de forma. A lista ocupa a mesma caixa que os campos ao redor.
 *
 * Não tem "Automático": o CRM nunca teve. Oferecer aqui uma terceira opção que o `layout.tsx` não
 * sabe aplicar daria uma escolha que não acontece.
 */
export function SeletorDeTema({ id }: { id?: string }) {
  const { t: traduzir } = useIdioma();
  const [tema, setTema] = useState<Tema>(temaAtual);

  return (
    <select
      id={id}
      className="input perfil-select"
      value={tema}
      onChange={(e) => {
        const novo = e.target.value as Tema;
        setTema(novo);
        aplicarTema(novo);
      }}
    >
      <option value="light">{traduzir("Claro")}</option>
      <option value="dark">{traduzir("Escuro")}</option>
    </select>
  );
}
