"use client";

import type { ReagirMensagemData } from "@/lib/automation-flow/types";

/**
 * O emoji da reação.
 *
 * A lista rápida cobre o que se usa numa conversa de atendimento; o campo aceita qualquer emoji
 * pra quem quiser outro. Reage à última mensagem que o CONTATO mandou, não à nossa.
 */
const RAPIDOS = ["❤️", "👍", "✅", "🙏", "😀", "🎉", "👏", "🔥"];

export function ReagirMensagemForm({
  data,
  onChange,
}: {
  data: ReagirMensagemData;
  onChange: (data: ReagirMensagemData) => void;
}) {
  return (
    <div className="flow-form">
      <div className="field">
        <label>Emoji</label>
        <div className="reagir-rapidos">
          {RAPIDOS.map((e) => (
            <button
              key={e}
              type="button"
              className={`reagir-emoji${data.emoji === e ? " on" : ""}`}
              onClick={() => onChange({ ...data, emoji: e })}
              aria-label={`Reagir com ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
        <input
          className="input mt8"
          value={data.emoji ?? ""}
          onChange={(e) => onChange({ ...data, emoji: e.target.value })}
          placeholder="Ou cole outro emoji"
          maxLength={8}
        />
        <p className="hint mt8">
          Reage à última mensagem que o contato mandou. Se ele ainda não escreveu nada, não há a que
          reagir e o passo é registrado como não feito, sem derrubar o fluxo.
        </p>
      </div>
    </div>
  );
}
