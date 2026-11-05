import { describe, expect, it } from "vitest";

import type { PaginaFormulario, PerguntaFormulario } from "@/lib/formularios-context";
import { juntarEmUmaPagina, temMaisDeUmaPagina, tituloAutomatico } from "@/lib/formularios/uma-pagina";

/**
 * Juntar páginas mexe em formulário QUE JÁ EXISTE, e alguns já foram respondidos: a resposta é
 * guardada por id de campo. Por isso o que se testa aqui é que nada some, nada troca de id e
 * nada muda de ordem — só o envelope muda.
 */

const campo = (id: string): PerguntaFormulario => ({
  id,
  tipo: "texto_curto",
  rotulo: id,
  obrigatoria: false,
  oculta: false,
  somenteLeitura: false,
  largura: "total",
});

const pagina = (id: string, titulo: string, ids: string[]): PaginaFormulario => ({
  id,
  titulo,
  perguntas: ids.map(campo),
});

let n = 0;
const novoId = () => `novo-${(n += 1)}`;

describe("um formulário, uma página", () => {
  it("formulário de uma página só não é tocado", () => {
    const uma = [pagina("p1", "Página 1", ["a", "b"])];
    expect(temMaisDeUmaPagina(uma)).toBe(false);
    expect(juntarEmUmaPagina(uma, novoId)).toBe(uma);
  });

  it("junta na ordem, sem perder nem trocar id de campo", () => {
    const antes = [pagina("p1", "Página 1", ["a", "b"]), pagina("p2", "Página 2", ["c"])];
    const [depois] = juntarEmUmaPagina(antes, novoId);
    expect(depois.perguntas.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(depois.id).toBe("p1");
  });

  it("o título da página juntada vira automático: ele já virou seção na lista", () => {
    const antes = [pagina("p1", "A marca", ["a"]), pagina("p2", "Quem compra", ["b"])];
    const [depois] = juntarEmUmaPagina(antes, novoId);
    expect(tituloAutomatico(depois.titulo)).toBe(true);
    expect(depois.perguntas.filter((p) => p.rotulo === "A marca")).toHaveLength(1);
  });

  it("título escrito à mão vira seção; título automático não vira nada", () => {
    const antes = [pagina("p1", "Página 1", ["a"]), pagina("p2", "Quem compra", ["b"])];
    const [depois] = juntarEmUmaPagina(antes, novoId);
    const tipos = depois.perguntas.map((p) => `${p.tipo}:${p.rotulo}`);
    expect(tipos).toEqual(["texto_curto:a", "titulo:Quem compra", "texto_curto:b"]);
  });

  it("página vazia não deixa um título solto pra trás", () => {
    const antes = [pagina("p1", "A marca", ["a"]), pagina("p2", "Seção sem nada", [])];
    const [depois] = juntarEmUmaPagina(antes, novoId);
    expect(depois.perguntas.map((p) => p.rotulo)).toEqual(["A marca", "a"]);
  });

  it("reconhece o título que o próprio produto deu", () => {
    for (const t of ["Página 1", "página", "PÁGINA 12", "  Pagina 3 "]) expect(tituloAutomatico(t)).toBe(true);
    for (const t of ["A marca", "Quem compra", "Páginas do carrossel"]) expect(tituloAutomatico(t)).toBe(false);
  });
});
