import { describe, expect, it } from "vitest";

import { filtrarOpcoes, opcaoCasaComBusca, semAcento } from "../busca-de-opcoes";
import { camposDaArea } from "@/lib/automation-flow/campos-condicao";

/**
 * A BUSCA TEM QUE ACHAR O CAMPO PELA FRASE QUE A PESSOA TEM NA CABEÇA.
 *
 * "Dentro de condição, tá faltando a opção de começou a me seguir." Não faltava: é o campo "É
 * seguidor (segue seu perfil)", e a busca não o encontrava porque olhava só o rótulo. O campo
 * existia e parecia não existir — e quem conclui que o CRM não faz vai montar o robô de outro jeito.
 *
 * Por isso o teste de baixo não é sobre strings: ele pergunta ao CATÁLOGO se a frase que ela
 * digitou acha o campo certo. Mexer no rótulo ou tirar o sinônimo derruba o teste, que é o ponto.
 */

const CAMPO = {
  valor: "ig_seguidor",
  label: "É seguidor (segue seu perfil)",
  descricao: "Quem segue a sua conta agora",
  sinonimos: ["começou a me seguir", "novo seguidor"],
};

describe("semAcento", () => {
  it("tira acento e caixa", () => {
    expect(semAcento("Comentário")).toBe("comentario");
    expect(semAcento("É SEGUIDOR")).toBe("e seguidor");
  });
});

describe("opcaoCasaComBusca", () => {
  it("termo vazio casa com tudo: é a lista inteira", () => {
    expect(opcaoCasaComBusca(CAMPO, "")).toBe(true);
    expect(opcaoCasaComBusca(CAMPO, "   ")).toBe(true);
  });

  it("acha pelo rótulo, ignorando acento", () => {
    expect(opcaoCasaComBusca(CAMPO, "e seguidor")).toBe(true);
    expect(opcaoCasaComBusca(CAMPO, "SEGUIDOR")).toBe(true);
  });

  it("acha pelo identificador", () => {
    expect(opcaoCasaComBusca(CAMPO, "ig_seg")).toBe(true);
  });

  it("acha pela descrição", () => {
    expect(opcaoCasaComBusca(CAMPO, "segue a sua conta")).toBe(true);
  });

  /* O caso que motivou tudo: a frase que ela digitou não está em lugar nenhum do rótulo. */
  it("acha pelo sinônimo", () => {
    expect(opcaoCasaComBusca(CAMPO, "começou a me seguir")).toBe(true);
    expect(opcaoCasaComBusca(CAMPO, "comecou a me seguir")).toBe(true);
    expect(opcaoCasaComBusca(CAMPO, "novo seguidor")).toBe(true);
  });

  it("não casa com o que não tem nada a ver", () => {
    expect(opcaoCasaComBusca(CAMPO, "boleto")).toBe(false);
  });

  /* Opção sem descrição e sem sinônimo continua funcionando: a maioria do catálogo é assim. */
  it("opção pelada casa só pelo rótulo e identificador", () => {
    const simples = { valor: "etapa", label: "Etapa" };
    expect(opcaoCasaComBusca(simples, "etap")).toBe(true);
    expect(opcaoCasaComBusca(simples, "seguidor")).toBe(false);
  });
});

describe("filtrarOpcoes no catálogo de condições do Social Seller", () => {
  const campos = camposDaArea("social").map((c) => ({
    valor: c.valor,
    label: c.label,
    descricao: c.descricao,
    sinonimos: c.sinonimos,
  }));

  it("\"começou a me seguir\" acha o campo de seguidor", () => {
    const achados = filtrarOpcoes(campos, "começou a me seguir").map((c) => c.valor);
    expect(achados).toContain("ig_seguidor");
  });

  it("\"seguir\" acha as duas relações, e não só uma", () => {
    const achados = filtrarOpcoes(campos, "seguir").map((c) => c.valor);
    expect(achados).toContain("ig_seguidor");
    expect(achados).toContain("ig_voce_segue");
  });

  it("\"24 horas\" acha a janela", () => {
    expect(filtrarOpcoes(campos, "24 horas").map((c) => c.valor)).toContain("ig_janela_24h");
  });

  it("\"selo\" acha a conta verificada", () => {
    expect(filtrarOpcoes(campos, "selo").map((c) => c.valor)).toContain("ig_verificado");
  });

  it("sem termo devolve a lista inteira", () => {
    expect(filtrarOpcoes(campos, "")).toHaveLength(campos.length);
  });
});
