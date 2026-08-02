"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { FlowEditor } from "@/components/automation-flow/FlowEditor";
import { useAutomationFlows } from "@/lib/automation-flow-context";

/**
 * `id` é ou o id de um `FluxoAutomacao` existente, ou o literal "novo" — nesse
 * caso a gente cria um rascunho vazio uma vez (em `useEffect`, não na
 * inicialização preguiçosa de `useState`, pra não mexer no estado do
 * `AutomationFlowProvider` no meio da renderização dessa página) e troca a URL
 * pro id de verdade, mas o editor já usa o id novo antes mesmo da URL virar.
 */
export default function EditorFluxoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { fluxos, criarFluxo } = useAutomationFlows();
  const router = useRouter();
  const [idCriado, setIdCriado] = useState<string | null>(null);

  useEffect(() => {
    if (id !== "novo" || idCriado) return;
    const criado = criarFluxo({ nome: "Nova automação" });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- criação única de rascunho ao montar com id="novo", precisa do id novo pra renderizar o editor antes mesmo da URL trocar.
    setIdCriado(criado.id);
    router.replace(`/automacoes/editor/${criado.id}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fluxoId = id === "novo" ? idCriado : id;

  if (!fluxoId) {
    return (
      <div className="flow-shell-empty">
        <p>Criando nova automação…</p>
      </div>
    );
  }

  if (id !== "novo" && !fluxos.some((f) => f.id === fluxoId)) {
    return (
      <div className="flow-shell-empty">
        <p>Esse fluxo não existe (mais).</p>
      </div>
    );
  }

  return <FlowEditor fluxoId={fluxoId} key={fluxoId} />;
}
