import { describe, expect, it } from "vitest";

import { formularioUsaCampo } from "../campos-do-formulario";

/**
 * O vazamento que estes testes prendem: a carteira de clientes de uma empresa exposta pelo link do
 * formulário.
 *
 * `contatos-sugeridos` é pública e devolvia o nome de todos os contatos do workspace pra qualquer
 * pessoa com o id do formulário: e esse id está no link que o cliente divulga. A lista só pode
 * sair quando existe um campo que a consome.
 */
const pagina = (tipos: string[]) => ({ perguntas: tipos.map((tipo, i) => ({ id: String(i), tipo })) });

describe("formularioUsaCampo", () => {
  it("acha o campo quando ele existe", () => {
    expect(formularioUsaCampo([pagina(["texto", "contato"])], "contato")).toBe(true);
    expect(formularioUsaCampo([pagina(["responsavel"])], "responsavel")).toBe(true);
  });

  it("acha o campo em qualquer página, não só na primeira", () => {
    expect(formularioUsaCampo([pagina(["texto"]), pagina(["email"]), pagina(["contato"])], "contato")).toBe(true);
  });

  it("não confunde um tipo com o outro", () => {
    expect(formularioUsaCampo([pagina(["responsavel"])], "contato")).toBe(false);
    expect(formularioUsaCampo([pagina(["contato"])], "responsavel")).toBe(false);
  });

  it("formulário sem o campo não libera lista nenhuma", () => {
    expect(formularioUsaCampo([pagina(["texto", "email", "telefone"])], "contato")).toBe(false);
  });

  // Formulário antigo, formato mudado, JSON estranho: na dúvida responde `false`, que é o lado que
  // não vaza. Derrubar a rota com um formato inesperado seria trocar um problema por outro.
  it("aguenta formato inesperado sem quebrar, respondendo o lado seguro", () => {
    expect(formularioUsaCampo(null, "contato")).toBe(false);
    expect(formularioUsaCampo(undefined, "contato")).toBe(false);
    expect(formularioUsaCampo("texto solto", "contato")).toBe(false);
    expect(formularioUsaCampo([{}], "contato")).toBe(false);
    expect(formularioUsaCampo([{ perguntas: "nao e lista" }], "contato")).toBe(false);
    expect(formularioUsaCampo([{ perguntas: [null, 7] }], "contato")).toBe(false);
    expect(formularioUsaCampo([], "contato")).toBe(false);
  });
});
