import { describe, expect, it } from "vitest";

import { virouSeguidor } from "../novo-seguidor";

/**
 * O GATILHO "COMEÇOU A TE SEGUIR" É UMA TRANSIÇÃO, não um estado.
 *
 * "É seguidor" responde sobre agora e vale pra quem segue há um ano. Este responde sobre a
 * MUDANÇA, e é a diferença entre dar boas-vindas a quem acabou de chegar e dar boas-vindas a quem
 * já estava lá — que chega como deboche.
 */
describe("virouSeguidor", () => {
  it("não seguia e agora segue: é novo seguidor", () => {
    expect(virouSeguidor(false, true)).toBe(true);
  });

  it("já seguia: não é novidade", () => {
    expect(virouSeguidor(true, true)).toBe(false);
  });

  it("deixou de seguir, ou nunca seguiu: não dispara", () => {
    expect(virouSeguidor(true, false)).toBe(false);
    expect(virouSeguidor(false, false)).toBe(false);
  });

  /*
   * A PRIMEIRA VEZ QUE O CRM OLHA NÃO É UMA TRANSIÇÃO.
   *
   * Contato novo, ou perfil que nunca foi consultado, tem `null`. Tudo que se sabe é que a pessoa
   * segue AGORA — ela pode seguir desde sempre. Chutar "começou agora" aqui faria o robô mandar
   * "obrigado por me seguir!" pra quem segue há um ano e acabou de comentar.
   */
  it("sem saber o estado anterior, não dispara", () => {
    expect(virouSeguidor(null, true)).toBe(false);
    expect(virouSeguidor(undefined, true)).toBe(false);
  });

  it("sem saber o estado atual, não dispara", () => {
    expect(virouSeguidor(false, null)).toBe(false);
    expect(virouSeguidor(false, undefined)).toBe(false);
  });
});
