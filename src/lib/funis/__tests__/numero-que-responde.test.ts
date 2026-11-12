import { describe, expect, it } from "vitest";

import {
  numeroQueResponde,
  podeResponderPor,
  porQueEsteNumero,
} from "@/lib/funis/numero-que-responde";

const VENDEDORA = "whatsapp_nao_oficial:5562999990000";
const CLOSER = "meta_whatsapp:109876543210";

describe("numeroQueResponde", () => {
  it("a etapa manda: o card em Proposta responde pelo número do closer", () => {
    // "No quadro de proposta é o closer: eu quero colocar o número do closer ali, que é ele que
    // vai responder naquela ali."
    expect(
      numeroQueResponde({
        etapaDoNegocio: { id: "proposta", contaCanal: CLOSER },
        contaCanalDaConversa: VENDEDORA,
      }),
    ).toEqual({ contaCanal: CLOSER, origem: "etapa" });
  });

  it("etapa sem número próprio não muda nada: vale a conversa", () => {
    /*
     * É o estado de TODA etapa que existe hoje. Se a ausência virasse um palpite, cada conta já
     * em uso teria suas respostas trocando de número no dia da publicação.
     */
    expect(
      numeroQueResponde({
        etapaDoNegocio: { id: "novo", contaCanal: null },
        contaCanalDaConversa: VENDEDORA,
      }),
    ).toEqual({ contaCanal: VENDEDORA, origem: "conversa" });
  });

  it("sem negócio no funil, vale a conversa", () => {
    expect(numeroQueResponde({ contaCanalDaConversa: VENDEDORA }).contaCanal).toBe(VENDEDORA);
  });

  it("a escolha da pessoa GANHA da etapa — a etapa é padrão, não amarra", () => {
    /*
     * A pessoa escolheu um número na ficha do contato ou no menu do "+". Deixar a etapa vencer
     * seria a tela desfazendo, em silêncio, o que ela acabou de pedir — que é exatamente a
     * reclamação que ela já trouxe sobre o envio voltando pro canal errado.
     */
    expect(
      numeroQueResponde({
        escolhaDaTela: VENDEDORA,
        etapaDoNegocio: { id: "proposta", contaCanal: CLOSER },
        contaCanalDaConversa: CLOSER,
      }),
    ).toEqual({ contaCanal: VENDEDORA, origem: "escolha" });
  });

  it("espaço em branco não é escolha nem número de etapa", () => {
    expect(
      numeroQueResponde({
        escolhaDaTela: "   ",
        etapaDoNegocio: { id: "x", contaCanal: "  " },
        contaCanalDaConversa: VENDEDORA,
      }),
    ).toEqual({ contaCanal: VENDEDORA, origem: "conversa" });
  });

  it("sem nada, nada: nulo é a conversa seguindo o caminho dela", () => {
    expect(numeroQueResponde({})).toEqual({ contaCanal: null, origem: "conversa" });
  });
});

describe("podeResponderPor", () => {
  it("nada marcado quer dizer TODOS — é a leitura de uma lista de caixas vazias", () => {
    expect(podeResponderPor(null, CLOSER)).toBe(true);
  });

  it("com recorte, só os números marcados", () => {
    // "Ele pode ver todas as etapas, mas o número dele só responde uma. Ele não consegue responder
    // as outras."
    expect(podeResponderPor([CLOSER], CLOSER)).toBe(true);
    expect(podeResponderPor([CLOSER], VENDEDORA)).toBe(false);
  });

  it("sem número definido, não barra: quem vê a conversa já foi autorizado a atendê-la", () => {
    expect(podeResponderPor([CLOSER], null)).toBe(true);
  });
});

describe("porQueEsteNumero", () => {
  it("diz QUEM decidiu, não só o resultado", () => {
    expect(porQueEsteNumero("escolha")).toMatch(/você escolheu/i);
    expect(porQueEsteNumero("etapa", "Proposta")).toContain("Proposta");
    expect(porQueEsteNumero("conversa")).toMatch(/mesmo número/i);
  });

  it("etapa sem nome ainda se explica", () => {
    expect(porQueEsteNumero("etapa")).toMatch(/etapa deste negócio/i);
  });
});
