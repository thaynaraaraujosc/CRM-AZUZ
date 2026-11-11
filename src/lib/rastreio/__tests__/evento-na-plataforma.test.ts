import { describe, expect, it } from "vitest";

import { EVENTOS_DE_CONVERSAO } from "@/lib/rastreio/eventos-de-conversao";
import { eventoCarregaValor, eventoNaMeta, eventoNoGoogle } from "@/lib/rastreio/evento-na-plataforma";

/**
 * O ERRO QUE ESTE ARQUIVO IMPEDE: lead qualificado chegando na plataforma como COMPRA.
 *
 * Os dois adaptadores tinham o nome do evento fixo no código — a Meta mandava `Purchase` sempre, e
 * o Google usava uma ação de conversão só, de categoria `PURCHASE`, pra tudo. Enquanto só a venda
 * ganha era devolvida, dava no mesmo. Com a qualificação do lead voltando pro anúncio, o leilão
 * passaria a caçar quem qualifica em vez de quem compra, e o relatório de receita encheria de venda
 * que nunca existiu.
 */
describe("eventoNaMeta", () => {
  it("venda continua sendo Purchase", () => {
    expect(eventoNaMeta("purchase")).toBe("Purchase");
  });

  it("lead qualificado NÃO é Purchase", () => {
    expect(eventoNaMeta("lead_qualified")).not.toBe("Purchase");
    expect(eventoNaMeta("lead_qualified")).toBe("QualifiedLead");
  });

  it("usa o evento padrão da Meta quando existe um que descreve o fato", () => {
    // `Lead` e `Schedule` estão na lista de eventos padrão da Meta.
    expect(eventoNaMeta("lead_created")).toBe("Lead");
    expect(eventoNaMeta("appointment_scheduled")).toBe("Schedule");
  });

  it("nenhum evento do CRM, nenhum, vira Purchase por engano", () => {
    for (const { valor } of EVENTOS_DE_CONVERSAO) {
      if (valor === "purchase") continue;
      expect(eventoNaMeta(valor), valor).not.toBe("Purchase");
    }
  });

  it("todos os nomes são CamelCase, que é o formato que a Meta documenta", () => {
    for (const { valor } of EVENTOS_DE_CONVERSAO) {
      expect(eventoNaMeta(valor), valor).toMatch(/^[A-Z][A-Za-z]*$/);
    }
  });

  it("evento desconhecido vai como chegou, nunca como Purchase", () => {
    expect(eventoNaMeta("algo_novo")).toBe("algo_novo");
  });
});

describe("eventoNoGoogle", () => {
  it("venda usa a ação que já existe na conta do cliente, com categoria PURCHASE", () => {
    // O nome não pode mudar: renomear criaria uma ação nova e deixaria o histórico de conversões
    // na antiga, partindo o relatório em dois.
    expect(eventoNoGoogle("purchase")).toEqual({ nome: "Venda · CRM AZUZ", categoria: "PURCHASE" });
  });

  it("lead qualificado tem ação própria, com a categoria do Google pra esse caso", () => {
    const acao = eventoNoGoogle("lead_qualified");
    expect(acao.categoria).toBe("QUALIFIED_LEAD");
    expect(acao.nome).not.toBe("Venda · CRM AZUZ");
  });

  it("nenhum evento além da venda usa a categoria PURCHASE", () => {
    for (const { valor } of EVENTOS_DE_CONVERSAO) {
      if (valor === "purchase") continue;
      expect(eventoNoGoogle(valor).categoria, valor).not.toBe("PURCHASE");
    }
  });

  it("cada evento tem uma ação própria: duas no mesmo nome misturariam os relatórios", () => {
    const nomes = EVENTOS_DE_CONVERSAO.map((e) => eventoNoGoogle(e.valor).nome);
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it("só usa categorias que existem no enum da API", () => {
    // Chutar um nome de categoria faz a CRIAÇÃO da ação falhar, e aí a conversão não é enviada por
    // um detalhe de rótulo. `DEFAULT` é a saída honesta pro que não foi confirmado.
    const confirmadas = new Set(["PURCHASE", "SUBMIT_LEAD_FORM", "QUALIFIED_LEAD", "CONVERTED_LEAD", "DEFAULT"]);
    for (const { valor } of EVENTOS_DE_CONVERSAO) {
      expect(confirmadas, valor).toContain(eventoNoGoogle(valor).categoria);
    }
  });

  it("evento desconhecido cai no lead cru, não na venda", () => {
    expect(eventoNoGoogle("algo_novo").categoria).toBe("SUBMIT_LEAD_FORM");
  });
});

describe("eventoCarregaValor", () => {
  it("só a venda carrega valor", () => {
    expect(eventoCarregaValor("purchase")).toBe(true);
    for (const { valor } of EVENTOS_DE_CONVERSAO) {
      if (valor === "purchase") continue;
      expect(eventoCarregaValor(valor), valor).toBe(false);
    }
  });
});
