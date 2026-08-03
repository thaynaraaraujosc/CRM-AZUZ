"use client";

import { useState } from "react";

const CHAVE_TEMA = "azuz-crm-tema";
type Tema = "light" | "dark" | "system";

function aplicarSistema() {
  const escuro = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.setAttribute("data-theme", escuro ? "dark" : "light");
}

/** Tela clara, escura ou "seguir o sistema" — vale só nesse navegador (guardado em localStorage).
 * "Sistema" lê `prefers-color-scheme` uma vez ao escolher; não fica escutando mudança em tempo real
 * porque o resto do CRM já reage só ao atributo `data-theme`, não a media query direto. */
export function ThemeToggle() {
  const [tema, setTema] = useState<Tema>(() => {
    if (typeof window === "undefined") return "light";
    try {
      const salvo = localStorage.getItem(CHAVE_TEMA) as Tema | null;
      if (salvo === "system") return "system";
    } catch {
      // ignora — cai no fallback abaixo
    }
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  });

  function escolher(novoTema: Tema) {
    setTema(novoTema);
    if (novoTema === "system") {
      aplicarSistema();
    } else {
      document.documentElement.setAttribute("data-theme", novoTema);
    }
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
        ☀️ Tela clara
      </button>
      <button
        type="button"
        className={`fchip${tema === "dark" ? " active" : ""}`}
        aria-pressed={tema === "dark"}
        onClick={() => escolher("dark")}
      >
        🌙 Tela escura
      </button>
      <button
        type="button"
        className={`fchip${tema === "system" ? " active" : ""}`}
        aria-pressed={tema === "system"}
        onClick={() => escolher("system")}
      >
        Sistema
      </button>
    </div>
  );
}
