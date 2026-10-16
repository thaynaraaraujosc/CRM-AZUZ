import { describe, expect, it } from "vitest";

import { identificarParticipante, nomesVistosNasMensagens, telefoneDoParticipante } from "../participantes";

/**
 * O QUE ESTE ARQUIVO PRENDE: o painel de participantes listando catorze dígitos no lugar de sete
 * nomes, e um botão oferecendo abrir conversa com um número que não existe.
 *
 * O WhatsApp passou a identificar participante de grupo por LID — 14 ou 15 dígitos que não são o
 * telefone de ninguém. A tela precisa saber a diferença entre "não sei o nome desta pessoa" e
 * "este é o telefone dela".
 */

const contatos = [{ nome: "Bianca Bastos", whatsapp: "5562999990001" }];

describe("o que é telefone e o que não é", () => {
  it("telefone brasileiro vira máscara legível", () => {
    expect(telefoneDoParticipante("5562999990001")).toBe("+55 (62) 99999-0001");
  });

  it("LID não vira telefone", () => {
    // Catorze dígitos cabem num E.164 e começam por algo que parece código de país. Não dá pra
    // distinguir olhando, então a resposta é não afirmar.
    expect(telefoneDoParticipante("33230329753761")).toBeNull();
    expect(telefoneDoParticipante("157797132062834")).toBeNull();
  });
});

describe("de quem é cada linha do painel", () => {
  it("usa o nome que veio na lista do grupo quando ele existe", () => {
    const r = identificarParticipante({ nome: "Eduarda Ibiapina", telefone: "5562999990002" }, {});

    expect(r).toMatchObject({ nome: "Eduarda Ibiapina", telefone: "+55 (62) 99999-0002", temNomeReal: true });
  });

  it("aprende o nome pelas mensagens quando a lista do grupo não traz nenhum", () => {
    /*
     * A fonte que não depende de a API resolver o LID: toda mensagem recebida num grupo traz o
     * `pushName` de quem escreveu. Quem já falou ali está identificado.
     */
    const nomesVistos = nomesVistosNasMensagens([
      { remetenteId: "33230329753761", remetenteNome: "Bia" },
      { remetenteId: "33230329753761", remetenteNome: "Bia Studio" },
    ]);
    const r = identificarParticipante({ nome: "33230329753761", telefone: "33230329753761" }, { nomesVistos });

    // O mais recente vence: quando a pessoa troca o nome do perfil, é esse que vale.
    expect(r).toMatchObject({ nome: "Bia Studio", temNomeReal: true, telefone: null });
  });

  it("cai no contato salvo no CRM quando o identificador é telefone de verdade", () => {
    const r = identificarParticipante({ nome: "5562999990001", telefone: "5562999990001" }, { contatos });

    expect(r).toMatchObject({ nome: "Bianca Bastos", temNomeReal: true });
  });

  it("não procura contato pelo LID, porque LID não é telefone", () => {
    // Procurar aqui não acharia nada e ainda daria a impressão de que a busca cobre esse caso.
    const r = identificarParticipante({ nome: "33230329753761", telefone: "33230329753761" }, { contatos });

    expect(r.temNomeReal).toBe(false);
  });

  it("sem nome em lugar nenhum, diz que não tem nome real em vez de fingir", () => {
    const r = identificarParticipante({ nome: "67113209352342", telefone: "67113209352342" }, {});

    expect(r).toEqual({
      identificador: "67113209352342",
      nome: "67113209352342",
      telefone: null,
      temNomeReal: false,
    });
  });

  it("sem nome mas com telefone, o telefone formatado serve de nome", () => {
    const r = identificarParticipante({ nome: "5562999990003", telefone: "5562999990003" }, {});

    expect(r).toMatchObject({ nome: "+55 (62) 99999-0003", telefone: "+55 (62) 99999-0003", temNomeReal: false });
  });
});

describe("nomes vistos nas mensagens", () => {
  it("ignora mensagem sem identificador de quem escreveu", () => {
    // Mensagem antiga, gravada antes de o CRM guardar o identificador: não dá pra atribuir a
    // ninguém, e chutar seria pior.
    expect(nomesVistosNasMensagens([{ remetenteNome: "Alguém" }]).size).toBe(0);
  });

  it("ignora nome que é o próprio identificador", () => {
    expect(nomesVistosNasMensagens([{ remetenteId: "33230329753761", remetenteNome: "33230329753761" }]).size).toBe(0);
  });
});
