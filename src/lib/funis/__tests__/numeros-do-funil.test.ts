import { describe, expect, it } from "vitest";

import {
  funilDoNumero,
  numerosDisponiveis,
  numerosDoFunil,
  porQueNaoPodeUsarEstesNumeros,
} from "@/lib/funis/numeros-do-funil";

/**
 * O QUE ESTES TESTES PROTEGEM, nos dois sentidos:
 *
 *  · AFROUXAR DEMAIS: deixar um número alimentar dois funis faz metade dos leads sumir de um deles
 *    sem explicação. A mensagem que chega cai num lugar só.
 *
 *  · AFROUXAR DE MENOS: o funil criado ANTES desta mudança guarda o número na coluna antiga. Se a
 *    leitura nova ignorasse aquela coluna, todo funil existente apareceria "sem número" no dia da
 *    publicação — e deixaria de receber.
 */

const OFICIAL = "meta_whatsapp:111";
const QR = "whatsapp_nao_oficial:5562994361377";
const TERCEIRO = "whatsapp_nao_oficial:5511999998888";

const numero = (chave: string, nome: string, status = "conectado") => ({
  chave,
  nome,
  provedor: chave.split(":")[0],
  status,
});

describe("numerosDoFunil", () => {
  it("lê o formato antigo e o novo juntos", () => {
    expect(numerosDoFunil({ id: "f", nome: "F", contaCanal: OFICIAL })).toEqual([OFICIAL]);
    expect(numerosDoFunil({ id: "f", nome: "F", contaCanais: [OFICIAL, QR] })).toEqual([OFICIAL, QR]);
  });

  it("o número antigo vem primeiro e não se repete quando está nas duas fontes", () => {
    // Acontece de verdade: o funil antigo ganha a tabela nova e o número original entra nela.
    expect(
      numerosDoFunil({ id: "f", nome: "F", contaCanal: OFICIAL, contaCanais: [OFICIAL, QR] }),
    ).toEqual([OFICIAL, QR]);
  });

  it("funil sem número nenhum devolve lista vazia, não um buraco", () => {
    expect(numerosDoFunil({ id: "f", nome: "F" })).toEqual([]);
    expect(numerosDoFunil({ id: "f", nome: "F", contaCanal: null, contaCanais: null })).toEqual([]);
  });

  it("chave vazia não conta como número", () => {
    // Conexão de QR Code cujo número o CRM ainda não descobriu tem chave "".
    expect(numerosDoFunil({ id: "f", nome: "F", contaCanal: "", contaCanais: [""] })).toEqual([]);
  });
});

describe("funilDoNumero", () => {
  const funis = [
    { id: "antigo", nome: "Funil - Comercial", contaCanal: OFICIAL },
    { id: "novo", nome: "Funil - Entrada", contaCanais: [QR, TERCEIRO] },
  ];

  it("acha pelo formato antigo e pelo novo", () => {
    expect(funilDoNumero(funis, OFICIAL)?.id).toBe("antigo");
    expect(funilDoNumero(funis, TERCEIRO)?.id).toBe("novo");
  });

  it("número de ninguém é de ninguém", () => {
    expect(funilDoNumero(funis, "meta_whatsapp:999")).toBeNull();
  });

  it("chave vazia nunca casa — senão toda conexão sem número viraria o mesmo funil", () => {
    expect(funilDoNumero([{ id: "x", nome: "X", contaCanal: "" }], "")).toBeNull();
  });
});

describe("numerosDisponiveis", () => {
  const todos = [numero(OFICIAL, "Comercial"), numero(QR, "Closer"), numero(TERCEIRO, "Suporte")];

  it("tira os que já são de outro funil", () => {
    const funis = [{ id: "a", nome: "A", contaCanais: [QR] }];
    expect(numerosDisponiveis(todos, funis).map((n) => n.chave)).toEqual([OFICIAL, TERCEIRO]);
  });

  it("editando um funil, os números DELE continuam na lista", () => {
    /*
     * Sem isto, abrir a edição mostraria os próprios números como indisponíveis e desmarcá-los
     * seria a única saída — a tela brigando com o que ela mesma gravou.
     */
    const funis = [{ id: "a", nome: "A", contaCanais: [QR] }];
    expect(numerosDisponiveis(todos, funis, "a").map((n) => n.chave)).toEqual([OFICIAL, QR, TERCEIRO]);
  });

  it("número desconectado fica de fora", () => {
    const comDesconectado = [numero(OFICIAL, "Comercial"), numero(QR, "Closer", "desconectado")];
    expect(numerosDisponiveis(comDesconectado, []).map((n) => n.chave)).toEqual([OFICIAL]);
  });
});

describe("porQueNaoPodeUsarEstesNumeros", () => {
  const todos = [numero(OFICIAL, "Comercial"), numero(QR, "Closer")];

  it("vários números no mesmo funil é o caso NORMAL agora", () => {
    expect(porQueNaoPodeUsarEstesNumeros([OFICIAL, QR], todos, [])).toBeNull();
  });

  it("funil sem número nenhum não faz sentido: ele não receberia nada", () => {
    expect(porQueNaoPodeUsarEstesNumeros([], todos, [])).toMatch(/pelo menos um número/i);
  });

  it("número que já é de outro funil é recusado, e a mensagem diz de qual", () => {
    const funis = [{ id: "a", nome: "Funil - Entrada", contaCanais: [QR] }];
    const erro = porQueNaoPodeUsarEstesNumeros([QR], todos, funis);
    expect(erro).toContain("Closer");
    expect(erro).toContain("Funil - Entrada");
  });

  it("mas os próprios números do funil editado passam", () => {
    const funis = [{ id: "a", nome: "Funil - Entrada", contaCanais: [QR] }];
    expect(porQueNaoPodeUsarEstesNumeros([QR, OFICIAL], todos, funis, "a")).toBeNull();
  });

  it("repetido na mesma escolha é recusado antes de estourar a chave única do banco", () => {
    expect(porQueNaoPodeUsarEstesNumeros([QR, QR], todos, [])).toMatch(/repetido/i);
  });

  it("número que não existe entre os conectados é recusado", () => {
    // O corpo da requisição não vem só da tela: aceitar uma chave qualquer gravaria um funil
    // ligado a uma conexão que não existe.
    expect(porQueNaoPodeUsarEstesNumeros(["meta_whatsapp:inventado"], todos, [])).toMatch(
      /não está entre os conectados/i,
    );
  });

  it("número desconectado é recusado com o nome dele", () => {
    const comDesconectado = [numero(OFICIAL, "Comercial"), numero(QR, "Closer", "desconectado")];
    expect(porQueNaoPodeUsarEstesNumeros([QR], comDesconectado, [])).toContain("Closer");
  });
});
