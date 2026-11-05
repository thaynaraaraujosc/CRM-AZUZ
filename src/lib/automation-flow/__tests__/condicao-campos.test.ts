import { describe, expect, it } from "vitest";

import { avaliarGrupoCondicoes, numeroDeTexto } from "../avaliacao";
import {
  campoDeCondicaoExiste,
  operadoresDoCampo,
  regraPadrao,
  rotuloDoCampo,
  rotuloDoOperador,
} from "../campos-condicao";
import { resumoNo, saidasDoNo } from "../resumo";
import { condicaoCobre, intervaloInvertido, validarFluxo } from "../validacao";
import { rastreioParaCondicoes } from "../disparar-no-servidor";
import type { CondicaoRamosData, FlowNode, GrupoCondicoes, OperadorCondicao, RegraCondicao } from "../types";

function grupo(...regras: Partial<RegraCondicao>[]): GrupoCondicoes {
  return {
    id: "g",
    tipo: "E",
    regras: regras.map((r, i) => ({
      id: `r${i}`,
      campo: (r.campo ?? "mensagem") as never,
      operador: (r.operador ?? "igual") as OperadorCondicao,
      valor: r.valor,
      valorFim: r.valorFim,
      fonteValor: r.fonteValor,
      campoPersonalizadoNome: r.campoPersonalizadoNome,
    })),
    subgrupos: [],
  };
}

const contato = (campos: Record<string, unknown>) => campos as never;

function noDeCondicao(ramos: CondicaoRamosData["ramos"]): FlowNode {
  return {
    id: "c1",
    type: "condicao_ramos",
    category: "condicao",
    position: { x: 0, y: 0 },
    data: { ramos },
  } as unknown as FlowNode;
}

describe("catálogo: cada campo só oferece o que faz sentido pra ele", () => {
  it("data não oferece \"começa com\", e booleano só oferece é/não é", () => {
    // Eram os mesmos onze operadores em todo campo. "Data da última conversa começa com" é uma
    // regra que a tela aceitava e que nunca podia ser verdadeira.
    const daData = operadoresDoCampo("data_ultima_conversa").map((o) => o.valor);
    expect(daData).not.toContain("comeca_com");
    expect(daData).toContain("entre");
    expect(operadoresDoCampo("respondeu").map((o) => o.valor)).toEqual(["igual", "diferente"]);
    expect(operadoresDoCampo("etiqueta").map((o) => o.valor)).toEqual(["igual", "diferente", "existe", "nao_existe"]);
  });

  it("o mesmo operador muda de nome conforme o campo", () => {
    expect(rotuloDoOperador("menor_que", "data_ultima_conversa")).toBe("antes de");
    expect(rotuloDoOperador("menor_que", "valor_negocio")).toBe("menor que");
    expect(rotuloDoOperador("igual", "respondeu")).toBe("é");
  });

  it("\"Cliente enviar\" existe na lista, e é a regra com que todo caminho nasce", () => {
    // Era o campo mais usado de todos e NÃO estava na lista do painel: o `<select>` mostrava a
    // primeira opção ("Canal") enquanto o dado gravado continuava `mensagem`, e a saída do bloco
    // anunciava um terceiro nome. Uma lista só, e o padrão sai dela.
    expect(campoDeCondicaoExiste("mensagem")).toBe(true);
    expect(rotuloDoCampo("mensagem")).toBe("Cliente enviar (última mensagem)");
    expect(regraPadrao("r1")).toMatchObject({ campo: "mensagem", operador: "igual" });
  });

  it("campo da empresa (`cp:`) é aceito; campo que saiu do produto, não", () => {
    expect(campoDeCondicaoExiste("cp:a1b2")).toBe(true);
    expect(campoDeCondicaoExiste("nps")).toBe(false);
  });
});

