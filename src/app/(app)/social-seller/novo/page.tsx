"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Topbar } from "@/components/ui";
import { GaleriaDeModelos } from "@/components/automacoes/GaleriaDeModelos";
import { useAutomationFlows } from "@/lib/automation-flow-context";
import type { ModeloDeRobo } from "@/lib/automacoes/modelos-de-robo";
import { useIdioma } from "@/lib/idioma-context";

/**
 * CRIAR AUTOMAÇÃO DO SOCIAL SELLER — a mesma galeria do funil, com os modelos de Instagram.
 *
 * "Quando eu clicar em criar automação, ao invés de aparecer essa página onde aparece começar com
 * o modelo, criar do zero, descrever, vai aparecer uma página igual a que criamos para o CRM, com
 * todos os modelos do Instagram que você já fez. Aí, quando eu clicar em um modelo, ele já vai
 * aparecer montado. E aí tem a opção, aparece lá criar do zero, igualzinho a gente criou para a
 * entrada do CRM."
 *
 * O QUE SAIU DAQUI, e por quê:
 *
 * - Os três cartões ("Começar com um modelo", "Criar do zero", "Descrever pra IA montar") eram
 *   uma escolha ANTES da escolha: dois cliques pra chegar nos modelos, que é onde a decisão
 *   acontece de verdade. A galeria já tem "Começar do zero" no canto, então o caminho de quem
 *   sabe o que quer continua existindo — com um clique a menos.
 * - "Descrever pra IA montar" estava desligado e escrito "Em breve". Um cartão de tamanho igual
 *   aos outros dois ocupando um terço da tela pra anunciar algo que não existe custa caro: é um
 *   terço da atenção gasto no único caminho que não leva a lugar nenhum. Quando a IA montar
 *   automação de verdade, ela volta — e aí valendo.
 * - A migalha "Automações › Nova automação" foi embora junto. Ela dizia que esta tela fica dentro
 *   do módulo Automações, e não fica: "Social Seller é Social Seller, lá em Automações é
 *   automações de WhatsApp ou de outras coisas".
 *
 * O componente da galeria é o MESMO do funil, com `area="social"`. Duas galerias parecidas
 * divergiriam na primeira correção feita só de um lado — e a pessoa ia sentir a diferença sem
 * saber nomear.
 */
export default function NovaAutomacaoSocialPage() {
  const { t: traduzir } = useIdioma();
  const router = useRouter();
  const { criarFluxo } = useAutomationFlows();
  const [criando, setCriando] = useState(false);

  function doZero() {
    if (criando) return;
    setCriando(true);
    const novo = criarFluxo({ nome: "Sem título", area: "social" });
    router.push(`/social-seller/editor/${novo.id}`);
  }

  function doModelo(modelo: ModeloDeRobo) {
    if (criando) return;
    setCriando(true);
    const { nodes, edges, configuracoes } = modelo.construir();
    /*
     * RASCUNHO, SEMPRE. Publicar sozinho ligaria uma automação que ninguém leu, respondendo
     * cliente de verdade com texto de exemplo — e no Instagram isso é público: a resposta ao
     * comentário aparece debaixo da publicação, pra todo mundo.
     */
    const novo = criarFluxo({
      nome: modelo.nome,
      descricao: modelo.objetivo,
      area: "social",
      nodes,
      edges,
      configuracoes,
    });
    router.push(`/social-seller/editor/${novo.id}`);
  }

  return (
    <>
      <Topbar title={traduzir("Criar automação")} sub="Social Seller" />

      <div className="content content-novo-robo">
        <GaleriaDeModelos
          area="social"
          comoPagina
          ocupado={criando}
          aoEscolher={doModelo}
          aoComecarDoZero={doZero}
          aoFechar={() => router.push("/social-seller/automacoes")}
        />
      </div>
    </>
  );
}
