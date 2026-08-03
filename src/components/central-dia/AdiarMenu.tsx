"use client";

import { useRef, useState } from "react";

import { FloatingDropdown } from "@/components/ui";
import type { PeriodoAdiamento } from "@/lib/central-dia-context";

const OPCOES: { periodo: PeriodoAdiamento; label: string }[] = [
  { periodo: "mais_tarde_hoje", label: "Mais tarde hoje" },
  { periodo: "amanha", label: "Amanhã" },
  { periodo: "proxima_semana", label: "Próxima semana" },
  { periodo: "data_escolhida", label: "Escolher data e horário" },
];

/** Botão "Adiar" — abre as opções do item 13 do pedido. Front-end apenas: guarda a escolha no
 * context (`adiarItem`), nunca agenda nada de verdade. */
export function AdiarMenu({ onAdiar }: { onAdiar: (periodo: PeriodoAdiamento, data?: string, hora?: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [escolhendoData, setEscolhendoData] = useState(false);
  const [data, setData] = useState("");
  const [hora, setHora] = useState("09:00");
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        type="button"
        className="btn ghost"
        ref={btnRef}
        onClick={() => {
          setAnchorRect(btnRef.current?.getBoundingClientRect() ?? null);
          setEscolhendoData(false);
          setAberto((v) => !v);
        }}
      >
        Adiar
      </button>
      {aberto ? (
        <FloatingDropdown anchorRect={anchorRect} align="right" onClose={() => setAberto(false)} width={240}>
          {!escolhendoData ? (
            OPCOES.map((o) => (
              <button
                type="button"
                key={o.periodo}
                className="dropdown-item"
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => {
                  if (o.periodo === "data_escolhida") {
                    setEscolhendoData(true);
                    return;
                  }
                  onAdiar(o.periodo);
                  setAberto(false);
                }}
              >
                <span className="n">{o.label}</span>
              </button>
            ))
          ) : (
            <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="field">
                <label>Data</label>
                <input className="input" type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </div>
              <div className="field">
                <label>Horário</label>
                <input className="input" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
              </div>
              <button
                type="button"
                className="btn primary block"
                disabled={!data}
                onClick={() => {
                  onAdiar("data_escolhida", data, hora);
                  setAberto(false);
                }}
              >
                Confirmar
              </button>
            </div>
          )}
        </FloatingDropdown>
      ) : null}
    </>
  );
}
