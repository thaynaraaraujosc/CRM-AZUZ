import { describe, expect, it } from "vitest";

import type { FluxoAutomacao } from "@/lib/automation-flow/types";
import { validarFluxo } from "@/lib/automation-flow/validacao";
import { MODELOS_COMERCIAIS, type ContextoModelo } from "../modelos-comerciais";

/**
 * Um modelo que não publica é pior do que modelo nenhum.
 *
 * Quem clica em "Começar com um modelo" espera trocar o texto e publicar. Se a validação recusar,
 * a pessoa fica com um robô quebrado que ela não montou e não sabe consertar. Então cada modelo é
 * validado aqui pelo MESMO `validarFluxo` que a tela usa, e em três posições diferentes do funil:
 * na primeira etapa, no meio e na última, porque "avança pra próxima etapa" se comporta diferente
 * em cada uma e a última não tem próxima.
 */
const ETAPAS = [
  { id: "novo", titulo: "Novo" },
  { id: "qualificado", titulo: "Qualificado" },
  { id: "proposta", titulo: "Proposta" },
  { id: "fechado", titulo: "Fechado" },
];

function contexto(etapaId: string): ContextoModelo {
  return { funilId: "funil-principal", etapas: ETAPAS, etapaId };
}

function comoFluxo(
  modelo: (typeof MODELOS_COMERCIAIS)[number],
  ctx: ContextoModelo,
): FluxoAutomacao {
  const { nodes, edges, configuracoes } = modelo.construir(ctx);
  return {
    nome: modelo.nome,
    nodes,
    edges,
    configuracoes,
    // Gatilho na etapa é o padrão dos modelos comerciais. O único que traz gatilho próprio no
    // canvas ("Lead parado") também passa por aqui: sobrar gatilho não é problema.
    funilId: ctx.funilId,
    etapaId: ctx.etapaId,
  } as FluxoAutomacao;
}

describe("modelos AZUZ do funil comercial", () => {
  it("existem e cada um se descreve", () => {
    expect(MODELOS_COMERCIAIS.length).toBeGreaterThanOrEqual(6);
    MODELOS_COMERCIAIS.forEach((m) => {
      expect(m.nome.trim()).not.toBe("");
      expect(m.descricao.trim()).not.toBe("");
      expect(m.ajustar.trim()).not.toBe("");
      expect(m.ondeCostumaViver.trim()).not.toBe("");
    });
  });

  ETAPAS.forEach((etapa) => {
    MODELOS_COMERCIAIS.forEach((modelo) => {
      it(`"${modelo.nome}" publica sem erro na etapa "${etapa.titulo}"`, () => {
        const problemas = validarFluxo(comoFluxo(modelo, contexto(etapa.id)));
        const erros = problemas.filter((p) => p.severidade === "erro").map((p) => p.mensagem);
        expect(erros).toEqual([]);
      });
    });
  });

  it("nenhum modelo deixa bloco solto ou id repetido", () => {
    MODELOS_COMERCIAIS.forEach((modelo) => {
      const { nodes, edges } = modelo.construir(contexto("qualificado"));
      const ids = nodes.map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
      // Toda aresta liga dois blocos que existem: um alvo inexistente não aparece na validação e
      // some do canvas sem aviso nenhum.
      edges.forEach((e) => {
        expect(ids).toContain(e.source);
        expect(ids).toContain(e.target);
      });
    });
  });

  it("só fala pelo WhatsApp, porque o funil comercial é do WhatsApp", () => {
    MODELOS_COMERCIAIS.forEach((modelo) => {
      modelo.construir(contexto("novo")).nodes.forEach((n) => {
        const canal = (n.data as { canal?: string }).canal;
        if (canal) expect(canal).toBe("whatsapp");
      });
    });
  });
});
