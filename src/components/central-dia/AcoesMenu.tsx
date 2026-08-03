"use client";

import { useRef, useState } from "react";

import { FloatingDropdown } from "@/components/ui";
import type { AcaoItemDia } from "@/lib/central-dia/tipos";

/** Menu "•••" de ações secundárias — mesmo padrão de popover flutuante (`FloatingDropdown`) usado no
 * resto do CRM, só que embrulhado numa lista de ações simples pra não repetir o boilerplate de
 * ref+anchorRect em cada card. */
export function AcoesMenu({ acoes, label = "Mais ações" }: { acoes: AcaoItemDia[]; label?: string }) {
  const [aberto, setAberto] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  if (acoes.length === 0) return null;

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        className="icon-btn subtle"
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={aberto}
        onClick={() => {
          setAnchorRect(btnRef.current?.getBoundingClientRect() ?? null);
          setAberto((v) => !v);
        }}
      >
        •••
      </button>
      {aberto ? (
        <FloatingDropdown anchorRect={anchorRect} align="right" onClose={() => setAberto(false)} width={220}>
          {acoes.map((acao) => (
            <a
              key={acao.label}
              href={acao.href ?? "#"}
              className="dropdown-item"
              style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
              onClick={(e) => {
                if (!acao.href) e.preventDefault();
                acao.onClick?.();
                setAberto(false);
              }}
            >
              <span className="n">{acao.label}</span>
            </a>
          ))}
        </FloatingDropdown>
      ) : null}
    </>
  );
}
