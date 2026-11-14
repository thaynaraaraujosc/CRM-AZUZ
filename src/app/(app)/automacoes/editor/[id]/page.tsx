"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { FlowEditor } from "@/components/automation-flow/FlowEditor";
import { useAutomationFlows } from "@/lib/automation-flow-context";
import { useIdioma } from "@/lib/idioma-context";

/**
 * `id` é ou o id de um `FluxoAutomacao` existente, ou o literal "novo": nesse
 * caso a gente cria um rascunho vazio uma vez (em `useEffect`, não na
 * inicialização preguiçosa de `useState`, pra não mexer no estado do
 * `AutomationFlowProvider` no meio da renderização dessa página) e troca a URL
 * pro id de verdade, mas o editor já usa o id novo antes mesmo da URL virar.
 */
export default function EditorFluxoPage({ params }: { params: Promise<{ id: string }> }) {
  const { t: traduzir } = useIdioma();
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
  const fluxo = fluxoId ? fluxos.find((f) => f.id === fluxoId) : null;

  /*
   * ROBÔ DO INSTAGRAM ABERTO AQUI VAI PRO ENDEREÇO DO SOCIAL SELLER.
   *
   * "Social Seller é Social Seller, lá em Automações é automações de WhatsApp ou de outras
   * coisas." A barra lateral e as abas leem o começo da URL pra decidir o que acender: enquanto
   * um robô social abrir em `/automacoes/...`, o CRM vai continuar afirmando que ela está em
   * Automações, por mais que a tela diga outra coisa.
   *
   * Vale pra link velho, favorito e histórico — e é por isso que a correção mora na rota, e não
   * em cada um dos dez lugares que levam ao editor.
   */
  useEffect(() => {
    if (fluxo && fluxo.area === "social") router.replace(`/social-seller/editor/${fluxo.id}`);
  }, [fluxo, router]);

  if (!fluxoId) {
    return (
      <div className="flow-shell-empty">
        <p>{traduzir("Criando nova automação…")}</p>
      </div>
    );
  }

  if (id !== "novo" && !fluxo) {
    return (
      <div className="flow-shell-empty">
        <p>{traduzir("Esse fluxo não existe (mais).")}</p>
      </div>
    );
  }

  if (fluxo && fluxo.area === "social") {
    return (
      <div className="flow-shell-empty">
        <p>{traduzir("Abrindo no Social Seller…")}</p>
      </div>
    );
  }

  return <FlowEditor fluxoId={fluxoId} key={fluxoId} />;
}
