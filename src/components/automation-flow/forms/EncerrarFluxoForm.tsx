"use client";

import type { EncerrarFluxoData, MotivoParada } from "@/lib/automation-flow/types";

/**
 * Por que a automação parou aqui.
 *
 * O motivo não muda o que acontece: ele explica no histórico POR QUE aquele lead parou, que é o
 * que separa "deu tudo certo" de "ninguém respondeu" quando alguém for olhar a execução depois.
 * Sem isso, todo fim de fluxo vira "concluída" e a diferença some.
 */
const MOTIVOS: { valor: MotivoParada; label: string }[] = [
  { valor: "concluido", label: "Concluído" },
  { valor: "transferido", label: "Transferido para atendimento humano" },
  { valor: "sem_resposta", label: "Sem resposta" },
  { valor: "desqualificado", label: "Lead desqualificado" },
  { valor: "erro", label: "Erro" },
  { valor: "outro", label: "Outro motivo" },
];

export function EncerrarFluxoForm({
  data,
  onChange,
}: {
  data: EncerrarFluxoData;
  onChange: (data: EncerrarFluxoData) => void;
}) {
  return (
    <div className="flow-form">
      <div className="field">
        <label>Motivo</label>
        <select
          className="input"
          value={data.motivo ?? "concluido"}
          onChange={(e) => onChange({ ...data, motivo: e.target.value as MotivoParada })}
        >
          {MOTIVOS.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Observação</label>
        <input
          className="input"
          value={data.observacao ?? ""}
          onChange={(e) => onChange({ ...data, observacao: e.target.value })}
          placeholder="Opcional: o que aconteceu, em uma linha"
        />
        <p className="hint mt8">Aparece no histórico da execução, junto com o motivo.</p>
      </div>
    </div>
  );
}
