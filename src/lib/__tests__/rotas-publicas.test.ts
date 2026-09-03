import { describe, expect, it } from "vitest";

import { ehRotaPublica } from "../rotas-publicas";

/**
 * O que estes testes protegem é uma falha que não faz barulho.
 *
 * Rota chamada por sistema (webhook, cron) que fica de fora da lista não dá erro: o proxy responde
 * 307 pro /login, quem chamou registra "sucesso" e a rota simplesmente nunca roda. Já aconteceu
 * três vezes — Evolution, saúde do WhatsApp e cron das campanhas — e em nenhuma delas apareceu
 * mensagem de erro em lugar nenhum. O sintoma foi sempre "a funcionalidade não faz nada".
 *
 * E o teste corre nos dois sentidos: esquecer de abrir uma rota de sistema quebra em silêncio,
 * abrir demais expõe dado de cliente. Os dois lados estão aqui.
 */
describe("rotas que dispensam sessão", () => {
  it("deixa passar quem é chamado por sistema, não por pessoa", () => {
    for (const rota of [
      "/api/webhooks/whatsapp",
      "/api/webhooks/instagram",
      "/api/webhooks/evolution",
      "/api/webhooks/asaas",
      "/api/cron/campanhas",
      "/api/integracoes/meta/whatsapp/saude",
    ]) {
      expect(ehRotaPublica(rota), `${rota} precisa dispensar sessão`).toBe(true);
    }
  });

  it("abre qualquer cron novo que nasça na pasta", () => {
    // O caso do `/api/cron/campanhas`: nasceu depois da lista e ninguém lembrou de incluir. Sendo
    // prefixo, o próximo cron já nasce funcionando.
    expect(ehRotaPublica("/api/cron/qualquer-coisa")).toBe(true);
  });

  it("mantém a landing aberta sem abrir o resto do site junto", () => {
    // "/" é prefixo de tudo — comparado como prefixo, liberaria o CRM inteiro.
    expect(ehRotaPublica("/")).toBe(true);
    expect(ehRotaPublica("/inicio")).toBe(false);
  });

  it("continua exigindo sessão em tudo que é do cliente", () => {
    for (const rota of [
      "/inicio",
      "/conversas",
      "/funil",
      "/contatos",
      "/configuracoes",
      "/api/funis",
      "/api/conversas",
      "/api/campanhas",
      "/api/contatos",
      "/admin",
      "/api/admin/workspaces",
    ]) {
      expect(ehRotaPublica(rota), `${rota} não pode ficar aberta`).toBe(false);
    }
  });

  it("não deixa um nome parecido passar por outra rota", () => {
    // `startsWith` cru abriria `/loginfalso` junto com `/login`, e `/api/cron-secreto` junto com
    // `/api/cron/`. A comparação tem que respeitar a fronteira do caminho.
    expect(ehRotaPublica("/loginfalso")).toBe(false);
    expect(ehRotaPublica("/api/cron-secreto")).toBe(false);
    expect(ehRotaPublica("/api/webhooks/whatsapp-falso")).toBe(false);
  });
});
