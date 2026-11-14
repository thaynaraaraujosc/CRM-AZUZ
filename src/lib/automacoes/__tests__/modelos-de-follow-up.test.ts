import { describe, expect, it } from "vitest";

import { MODELOS_DE_ROBO } from "@/lib/automacoes/modelos-de-robo";
import { validarFluxo } from "@/lib/automation-flow/validacao";
import type { FluxoAutomacao } from "@/lib/automation-flow/types";

/**
 * Os quatro modelos de follow-up, e as duas coisas que precisam continuar verdadeiras neles.
 *
 * 1. PARAM QUANDO A PESSOA RESPONDE. É o ponto inteiro: um follow-up que manda "vi que você não
 *    me deu retorno" pra quem respondeu dez minutos antes é pior do que não ter follow-up.
 * 2. RESPEITAM A JANELA DE 24H DA API OFICIAL. Na conta oficial, texto livre fora da janela
 *    simplesmente não é entregue — e a automação não tem como saber que o cliente nunca recebeu.
 */

const FOLLOW_UPS = [
  "follow-up-ainda-tem-interesse",
  "follow-up-tres-toques",
  "follow-up-janela-24h",
  "follow-up-modelo-aprovado",
];

/** O fluxo mínimo que o validador precisa, montado a partir do modelo. */
function comoFluxo(id: string): FluxoAutomacao {
  const { nodes, edges, configuracoes } = modelo(id).construir();
  return {
    id: `teste-${id}`,
    nome: modelo(id).nome,
    status: "rascunho",
    nodes,
    edges,
    configuracoes,
  } as unknown as FluxoAutomacao;
}

function modelo(id: string) {
  const m = MODELOS_DE_ROBO.find((x) => x.id === id);
  if (!m) throw new Error(`modelo "${id}" sumiu do catálogo`);
  return m;
}

describe("os modelos de follow-up", () => {
  it("são quatro: dois pro WhatsApp QR Code e dois pra API oficial", () => {
    // "2 para WhatsApp normal e 2 para WhatsApp API oficial."
    const qrcode = FOLLOW_UPS.filter((id) => modelo(id).canais.join() === "whatsapp_qrcode");
    const oficial = FOLLOW_UPS.filter((id) => modelo(id).canais.join() === "whatsapp_oficial");

    expect(qrcode).toEqual(["follow-up-ainda-tem-interesse", "follow-up-tres-toques"]);
    expect(oficial).toEqual(["follow-up-janela-24h", "follow-up-modelo-aprovado"]);
  });

  it("toda espera para na hora em que o lead responde", () => {
    for (const id of FOLLOW_UPS) {
      const { nodes, edges } = modelo(id).construir();
      const esperas = nodes.filter((n) => n.type === "aguardar");
      expect(esperas.length, `${id} sem bloco de espera`).toBeGreaterThan(0);

      for (const espera of esperas) {
        const data = espera.data as { modo?: string; interromperSeResponder?: boolean };
        const paraSeResponder = data.interromperSeResponder === true || data.modo === "ate_resposta";
        expect(paraSeResponder, `${id}: a espera "${espera.id}" não para quando o lead responde`).toBe(true);

        // E os dois caminhos precisam estar LIGADOS: só configurar não basta, o "respondeu" tem
        // que ir pra algum lugar, senão o lead que responde fica pendurado no meio do fluxo.
        const saidas = edges.filter((e) => e.source === espera.id).map((e) => e.sourceHandle);
        expect(saidas, `${id}: a espera "${espera.id}" não trata os dois fins`).toEqual(
          expect.arrayContaining(["ok", "timeout"]),
        );
      }
    }
  });

  it("os da API oficial não mandam texto livre fora da janela de 24 horas", () => {
    /*
     * A conta: a espera ANTES de um texto livre precisa caber dentro das 24 horas. O modelo que
     * precisa falar depois disso usa `mensagem_modelo_whatsapp`, que é o único envio que a Meta
     * aceita fora da janela.
     */
    const LIVRES = new Set(["mensagem_texto", "mensagem_botoes", "mensagem_lista"]);

    for (const id of ["follow-up-janela-24h", "follow-up-modelo-aprovado"]) {
      const { nodes, edges } = modelo(id).construir();
      const porId = new Map(nodes.map((n) => [n.id, n]));

      for (const espera of nodes.filter((n) => n.type === "aguardar")) {
        const data = espera.data as { modo?: string; valor?: number };
        const horas =
          data.modo === "horas" ? (data.valor ?? 0) : data.modo === "dias" ? (data.valor ?? 0) * 24 : 0;
        if (horas < 24) continue;

        // Esperou 24h ou mais: o que vier depois pelo caminho de "não respondeu" não pode ser
        // texto livre.
        for (const e of edges.filter((x) => x.source === espera.id && x.sourceHandle === "timeout")) {
          const depois = porId.get(e.target)!;
          expect(
            LIVRES.has(depois.type),
            `${id}: "${depois.id}" manda texto livre depois de ${horas}h de silêncio — fora da janela da API oficial`,
          ).toBe(false);
        }
      }
    }
  });

  it("o de modelo aprovado nasce pedindo o template, e esse é o único pendente", () => {
    /*
     * O template é aprovado por conta, idioma e categoria: não tem como vir pronto. O que este
     * teste garante é que o editor vai apontar ESSE campo e mais nenhum — um modelo que abre com
     * cinco erros não é instrução, é bagunça.
     */
    const problemas = validarFluxo(comoFluxo("follow-up-modelo-aprovado"), { gatilhosDeEtapa: 1 });
    const erros = problemas.filter((p) => p.severidade === "erro");

    expect(erros).toHaveLength(1);
    expect(erros[0].mensagem).toContain("sem modelo escolhido");
  });

  it("os outros três abrem sem nenhum erro: é só trocar o texto e publicar", () => {
    for (const id of ["follow-up-ainda-tem-interesse", "follow-up-tres-toques", "follow-up-janela-24h"]) {
      const problemas = validarFluxo(comoFluxo(id), { gatilhosDeEtapa: 1 });
      const erros = problemas.filter((p) => p.severidade === "erro").map((p) => p.mensagem);
      expect(erros, `${id} abre com erro`).toEqual([]);
    }
  });

  it("todos marcam o lead: follow-up sem etiqueta não vira lista de ninguém", () => {
    for (const id of FOLLOW_UPS) {
      const { nodes } = modelo(id).construir();
      expect(
        nodes.some((n) => n.type === "adicionar_etiqueta"),
        `${id} não etiqueta o lead em caminho nenhum`,
      ).toBe(true);
    }
  });
});
