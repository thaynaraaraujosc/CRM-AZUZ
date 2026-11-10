import { describe, expect, it } from "vitest";

import { avaliarGrupoCondicoes, booleanoDoValor, dataDoValor, diaEmSaoPaulo } from "../avaliacao";
import {
  ehCampoDeInstagram,
  operadoresDoCampo,
  pedeNumeroDeDias,
  pedeValor,
  pedeVariosValores,
  tipoDoCampo,
} from "../campos-condicao";
import type { CampoCondicao, GrupoCondicoes, OperadorCondicao, RegraCondicao } from "../types";

/**
 * O BLOCO DE CONDIÇÃO, TIPO POR TIPO.
 *
 * Cada operador aqui decide pra onde um lead vai no meio de uma conversa, e o erro nunca aparece
 * como erro: a regra fica na tela com cara de configurada e manda todo mundo pelo caminho errado.
 * Por isso o teste é por OPERADOR, e não por tela.
 */
function regra(r: Partial<RegraCondicao>): RegraCondicao {
  return {
    id: "r1",
    campo: (r.campo ?? "mensagem") as CampoCondicao,
    operador: (r.operador ?? "igual") as OperadorCondicao,
    valor: r.valor,
    valorFim: r.valorFim,
    valores: r.valores,
    fonteValor: r.fonteValor,
  };
}

function grupo(tipo: "E" | "OU", ...regras: Partial<RegraCondicao>[]): GrupoCondicoes {
  return { id: "g", tipo, regras: regras.map(regra), subgrupos: [] };
}

const contato = (campos: Record<string, unknown>) => campos as never;
const agora = new Date("2026-11-10T15:00:00-03:00");

function vale(r: Partial<RegraCondicao>, campos: Record<string, unknown>): boolean {
  return avaliarGrupoCondicoes(grupo("E", r), contato(campos), agora);
}

describe("texto", () => {
  it("compara sem maiúscula e sem acento", () => {
    expect(vale({ campo: "mensagem", operador: "igual", valor: "Orçamento" }, { mensagem: "orcamento" })).toBe(true);
    expect(vale({ campo: "mensagem", operador: "contem", valor: "preco" }, { mensagem: "Qual o PREÇO?" })).toBe(true);
    expect(vale({ campo: "mensagem", operador: "nao_contem", valor: "preco" }, { mensagem: "Oi" })).toBe(true);
    expect(vale({ campo: "mensagem", operador: "comeca_com", valor: "oi" }, { mensagem: "Oi, tudo bem" })).toBe(true);
    expect(vale({ campo: "mensagem", operador: "termina_com", valor: "bem" }, { mensagem: "Oi, tudo bem" })).toBe(true);
  });

  it("existe e não existe olham o campo, não o valor", () => {
    expect(vale({ campo: "cidade", operador: "existe" }, { cidade: "Recife" })).toBe(true);
    expect(vale({ campo: "cidade", operador: "existe" }, {})).toBe(false);
    expect(vale({ campo: "cidade", operador: "nao_existe" }, {})).toBe(true);
    expect(vale({ campo: "cidade", operador: "nao_existe" }, { cidade: "" })).toBe(true);
  });
});

describe("número", () => {
  const valor = { valor_negocio: "R$ 4.800,50" };

  it("entende dinheiro escrito como gente escreve", () => {
    expect(vale({ campo: "valor_negocio", operador: "maior_que", valor: "1000" }, valor)).toBe(true);
    expect(vale({ campo: "valor_negocio", operador: "menor_que", valor: "1000" }, valor)).toBe(false);
  });

  it("maior ou igual e menor ou igual incluem a borda", () => {
    expect(vale({ campo: "tentativas", operador: "maior_igual", valor: "3" }, { tentativas: "3" })).toBe(true);
    expect(vale({ campo: "tentativas", operador: "maior_que", valor: "3" }, { tentativas: "3" })).toBe(false);
    expect(vale({ campo: "tentativas", operador: "menor_igual", valor: "3" }, { tentativas: "3" })).toBe(true);
    expect(vale({ campo: "tentativas", operador: "menor_que", valor: "3" }, { tentativas: "3" })).toBe(false);
  });

  it("entre inclui as duas pontas", () => {
    expect(vale({ campo: "tentativas", operador: "entre", valor: "2", valorFim: "5" }, { tentativas: "2" })).toBe(true);
    expect(vale({ campo: "tentativas", operador: "entre", valor: "2", valorFim: "5" }, { tentativas: "6" })).toBe(false);
  });
});

