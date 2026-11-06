import { describe, expect, it } from "vitest";

import { CORES_DA_ETAPA } from "@/lib/funil/etapa-aparencia";
import { ETAPAS_DO_FUNIL_PADRAO, montarFunilPadrao } from "@/lib/funil/funil-padrao";

describe("o funil que toda conta nova já nasce com", () => {
  it("tem as seis etapas, na ordem em que elas acontecem", () => {
    // "Proposta" antes de "Fechado": é essa a ordem do atendimento, e a ordem é o funil.
    expect(ETAPAS_DO_FUNIL_PADRAO.map((e) => e.titulo)).toEqual([
      "Novo lead",
      "Qualificado",
      "Follow-up",
      "Proposta",
      "Fechado",
      "Retorno",
    ]);
  });

  it("só usa cor da paleta fechada", () => {
    // Cor fora da paleta é descartada na leitura (`lerCorDaEtapa`), e a etapa apareceria sem cor
    // nenhuma depois de gravada — um defeito que só aparece no segundo acesso.
    for (const etapa of ETAPAS_DO_FUNIL_PADRAO) {
      expect(CORES_DA_ETAPA as readonly string[], etapa.titulo).toContain(etapa.cor);
    }
  });

  it("os ids saem do workspace e a ordem começa em zero", () => {
    const f = montarFunilPadrao("empresa-x");
    expect(f.id).toBe("empresa-x-funil");
    expect(f.etapas[0]).toMatchObject({ id: "empresa-x-etapa-1", ordem: 0 });
    expect(f.etapas.at(-1)).toMatchObject({ id: "empresa-x-etapa-6", ordem: 5 });
    // Ids previsíveis: criar duas vezes falha por chave duplicada em vez de duplicar o funil.
    expect(new Set(f.etapas.map((e) => e.id)).size).toBe(6);
  });
});
