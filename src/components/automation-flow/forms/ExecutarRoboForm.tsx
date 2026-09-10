"use client";

import { useEffect, useState } from "react";

import type { AreaAutomacao } from "@/lib/canais/capacidades";

import type { ExecutarRoboData } from "@/lib/automation-flow/types";

/**
 * Escolha do robô que este bloco começa.
 *
 * O robô chamado corre por conta dele e este fluxo segue: dá pra chamar o robô de cobrança no
 * meio de uma conversa sem abandonar o que estava acontecendo.
 */
export function ExecutarRoboForm({
  data,
  area,
  fluxoAtualId,
  onChange,
}: {
  data: ExecutarRoboData;
  /** Comercial ou social: só robôs da mesma área podem ser chamados. */
  area: AreaAutomacao;
  /** O fluxo que está aberto. Ele não aparece na lista: um robô que chama a si mesmo não para. */
  fluxoAtualId?: string;
  onChange: (data: ExecutarRoboData) => void;
}) {
  const [robos, setRobos] = useState<{ id: string; nome: string; status?: string; area?: string }[]>([]);

  useEffect(() => {
    let vivo = true;
    fetch("/api/automacoes-fluxos")
      .then((r) => (r.ok ? r.json() : []))
      .then((lista: { id: string; nome: string; status?: string; area?: string }[]) => {
        if (vivo) setRobos(lista.map((f) => ({ id: f.id, nome: f.nome, status: f.status, area: f.area })));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  // Só robôs da MESMA área. Um robô do Instagram chamado por um fluxo comercial (ou o contrário)
  // aparecia na lista, era escolhido, e não rodava: o motor recusa por área em
  // `areaCombina`. Escolher uma opção que nunca vai acontecer é pior do que não ter a opção.
  // Fluxo sem área é anterior à separação e conta como comercial, igual ao resto do sistema.
  const disponiveis = robos.filter(
    (r) => r.id !== fluxoAtualId && ((r.area as AreaAutomacao) ?? "comercial") === area,
  );

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
