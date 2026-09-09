import { describe, expect, it } from "vitest";

import {
  lerRespostaDoFluxo,
  montarFluxoDaResposta,
  validarResposta,
  type RespostaAutomatica,
} from "../resposta-automatica";

function base(): RespostaAutomatica {
  return {
    nome: "Comentou 'quero'",
    quando: "comentario",
    palavras: ["quero"],
    mensagem: "Te mandei o link aqui!",
    respostaPublica: "Chamei você no Direct 💙",
    etiqueta: "Veio do Instagram",
  };
}

/**
 * O que estes testes protegem é a promessa de que a tela curta e o construtor são o MESMO fluxo.
 *
 * Se `montar` e `ler` divergirem, editar uma resposta automática vira adivinhação: a tela mostra
 * uma versão empobrecida do que existe e, ao salvar, apaga o que ela não soube ler. O prejuízo cai
 * em cima de trabalho que a pessoa já tinha feito.
 */
describe("ida e volta", () => {
  it("lê de volta exatamente o que montou", () => {
    const original = base();
    const { nodes, edges } = montarFluxoDaResposta(original);
    const lido = lerRespostaDoFluxo({ nome: original.nome, nodes, edges });
    expect(lido).toEqual(original);
  });

  it("funciona sem os campos opcionais", () => {
    const simples: RespostaAutomatica = {
      nome: "Qualquer Direct",
      quando: "direct",
      palavras: [],
      mensagem: "Oi! Já te respondo.",
    };
    const { nodes, edges } = montarFluxoDaResposta(simples);
    const lido = lerRespostaDoFluxo({ nome: simples.nome, nodes, edges });
    expect(lido?.quando).toBe("direct");
    expect(lido?.mensagem).toBe("Oi! Já te respondo.");
    expect(lido?.respostaPublica).toBeUndefined();
    expect(lido?.etiqueta).toBeUndefined();
  });

  it("põe a resposta pública ANTES do Direct", () => {
    // É ela que aparece pra quem está lendo os comentários, e é o que faz a próxima pessoa
    // comentar também. Invertida, o efeito público some.
    const { nodes, edges } = montarFluxoDaResposta(base());
    const publica = nodes.findIndex((n) => n.type === "responder_comentario_instagram");
    const direct = nodes.findIndex((n) => n.type === "mensagem_texto");
    expect(publica).toBeLessThan(direct);
    expect(edges.some((e) => e.source === "ra-publica" && e.target === "ra-direct")).toBe(true);
  });
});

describe("quando o fluxo cresce além da tela curta", () => {
  it("se recusa a ler, em vez de mostrar uma versão empobrecida", () => {
    // Alguém abriu no construtor e acrescentou uma pergunta. Mostrar isto na tela curta e deixar
    // salvar apagaria a pergunta sem avisar.
    const { nodes, edges } = montarFluxoDaResposta(base());
    nodes.push({
      id: "extra",
      type: "mensagem_botoes",
      category: "mensagem",
      position: { x: 0, y: 0 },
      data: { canal: "instagram", texto: "?", opcoes: [] },
    });
    expect(lerRespostaDoFluxo({ nome: "x", nodes, edges })).toBeNull();
  });

  it("ignora fluxo cujo gatilho não é dos três", () => {
    expect(
      lerRespostaDoFluxo({
        nome: "x",
        nodes: [{ id: "g", type: "lead_criado", category: "gatilho", position: { x: 0, y: 0 }, data: {} }],
        edges: [],
      }),
    ).toBeNull();
  });
});

describe("o que impede de salvar", () => {
  it("exige nome e mensagem", () => {
    const problemas = validarResposta({ nome: "", quando: "direct", palavras: [], mensagem: "" });
    expect(problemas).toHaveLength(2);
  });

  it("recusa mensagem acima do limite do Direct", () => {
    const problemas = validarResposta({
      nome: "n",
      quando: "direct",
      palavras: [],
      mensagem: "a".repeat(1001),
    });
    expect(problemas.join(" ")).toContain("1.000");
  });

  it("recusa resposta pública sem comentário pra responder", () => {
    const problemas = validarResposta({
      nome: "n",
      quando: "direct",
      palavras: [],
      mensagem: "oi",
      respostaPublica: "obrigado",
    });
    expect(problemas.join(" ")).toContain("comentário");
  });
});