describe("booleano", () => {
  it("é verdadeiro / é falso leem o dado, não o texto 'sim'", () => {
    expect(vale({ campo: "ig_seguidor", operador: "verdadeiro" }, { igSegueVoce: true })).toBe(true);
    expect(vale({ campo: "ig_seguidor", operador: "falso" }, { igSegueVoce: false })).toBe(true);
    expect(vale({ campo: "ig_seguidor", operador: "verdadeiro" }, { igSegueVoce: false })).toBe(false);
  });

  /*
   * O CASO QUE MOTIVA O TIPO TER TRÊS RESPOSTAS.
   *
   * Sem o Instagram conectado, `igSegueVoce` é nulo. "É falso" não pode responder verdadeiro ali:
   * quem não se sabe não é quem não segue, e tratar os dois igual manda os seguidores pelo caminho
   * de quem nunca seguiu no dia em que o token vencer.
   */
  it("dado ausente não é verdadeiro nem falso", () => {
    expect(vale({ campo: "ig_seguidor", operador: "verdadeiro" }, {})).toBe(false);
    expect(vale({ campo: "ig_seguidor", operador: "falso" }, {})).toBe(false);
    expect(vale({ campo: "ig_seguidor", operador: "nao_existe" }, {})).toBe(true);
    expect(vale({ campo: "ig_seguidor", operador: "existe" }, { igSegueVoce: false })).toBe(true);
  });

  it("aceita o texto gravado por fluxos e colunas antigas", () => {
    expect(booleanoDoValor("Sim")).toBe(true);
    expect(booleanoDoValor("não")).toBe(false);
    expect(booleanoDoValor("true")).toBe(true);
    expect(booleanoDoValor("talvez")).toBeUndefined();
    expect(booleanoDoValor(undefined)).toBeUndefined();
  });
});

describe("data", () => {
  it("é hoje usa o fuso de São Paulo", () => {
    // 23h de Brasília é o dia seguinte em UTC: sem o fuso, "é hoje" responderia falso.
    const tarde = new Date("2026-11-10T23:30:00-03:00");
    expect(diaEmSaoPaulo(tarde)).toBe("2026-11-10");
    expect(avaliarGrupoCondicoes(
      grupo("E", { campo: "data_ultima_conversa", operador: "e_hoje" }),
      contato({ data_ultima_conversa: "2026-11-10" }),
      tarde,
    )).toBe(true);
  });

  it("nos últimos X dias e há mais de X dias", () => {
    const campos = { data_ultima_conversa: "2026-11-05" };
    expect(vale({ campo: "data_ultima_conversa", operador: "ultimos_dias", valor: "7" }, campos)).toBe(true);
    expect(vale({ campo: "data_ultima_conversa", operador: "ultimos_dias", valor: "3" }, campos)).toBe(false);
    expect(vale({ campo: "data_ultima_conversa", operador: "ha_mais_de_dias", valor: "3" }, campos)).toBe(true);
    expect(vale({ campo: "data_ultima_conversa", operador: "ha_mais_de_dias", valor: "7" }, campos)).toBe(false);
  });

  it("antes de e depois de continuam valendo", () => {
    const campos = { data_ultima_conversa: "2026-11-05" };
    expect(vale({ campo: "data_ultima_conversa", operador: "menor_que", valor: "2026-11-09" }, campos)).toBe(true);
    expect(vale({ campo: "data_ultima_conversa", operador: "maior_que", valor: "2026-11-09" }, campos)).toBe(false);
  });

  it("campo sem data não responde verdadeiro por acaso", () => {
    expect(vale({ campo: "data_ultima_conversa", operador: "e_hoje" }, {})).toBe(false);
    expect(vale({ campo: "data_ultima_conversa", operador: "ultimos_dias", valor: "7" }, {})).toBe(false);
    expect(dataDoValor("nada disso é data")).toBeUndefined();
    expect(dataDoValor("05/11/2026")?.getFullYear()).toBe(2026);
  });
});

