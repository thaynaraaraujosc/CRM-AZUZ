import { describe, expect, it } from "vitest";

import { precisaBaixarFoto } from "../foto-de-perfil";

/**
 * O sintoma que isto prende: conversa de grupo mostrando o ícone genérico pra sempre. O endereço
 * do WhatsApp expira em horas, e como o campo não ficava vazio, nada tentava buscar de novo.
 */
describe("precisaBaixarFoto", () => {
  it("sem nada guardado, busca", () => {
    expect(precisaBaixarFoto(null)).toBe(true);
    expect(precisaBaixarFoto(undefined)).toBe(true);
    expect(precisaBaixarFoto("")).toBe(true);
  });

  /*
   * A condição que alcança o que JÁ ESTÁ no banco. Sem ela, toda conversa gravada com um link
   * continuaria com a foto quebrada, porque o campo não está vazio.
   */
  it("endereço guardado é tratado como provisório, e vira busca", () => {
    expect(precisaBaixarFoto("https://pps.whatsapp.net/v/t61.000-24/123_n.jpg?ccb=11-4&oh=01")).toBe(true);
    expect(precisaBaixarFoto("http://exemplo.com/foto.jpg")).toBe(true);
  });

  it("imagem já guardada no banco não é buscada de novo", () => {
    expect(precisaBaixarFoto("data:image/jpeg;base64,/9j/4AAQSkZJRg==")).toBe(false);
  });
});
