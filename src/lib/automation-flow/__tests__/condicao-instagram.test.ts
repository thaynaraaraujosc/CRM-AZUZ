import { describe, expect, it } from "vitest";

import { fluxoUsaCampoDeCondicao } from "../disparar-no-servidor";
import { validarFluxo } from "../validacao";
import type { FluxoAutomacao, GrupoCondicoes } from "../types";

/**
 * AS PENDÊNCIAS QUE SÓ EXISTEM OLHANDO PRA FORA DO DESENHO.
 *
 * As duas daqui têm o mesmo formato de defeito: o fluxo roda, não dá erro, e decide sempre igual —
 * ou porque o dado que a condição pergunta não existe, ou porque a mensagem desenhada não vai
 * poder sair. Nenhuma das duas aparece como erro em lugar nenhum sem este aviso.
 */
function grupoDeJanela(operador: "verdadeiro" | "falso"): GrupoCondicoes {
  return {
    id: "g",
    tipo: "E",
    regras: [{ id: "r", campo: "ig_janela_24h", operador }],
    subgrupos: [],
  };
}

function fluxo(nodes: unknown[], edges: unknown[] = []): FluxoAutomacao {
  return {
    id: "f1",
    nome: "Robô",
    area: "social",
    status: "publicado",
    ativa: true,
    nodes,
    edges,
    versaoAtual: 1,
    configuracoes: {},
  } as unknown as FluxoAutomacao;
}

const gatilho = {
  id: "g1",
  type: "comentario_instagram",
  category: "gatilho",
  position: { x: 0, y: 0 },
  data: {},
};

describe("condição de Instagram sem Instagram conectado", () => {
  const nodes = [
    gatilho,
    { id: "c1", type: "condicao_grupo", category: "condicao", titulo: "É seguidor?", position: { x: 1, y: 0 }, data: { grupo: { id: "g", tipo: "E", regras: [{ id: "r", campo: "ig_seguidor", operador: "verdadeiro" }], subgrupos: [] } } },
  ];

  it("avisa quando a conta está desconectada", () => {
    const problemas = validarFluxo(fluxo(nodes), { instagramConectado: false });
    expect(problemas.some((p) => p.mensagem.includes("Instagram não está conectado"))).toBe(true);
  });

  it("não avisa quando está conectada", () => {
    const problemas = validarFluxo(fluxo(nodes), { instagramConectado: true });
    expect(problemas.some((p) => p.mensagem.includes("Instagram não está conectado"))).toBe(false);
  });

  /*
   * NÃO SABER NÃO É SABER QUE NÃO.
   *
   * A validação roda também fora do editor (ao publicar pelo contexto, na Central do Dia), onde
   * ninguém consultou a integração. Inventar o aviso ali encheria de pendência um fluxo que pode
   * estar perfeito.
   */
  it("não inventa pendência quando não se sabe", () => {
    const problemas = validarFluxo(fluxo(nodes));
    expect(problemas.some((p) => p.mensagem.includes("Instagram não está conectado"))).toBe(false);
  });
});

