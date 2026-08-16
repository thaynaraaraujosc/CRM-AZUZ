"use client";

import { useState } from "react";

const CHAVE_TEMA = "azuz-crm-tema";
type Tema = "light" | "dark";

/** Tela clara ou escura — vale só nesse navegador (guardado em localStorage, lido no boot por
 * `src/app/layout.tsx` antes do primeiro paint). Sem "Sistema": só as duas opções que a pessoa
 * escolhe de fato. */
export function ThemeToggle() {
  const [tema, setTema] = useState<Tema>(() => {
    if (typeof window === "undefined") return "light";
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  });

  function escolher(novoTema: Tema) {
    setTema(novoTema);
    document.documentElement.setAttribute("data-theme", novoTema);
    try {
      localStorage.setItem(CHAVE_TEMA, novoTema);
    } catch {
      // localStorage indisponível (modo privado etc.) — só não persiste entre sessões
    }
  }

  return (
    <div className="filters-row">
      <button
        type="button"
        className={`fchip${tema === "light" ? " active" : ""}`}
        aria-pressed={tema === "light"}
        onClick={() => escolher("light")}
      >
        Claro
      </button>
      <button
        type="button"
        className={`fchip${tema === "dark" ? " active" : ""}`}
        aria-pressed={tema === "dark"}
        onClick={() => escolher("dark")}
      >
        Escuro
      </button>
    </div>
  );
}
