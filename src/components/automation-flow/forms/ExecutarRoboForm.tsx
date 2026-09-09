"use client";

import { useEffect, useState } from "react";

import type { ExecutarRoboData } from "@/lib/automation-flow/types";

/**
 * Escolha do robô que este bloco começa.
 *
 * O robô chamado corre por conta dele e este fluxo segue: dá pra chamar o robô de cobrança no
 * meio de uma conversa sem abandonar o que estava acontecendo.
 */
export function ExecutarRoboForm({
  data,
  fluxoAtualId,
  onChange,
}: {
  data: ExecutarRoboData;
  /** O fluxo que está aberto. Ele não aparece na lista: um robô que chama a si mesmo não para. */
  fluxoAtualId?: string;
  onChange: (data: ExecutarRoboData) => void;
}) {
  const [robos, setRobos] = useState<{ id: string; nome: string; status?: string }[]>([]);

  useEffect(() => {
    let vivo = true;
    fetch("/api/automacoes-fluxos")
      .then((r) => (r.ok ? r.json() : []))
      .then((lista: { id: string; nome: string; status?: string }[]) => {
        if (vivo) setRobos(lista.map((f) => ({ id: f.id, nome: f.nome, status: f.status })));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const disponiveis = robos.filter((r) => r.id !== fluxoAtualId);

  return (
    <div className="flow-form">
      <div className="field">
        <label>Robô</label>
        <select
          className="input"
          value={data.fluxoId ?? ""}
          onChange={(e) => {
            const escolhido = disponiveis.find((r) => r.id === e.target.value);
            // O nome vai junto só pra tela: o resumo do bloco no quadro não pode mostrar um id.
            onChange({ ...data, fluxoId: e.target.value, fluxoNome: escolhido?.nome });
          }}
        >
          <option value="">Nenhum robô selecionado</option>
          {disponiveis.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nome}
              {r.status === "publicado" ? "" : " (rascunho)"}
            </option>
          ))}
        </select>
        <p className="hint mt8">
          O robô escolhido começa pro mesmo contato, e este fluxo continua no próximo passo. Ele
          precisa estar publicado pra rodar.
        </p>
      </div>
    </div>
  );
}
