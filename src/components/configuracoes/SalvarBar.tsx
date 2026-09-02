"use client";

import { useState } from "react";
import { IconCheck } from "@/components/icons";

/**
 * Barra de "alterações não salvas" — aparece fixa no rodapé do painel sempre que o rascunho local
 * (`dirty`) diverge do que foi salvo. `onSalvar` é definido por quem usa o componente — cada seção
 * de Configurações já persiste de verdade (via `/api/preferencias/[chave]` ou rota própria), esse
 * componente só cuida da UI de "salvar/descartar".
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
        <span className="config-salvar-bar-ok"><IconCheck width={12} height={12} aria-hidden="true" /> {mensagemSalvo}</span>
      )}
    </div>
  );
}