describe("mensagem depois da janela de 24h fechada", () => {
  const mensagem = {
    id: "m1",
    type: "mensagem_texto",
    category: "mensagem",
    position: { x: 2, y: 0 },
    data: { canal: "instagram", texto: "Oi!" },
  };

  it("avisa quando o caminho de FORA da janela leva a um envio", () => {
    const nodes = [
      gatilho,
      { id: "c1", type: "condicao_grupo", category: "condicao", titulo: "Janela aberta?", position: { x: 1, y: 0 }, data: { grupo: grupoDeJanela("verdadeiro") } },
      mensagem,
    ];
    // A saída "nao" da pergunta "está dentro da janela?" é quem está FORA dela.
    const edges = [{ id: "e1", source: "c1", target: "m1", sourceHandle: "nao" }];
    const problemas = validarFluxo(fluxo(nodes, edges));
    expect(problemas.some((p) => p.mensagem.includes("FORA da janela de 24h"))).toBe(true);
  });

  it("não avisa quando o envio está no caminho de quem está DENTRO da janela", () => {
    const nodes = [
      gatilho,
      { id: "c1", type: "condicao_grupo", category: "condicao", position: { x: 1, y: 0 }, data: { grupo: grupoDeJanela("verdadeiro") } },
      mensagem,
    ];
    const edges = [{ id: "e1", source: "c1", target: "m1", sourceHandle: "sim" }];
    const problemas = validarFluxo(fluxo(nodes, edges));
    expect(problemas.some((p) => p.mensagem.includes("FORA da janela de 24h"))).toBe(false);
  });

  it("entende a pergunta ao contrário: 'janela é falso' no caminho verdadeiro", () => {
    const nodes = [
      gatilho,
      { id: "c1", type: "condicao_grupo", category: "condicao", position: { x: 1, y: 0 }, data: { grupo: grupoDeJanela("falso") } },
      mensagem,
    ];
    const edges = [{ id: "e1", source: "c1", target: "m1", sourceHandle: "sim" }];
    const problemas = validarFluxo(fluxo(nodes, edges));
    expect(problemas.some((p) => p.mensagem.includes("FORA da janela de 24h"))).toBe(true);
  });

  it("acha o envio mesmo com uma espera no meio do caminho", () => {
    const nodes = [
      gatilho,
      { id: "c1", type: "condicao_grupo", category: "condicao", position: { x: 1, y: 0 }, data: { grupo: grupoDeJanela("verdadeiro") } },
      { id: "a1", type: "aguardar", category: "espera", position: { x: 2, y: 0 }, data: { modo: "minutos", valor: 5 } },
      mensagem,
    ];
    const edges = [
      { id: "e1", source: "c1", target: "a1", sourceHandle: "nao" },
      { id: "e2", source: "a1", target: "m1" },
    ];
    const problemas = validarFluxo(fluxo(nodes, edges));
    expect(problemas.some((p) => p.mensagem.includes("FORA da janela de 24h"))).toBe(true);
  });

  it("bloco que não pergunta pela janela não gera aviso nenhum", () => {
    const nodes = [
      gatilho,
      { id: "c1", type: "condicao_grupo", category: "condicao", position: { x: 1, y: 0 }, data: { grupo: { id: "g", tipo: "E", regras: [{ id: "r", campo: "mensagem", operador: "contem", valor: "oi" }], subgrupos: [] } } },
      mensagem,
    ];
    const edges = [{ id: "e1", source: "c1", target: "m1", sourceHandle: "nao" }];
    const problemas = validarFluxo(fluxo(nodes, edges));
    expect(problemas.some((p) => p.mensagem.includes("FORA da janela de 24h"))).toBe(false);
  });
});

/**
 * O LINK DA PUBLICAÇÃO CUSTA UMA CHAMADA À META, e só vale a pena pra quem usa o campo.
 *
 * Errar aqui é silencioso dos dois lados: ou se paga uma chamada por comentário em toda conta do
 * CRM, ou o campo fica vazio justamente em quem o configurou.
 */
describe("quando buscar o link da publicação", () => {
  const comCampo = [
    {
      nodes: [
        {
          type: "condicao_ramos",
          data: {
            ramos: [
              { id: "r1", grupo: { tipo: "E", regras: [{ campo: "ig_post_link", operador: "contem", valor: "reel" }], subgrupos: [] } },
            ],
          },
        },
      ],
    },
  ];

  it("acha o campo numa condição de vários caminhos", () => {
    expect(fluxoUsaCampoDeCondicao(comCampo, "ig_post_link")).toBe(true);
    expect(fluxoUsaCampoDeCondicao(comCampo, "ig_seguidor")).toBe(false);
  });

  it("acha o campo dentro de um subgrupo", () => {
    const aninhado = [
      {
        nodes: [
          {
            type: "condicao_grupo",
            data: {
              grupo: {
                tipo: "E",
                regras: [],
                subgrupos: [{ tipo: "OU", regras: [{ campo: "ig_post_link", operador: "existe" }], subgrupos: [] }],
              },
            },
          },
        ],
      },
    ];
    expect(fluxoUsaCampoDeCondicao(aninhado, "ig_post_link")).toBe(true);
  });

  it("fluxo sem condição nenhuma não pede o link", () => {
    expect(fluxoUsaCampoDeCondicao([{ nodes: [{ type: "mensagem_texto", data: { texto: "oi" } }] }], "ig_post_link")).toBe(false);
    expect(fluxoUsaCampoDeCondicao([{}], "ig_post_link")).toBe(false);
  });
});

