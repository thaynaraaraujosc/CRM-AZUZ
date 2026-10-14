import { describe, expect, it } from "vitest";

import { podeDescreverOEstado, precisaConfirmarAntesDeGerar } from "../estado-do-cartao";

/**
 * O print de produção de 14/10/2026 mostrou o cartão dizendo três coisas que ele não sabia:
 * "Nenhuma chave ativa", "Esta empresa ainda não tem funil" e "WhatsApp oficial não conectado".
 * As três vinham de uma leitura que tinha FALHADO, e o `estado?.campo` de um objeto nulo é
 * indistinguível do campo ausente de um objeto lido.
 */
describe("o que a tela pode afirmar", () => {
  it("só descreve o estado quando ele foi lido", () => {
    expect(podeDescreverOEstado("lido")).toBe(true);
    expect(podeDescreverOEstado("lendo")).toBe(false);
    // O caso do print: dizer "não tem funil" a partir de uma leitura que falhou é inventar um fato
    // sobre a conta de um cliente.
    expect(podeDescreverOEstado("falhou")).toBe(false);
  });
});

describe("confirmar antes de gerar a chave", () => {
  it("pergunta quando já existe chave", () => {
    expect(precisaConfirmarAntesDeGerar("lido", true)).toBe(true);
  });

  it("não pergunta quando foi LIDO que não há chave", () => {
    // Única situação sem pergunta: não há nada a perder, e um confirm aqui seria atrito à toa.
    expect(precisaConfirmarAntesDeGerar("lido", false)).toBe(false);
  });

  it("pergunta quando NÃO SE SABE se existe chave", () => {
    // O defeito: com a leitura falhando, o botão revogaria a chave em uso sem perguntar nada, e o
    // Flow pararia de entregar lead sem ninguém perceber.
    expect(precisaConfirmarAntesDeGerar("falhou", false)).toBe(true);
    expect(precisaConfirmarAntesDeGerar("lendo", false)).toBe(true);
  });
});
