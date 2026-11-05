import { describe, expect, it } from "vitest";

import { avaliarGrupoCondicoes } from "../avaliacao";
import { saidasDoNo } from "../resumo";
import type { CondicaoRamosData, FlowNode, GrupoCondicoes, OperadorCondicao } from "../types";

function grupo(...regras: { campo?: string; operador: OperadorCondicao; valor?: string; valorFim?: string }[]): GrupoCondicoes {
  return {
    id: "g",
    tipo: "E",
    regras: regras.map((r, i) => ({
      id: `r${i}`,
      campo: (r.campo ?? "mensagem") as never,
      operador: r.operador,
      valor: r.valor,
      valorFim: r.valorFim,
    })),
    subgrupos: [],
  };
}

const contato = (campos: Record<string, unknown>) => campos as never;

describe("regras de condição: como o texto é comparado", () => {
  it("ignora maiúscula, acento e espaço sobrando", () => {
    // Quem escreve a regra digita "consulta"; quem responde manda "  Consultá ". Era pra bater, e
    // antes não batia: o acento sozinho mandava o lead pelo caminho errado.
    const regra = grupo({ operador: "igual", valor: "consulta" });
    expect(avaliarGrupoCondicoes(regra, contato({ mensagem: "  Consultá " }))).toBe(true);
  });

  it("\"contém\" acha a palavra no meio da frase", () => {
    const regra = grupo({ operador: "contem", valor: "agendar" });
    expect(avaliarGrupoCondicoes(regra, contato({ mensagem: "Quero AGENDAR uma consulta" }))).toBe(true);
    expect(avaliarGrupoCondicoes(regra, contato({ mensagem: "Quero saber o preço" }))).toBe(false);
  });

  it("\"começa com\" e \"termina com\" comparam de verdade", () => {
    /*
     * OS DOIS ACEITAVAM TUDO.
     *
     * Estavam na lista de operadores do formulário e não tinham caso no avaliador: caíam no
     * `default`, que devolve `true`. A regra parecia configurada e passava sempre — o pior tipo
     * de defeito numa condição, porque o fluxo roda e não há erro nenhum pra ver.
     */
    expect(avaliarGrupoCondicoes(grupo({ operador: "comeca_com", valor: "oi" }), contato({ mensagem: "Oi, tudo bem?" }))).toBe(true);
    expect(avaliarGrupoCondicoes(grupo({ operador: "comeca_com", valor: "oi" }), contato({ mensagem: "Bom dia" }))).toBe(false);
    expect(avaliarGrupoCondicoes(grupo({ operador: "termina_com", valor: "?" }), contato({ mensagem: "Vocês atendem hoje?" }))).toBe(true);
    expect(avaliarGrupoCondicoes(grupo({ operador: "termina_com", valor: "?" }), contato({ mensagem: "Obrigada" }))).toBe(false);
  });

  it("\"existe\" e \"não existe\" olham o campo vazio, não o texto", () => {
    expect(avaliarGrupoCondicoes(grupo({ campo: "cidade", operador: "existe" }), contato({ cidade: "Goiânia" }))).toBe(true);
    expect(avaliarGrupoCondicoes(grupo({ campo: "cidade", operador: "existe" }), contato({ cidade: "" }))).toBe(false);
    expect(avaliarGrupoCondicoes(grupo({ campo: "cidade", operador: "nao_existe" }), contato({}))).toBe(true);
  });

  it("\"entre\" inclui os dois limites", () => {
    const regra = grupo({ campo: "valor_negocio", operador: "entre", valor: "100", valorFim: "200" });
    expect(avaliarGrupoCondicoes(regra, contato({ valor_negocio: "100" }))).toBe(true);
    expect(avaliarGrupoCondicoes(regra, contato({ valor_negocio: "200" }))).toBe(true);
    expect(avaliarGrupoCondicoes(regra, contato({ valor_negocio: "201" }))).toBe(false);
  });

  it("as regras de um ramo valem JUNTAS", () => {
    const regra = grupo({ operador: "contem", valor: "consulta" }, { campo: "origem", operador: "igual", valor: "instagram" });
    expect(avaliarGrupoCondicoes(regra, contato({ mensagem: "quero consulta", origem: "Instagram" }))).toBe(true);
    expect(avaliarGrupoCondicoes(regra, contato({ mensagem: "quero consulta", origem: "Google" }))).toBe(false);
  });

  it("ramo SEM regra nenhuma é verdadeiro: ele pega todo mundo", () => {
    // Documentado porque é contraintuitivo e tem consequência: um ramo vazio apaga os de baixo.
    // A validação do fluxo cobra isso antes de publicar, e o cartão escreve a frase.
    expect(avaliarGrupoCondicoes(grupo(), contato({ mensagem: "qualquer coisa" }))).toBe(true);
  });
});

describe("as saídas do bloco de condição com ramos", () => {
  function bloco(data: CondicaoRamosData): FlowNode {
    return { id: "c1", type: "condicao_ramos", category: "condicao", position: { x: 0, y: 0 }, data } as unknown as FlowNode;
  }

  it("uma saída por caminho, na ordem, e a padrão por último", () => {
    const saidas = saidasDoNo(
      bloco({
        ramos: [
          { id: "ra", rotulo: "Agendamento", grupo: grupo({ operador: "contem", valor: "agendar" }) },
          { id: "rb", grupo: grupo({ operador: "contem", valor: "preço" }) },
        ],
      }),
    );
    expect(saidas.map((s) => s.handleId)).toEqual(["ra", "rb", "senao"]);
    expect(saidas[0].label).toBe("Agendamento");
    // Sem nome, a saída mostra o resumo das regras: é o que permite ler o bloco pelo desenho.
    expect(saidas[1].label).toContain("contém");
    expect(saidas[2].label).toBe("Nenhuma das condições");
  });

  it("a saída padrão existe mesmo sem nenhum caminho", () => {
    expect(saidasDoNo(bloco({ ramos: [] })).map((s) => s.handleId)).toEqual(["senao"]);
  });
});