describe("números escritos como dinheiro", () => {
  it("entende cifrão, ponto de milhar e vírgula decimal", () => {
    expect(numeroDeTexto("R$ 4.800,50")).toBe(4800.5);
    expect(numeroDeTexto("1.200")).toBe(1200);
    expect(numeroDeTexto("1.5")).toBe(1.5);
    expect(numeroDeTexto("abc")).toBeUndefined();
    expect(numeroDeTexto("")).toBeUndefined();
  });

  it("\"valor do negócio maior que\" passa a funcionar com o valor do jeito que ele é guardado", () => {
    // `Number("R$ 4.800")` é NaN, e comparação com NaN é sempre falsa: a regra nunca batia pra
    // ninguém e o caminho ficava morto sem nenhum aviso.
    const regra = grupo({ campo: "valor_negocio", operador: "maior_que", valor: "1000" });
    expect(avaliarGrupoCondicoes(regra, contato({ valor: "R$ 4.800" }))).toBe(true);
    expect(avaliarGrupoCondicoes(regra, contato({ valor: "R$ 800" }))).toBe(false);
  });
});

describe("data e hora comparam como data e hora", () => {
  it("\"antes de\" e \"depois de\" funcionam numa data", () => {
    const antes = grupo({ campo: "data_ultima_conversa", operador: "menor_que", valor: "2026-11-01" });
    expect(avaliarGrupoCondicoes(antes, contato({ data_ultima_conversa: "2026-10-20" }))).toBe(true);
    expect(avaliarGrupoCondicoes(antes, contato({ data_ultima_conversa: "2026-11-20" }))).toBe(false);
  });

  it("\"entre\" com horas inclui os dois limites", () => {
    const regra = grupo({ campo: "horario", operador: "entre", valor: "09:00", valorFim: "18:00" });
    expect(avaliarGrupoCondicoes(regra, contato({ horario: "09:00" }))).toBe(true);
    expect(avaliarGrupoCondicoes(regra, contato({ horario: "13:30" }))).toBe(true);
    expect(avaliarGrupoCondicoes(regra, contato({ horario: "18:01" }))).toBe(false);
  });

  it("campo sem valor não é maior nem menor que nada", () => {
    // Antes `Number(undefined ?? 0)` virava 0, e "valor maior que -1" era verdadeiro pra quem não
    // tinha valor nenhum.
    const regra = grupo({ campo: "valor_negocio", operador: "maior_que", valor: "-1" });
    expect(avaliarGrupoCondicoes(regra, contato({}))).toBe(false);
  });
});

describe("de onde vem o valor comparado", () => {
  it("compara um campo com OUTRO campo do mesmo lead", () => {
    const regra = grupo({ campo: "mensagem", operador: "contem", fonteValor: "{primeiro_nome}" });
    expect(avaliarGrupoCondicoes(regra, contato({ mensagem: "aqui é a Marina", nome: "Marina Alves" }))).toBe(true);
    expect(avaliarGrupoCondicoes(regra, contato({ mensagem: "aqui é o João", nome: "Marina Alves" }))).toBe(false);
  });

  it("\"não preenchido\" compara com vazio", () => {
    const regra = grupo({ campo: "cargo", operador: "igual", fonteValor: "vazio" });
    expect(avaliarGrupoCondicoes(regra, contato({}))).toBe(true);
    expect(avaliarGrupoCondicoes(regra, contato({ cargo: "Diretora" }))).toBe(false);
  });
});

