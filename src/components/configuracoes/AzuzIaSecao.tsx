"use client";

import { IconSparkle } from "@/components/icons";
import { EmBreveVitrine } from "./EmBreveVitrine";
import { useIdioma } from "@/lib/idioma-context";

/** Mesma decisão de `/azuz-ia`: comportamento/dados/sugestões ainda não vão pro ar, então a
 * categoria também vira vitrine em vez de um formulário que configuraria algo inexistente. */
export function AzuzIaSecao() {
  const { t: traduzir } = useIdioma();
  return (
    <EmBreveVitrine
      titulo="Azuz IA"
      descricao={traduzir("Comportamento, dados permitidos e sugestões.")}
      Icon={IconSparkle}
      texto="Estamos trabalhando pra trazer uma assistente que entende os dados reais do seu workspace (leads, conversas, tarefas e funil). As preferências de comportamento ficam disponíveis aqui assim que a Azuz IA voltar a funcionar."
    />
  );
}