describe("lista", () => {
  it("é um destes e não é nenhum destes", () => {
    const campos = { etapa: "Qualificado" };
    expect(vale({ campo: "etapa", operador: "um_destes", valores: ["Novo", "Qualificado"] }, campos)).toBe(true);
    expect(vale({ campo: "etapa", operador: "um_destes", valores: ["Novo", "Perdido"] }, campos)).toBe(false);
    expect(vale({ campo: "etapa", operador: "nenhum_destes", valores: ["Novo", "Perdido"] }, campos)).toBe(true);
  });

  it("lista de valores vazia não pega todo mundo", () => {
    expect(vale({ campo: "etapa", operador: "um_destes", valores: [] }, { etapa: "Novo" })).toBe(false);
    expect(vale({ campo: "etapa", operador: "nenhum_destes", valores: [] }, { etapa: "Novo" })).toBe(false);
  });
});

describe("multi-valor (etiquetas)", () => {
  const comEtiquetas = { etiquetas: ["Cliente", "VIP"] };

  /*
   * O DEFEITO QUE ISTO FECHA.
   *
   * Enquanto a etiqueta era tratada como lista, "é igual a: VIP" comparava "vip" com
   * "cliente,vip" — e só batia em quem tivesse exatamente UMA etiqueta. Quem tinha duas ficava de
   * fora da própria regra que o descrevia.
   */
  it("tem e não tem olham o conjunto, não o texto grudado", () => {
    expect(vale({ campo: "etiqueta", operador: "tem", valores: ["VIP"] }, comEtiquetas)).toBe(true);
    expect(vale({ campo: "etiqueta", operador: "tem", valores: ["Frio"] }, comEtiquetas)).toBe(false);
    expect(vale({ campo: "etiqueta", operador: "nao_tem", valores: ["Frio"] }, comEtiquetas)).toBe(true);
  });

  it("qualquer uma, todas e nenhuma são três perguntas diferentes", () => {
    expect(vale({ campo: "etiqueta", operador: "tem_qualquer", valores: ["VIP", "Frio"] }, comEtiquetas)).toBe(true);
    expect(vale({ campo: "etiqueta", operador: "tem_todas", valores: ["VIP", "Frio"] }, comEtiquetas)).toBe(false);
    expect(vale({ campo: "etiqueta", operador: "tem_todas", valores: ["VIP", "Cliente"] }, comEtiquetas)).toBe(true);
    expect(vale({ campo: "etiqueta", operador: "nao_tem_nenhuma", valores: ["Frio"] }, comEtiquetas)).toBe(true);
    expect(vale({ campo: "etiqueta", operador: "nao_tem_nenhuma", valores: ["VIP"] }, comEtiquetas)).toBe(false);
  });

  it("contato sem etiqueta nenhuma", () => {
    expect(vale({ campo: "etiqueta", operador: "tem", valores: ["VIP"] }, { etiquetas: [] })).toBe(false);
    expect(vale({ campo: "etiqueta", operador: "nao_tem_nenhuma", valores: ["VIP"] }, { etiquetas: [] })).toBe(true);
  });
});

describe("campos do Instagram", () => {
  it("o @ é comparado sem o arroba, venha ele de onde vier", () => {
    expect(vale({ campo: "ig_arroba", operador: "igual", valor: "azuz.digital" }, { instagram: "@azuz.digital" })).toBe(true);
  });

  it("o tipo de interação e o post vêm do evento", () => {
    const evento = { ig_tipo_interacao: "comentario", ig_post_id: "178..." };
    expect(vale({ campo: "ig_tipo_interacao", operador: "igual", valor: "comentario" }, evento)).toBe(true);
    expect(vale({ campo: "ig_tipo_interacao", operador: "um_destes", valores: ["story_respondido", "comentario"] }, evento)).toBe(true);
    expect(vale({ campo: "ig_post_id", operador: "existe" }, evento)).toBe(true);
  });

  it("a janela de 24h é booleana de três respostas", () => {
    expect(vale({ campo: "ig_janela_24h", operador: "verdadeiro" }, { ig_janela_24h: true })).toBe(true);
    expect(vale({ campo: "ig_janela_24h", operador: "falso" }, { ig_janela_24h: false })).toBe(true);
    expect(vale({ campo: "ig_janela_24h", operador: "nao_existe" }, {})).toBe(true);
  });

  it("nº de seguidores compara como número", () => {
    expect(vale({ campo: "ig_seguidores", operador: "maior_que", valor: "1000" }, { igSeguidores: 5400 })).toBe(true);
    expect(vale({ campo: "ig_seguidores", operador: "maior_que", valor: "1000" }, { igSeguidores: 400 })).toBe(false);
  });

  it("todos os campos do grupo são reconhecidos como de Instagram", () => {
    expect(ehCampoDeInstagram("ig_seguidor")).toBe(true);
    expect(ehCampoDeInstagram("mensagem")).toBe(false);
  });
});

