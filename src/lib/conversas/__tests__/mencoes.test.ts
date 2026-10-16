import { describe, expect, it } from "vitest";

import { criarResolvedorDeMencao } from "../mencoes";

/**
 * A REGRESSÃO QUE ESTES TESTES PRENDEM: menção a uma pessoa aparecendo como número cru, com os
 * atalhos "WhatsApp" e "Ligar" pendurados — um convite a ligar pra quem só foi citado.
 *
 * E a regra nova, que é de ordem: o nome que ESTA empresa salvou ganha do nome que o dono do
 * número escolheu pra si, e o número formatado é o último recurso.
 */
const participantes = [
  { nome: "Raquel Fernandes Brito", telefone: "5587600555651" },
  { nome: "Ariane Aires de Brito", telefone: "(62) 99999-0001" },
  { nome: "556299990002", telefone: "556299990002" },
];

const contatos = [
  { nome: "Raquel — Studio Bia", whatsapp: "5587600555651" },
  { nome: "Sem telefone salvo", whatsapp: null },
];

describe("de quem é a menção", () => {
  it("prefere o nome salvo no CRM ao nome que a pessoa pôs no perfil", () => {
    // É o que o celular faz: mostra o nome da SUA agenda, não o que a pessoa escolheu pra si.
    const resolver = criarResolvedorDeMencao(contatos, participantes);

    expect(resolver("5587600555651")).toBe("Raquel — Studio Bia");
  });

  it("usa o nome do perfil quando o contato não está salvo", () => {
    const resolver = criarResolvedorDeMencao(contatos, participantes);

    expect(resolver("5562999990001")).toBe("Ariane Aires de Brito");
  });

  it("casa mesmo com o telefone guardado em outro formato", () => {
    // A menção vem com DDI e sem máscara; a lista do grupo pode ter vindo como "(62) 99999-0001".
    const resolver = criarResolvedorDeMencao(null, participantes);

    expect(resolver("5562999990001")).toBe("Ariane Aires de Brito");
  });

  it("sem nome em lugar nenhum, mostra o telefone legível em vez de dígito colado", () => {
    /*
     * O caso que motivou tudo: `@33230329753761` aparecia inteiro na tela, e o detector de telefone
     * ainda mordia onze dos quatorze dígitos pra pendurar "WhatsApp" e "Ligar" no meio da frase.
     */
    const resolver = criarResolvedorDeMencao(contatos, participantes);

    expect(resolver("5511888887777")).toBe("+55 (11) 88888-7777");
  });

  it("participante cujo nome é o próprio número não conta como nome", () => {
    // Trocar número por número não ajuda ninguém — e esconderia a formatação, que ajuda.
    const resolver = criarResolvedorDeMencao(null, participantes);

    expect(resolver("556299990002")).toBe("+55 (62) 9999-0002");
  });

  it("contato sem telefone salvo não entra no índice", () => {
    // `whatsapp` nulo não pode virar chave vazia e casar com qualquer menção.
    const resolver = criarResolvedorDeMencao(contatos, null);

    expect(resolver("5562988887777")).toBe("+55 (62) 98888-7777");
  });

  it("sem fonte nenhuma, ainda devolve algo legível", () => {
    const resolver = criarResolvedorDeMencao(null, null);

    expect(resolver("5587600555651")).toBe("+55 (87) 60055-5651");
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
