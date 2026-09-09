"use client";

import { useState } from "react";

import { Topbar } from "@/components/ui";
import { AbasAutomacoes } from "@/components/automacoes/AbasAutomacoes";
import { AutomacaoDoFunil } from "@/components/funil/AutomacaoDoFunil";
import { useFunis } from "@/lib/funis-context";

/**
 * "Automatizar funil" dentro de Automações: escolher ONDE automatizar antes de automatizar.
 *
 * A mesma grade que aparece no quadro do funil, mas alcançada pelo caminho de quem já está
 * pensando em automação. Quem entra em Automações quer ligar alguma coisa: obrigar a pessoa a ir
 * até o Funil, achar o botão e voltar é fazer ela sair do lugar onde já estava com a intenção
 * certa.
 *
 * É a mesma tela, não uma cópia: o mesmo componente e a mesma API dos dois lados. Duas telas que
 * fazem a mesma coisa divergem na primeira correção feita só numa delas.
 */
export default function AutomatizarFunilPage() {
  const { funis } = useFunis();
  const [funilId, setFunilId] = useState<string>("");

  // O primeiro funil já vem escolhido, por derivação e não por efeito: abrir numa tela vazia com
  // um seletor obriga a um clique que não decide nada quando só existe um funil, que é o caso
  // comum. Derivar evita a renderização extra (e o aviso do lint) de um `setState` dentro de
  // efeito só pra escolher um padrão.
  const funilAberto = funilId || funis[0]?.id || "";
  const funil = funis.find((f) => f.id === funilAberto);

  return (
    <>
      <Topbar title="Automatizar funil" sub="O que cada etapa faz sozinha quando um lead entra" />
      <AbasAutomacoes />

      <section className="card">
        <div className="field" style={{ maxWidth: 340 }}>
          <label>Qual funil você quer automatizar</label>
          <select className="input" value={funilAberto} onChange={(e) => setFunilId(e.target.value)}>
            {funis.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
          <p className="hint mt8">
            Vale junto com as automações que têm gatilho próprio: uma não desliga a outra.
          </p>
        </div>
      </section>

      {funil ? (
        <AutomacaoDoFunil
          funilId={funil.id}
          funilNome={funil.nome}
          colunas={funil.colunas.map((c) => ({ id: c.id, titulo: c.titulo, total: c.total }))}
        />
      ) : (
        <section className="card">
          <p className="hint">Nenhum funil criado ainda. Crie um em Funil pra automatizar as etapas.</p>
        </section>
      )}
    </>
  );
}
