"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { FlowEditor } from "@/components/automation-flow/FlowEditor";
import { useAutomationFlows } from "@/lib/automation-flow-context";
import { useIdioma } from "@/lib/idioma-context";

/**
 * O EDITOR DO SOCIAL SELLER, no endereço do Social Seller.
 *
 * É o mesmo editor de `/automacoes/editor/[id]` — mesmo componente, mesmo motor, mesmas
 * execuções. O que muda é o ENDEREÇO, e o endereço é o que a barra lateral lê pra decidir qual
 * módulo está aceso. Enquanto os dois moravam em `/automacoes/...`, abrir um robô do Instagram
 * acendia "Automações" na lateral e nas abas: o CRM afirmava que ela estava no outro bloco.
 *
 * A rota SE CORRIGE: robô comercial aberto por aqui é mandado pro endereço de Automações. Assim
 * nenhum link velho leva pra tela errada, e nenhuma das duas telas precisa confiar em quem
 * chamou.
 */
export default function EditorSocialPage({ params }: { params: Promise<{ id: string }> }) {
  const { t: traduzir } = useIdioma();
  const { id } = use(params);
  const { fluxos, criarFluxo } = useAutomationFlows();
  const router = useRouter();
  const [idCriado, setIdCriado] = useState<string | null>(null);

  useEffect(() => {
    if (id !== "novo" || idCriado) return;
    const criado = criarFluxo({ nome: "Nova automação", area: "social" });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- criação única de rascunho ao montar com id="novo", precisa do id novo pra renderizar o editor antes mesmo da URL trocar.
    setIdCriado(criado.id);
    router.replace(`/social-seller/editor/${criado.id}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fluxoId = id === "novo" ? idCriado : id;
  const fluxo = fluxoId ? fluxos.find((f) => f.id === fluxoId) : null;

  // Robô do funil aberto pelo endereço do Social Seller: vai pro endereço dele. `replace` e não
  // `push` porque o endereço errado não merece uma parada no histórico.
  useEffect(() => {
    if (fluxo && fluxo.area !== "social") router.replace(`/automacoes/editor/${fluxo.id}`);
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

  if (fluxo && fluxo.area !== "social") {
    return (
      <div className="flow-shell-empty">
        <p>{traduzir("Abrindo em Automações…")}</p>
      </div>
    );
  }

  return <FlowEditor fluxoId={fluxoId} key={fluxoId} />;
}
