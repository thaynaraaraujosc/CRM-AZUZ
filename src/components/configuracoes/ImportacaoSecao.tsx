"use client";

import { IconImportar } from "@/components/icons";
import { EmBreveVitrine } from "./EmBreveVitrine";

/** O assistente antigo era 100% simulado (nenhum arquivo era processado de verdade) — vira vitrine
 * até existir uma importação/exportação real. */
export function ImportacaoSecao() {
  return (
    <EmBreveVitrine
      titulo="Importação e exportação"
      descricao="Trazer ou tirar dados do CRM."
      Icon={IconImportar}
      texto="Importar contatos e negócios de uma planilha, ou exportar o que já está no CRM, ainda não está disponível — em breve."
    />
  );
}
