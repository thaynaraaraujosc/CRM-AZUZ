import { describe, expect, it } from "vitest";

import { ROTA_AVISO, ROTA_PAGAMENTO, decidirAcesso, motivoDoBloqueio } from "../acesso";

/**
 * A falha que estes testes prendem: usar o CRM inteiro sem nunca ter pago.
 *
 * Uma conta criada do zero tinha acesso a tudo, e continuava tendo mesmo com a assinatura marcada
 * como atrasada. Duas causas somadas: `/api` ficava inteiramente fora do bloqueio (e o CRM lê tudo
 * por `/api`), e quem não pagou era mandado pra tela de Configurações completa, com conexões,
 * equipe e armazenamento à disposição.
 */
const dono = { superAdmin: false, papelTipo: "admin" };
const equipe = { superAdmin: false, papelTipo: "padrao" };

describe("decidirAcesso", () => {
  it("libera tudo pra quem tem assinatura ativa", () => {
    expect(decidirAcesso({ ...dono, pathname: "/conversas", statusAssinatura: "ativa" }).liberado).toBe(true);
    expect(decidirAcesso({ ...equipe, pathname: "/funil", statusAssinatura: "ativa" }).liberado).toBe(true);
    expect(decidirAcesso({ ...dono, pathname: "/api/contatos", statusAssinatura: "ativa" }).liberado).toBe(true);
  });

  it("nunca bloqueia o super-admin da plataforma", () => {
    const d = decidirAcesso({ superAdmin: true, papelTipo: "admin", pathname: "/admin", statusAssinatura: null });
    expect(d.liberado).toBe(true);
  });

  // O caso relatado: conta nova, nada pago, acesso a tudo.
  it("bloqueia as páginas de quem não pagou", () => {
    for (const status of ["pendente", "atrasada", "cancelada", null]) {
      const d = decidirAcesso({ ...dono, pathname: "/inicio", statusAssinatura: status });
      expect(d.liberado, `status ${status}`).toBe(false);
      if (!d.liberado) expect(d.destino).toBe(ROTA_PAGAMENTO);
    }
  });

  // A metade que faltava: o CRM lê tudo por `/api`, e `/api` estava inteiramente liberada.
  it("bloqueia também a API, que era por onde o produto todo respondia", () => {
    const d = decidirAcesso({ ...dono, pathname: "/api/contatos", statusAssinatura: "pendente" });
    expect(d.liberado).toBe(false);
    if (!d.liberado) expect(d.ehApi).toBe(true);
  });

  // Atrasada é o caso que ela testou na mão e continuou entrando.
  it("trata atrasada e cancelada como não pago", () => {
    expect(decidirAcesso({ ...dono, pathname: "/api/conversas", statusAssinatura: "atrasada" }).liberado).toBe(false);
    expect(decidirAcesso({ ...dono, pathname: "/relatorios", statusAssinatura: "cancelada" }).liberado).toBe(false);
  });

  // Ausência de registro não pode virar acesso grátis.
  it("trata a falta de assinatura como não pago", () => {
    expect(decidirAcesso({ ...dono, pathname: "/inicio", statusAssinatura: null }).liberado).toBe(false);
  });

  it("manda quem não é dono da conta pro aviso, não pra tela de pagamento", () => {
    const d = decidirAcesso({ ...equipe, pathname: "/inicio", statusAssinatura: "atrasada" });
    expect(d.liberado).toBe(false);
    if (!d.liberado) expect(d.destino).toBe(ROTA_AVISO);
  });

  // Sem isto o bloqueio se morde: a tela de pagamento não carregaria nem enviaria o pagamento.
  it("deixa o caminho de regularizar funcionar", () => {
    expect(decidirAcesso({ ...dono, pathname: ROTA_PAGAMENTO, statusAssinatura: "pendente" }).liberado).toBe(true);
    expect(decidirAcesso({ ...dono, pathname: "/api/assinatura", statusAssinatura: "pendente" }).liberado).toBe(true);
    expect(decidirAcesso({ ...dono, pathname: "/api/assinatura/cancelar", statusAssinatura: "pendente" }).liberado).toBe(true);
  });

  it("deixa sair da conta mesmo bloqueado", () => {
    expect(decidirAcesso({ ...dono, pathname: "/api/auth/session", statusAssinatura: null }).liberado).toBe(true);
    expect(decidirAcesso({ ...equipe, pathname: "/api/auth/signout", statusAssinatura: null }).liberado).toBe(true);
  });

  it("deixa a página de aviso carregar pra quem é mandado pra ela", () => {
    expect(decidirAcesso({ ...equipe, pathname: ROTA_AVISO, statusAssinatura: "pendente" }).liberado).toBe(true);
  });

  // Uma rota que só COMEÇA parecida não pode escapar: `/api/assinaturas-falsas` não é o caminho de
  // pagamento.
  it("não deixa um nome parecido furar a lista de liberadas", () => {
    expect(decidirAcesso({ ...dono, pathname: "/api/assinaturas-falsas", statusAssinatura: null }).liberado).toBe(false);
    expect(decidirAcesso({ ...dono, pathname: "/assinatura-de-mentira", statusAssinatura: null }).liberado).toBe(false);
  });
});

describe("motivoDoBloqueio", () => {
  it("explica cada situação com a palavra certa", () => {
    expect(motivoDoBloqueio("atrasada")).toContain("atrasado");
    expect(motivoDoBloqueio("cancelada")).toContain("cancelada");
    expect(motivoDoBloqueio("pendente")).toContain("confirmar o pagamento");
    expect(motivoDoBloqueio(null)).toContain("confirmar o pagamento");
  });
});
