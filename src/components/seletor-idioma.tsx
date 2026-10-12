"use client";

import { useIdioma } from "@/lib/idioma-context";

/**
 * Chave PT/EN no topo do CRM. Fica no cabeçalho, e não escondida em Configurações, porque quem mais
 * precisa dela é quem está entrando pela primeira vez e não lê português: o analista da Meta, que
 * recebe um acesso de demonstração e tem que conseguir navegar sozinho. Um seletor que só se acha
 * depois de entender o menu em português não serviria pra isso.
 *
 * Duas letras em vez de "Português/English" por espaço: o cabeçalho divide a linha com a busca
 * global e o sino de notificações.
 */
export function SeletorIdioma() {
  const { idioma, definirIdioma } = useIdioma();

  return (
    <div className="seletor-idioma" role="group" aria-label={idioma === "en" ? "Language" : "Idioma"}>
      <button
        type="button"
        onClick={() => definirIdioma("pt")}
        aria-pressed={idioma === "pt"}
        className={idioma === "pt" ? "ativo" : undefined}
        title="Português"
      >
        PT
      </button>
      <button
        type="button"
        onClick={() => definirIdioma("en")}
        aria-pressed={idioma === "en"}
        className={idioma === "en" ? "ativo" : undefined}
        title="English"
      >
        EN
      </button>
    </div>
  );
}
