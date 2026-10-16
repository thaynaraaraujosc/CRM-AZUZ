import { describe, expect, it } from "vitest";

import { normalizarParticipantes } from "../evolution";

/**
 * O QUE ESTE ARQUIVO PRENDE: o painel de participantes de um grupo listando catorze dígitos no
 * lugar de sete nomes.
 *
 * O WhatsApp migrou a identificação de participante de grupo pro LID (`@lid`): um identificador de
 * 14 ou 15 dígitos que não é o telefone da pessoa. Quando ele vem, o campo `id` traz o LID, e
 * pegar `id` primeiro grava o LID na coluna chamada `telefone` — que depois é comparada com
 * telefone de verdade e nunca casa com ninguém.
 */
describe("participantes de um grupo", () => {
  it("prefere o telefone ao LID quando os dois vêm juntos", () => {
    const lista = normalizarParticipantes([
      { id: "33230329753761@lid", jid: "5562999990001@s.whatsapp.net", pushName: "Bianca" },
    ]);

    expect(lista).toEqual([{ nome: "Bianca", telefone: "5562999990001" }]);
  });

  it("aceita o telefone em `phoneNumber`, que é outro nome do mesmo campo", () => {
    const lista = normalizarParticipantes([{ id: "33230329753761@lid", phoneNumber: "5562999990002" }]);

    expect(lista[0].telefone).toBe("5562999990002");
  });

  it("com só o LID, guarda o LID em vez de perder o participante", () => {
    // Pior que um identificador que não serve pra ligar é a lista vir vazia: aí o grupo fica
    // "0 participantes" e nenhuma menção se resolve.
    const lista = normalizarParticipantes([{ id: "67113209352342@lid" }]);

    expect(lista).toEqual([{ nome: "67113209352342", telefone: "67113209352342" }]);
  });

  it("o formato antigo, só com `id` de telefone, continua funcionando igual", () => {
    const lista = normalizarParticipantes([
      { id: "5587600555651@s.whatsapp.net", pushName: "Raquel Fernandes Brito" },
    ]);

    expect(lista).toEqual([{ nome: "Raquel Fernandes Brito", telefone: "5587600555651" }]);
  });

  it("sem nome nenhum, o próprio identificador vira o nome", () => {
    // É o que a tela mostra hoje. Não é bonito, mas é verdade — e é o que `criarResolvedorDeMencao`
    // sabe reconhecer como "isto não é nome" pra não trocar número por número.
    const lista = normalizarParticipantes([{ id: "5562988887777@s.whatsapp.net" }]);

    expect(lista[0].nome).toBe("5562988887777");
  });

  it("participante sem identificador nenhum é descartado, não vira linha vazia", () => {
    expect(normalizarParticipantes([{ pushName: "Fantasma" }, null, 42])).toEqual([]);
  });
});
