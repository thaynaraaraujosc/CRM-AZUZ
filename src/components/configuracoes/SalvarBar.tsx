"use client";

import { useState } from "react";

/**
 * Barra de "alterações não salvas" (item 41) — aparece fixa no rodapé do painel sempre que o rascunho
 * local (`dirty`) diverge do que foi salvo. Front-end apenas: "salvar" só grava no state/localStorage
 * do context, nunca chama uma API real.
 */
export function SalvarBar({
  dirty,
  onSalvar,
  onDescartar,
  mensagemSalvo = "Alterações salvas.",
}: {
  dirty: boolean;
  onSalvar: () => void;
  onDescartar: () => void;
  mensagemSalvo?: string;
}) {
  const [salvo, setSalvo] = useState(false);

  if (!dirty && !salvo) return null;

  return (
    <div className="config-salvar-bar">
      {dirty ? (
        <>
          <span className="hint">Você possui alterações não salvas.</span>
          <div className="config-salvar-bar-acoes">
            <button type="button" className="btn ghost" onClick={onDescartar}>
              Descartar
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                onSalvar();
                setSalvo(true);
                setTimeout(() => setSalvo(false), 2500);
              }}
            >
              Salvar alterações
            </button>
          </div>
        </>
      ) : (
        <span className="config-salvar-bar-ok">✓ {mensagemSalvo}</span>
      )}
    </div>
  );
}