/**
 * GATILHO LIGADO A NADA NÃO É "FIM DE FLUXO".
 *
 * A mensagem genérica aparecia nos gatilhos marcados e ainda não ligados, dizendo que eles
 * "terminam o fluxo sem passar por Encerrar fluxo" — uma frase que não é verdade sobre um
 * gatilho, e que travava a publicação no meio da montagem.
 */
describe("gatilho que não leva a lugar nenhum", () => {
  const gatilhoSolto = {
    id: "g2",
    type: "instagram_story_respondido",
    category: "gatilho",
    position: { x: 0, y: 1 },
    data: {},
  };

  it("vira aviso, com a frase do que realmente acontece", () => {
    const problemas = validarFluxo(fluxo([gatilho, gatilhoSolto]));
    const dele = problemas.filter((p) => p.nodeId === "g2");
    expect(dele).toHaveLength(1);
    expect(dele[0].severidade).toBe("aviso");
    expect(dele[0].mensagem).toContain("não leva a passo nenhum");
    expect(dele[0].mensagem).not.toContain("Encerrar fluxo");
  });

  it("não trava a publicação", () => {
    const erros = validarFluxo(fluxo([gatilho, gatilhoSolto])).filter((p) => p.severidade === "erro");
    expect(erros.some((p) => p.nodeId === "g2")).toBe(false);
  });

  it("bloco que não é gatilho continua cobrando o fim do caminho", () => {
    const mensagemSolta = {
      id: "m9",
      type: "mensagem_texto",
      category: "mensagem",
      position: { x: 1, y: 0 },
      data: { canal: "instagram", texto: "Oi" },
    };
    const edges = [{ id: "e9", source: "g1", target: "m9" }];
    const problemas = validarFluxo(fluxo([gatilho, mensagemSolta], edges));
    expect(problemas.some((p) => p.nodeId === "m9" && p.mensagem.includes("Encerrar fluxo"))).toBe(true);
  });
});

/**
 * A PENDÊNCIA CHAMA O BLOCO PELO NOME QUE ESTÁ NA TELA.
 *
 * "O gatilho instagram_story_respondido não leva a passo nenhum" manda procurar no quadro uma
 * coisa que, no quadro, se chama "Resposta nos stories". O identificador do código não aparece em
 * lugar nenhum da interface, e vazou em cinquenta e cinco mensagens de pendência de uma vez.
 */
describe("o nome do bloco nas pendências", () => {
  const soltoNoFluxo = {
    id: "g1",
    type: "instagram_story_respondido",
    category: "gatilho",
    position: { x: 0, y: 0 },
    data: {},
  };

  it("usa o nome da biblioteca quando o bloco não foi renomeado", () => {
    const problemas = validarFluxo(fluxo([soltoNoFluxo]));
    const doGatilho = problemas.find((p) => p.mensagem.includes("não leva a passo nenhum"));
    expect(doGatilho?.mensagem).toContain("Resposta nos stories");
    expect(doGatilho?.mensagem).not.toContain("instagram_story_respondido");
  });

  /* Renomear ganha de tudo: se a pessoa chamou aquele bloco de "Promo de outubro", é esse o nome
     que ela vai procurar no quadro. */
  it("o nome dado pela pessoa ganha do nome da biblioteca", () => {
    const problemas = validarFluxo(fluxo([{ ...soltoNoFluxo, titulo: "Promo de outubro" }]));
    const doGatilho = problemas.find((p) => p.mensagem.includes("não leva a passo nenhum"));
    expect(doGatilho?.mensagem).toContain("Promo de outubro");
  });

  /* A frase diz o que fazer, e não só o que está errado. */
  it("diz onde clicar pra resolver", () => {
    const problemas = validarFluxo(fluxo([soltoNoFluxo]));
    const doGatilho = problemas.find((p) => p.mensagem.includes("não leva a passo nenhum"));
    expect(doGatilho?.mensagem).toContain("+");
    expect(doGatilho?.severidade).toBe("aviso");
  });
});

