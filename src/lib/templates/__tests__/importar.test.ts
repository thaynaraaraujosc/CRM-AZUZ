import { describe, expect, it } from "vitest";

import { lerTemplatesColados, numeradasParaNomeadas } from "@/lib/templates/importar";

/**
 * O TEXTO DESTE TESTE É O QUE ELA COLOU DE VERDADE, com o lixo e tudo.
 *
 * Um teste com um formato arrumado por mim provaria que o leitor entende o formato que eu
 * inventei. O que precisa funcionar é ISTO: título numerado, categoria numa linha solta antes do
 * nome, nome entre crases, o texto, os botões embaixo, e um "Copiar mensagem" que veio junto da
 * página de onde ela copiou.
 */
const COLADO = `1. Primeiro contato — Formulário
Marketing
Nome: \`primeiro_contato_formulario\`
Mensagem
Olá, {{1}}! Tudo bem? Recebemos seu cadastro e vimos que você demonstrou interesse em conhecer nossas soluções. Gostaríamos de entender melhor o que você procura e apresentar como podemos ajudar. Podemos conversar?
Botões sugeridos
Quero conhecer
Agora não
 Copiar mensagem
2. Primeiro contato — Apresentação
Marketing
Nome: \`apresentacao_comercial\`
Olá, {{1}}! Aqui é da Azuz Digital. Trabalhamos com estratégias de marketing, tecnologia e soluções para ajudar empresas a organizar seus processos e desenvolver novas oportunidades de negócio. Gostaria de conhecer melhor nossas soluções?
Tenho interesse
Não tenho interesse
 Copiar mensagem
4. Follow-up 1 — Retomada
Marketing
Nome: \`followup_primeiro_retorno\`
Olá, {{1}}! Tudo bem? Passando para retomar nosso contato sobre seu interesse nas soluções da Azuz Digital. Gostaria de saber se ainda faz sentido conversarmos sobre as necessidades da sua empresa. Podemos continuar?
Podemos conversar
Outro momento`;

describe("lerTemplatesColados", () => {
  const lidos = lerTemplatesColados(COLADO);

  it("acha um template por `Nome:`", () => {
    expect(lidos.map((t) => t.nome)).toEqual([
      "primeiro_contato_formulario",
      "apresentacao_comercial",
      "followup_primeiro_retorno",
    ]);
  });

  it("pega a categoria da linha solta ANTES do nome", () => {
    // É como as pessoas escrevem: título, categoria, nome. Procurar só dentro do bloco não
    // acharia nenhuma, e os sete viriam sem categoria — que é justamente o que a Meta exige.
    expect(lidos.every((t) => t.categoria === "MARKETING")).toBe(true);
  });

  it("separa os botões do corpo pela pontuação, não só pelo tamanho", () => {
    /*
     * O caso perigoso, e ele está nos modelos dela: "Podemos conversar?" é a última FRASE do
     * quarto modelo, e "Podemos conversar" é um BOTÃO dele. Vinte e poucos caracteres os dois.
     * Quem desempata é a interrogação — frase termina com pontuação, rótulo de botão não.
     */
    const retomada = lidos[2];
    expect(retomada.botoes.map((b) => b.texto)).toEqual(["Podemos conversar", "Outro momento"]);
    expect(retomada.corpo).toMatch(/Podemos continuar\?$/);
    expect(retomada.corpo).not.toContain("Outro momento");
  });

  it("joga fora as linhas que são rótulo de tela", () => {
    // "Mensagem", "Botões sugeridos" e "Copiar mensagem" vieram no copiar-colar. Nenhuma delas é
    // conteúdo, e "Copiar mensagem" cairia direitinho como um quarto botão.
    const primeiro = lidos[0];
    expect(primeiro.corpo).not.toMatch(/Copiar|Botões sugeridos|^Mensagem/);
    expect(primeiro.botoes.map((b) => b.texto)).toEqual(["Quero conhecer", "Agora não"]);
  });

  it("o título numerado do bloco anterior não vira botão do seguinte", () => {
    expect(lidos[0].botoes.map((b) => b.texto)).not.toContain("2. Primeiro contato — Apresentação");
  });

  it("`{{1}}` vira a variável de primeiro nome, com origem", () => {
    const primeiro = lidos[0];
    expect(primeiro.corpo).toContain("Olá, {{primeiroNome}}!");
    expect(primeiro.variaveis).toEqual([
      { chave: "primeiroNome", indice: 1, origem: "contato.primeiroNome" },
    ]);
  });

  it("os sete passam: nenhum problema nos modelos dela", () => {
    // É o que importa: ela colar e poder mandar pra análise sem corrigir nada.
    expect(lidos.flatMap((t) => t.problemas)).toEqual([]);
  });

  it("texto sem nenhum `Nome:` não vira template nenhum", () => {
    // Melhor dizer "não achei nada" do que inventar um template a partir de um texto qualquer.
    expect(lerTemplatesColados("Olá, tudo bem?\nQuero conhecer")).toEqual([]);
  });
});

describe("problemas que o leitor precisa apontar", () => {
  it("sem categoria, a Meta recusa — e isso é dito antes de criar", () => {
    const [t] = lerTemplatesColados("Nome: sem_categoria\nOlá, tudo bem? Esta é uma mensagem de teste pro CRM.");
    expect(t.problemas.join(" ")).toMatch(/categoria/i);
  });

  it("botão acima de 25 caracteres é recusado com o texto dele", () => {
    const [t] = lerTemplatesColados(
      "Marketing\nNome: botao_grande\nOlá, tudo bem? Esta é uma mensagem de teste pro CRM.\nEste botão é grande demais pra Meta aceitar",
    );
    // Linha longa demais pra ser botão vira parte do corpo — e aí o corpo passa a ter duas
    // linhas, o que é legítimo. O que não pode é virar um botão inválido em silêncio.
    expect(t.botoes).toEqual([]);
    expect(t.corpo).toContain("Este botão é grande demais");
  });

  it("variável sem origem é apontada ANTES de ir pra análise", () => {
    /*
     * É o defeito que já está no ar: a prévia escreve `[var2]` exatamente quando não tem valor
     * pra pôr ali, e o modelo segue aprovado mandando a frase com buraco.
     */
    const [t] = lerTemplatesColados("Marketing\nNome: duas_vars\nOlá, {{1}}! Sua reunião é {{2}}, combinado?");
    expect(t.corpo).toContain("{{var2}}");
    expect(t.problemas.join(" ")).toMatch(/\{\{var2\}\} não tem origem/);
  });

  it("modelo que termina com variável é recusado — a Meta não aceita", () => {
    const [t] = lerTemplatesColados("Marketing\nNome: termina_em_var\nOlá, tudo bem? Seu contato é {{1}}");
    expect(t.problemas.join(" ")).toMatch(/não pode começar nem terminar com uma variável/i);
  });
});

describe("numeradasParaNomeadas", () => {
  it("só a primeira é adivinhada; as outras ficam pendentes de propósito", () => {
    expect(numeradasParaNomeadas("Oi {{1}}, dia {{2}} às {{3}}")).toBe(
      "Oi {{primeiroNome}}, dia {{var2}} às {{var3}}",
    );
  });

  it("aguenta espaço dentro das chaves", () => {
    expect(numeradasParaNomeadas("Oi {{ 1 }}")).toBe("Oi {{primeiroNome}}");
  });
});
