import { describe, expect, it } from "vitest";

import {
  contatoApareceEmContatos,
  contatoEsperaNome,
  contatoFoiSalvo,
  temNomeDeVerdade,
  temTelefone,
} from "../salvos";

/**
 * O risco destes testes vai nos dois sentidos, e é por isso que eles são tantos.
 *
 * MOSTRAR DE MENOS: esconder alguém que a equipe guardou parece perda de dado, e quem vê uma
 * agenda que encolheu sozinha não confia mais nela.
 *
 * MOSTRAR DEMAIS: esta lista é de onde sai o disparo em massa. Um número sem nome aqui dentro é
 * uma mensagem enviada sem saber pra quem — erro que não dá pra desfazer depois de sair.
 */

describe("temNomeDeVerdade", () => {
  it("telefone não é nome, escrito de qualquer jeito", () => {
    // Os dois são a MESMA pessoa da tela dela. Testar só "é tudo dígito" deixaria o segundo passar.
    expect(temNomeDeVerdade("5511919749536")).toBe(false);
    expect(temNomeDeVerdade("+55 (11) 91974-9536")).toBe(false);
  });

  it("nome de gente tem letra", () => {
    expect(temNomeDeVerdade("Lidiane")).toBe(true);
    expect(temNomeDeVerdade("Natália Vianna")).toBe(true);
    // Nome com número continua sendo nome.
    expect(temNomeDeVerdade("123 Imóveis")).toBe(true);
  });

  it("vazio e espaço não são nome", () => {
    expect(temNomeDeVerdade("")).toBe(false);
    expect(temNomeDeVerdade("   ")).toBe(false);
    expect(temNomeDeVerdade(null)).toBe(false);
    expect(temNomeDeVerdade(undefined)).toBe(false);
  });
});

describe("temTelefone", () => {
  it('"-" e vazio são o jeito de dizer que não tem', () => {
    expect(temTelefone("-")).toBe(false);
    expect(temTelefone("")).toBe(false);
    expect(temTelefone(null)).toBe(false);
  });

  it("aceita telefone escrito de qualquer jeito", () => {
    expect(temTelefone("5511919749536")).toBe(true);
    expect(temTelefone("+55 (11) 91974-9536")).toBe(true);
  });
});

describe("contatoApareceEmContatos", () => {
  it("quem conversou pelo WhatsApp e tem nome entra sozinho — é a agenda de disparo", () => {
    /*
     * O ponto do pedido: "A Lidiane mandou mensagem, já salva o número dela." Antes ela só
     * apareceria se alguém tivesse clicado em salvar; a campanha de amanhã sairia sem ela.
     */
    expect(
      contatoApareceEmContatos({ nome: "Lidiane", whatsapp: "5511919749536", criadoVia: "whatsapp" }),
    ).toBe(true);
  });

  it("número sem nome NÃO entra, nem salvo à mão", () => {
    // "Se não tiver nome, não coloque aqui em contato, porque senão a gente não sabe pra quem tá
    // enviando as coisas." Vale inclusive pra quem alguém salvou: o disparo continua cego.
    expect(contatoApareceEmContatos({ nome: "5511919749536", whatsapp: "5511919749536", criadoVia: "whatsapp" })).toBe(false);
    expect(
      contatoApareceEmContatos({
        nome: "5511919749536",
        whatsapp: "5511919749536",
        salvoEm: new Date(),
        criadoVia: "manual",
      }),
    ).toBe(false);
  });

  it("arroba do Instagram sem telefone não entra", () => {
    // "Tudo que for de arroba de Instagram, não precisa salvar nada dentro de contato, apenas os
    // números de WhatsApp." Sem telefone, a pessoa não recebe disparo: não é desta lista.
    expect(contatoApareceEmContatos({ nome: "Ana Paula", criadoVia: "instagram" })).toBe(false);
    expect(contatoApareceEmContatos({ nome: "Ana Paula", criadoVia: "instagram", salvoEm: new Date() })).toBe(false);
  });

  it("mas o contato do Instagram que JÁ passou o telefone entra", () => {
    // Aqui ele deixou de ser "um arroba": virou um número alcançável, com nome.
    expect(
      contatoApareceEmContatos({ nome: "Ana Paula", whatsapp: "5562994361377", criadoVia: "instagram" }),
    ).toBe(true);
  });

  it("ficha criada à mão sem telefone continua aparecendo", () => {
    /*
     * A condição que impede a agenda de encolher sozinha: fichas de e-mail, de empresa, de quem
     * ainda não passou o número. Elas existiam antes desta regra e ninguém mandou tirar.
     */
    expect(contatoApareceEmContatos({ nome: "Clínica Sorriso", criadoVia: "manual" })).toBe(true);
    expect(contatoApareceEmContatos({ nome: "Clínica Sorriso" })).toBe(true);
    expect(contatoApareceEmContatos({ nome: "João", criadoVia: "azuz-flow", salvoEm: new Date() })).toBe(true);
  });

  it("lead do fluxo sem telefone e sem ninguém ter guardado fica de fora", () => {
    expect(contatoApareceEmContatos({ nome: "João", criadoVia: "azuz-flow" })).toBe(false);
  });
});

describe("contatoEsperaNome", () => {
  it("número que conversou e não tem nome fica na fila de batismo", () => {
    // Ele não some: a tela mostra à parte, e dar o nome é o que o move pra lista de verdade.
    expect(contatoEsperaNome({ nome: "5511919749536", whatsapp: "5511919749536" })).toBe(true);
  });

  it("quem já tem nome não está esperando nada", () => {
    expect(contatoEsperaNome({ nome: "Lidiane", whatsapp: "5511919749536" })).toBe(false);
  });

  it("sem telefone não há o que batizar aqui — não é da lista de disparo", () => {
    expect(contatoEsperaNome({ nome: "", criadoVia: "instagram" })).toBe(false);
  });
});

describe("contatoFoiSalvo", () => {
  it("continua querendo dizer o que sempre quis: a equipe guardou de propósito", () => {
    expect(contatoFoiSalvo({ salvoEm: new Date(), criadoVia: "whatsapp" })).toBe(true);
    expect(contatoFoiSalvo({ criadoVia: "manual" })).toBe(true);
    expect(contatoFoiSalvo({ criadoVia: "whatsapp" })).toBe(false);
  });
});
