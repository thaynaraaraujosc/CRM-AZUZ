import { describe, expect, it } from "vitest";

import {
  formatarDocumento,
  formatarTelefoneDaEmpresa,
  lerDadosDaEmpresa,
  lerDocumentoDaEmpresa,
  lerEmailDaEmpresa,
  lerNomeDoEspaco,
  lerSiteDaEmpresa,
  lerTelefoneDaEmpresa,
} from "../dados";

/**
 * Estas regras rodam em DOIS lugares — na tela, enquanto a pessoa digita, e na rota, que recusa um
 * pedido que não veio da tela. Provar aqui é provar os dois: é o mesmo código.
 *
 * O princípio que guia tudo: VAZIO É PERMITIDO em quase todo campo (uma agência pode não ter CNPJ
 * ainda), mas PREENCHIDO TEM QUE VALER. Campo que aceita qualquer coisa é campo que não serve pra
 * nota fiscal nem pra cobrança.
 */

describe("o nome do espaço de trabalho", () => {
  it("é o único que não pode ficar em branco", () => {
    // É o nome que aparece no menu, nos convites e nos e-mails: em branco, some de três lugares.
    expect(lerNomeDoEspaco("   ").ok).toBe(false);
    expect(lerNomeDoEspaco("  AZUZ Digital  ")).toEqual({ ok: true, valor: "AZUZ Digital" });
  });

  it("tem teto", () => {
    expect(lerNomeDoEspaco("a".repeat(121)).ok).toBe(false);
  });
});

describe("CNPJ e CPF", () => {
  it("confere o dígito, não só a quantidade de números", () => {
    // 111.111.111-11 passa na conta do dígito por acidente da matemática e é o número que alguém
    // digita quando não quer dar o CPF de verdade.
    expect(lerDocumentoDaEmpresa("111.111.111-11").ok).toBe(false);
    expect(lerDocumentoDaEmpresa("390.533.447-05")).toEqual({ ok: true, valor: "390.533.447-05" });
  });

  it("aceita CNPJ válido e devolve formatado", () => {
    expect(lerDocumentoDaEmpresa("11222333000181")).toEqual({ ok: true, valor: "11.222.333/0001-81" });
  });

  it("diz quantos dígitos faltam em vez de só recusar", () => {
    const r = lerDocumentoDaEmpresa("1122233300");
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.erro).toContain("14 dígitos");
  });

  it("vazio é permitido: nem toda agência tem CNPJ aberto", () => {
    expect(lerDocumentoDaEmpresa("")).toEqual({ ok: true, valor: "" });
  });

  it("a máscara acompanha o que está sendo digitado", () => {
    expect(formatarDocumento("390")).toBe("390");
    expect(formatarDocumento("39053344705")).toBe("390.533.447-05");
    // Passou de 11 dígitos: vira CNPJ no meio da digitação, sem a pessoa escolher nada.
    expect(formatarDocumento("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatarDocumento("112223330001819999")).toBe("11.222.333/0001-81");
  });
});

describe("telefone", () => {
  it("aceita fixo e celular, e recusa número pela metade", () => {
    expect(lerTelefoneDaEmpresa("6233334444")).toEqual({ ok: true, valor: "(62) 3333-4444" });
    expect(lerTelefoneDaEmpresa("62999990001")).toEqual({ ok: true, valor: "(62) 99999-0001" });
    expect(lerTelefoneDaEmpresa("62999").ok).toBe(false);
  });

  it("a máscara não atrapalha quem está digitando", () => {
    expect(formatarTelefoneDaEmpresa("6")).toBe("6");
    expect(formatarTelefoneDaEmpresa("62")).toBe("62");
    expect(formatarTelefoneDaEmpresa("629")).toBe("(62) 9");
    expect(formatarTelefoneDaEmpresa("62999990001")).toBe("(62) 99999-0001");
  });
});

describe("site", () => {
  it("aceita como as pessoas escrevem, sem exigir https", () => {
    // Pedir o protocolo é pedir que alguém digite o que o navegador esconde há dez anos.
    expect(lerSiteDaEmpresa("suaempresa.com.br").ok).toBe(true);
    expect(lerSiteDaEmpresa("https://suaempresa.com.br/contato").ok).toBe(true);
  });

  it("recusa o que não tem forma de endereço", () => {
    expect(lerSiteDaEmpresa("suaempresa").ok).toBe(false);
    expect(lerSiteDaEmpresa("meu site").ok).toBe(false);
  });
});

describe("e-mail", () => {
  it("vazio passa, errado não", () => {
    expect(lerEmailDaEmpresa("")).toEqual({ ok: true, valor: "" });
    expect(lerEmailDaEmpresa("contato@suaempresa.com.br").ok).toBe(true);
    expect(lerEmailDaEmpresa("contato@").ok).toBe(false);
  });
});

describe("o conjunto", () => {
  it("devolve tudo normalizado quando passa", () => {
    const r = lerDadosDaEmpresa({
      empresaNome: "  AZUZ Digital Ltda  ",
      empresaDocumento: "11222333000181",
      empresaTelefone: "62999990001",
      empresaSite: "azuzdigital.com.br",
    });

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.dados.empresaNome).toBe("AZUZ Digital Ltda");
      expect(r.dados.empresaDocumento).toBe("11.222.333/0001-81");
      expect(r.dados.empresaTelefone).toBe("(62) 99999-0001");
      // O que não veio fica vazio, e vazio é permitido.
      expect(r.dados.empresaEndereco).toBe("");
    }
  });

  it("para no primeiro erro e diz qual campo é", () => {
    // Seis erros de uma vez obrigam a pessoa a procurar qual campo é qual. Um por vez, nomeado,
    // é o que dá pra agir.
    const r = lerDadosDaEmpresa({ empresaDocumento: "111.111.111-11", empresaEmail: "quebrado@" });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.erro).toContain("CPF");
  });
});
