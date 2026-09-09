import { describe, expect, it } from "vitest";

import { ehRotaPublica } from "../rotas-publicas";

/**
 * O que estes testes protegem é uma falha que não faz barulho.
 *
 * Rota chamada por sistema (webhook, cron) que fica de fora da lista não dá erro: o proxy responde
 * 307 pro /login, quem chamou registra "sucesso" e a rota simplesmente nunca roda. Já aconteceu
 * três vezes: Evolution, saúde do WhatsApp e cron das campanhas. E em nenhuma delas apareceu
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
    // "/" é prefixo de tudo. Comparado como prefixo, liberaria o CRM inteiro.
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

  it("abre a tela pública do formulário, que é aberta por um lead sem login", () => {
    // O link compartilhado leva pra cá. Se esta rota exigisse sessão, o proxy devolveria 307 pro
    // /login e o formulário nunca seria respondido: foi assim que a tela pública ficou inacessível
    // até ela existir de fato.
    expect(ehRotaPublica("/f/form-1786749623297-oy4a1")).toBe(true);
    expect(ehRotaPublica("/f")).toBe(true);
  });

  it("abre o ícone e a imagem de compartilhamento", () => {
    // Quem busca é o navegador montando a aba e o servidor do WhatsApp montando a prévia do link:
    // nenhum tem sessão, e um 307 pro /login dá no mesmo que não existir imagem.
    // As DUAS formas: gerado por código responde em `/icon`, arquivo de imagem em `/icon.png`.
    // Foi essa diferença que já derrubou a liberação duas vezes.
    for (const rota of [
      "/icon",
      "/icon.png",
      "/apple-icon",
      "/apple-icon.png",
      "/opengraph-image",
      "/opengraph-image.png",
      "/favicon.ico",
    ]) {
      expect(ehRotaPublica(rota), `${rota} precisa abrir sem sessão`).toBe(true);
    }
  });

  it("a regra dos arquivos de marca não abre rota de verdade parecida", () => {
    // `iconografia` ou `favicon-interno` não podem entrar de carona na regra.
    expect(ehRotaPublica("/iconografia")).toBe(false);
    expect(ehRotaPublica("/icon/secreto")).toBe(false);
    expect(ehRotaPublica("/opengraph-image/lista")).toBe(false);
  });

  it("não deixa um nome parecido passar por outra rota", () => {
    // `startsWith` cru abriria `/loginfalso` junto com `/login`, e `/api/cron-secreto` junto com
    // `/api/cron/`. A comparação tem que respeitar a fronteira do caminho.
    expect(ehRotaPublica("/loginfalso")).toBe(false);
    expect(ehRotaPublica("/api/cron-secreto")).toBe(false);
    expect(ehRotaPublica("/api/webhooks/whatsapp-falso")).toBe(false);
    // `/f` é curto e perigoso: sem a fronteira, abriria /funil, /formularios e /faturas.
    expect(ehRotaPublica("/funil")).toBe(false);
    expect(ehRotaPublica("/formularios")).toBe(false);
  });
});

describe("anexo assinado que os canais buscam de fora", () => {
  it("não exige sessão", () => {
    // A Meta e a Evolution buscam o arquivo elas mesmas, sem navegador e sem login. Fora desta
    // lista, o proxy devolvia 307 pro /login e o canal recebia uma página de login em vez da
    // imagem: a mensagem de mídia não chegava, e sem erro em lugar nenhum, porque do lado do CRM
    // o envio tinha sido aceito.
    expect(ehRotaPublica("/api/anexos/publico/abc123.jpg")).toBe(true);
    expect(ehRotaPublica("/api/anexos/publico/abc123")).toBe(true);
  });

  it("não abre o resto das rotas de arquivo", () => {
    // A exceção é só esta rota, que se defende sozinha com assinatura e prazo. Qualquer outra
    // rota de arquivo continua exigindo login.
    expect(ehRotaPublica("/api/anexos")).toBe(false);
    expect(ehRotaPublica("/api/arquivos")).toBe(false);
    expect(ehRotaPublica("/api/biblioteca-documentos")).toBe(false);
  });
});
