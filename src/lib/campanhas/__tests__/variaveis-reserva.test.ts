import { describe, expect, it } from "vitest";

import {
  mapearVariaveis,
  motivoDeVariavelVazia,
  prepararEnvioDeModelo,
  primeiroNomeDe,
  resolverParametros,
  type MapeamentoVariavel,
} from "../variaveis";

describe("primeiroNomeDe", () => {
  it("devolve a primeira palavra", () => {
    expect(primeiroNomeDe("Marina Alves")).toBe("Marina");
  });

  it("tira o sufixo de homônimo, que é cadastro e não nome de gente", () => {
    // O segundo "Marina Alves" que chega entra assim pra não fundir com o primeiro. Mandar isso
    // num "Olá, {{nome}}" escancara pro cliente um detalhe interno do CRM.
    expect(primeiroNomeDe("Marina Alves (Consultoria grátis)")).toBe("Marina");
    expect(primeiroNomeDe("Marina (Consultoria grátis)")).toBe("Marina");
    expect(primeiroNomeDe("Marina Alves (a1b2c3)")).toBe("Marina");
  });

  it("não devolve vazio quando o nome é só o sufixo", () => {
    // Melhor um nome estranho do que uma variável vazia, que faz a Meta recusar o envio inteiro.
    expect(primeiroNomeDe("(Consultoria)")).toBe("(Consultoria)");
  });

  it("aguenta nome de uma palavra e espaço sobrando", () => {
    expect(primeiroNomeDe("Marina")).toBe("Marina");
    expect(primeiroNomeDe("   Marina   Alves  ")).toBe("Marina");
  });
});

describe("valor reserva", () => {
  const contato = { nome: "Marina Alves (Consultoria grátis)", empresa: null, cidade: "Goiânia" };

  it("usa o reserva quando o campo do contato está vazio", () => {
    const variaveis: MapeamentoVariavel[] = [
      { chave: "empresa", indice: 1, origem: "contato.empresa", reserva: "sua empresa" },
    ];
    expect(resolverParametros(variaveis, contato).empresa).toBe("sua empresa");
  });

  it("não usa o reserva quando há valor de verdade", () => {
    const variaveis: MapeamentoVariavel[] = [
      { chave: "cidade", indice: 1, origem: "contato.cidade", reserva: "sua cidade" },
    ];
    expect(resolverParametros(variaveis, contato).cidade).toBe("Goiânia");
  });

  it("primeiro nome sai limpo do sufixo", () => {
    const variaveis: MapeamentoVariavel[] = [{ chave: "primeiroNome", indice: 1, origem: "contato.primeiroNome" }];
    expect(resolverParametros(variaveis, contato).primeiroNome).toBe("Marina");
  });
});

describe("prepararEnvioDeModelo", () => {
  const contato = { nome: "Ana Souza", empresa: null };

  it("não deixa sair com variável vazia: a Meta recusaria o envio inteiro", () => {
    const variaveis: MapeamentoVariavel[] = [{ chave: "empresa", indice: 1, origem: "contato.empresa" }];
    const r = prepararEnvioDeModelo(variaveis, contato);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.faltando).toEqual(["empresa"]);
    // A frase precisa dizer QUAL variável e que nada saiu: "falhou" sozinho não deixa ninguém
    // corrigir.
    expect(r.motivo).toContain("{{empresa}}");
    expect(r.motivo).toContain("nada foi enviado");
  });

  it("deixa sair quando o reserva cobre o vazio", () => {
    const variaveis: MapeamentoVariavel[] = [
      { chave: "empresa", indice: 1, origem: "contato.empresa", reserva: "sua empresa" },
    ];
    const r = prepararEnvioDeModelo(variaveis, contato);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.componentes?.[0].parameters[0].text).toBe("sua empresa");
  });

  it("modelo sem variável nenhuma sai normalmente", () => {
    const r = prepararEnvioDeModelo([], contato);
    expect(r.ok).toBe(true);
    // `components: []` também é recusado pela Meta: tem que ser ausente.
    if (r.ok) expect(r.componentes).toBeUndefined();
  });

  it("manda os parâmetros na ordem dos índices, não na ordem do texto", () => {
    const variaveis: MapeamentoVariavel[] = [
      { chave: "b", indice: 2, origem: "texto", valor: "segundo" },
      { chave: "a", indice: 1, origem: "texto", valor: "primeiro" },
    ];
    const r = prepararEnvioDeModelo(variaveis, contato);
    expect(r.ok && r.componentes?.[0].parameters.map((p) => p.text)).toEqual(["primeiro", "segundo"]);
  });
});

describe("motivoDeVariavelVazia", () => {
  it("concorda singular e plural", () => {
    expect(motivoDeVariavelVazia(["empresa"])).toContain("está vazia");
    expect(motivoDeVariavelVazia(["empresa", "cargo"])).toContain("estão vazias");
  });
});

describe("mapearVariaveis", () => {
  it("adivinha a origem sem olhar a caixa das letras", () => {
    // Quem escreve {{primeironome}} e quem escreve {{primeiroNome}} querem a mesma coisa. Errar
    // aqui deixa a variável como "texto", e a pessoa nunca entende por que ela não puxou sozinha.
    expect(mapearVariaveis("Olá {{primeiroNome}}")[0].origem).toBe("contato.primeiroNome");
    expect(mapearVariaveis("Olá {{primeironome}}")[0].origem).toBe("contato.primeiroNome");
    expect(mapearVariaveis("Olá {{nome}}")[0].origem).toBe("contato.nome");
  });

  it("preserva o reserva ao reeditar o texto", () => {
    const antes: MapeamentoVariavel[] = [
      { chave: "empresa", indice: 1, origem: "contato.empresa", reserva: "sua empresa" },
    ];
    const depois = mapearVariaveis("Oi, tudo bem na {{empresa}}?", antes);
    expect(depois[0].reserva).toBe("sua empresa");
  });
});
