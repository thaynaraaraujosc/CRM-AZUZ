import { describe, expect, it } from "vitest";

import {
  numerosDoFunil,
  rotuloDoNumeroDoFunil,
  valeMostrarNumeroDoFunil,
  type NumeroComFunil,
} from "@/lib/funis/numero-do-funil";

const oficial: NumeroComFunil = {
  chave: "meta_whatsapp:143588938831846",
  nome: "WhatsApp oficial",
  provedor: "meta_whatsapp",
  status: "conectado",
  funilId: "funil-comercial",
};

const closer: NumeroComFunil = {
  chave: "whatsapp_nao_oficial:5562963404 38".replace(" ", ""),
  nome: "Lucas Chaveiro",
  provedor: "whatsapp_nao_oficial",
  status: "conectado",
  funilId: "funil-lucas",
};

const semVinculo: NumeroComFunil = {
  chave: "whatsapp_nao_oficial:5562999990000",
  nome: "Vendas 2",
  provedor: "whatsapp_nao_oficial",
  status: "conectado",
  funilId: null,
};

describe("numerosDoFunil", () => {
  it("devolve só os números que apontam pra este funil", () => {
    expect(numerosDoFunil([oficial, closer, semVinculo], "funil-lucas")).toEqual([closer]);
  });

  it("funil sem número apontando pra ele devolve lista vazia", () => {
    expect(numerosDoFunil([oficial, closer, semVinculo], "funil-novo")).toEqual([]);
  });

  it("funil sem id não casa com número de funil nulo", () => {
    // `funilId: null` quer dizer "o padrão da empresa", não "o funil de id vazio". Sem a guarda,
    // uma tela que ainda não carregou o funil ativo mostraria todos os números soltos como se
    // fossem dele.
    expect(numerosDoFunil([semVinculo], "")).toEqual([]);
  });

  it("aceita mais de um número no mesmo funil", () => {
    const outro = { ...semVinculo, nome: "Vendas 2", funilId: "funil-lucas" };
    expect(numerosDoFunil([closer, outro], "funil-lucas")).toHaveLength(2);
  });

  it("número desconectado continua contando: o vínculo é configuração, não estado", () => {
    const caiu = { ...closer, status: "desconectado" };
    expect(numerosDoFunil([caiu], "funil-lucas")).toEqual([caiu]);
  });
});

describe("rotuloDoNumeroDoFunil", () => {
  it("diz o nome do número quando há um", () => {
    expect(rotuloDoNumeroDoFunil([oficial, closer], "funil-lucas")).toBe("Lucas Chaveiro");
  });

  it("sem número próprio, diz que recebe de todos", () => {
    expect(rotuloDoNumeroDoFunil([oficial, closer], "funil-novo")).toBe("Todos os números");
  });

  it("com mais de um, mostra o primeiro e quantos faltam", () => {
    const outro = { ...semVinculo, nome: "Vendas 2", funilId: "funil-lucas" };
    expect(rotuloDoNumeroDoFunil([closer, outro], "funil-lucas")).toBe("Lucas Chaveiro +1");
  });
});

describe("valeMostrarNumeroDoFunil", () => {
  it("não mostra com um número conectado só", () => {
    expect(valeMostrarNumeroDoFunil([oficial])).toBe(false);
  });

  it("mostra com dois ou mais conectados", () => {
    expect(valeMostrarNumeroDoFunil([oficial, closer])).toBe(true);
  });

  it("não conta número sem chave: ele não endereça nada", () => {
    const semChave = { ...closer, chave: "" };
    expect(valeMostrarNumeroDoFunil([oficial, semChave])).toBe(false);
  });

  it("não conta número desconectado pra decidir se a etiqueta aparece", () => {
    expect(valeMostrarNumeroDoFunil([oficial, { ...closer, status: "desconectado" }])).toBe(false);
  });
});