/**
 * BLOCO SOLTO NÃO TRAVA A PUBLICAÇÃO.
 *
 * "Condição não precisa estar ligada a nada." O bloco que ninguém alcança continua sendo apontado
 * — ele nunca vai rodar, e isso precisa aparecer —, mas como AVISO: largar um bloco no quadro e
 * ligar depois é como se monta uma automação, e o resto do robô, que está pronto, não pode ficar
 * sem ir pro ar por causa de uma peça ainda solta.
 *
 * O erro de verdade continua sendo erro: fluxo sem gatilho nenhum é o robô que não roda.
 */
describe("bloco sem nada antes dele", () => {
  const condicaoSolta = {
    id: "c9",
    type: "condicao_ramos",
    category: "condicao",
    titulo: "CONDICAO SEGUIDOR",
    position: { x: 3, y: 3 },
    data: { ramos: [{ id: "r1", titulo: "Seguidor", grupo: { id: "g", tipo: "E", regras: [{ id: "x", campo: "ig_seguidor", operador: "verdadeiro" }], subgrupos: [] } }] },
  };

  it("é aviso, e não erro que impede publicar", () => {
    const problemas = validarFluxo(fluxo([gatilho, condicaoSolta]));
    const solto = problemas.find((p) => p.mensagem.includes("Nada leva até"));
    expect(solto?.severidade).toBe("aviso");
    expect(solto?.nodeId).toBe("c9");
  });

  /* A frase diz o que acontece ("o robô nunca passa por ele") e as duas saídas: ligar ou tirar. */
  it("diz o que acontece e o que fazer", () => {
    const problemas = validarFluxo(fluxo([gatilho, condicaoSolta]));
    const solto = problemas.find((p) => p.mensagem.includes("Nada leva até"));
    expect(solto?.mensagem).toContain("nunca passa por ele");
    expect(solto?.mensagem).toContain("CONDICAO SEGUIDOR");
  });

  /* Fluxo sem gatilho nenhum continua sendo ERRO: aí não é uma peça solta, é o robô inteiro que
     não tem o que o faça começar. */
  it("fluxo sem gatilho continua sendo erro", () => {
    const problemas = validarFluxo(fluxo([condicaoSolta]));
    expect(
      problemas.some((p) => p.severidade === "erro" && p.mensagem.includes("Nada dispara esta automação")),
    ).toBe(true);
  });

  /*
   * O COMEÇO DO DESENHO NÃO LEVA A PENDÊNCIA DE BLOCO SOLTO.
   *
   * Sem bloco de gatilho, o editor desenha a pastilha "Iniciar robô" ligada ao primeiro bloco. A
   * tela mostrava a linha chegando nele e, em cima dele, uma pendência dizendo que nada chegava —
   * as duas coisas ao mesmo tempo, no mesmo lugar. O problema de verdade é um só, e é o erro de
   * cima: o fluxo não tem gatilho.
   */
  it("o primeiro bloco de um fluxo sem gatilho não é acusado de solto", () => {
    const problemas = validarFluxo(fluxo([condicaoSolta]));
    expect(problemas.some((p) => p.mensagem.includes("Nada leva até"))).toBe(false);
  });

  /* O SEGUNDO pedaço largado no canto continua sendo apontado: isso é outra coisa, e continua
     precisando de caminho. */
  it("um segundo bloco solto continua sendo apontado", () => {
    const outraSolta = { ...condicaoSolta, id: "c8", titulo: "OUTRA CONDICAO" };
    const problemas = validarFluxo(fluxo([condicaoSolta, outraSolta]));
    const soltos = problemas.filter((p) => p.mensagem.includes("Nada leva até"));
    expect(soltos).toHaveLength(1);
    expect(soltos[0]?.mensagem).toContain("OUTRA CONDICAO");
  });
});
