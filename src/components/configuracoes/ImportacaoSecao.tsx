"use client";

import { IconImportar } from "@/components/icons";
import { EmBreveVitrine } from "./EmBreveVitrine";
import { useIdioma } from "@/lib/idioma-context";

/** O assistente antigo era 100% simulado (nenhum arquivo era processado de verdade). Vira vitrine
 * até existir uma importação/exportação real. */
export function ImportacaoSecao() {
  const { t: traduzir } = useIdioma();
  return (
    <EmBreveVitrine
      titulo={traduzir("Importação e exportação")}
      descricao={traduzir("Trazer ou tirar dados do CRM.")}
      Icon={IconImportar}
      texto="Importar contatos e negócios de uma planilha, ou exportar o que já está no CRM, ainda não está disponível: em breve."
    />
  );
}