describe("campos que o CRM já guardava e a condição não enxergava", () => {
  it("campo criado pela empresa, pelo id", () => {
    const regra = grupo({ campo: "cp:a1b2" as never, operador: "igual", valor: "Turma A" });
    expect(avaliarGrupoCondicoes(regra, contato({ camposExtras: { a1b2: "Turma A" } }))).toBe(true);
    expect(avaliarGrupoCondicoes(regra, contato({ camposExtras: { a1b2: "Turma B" } }))).toBe(false);
  });

  it("perfil do Instagram: seguidor, verificado, e o que a Meta não contou", () => {
    const seguidor = grupo({ campo: "cliente_perfil", operador: "igual", valor: "seguidor" });
    expect(avaliarGrupoCondicoes(seguidor, contato({ igSegueVoce: true }))).toBe(true);
    expect(avaliarGrupoCondicoes(seguidor, contato({ igSegueVoce: false }))).toBe(false);
    // Sem a permissão do perfil o dado não existe — e "não existe" não é "não segue".
    expect(avaliarGrupoCondicoes(seguidor, contato({}))).toBe(false);
  });

  it("telefone e e-mail do contato, pelo nome que a tela usa", () => {
    const regra = grupo({ campo: "telefone_celular", operador: "existe" });
    expect(avaliarGrupoCondicoes(regra, contato({ whatsapp: "5562999990000" }))).toBe(true);
    expect(avaliarGrupoCondicoes(regra, contato({}))).toBe(false);
  });

  it("consentimento em branco é \"não se sabe\", não é \"não\"", () => {
    const naoExiste = grupo({ campo: "consentimento", operador: "nao_existe" });
    expect(avaliarGrupoCondicoes(naoExiste, contato({}))).toBe(true);
    expect(avaliarGrupoCondicoes(naoExiste, contato({ consentimentoWhatsApp: false }))).toBe(false);
  });
});

describe("o rastreio de origem vira campo de condição", () => {
  it("achata UTM e separa o código do clique pelo tipo", () => {
    expect(
      rastreioParaCondicoes({ utmSource: "google", cliqueId: "abc123", tipoDoClique: "gclid", anuncioId: "999" }),
    ).toEqual({ utm_source: "google", gclid: "abc123", meta_ads_anuncio: "999" });
    expect(rastreioParaCondicoes({ cliqueId: "xyz", tipoDoClique: "fbclid" })).toEqual({ fbclid: "xyz" });
    // Campo vazio fica FORA: "existe"/"não existe" precisa diferenciar "não veio de anúncio" de
    // "veio com o campo em branco".
    expect(rastreioParaCondicoes({ utmSource: "  " })).toEqual({});
    expect(rastreioParaCondicoes(null)).toEqual({});
  });
});

describe("a saída do bloco escreve a regra que está lá", () => {
  it("usa o campo real, e não o primeiro da lista", () => {
    const saidas = saidasDoNo(
      noDeCondicao([{ id: "a", grupo: grupo({ campo: "canal", operador: "igual", valor: "instagram" }) }]),
    );
    expect(saidas[0].label).toContain("Canal");
    expect(saidas[0].label).not.toContain("Resposta do contato");
  });

  it("\"entre\" pela metade não vira `entre \" e ?\"`", () => {
    const saidas = saidasDoNo(
      noDeCondicao([{ id: "a", grupo: grupo({ campo: "valor_negocio", operador: "entre", valor: "", valorFim: "" }) }]),
    );
    expect(saidas[0].label).toContain("(preencha os valores)");
    expect(saidas[0].label).not.toContain('"');
  });

  it("valor que vem de outro campo aparece pelo nome, não pelo token", () => {
    const saidas = saidasDoNo(
      noDeCondicao([{ id: "a", grupo: grupo({ campo: "mensagem", operador: "contem", fonteValor: "{primeiro_nome}" }) }]),
    );
    expect(saidas[0].label).toContain("Primeiro nome");
    expect(saidas[0].label).not.toContain("{");
  });

  it("o resumo do bloco conta as condições", () => {
    expect(resumoNo(noDeCondicao([{ id: "a", grupo: grupo({ operador: "igual", valor: "oi" }) }]))).toContain("1 condição");
  });
});

