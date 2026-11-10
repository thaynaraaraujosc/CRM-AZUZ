import { describe, expect, it } from "vitest";

import {
  gatilhoTemAlcance,
  gravarAlcance,
  lerAlcance,
  resumoDoAlcance,
} from "../alcance-do-gatilho";

/**
 * ONDE AQUELE GATILHO VALE, LIDO E ESCRITO NUM LUGAR SÓ.
 *
 * "Quando eu clico nos gatilhos ativos, seria interessante se eu pudesse ver como que foi que eu
 * escolhi — se é em todos os stories ou não — e aí a opção de mudar."
 *
 * O alcance mora em campos com nomes diferentes por gatilho, mais o campo antigo de um item só que
 * fluxo publicado continua usando. Era mapeado à mão em cada tela, e cada cópia tinha um detalhe
 * diferente. Estes testes prendem as três coisas que não podem variar: o padrão de quem nunca
 * abriu o campo, a compatibilidade com o campo antigo, e a frase que o painel mostra.
 */

describe("quais gatilhos têm alcance", () => {
  it("comentário e resposta de story têm", () => {
    expect(gatilhoTemAlcance("comentario_instagram")).toBe(true);
    expect(gatilhoTemAlcance("instagram_story_respondido")).toBe(true);
  });

  /* Direct recebido não escolhe nada: não há publicação nem story pra apontar. Perguntar o alcance
     dele seria uma tela em branco. */
  it("Direct recebido e menção não têm", () => {
    expect(gatilhoTemAlcance("instagram_direct_recebido")).toBe(false);
    expect(gatilhoTemAlcance("instagram_mencao_story")).toBe(false);
    expect(gatilhoTemAlcance(undefined)).toBe(false);
  });
});

describe("lerAlcance", () => {
  it("sem nada gravado, vale pra qualquer um", () => {
    expect(lerAlcance("comentario_instagram", {})).toEqual({ escopo: "qualquer", ids: [], conhecidos: [] });
    expect(lerAlcance("instagram_story_respondido", undefined)).toEqual({
      escopo: "qualquer",
      ids: [],
      conhecidos: [],
    });
  });

  /*
   * O CAMPO ANTIGO CONTINUA VALENDO.
   *
   * Fluxo gravado quando só dava pra escolher UMA publicação tem `publicacaoId` e não tem escopo.
   * Ele sempre valeu só pra ela, e tem que continuar valendo: migração de fluxo publicado é coisa
   * que se evita quando a leitura resolve.
   */
  it("o campo antigo de um item só vira lista de um, e o escopo vira específico", () => {
    expect(lerAlcance("comentario_instagram", { publicacaoId: "post-1" })).toEqual({
      escopo: "especifico",
      ids: ["post-1"],
      conhecidos: [],
    });
    expect(lerAlcance("instagram_story_respondido", { storyId: "st-9" })).toEqual({
      escopo: "especifico",
      ids: ["st-9"],
      conhecidos: [],
    });
  });

  it("a lista nova ganha do campo antigo", () => {
    const lido = lerAlcance("comentario_instagram", {
      publicacaoId: "post-velho",
      publicacaoIds: ["post-1", "post-2"],
    });
    expect(lido?.ids).toEqual(["post-1", "post-2"]);
  });

  it("lê o escopo gravado, inclusive 'qualquer' com ids guardados", () => {
    const lido = lerAlcance("comentario_instagram", {
      escopoPublicacao: "qualquer",
      publicacaoIds: ["post-1"],
    });
    expect(lido?.escopo).toBe("qualquer");
    expect(lido?.ids).toEqual(["post-1"]);
  });

  /* "Meu próximo post" não existe pra story — story some em 24 horas, e "o próximo" seria uma
     promessa que o dado não cumpre. Valor estranho cai no padrão em vez de virar um terceiro
     estado que nenhuma tela desenha. */
  it("'proxima' vale pra publicação e não pra story", () => {
    expect(lerAlcance("comentario_instagram", { escopoPublicacao: "proxima" })?.escopo).toBe("proxima");
    expect(lerAlcance("instagram_story_respondido", { escopoStory: "proxima" })?.escopo).toBe("qualquer");
  });

  it("guarda os ids conhecidos da publicação", () => {
    const lido = lerAlcance("comentario_instagram", {
      escopoPublicacao: "proxima",
      publicacoesConhecidas: ["post-1", "post-2"],
    });
    expect(lido?.conhecidos).toEqual(["post-1", "post-2"]);
  });

  it("devolve nulo pra gatilho sem alcance", () => {
    expect(lerAlcance("instagram_direct_recebido", { publicacaoIds: ["x"] })).toBeNull();
  });
});

