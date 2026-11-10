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