describe("uma condição que nunca acontece", () => {
  it("\"contém oi\" em cima apaga \"é igual a oi\" embaixo", () => {
    expect(
      condicaoCobre(grupo({ operador: "contem", valor: "oi" }), grupo({ operador: "igual", valor: "oi" })),
    ).toBe(true);
  });

  it("não acusa quando a de cima é mais estreita", () => {
    expect(
      condicaoCobre(grupo({ operador: "igual", valor: "oi" }), grupo({ operador: "contem", valor: "oi" })),
    ).toBe(false);
    // Campos diferentes não se cobrem.
    expect(
      condicaoCobre(grupo({ campo: "canal", operador: "igual", valor: "x" }), grupo({ operador: "igual", valor: "x" })),
    ).toBe(false);
  });

  it("intervalo que começa depois de onde termina", () => {
    expect(intervaloInvertido("500", "100")).toBe(true);
    expect(intervaloInvertido("100", "500")).toBe(false);
    expect(intervaloInvertido("2026-12-01", "2026-01-01")).toBe(true);
    expect(intervaloInvertido("", "100")).toBe(false);
  });
});

describe("o que a aba Problemas cobra antes de publicar", () => {
  const fluxo = (ramos: CondicaoRamosData["ramos"]) => ({
    nodes: [noDeCondicao(ramos)],
    edges: [],
    configuracoes: {},
  });

  it("condição sem regra é erro mesmo sendo a última", () => {
    // Era aviso: "um caminho largo". Não é — ela pega todo mundo e "Nenhuma das condições" nunca
    // acontece, com o bloco continuando com cara de configurado.
    const problemas = validarFluxo(fluxo([{ id: "a", grupo: { id: "g", tipo: "E", regras: [], subgrupos: [] } }]) as never);
    expect(problemas.some((p) => p.severidade === "erro" && p.mensagem.includes("sem regra"))).toBe(true);
  });

  it("operador que não combina com o tipo do campo é AVISO, pra não travar fluxo publicado", () => {
    // Há fluxos rodando com "Data começa com": a tela oferecia os onze operadores pra todo campo.
    // Virar erro impediria de republicar um fluxo que funciona hoje por uma escolha que o próprio
    // produto ofereceu.
    const problemas = validarFluxo(
      fluxo([{ id: "a", grupo: grupo({ campo: "data_ultima_conversa", operador: "comeca_com", valor: "2026" }) }]) as never,
    );
    const achado = problemas.find((p) => p.mensagem.includes("não combina com esse tipo"));
    expect(achado?.severidade).toBe("aviso");
  });

  it("campo que não existe mais é erro", () => {
    const problemas = validarFluxo(fluxo([{ id: "a", grupo: grupo({ campo: "nps" as never, operador: "igual", valor: "9" }) }]) as never);
    expect(problemas.some((p) => p.severidade === "erro" && p.mensagem.includes("não existe mais"))).toBe(true);
  });

  it("\"entre\" invertido é erro", () => {
    const problemas = validarFluxo(
      fluxo([{ id: "a", grupo: grupo({ campo: "valor_negocio", operador: "entre", valor: "500", valorFim: "100" }) }]) as never,
    );
    expect(problemas.some((p) => p.severidade === "erro" && p.mensagem.includes("começa depois"))).toBe(true);
  });

  it("condição inalcançável é aviso, não erro", () => {
    const problemas = validarFluxo(
      fluxo([
        { id: "a", grupo: grupo({ operador: "contem", valor: "oi" }) },
        { id: "b", grupo: grupo({ operador: "igual", valor: "oi" }) },
      ]) as never,
    );
    const inalcancavel = problemas.find((p) => p.mensagem.includes("nunca acontece"));
    expect(inalcancavel?.severidade).toBe("aviso");
  });

  it("fluxo antigo, com a regra preenchida, não ganha erro NA CONDIÇÃO", () => {
    // O recorte importa: um fluxo de teste sem gatilho e sem fim tem erros de ESTRUTURA, que não
    // têm nada a ver com a regra. O que esta garantia cobre é que nada do que mudou aqui passou a
    // reprovar uma condição que já estava publicada e certa.
    const problemas = validarFluxo(
      fluxo([{ id: "a", grupo: grupo({ campo: "mensagem", operador: "contem", valor: "orçamento" }) }]) as never,
    );
    const daCondicao = problemas.filter(
      (p) => p.severidade === "erro" && (p.mensagem.includes("condição") || p.mensagem.includes("regra")),
    );
    expect(daCondicao).toEqual([]);
  });
});