describe("gravarAlcance", () => {
  it("escreve nos campos daquele gatilho", () => {
    expect(gravarAlcance("comentario_instagram", { escopo: "especifico", ids: ["post-1"] })).toEqual({
      publicacaoIds: ["post-1"],
      escopoPublicacao: "especifico",
      publicacaoId: "",
    });
    expect(gravarAlcance("instagram_story_respondido", { escopo: "qualquer", ids: [] })).toEqual({
      storyIds: [],
      escopoStory: "qualquer",
      storyId: "",
    });
  });

  /* O campo antigo é ZERADO: deixá-lo pra trás faria a avaliação continuar lendo uma publicação
     que a tela já esqueceu — o dado velho ganhando do novo, em silêncio. */
  it("zera o campo antigo", () => {
    expect(gravarAlcance("comentario_instagram", { escopo: "qualquer" }).publicacaoId).toBe("");
  });

  it("só grava os conhecidos quando eles vêm", () => {
    expect(gravarAlcance("comentario_instagram", { escopo: "proxima" })).not.toHaveProperty(
      "publicacoesConhecidas",
    );
    expect(
      gravarAlcance("comentario_instagram", { escopo: "proxima", conhecidos: ["post-1"] }),
    ).toHaveProperty("publicacoesConhecidas", ["post-1"]);
  });

  it("gatilho sem alcance não ganha campo nenhum", () => {
    expect(gravarAlcance("instagram_direct_recebido", { escopo: "qualquer" })).toEqual({});
  });
});

describe("resumoDoAlcance: a escolha em uma linha", () => {
  it("diz qualquer, no plural certo de cada um", () => {
    expect(resumoDoAlcance("comentario_instagram", {})).toBe("Qualquer publicação");
    expect(resumoDoAlcance("instagram_story_respondido", {})).toBe("Qualquer story");
  });

  it("conta os escolhidos, no singular e no plural", () => {
    expect(resumoDoAlcance("comentario_instagram", { publicacaoIds: ["a"] })).toBe("1 publicação escolhida");
    expect(resumoDoAlcance("comentario_instagram", { publicacaoIds: ["a", "b", "c"] })).toBe(
      "3 publicações escolhidas",
    );
    expect(resumoDoAlcance("instagram_story_respondido", { storyIds: ["a"] })).toBe("1 story escolhido");
    expect(resumoDoAlcance("instagram_story_respondido", { storyIds: ["a", "b"] })).toBe(
      "2 stories escolhidos",
    );
  });

  it("diz quando é só a próxima publicação", () => {
    expect(resumoDoAlcance("comentario_instagram", { escopoPublicacao: "proxima" })).toBe(
      "Só na próxima publicação",
    );
  });

  /*
   * O ESTADO PERIGOSO TEM FRASE PRÓPRIA.
   *
   * "Post específico" marcado e nenhum post escolhido é um estado possível — marcar e fechar a
   * tela — e é o pior dos três, porque a automação roda pra TUDO enquanto parece restrita. Dizer
   * só "0 publicações escolhidas" deixaria quem lê achando que ela está parada.
   */
  it("avisa quando o específico está vazio", () => {
    expect(resumoDoAlcance("comentario_instagram", { escopoPublicacao: "especifico", publicacaoIds: [] })).toBe(
      "Nenhuma publicação escolhida ainda — vale pra todas",
    );
    expect(resumoDoAlcance("instagram_story_respondido", { escopoStory: "especifico", storyIds: [] })).toBe(
      "Nenhum story escolhido ainda — vale pra todos",
    );
  });

  it("gatilho sem alcance não tem resumo", () => {
    expect(resumoDoAlcance("instagram_direct_recebido", {})).toBeNull();
  });
});