describe("E / OU", () => {
  const campos = { mensagem: "quero orçamento", cidade: "Recife" };

  it("E quer todas; OU quer uma", () => {
    const duas = [
      { campo: "mensagem" as const, operador: "contem" as const, valor: "orcamento" },
      { campo: "cidade" as const, operador: "igual" as const, valor: "São Paulo" },
    ];
    expect(avaliarGrupoCondicoes(grupo("E", ...duas), contato(campos), agora)).toBe(false);
    expect(avaliarGrupoCondicoes(grupo("OU", ...duas), contato(campos), agora)).toBe(true);
  });

  it("OU com todas falsas é falso", () => {
    expect(
      avaliarGrupoCondicoes(
        grupo("OU", { campo: "cidade", operador: "igual", valor: "Curitiba" }),
        contato(campos),
        agora,
      ),
    ).toBe(false);
  });
});

describe("o catálogo e a tela", () => {
  it("cada tipo oferece só operadores que o motor entende", () => {
    expect(tipoDoCampo("etiqueta")).toBe("multi");
    expect(tipoDoCampo("ig_seguidor")).toBe("booleano");
    expect(tipoDoCampo("ig_seguidores")).toBe("numero");
    expect(operadoresDoCampo("ig_seguidor").map((o) => o.valor)).toContain("verdadeiro");
    expect(operadoresDoCampo("etiqueta").map((o) => o.valor)).toContain("tem_todas");
    expect(operadoresDoCampo("data_ultima_conversa").map((o) => o.valor)).toContain("ultimos_dias");
  });

  it("operador sem valor não pede campo de valor", () => {
    expect(pedeValor("verdadeiro")).toBe(false);
    expect(pedeValor("e_hoje")).toBe(false);
    expect(pedeValor("existe")).toBe(false);
    expect(pedeValor("igual")).toBe(true);
    expect(pedeVariosValores("tem_todas")).toBe(true);
    expect(pedeNumeroDeDias("ultimos_dias")).toBe(true);
  });
});

/**
 * COMPATIBILIDADE: fluxo publicado antes disto continua decidindo igual.
 *
 * Nenhuma condição gravada é migrada — ela é LIDA como sempre foi. Se algum destes quebrar, há
 * automação no ar mudando de comportamento sozinha.
 */
describe("fluxos antigos", () => {
  it("booleano gravado como 'é igual a: sim' continua valendo", () => {
    expect(vale({ campo: "respondeu", operador: "igual", valor: "sim" }, { respondeu: "sim" })).toBe(true);
    expect(vale({ campo: "respondeu", operador: "igual", valor: "sim" }, { ultimaRespostaEm: "2026-11-01" })).toBe(true);
    expect(vale({ campo: "respondeu", operador: "diferente", valor: "sim" }, {})).toBe(true);
  });

  it("etiqueta gravada com contém continua valendo", () => {
    expect(vale({ campo: "etiqueta", operador: "contem", valor: "VIP" }, { etiquetas: ["Cliente", "VIP"] })).toBe(true);
  });

  it("grupo sem tipo gravado cai no E, como antes", () => {
    const antigo = { id: "g", tipo: "E" as const, regras: [regra({ campo: "cidade", operador: "existe" })], subgrupos: [] };
    expect(avaliarGrupoCondicoes(antigo, contato({ cidade: "Recife" }), agora)).toBe(true);
  });
});
