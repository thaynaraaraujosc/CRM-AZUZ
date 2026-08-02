"use client";

import { useRef, useState } from "react";

import { FloatingDropdown } from "@/components/ui";
import { VARIAVEIS_MENSAGEM } from "./variaveis";

/** Botão "Inserir variável" — abre a lista de tokens da spec seção 4 e devolve o escolhido. */
export function VariavelDropdown({ onEscolher }: { onEscolher: (token: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        className="btn ghost"
        onClick={(e) => {
          setRect(e.currentTarget.getBoundingClientRect());
          setAberto((v) => !v);
        }}
      >
        Inserir variável ▾
      </button>
      <FloatingDropdown anchorRect={aberto ? rect : null} onClose={() => setAberto(false)} width={220}>
        {VARIAVEIS_MENSAGEM.map((v) => (
          <button
            key={v.token}
            type="button"
            className="dropdown-item"
            style={{ width: "100%", textAlign: "left" }}
            onClick={() => {
              onEscolher(v.token);
              setAberto(false);
            }}
          >
            <span className="n">{v.label}</span>
            <span className="r">{v.token}</span>
          </button>
        ))}
      </FloatingDropdown>
    </>
  );
}
