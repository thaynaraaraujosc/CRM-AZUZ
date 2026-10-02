import { describe, expect, it } from "vitest";

import { aplicarMencoes } from "../mencoes";

/**
 * A REGRESSÃO QUE ESTES TESTES PRENDEM: menção a uma pessoa do grupo aparecendo como número cru,
 * com os atalhos "WhatsApp" e "Ligar" pendurados — um convite a ligar pra quem só foi citado.
 */
const participantes = [
  { nome: "Raquel Fernandes Brito", telefone: "5587600555651" },
  { nome: "Ariane Aires de Brito", telefone: "(62) 99999-0001" },
  { nome: "556299990002", telefone: "556299990002" },
];

describe("aplicarMencoes", () => {
  it("troca a menção pelo nome de quem foi mencionado", () => {
    expect(aplicarMencoes("@5587600555651 disponibilizei as cenas", participantes)).toBe(
      "@Raquel Fernandes Brito disponibilizei as cenas",
    );
  });

  it("casa mesmo com a lista do grupo em outro formato de número", () => {
    // A menção vem com DDI e sem máscara; a lista pode ter vindo como "(62) 99999-0001".
    expect(aplicarMencoes("bom dia @5562999990001", participantes)).toBe("bom dia @Ariane Aires de Brito");
  });

  it("troca várias menções na mesma mensagem", () => {
    const r = aplicarMencoes("@5587600555651 e @5562999990001, podem ver?", participantes);

    expect(r).toBe("@Raquel Fernandes Brito e @Ariane Aires de Brito, podem ver?");
  });

  it("quem não está na lista continua como veio", () => {
    // Melhor um número honesto do que um nome inventado.
    expect(aplicarMencoes("@5511888887777 vc viu?", participantes)).toBe("@5511888887777 vc viu?");
  });

  it("participante sem nome real não vira troca de número por número", () => {
    expect(aplicarMencoes("@556299990002 oi", participantes)).toBe("@556299990002 oi");
  });

  it("não mexe em texto sem menção", () => {
    expect(aplicarMencoes("o meu está indo rs", participantes)).toBe("o meu está indo rs");
  });

  it("não mexe em e-mail nem em @ de usuário", () => {
    expect(aplicarMencoes("manda pra contato@azuz.com e chama o @joao", participantes)).toBe(
      "manda pra contato@azuz.com e chama o @joao",
    );
  });

  it("sem lista de participantes, devolve o texto intacto", () => {
    expect(aplicarMencoes("@5587600555651 oi", null)).toBe("@5587600555651 oi");
    expect(aplicarMencoes("@5587600555651 oi", [])).toBe("@5587600555651 oi");
  });
});

import { filtrarParticipantes, inserirMencao, mencaoEmDigitacao } from "../mencoes";

/** Marcar alguém num grupo é o gesto mais comum do WhatsApp e não existia no CRM: só dava pra
 *  digitar o número na mão — que é justamente o que faz a menção sair como número do outro lado. */
describe("mencaoEmDigitacao", () => {
  it("reconhece o @ no começo da mensagem", () => {
    expect(mencaoEmDigitacao("@ra", 3)).toEqual({ busca: "ra", inicio: 0 });
  });

  it("reconhece o @ depois de um espaço", () => {
    expect(mencaoEmDigitacao("bom dia @ariane", 15)).toEqual({ busca: "ariane", inicio: 8 });
  });

  it("o @ sozinho já abre a lista", () => {
    expect(mencaoEmDigitacao("oi @", 4)).toEqual({ busca: "", inicio: 3 });
  });

  // Senão, digitar um e-mail abriria um seletor de pessoas na cara de quem escreve.
  it("e-mail não vira menção", () => {
    expect(mencaoEmDigitacao("manda pra contato@azuz.com", 25)).toBeNull();
  });

  it("menção encerrada por espaço não continua aberta", () => {
    expect(mencaoEmDigitacao("@raquel ja vi", 13)).toBeNull();
  });

  it("olha o cursor, não o fim do texto", () => {
    expect(mencaoEmDigitacao("@ra resto da frase", 3)).toEqual({ busca: "ra", inicio: 0 });
  });
});

describe("filtrarParticipantes", () => {
  it("acha por pedaço do nome, sem diferenciar maiúscula", () => {
    expect(filtrarParticipantes(participantes, "raq").map((p) => p.nome)).toEqual(["Raquel Fernandes Brito"]);
  });

  it("acha por telefone: quem não tem nome salvo aparece pelo número", () => {
    expect(filtrarParticipantes(participantes, "99990002").map((p) => p.telefone)).toEqual(["556299990002"]);
  });

  it("sem busca, mostra os primeiros", () => {
    expect(filtrarParticipantes(participantes, "")).toHaveLength(3);
  });

  it("grupo sem lista não quebra", () => {
    expect(filtrarParticipantes(null, "a")).toEqual([]);
  });
});

describe("inserirMencao", () => {
  // O número sai no formato canônico (DDI + DDD + 9): sem DDI, o WhatsApp não resolve a menção
  // pra ninguém, e `aplicarMencoes` também não casaria de volta na exibição.
  it("insere o telefone no formato que o WhatsApp entende", () => {
    const r = inserirMencao("bom dia @ari", 8, 12, { nome: "Ariane", telefone: "(62) 99999-0001" });

    expect(r.texto).toBe("bom dia @5562999990001 ");
    expect(r.cursor).toBe(r.texto.length);
  });

  it("preserva o que vem depois do cursor", () => {
    const r = inserirMencao("@ra, pode ver?", 0, 3, { nome: "Raquel", telefone: "5587600555651" });

    expect(r.texto).toBe("@5587600555651 , pode ver?");
  });
});
