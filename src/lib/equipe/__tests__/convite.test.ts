import { describe, expect, it } from "vitest";

import { VALIDADE_CONVITE_MS, conviteValido, gerarTokenConvite, hashDoToken, tokenConfere } from "../convite";

/**
 * A vulnerabilidade que estes testes prendem: tomada de conta sem estar logado.
 *
 * O link de convite era `/convite/<id do membro>`, e o id é o slug do nome ("João Silva" →
 * "joao-silva"). Qualquer pessoa de fora que chutasse o nome de alguém com convite pendente
 * definia a senha daquela conta e entrava no workspace da empresa. O id continua sendo o id; o que
 * autoriza agora é o token, que só existe no link.
 */
const pendente = (extra: Partial<{ conviteTokenHash: string | null; conviteExpiraEm: Date | null }> = {}) => ({
  convitePendente: true,
  conviteTokenHash: null,
  conviteExpiraEm: null,
  ...extra,
});

describe("token de convite", () => {
  it("gera token longo e diferente a cada chamada", () => {
    const a = gerarTokenConvite();
    const b = gerarTokenConvite();
    expect(a).toHaveLength(64);
    expect(a).not.toBe(b);
  });

  it("guarda o hash, nunca o token", () => {
    const token = gerarTokenConvite();
    expect(hashDoToken(token)).not.toBe(token);
    expect(hashDoToken(token)).toBe(hashDoToken(token));
  });

  it("confere o token certo e recusa o errado", () => {
    const token = gerarTokenConvite();
    const hash = hashDoToken(token);
    expect(tokenConfere(token, hash)).toBe(true);
    expect(tokenConfere(gerarTokenConvite(), hash)).toBe(false);
    expect(tokenConfere(null, hash)).toBe(false);
    expect(tokenConfere(token, null)).toBe(false);
  });
});

describe("conviteValido", () => {
  const token = gerarTokenConvite();
  const hash = hashDoToken(token);
  const daquiUmaSemana = new Date(Date.now() + VALIDADE_CONVITE_MS);

  it("aceita convite pendente, com token certo e dentro do prazo", () => {
    expect(conviteValido(pendente({ conviteTokenHash: hash, conviteExpiraEm: daquiUmaSemana }), token)).toBe(true);
  });

  // O ataque original: o id sozinho abria o convite. Sem token, nada abre.
  it("recusa quem tem o id e não tem o token", () => {
    expect(conviteValido(pendente({ conviteTokenHash: hash, conviteExpiraEm: daquiUmaSemana }), null)).toBe(false);
    expect(conviteValido(pendente({ conviteTokenHash: hash, conviteExpiraEm: daquiUmaSemana }), "")).toBe(false);
    expect(conviteValido(pendente({ conviteTokenHash: hash, conviteExpiraEm: daquiUmaSemana }), "chute")).toBe(false);
  });

  it("recusa convite vencido", () => {
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(conviteValido(pendente({ conviteTokenHash: hash, conviteExpiraEm: ontem }), token)).toBe(false);
  });

  // Convite criado antes do token existir não tem hash nem prazo. Aceitá-lo manteria aberta
  // exatamente a porta que esta mudança fecha: o admin reenvia e o novo já nasce protegido.
  it("recusa convite antigo, sem token gravado", () => {
    expect(conviteValido(pendente(), null)).toBe(false);
    expect(conviteValido(pendente({ conviteExpiraEm: daquiUmaSemana }), "qualquer")).toBe(false);
  });

  it("recusa convite que já foi aceito", () => {
    const usado = { convitePendente: false, conviteTokenHash: hash, conviteExpiraEm: daquiUmaSemana };
    expect(conviteValido(usado, token)).toBe(false);
  });

  it("recusa membro inexistente", () => {
    expect(conviteValido(null, token)).toBe(false);
  });
});
