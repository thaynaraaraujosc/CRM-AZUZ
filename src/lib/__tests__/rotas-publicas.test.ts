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

  /*
   * Os documentos que a Meta exige pra revisar o App. Se qualquer um deles devolver redirecionamento
   * pro login, o revisor da Meta vê uma tela de login no lugar do documento e reprova a submissão:
   * o app fica preso em modo de desenvolvimento, e aí só conta convidada como testadora consegue
   * conectar o Instagram. É o "meu cliente não consegue conectar" com outra roupa.
   */
  it("serve os documentos públicos que a Meta vai abrir na revisão", () => {
    for (const rota of ["/politica-de-privacidade", "/termos", "/exclusao-de-dados"]) {
      expect(ehRotaPublica(rota), `${rota} precisa abrir sem login`).toBe(true);
    }
  });

  /*
   * A tela que o cliente da empresa abre. Ela não tem login, e cada pedaço dela é uma chamada
   * separada: o formulário, os horários livres, o envio da resposta. Qualquer um desses fora da
   * lista vira um 307 pro /login que o navegador do cliente engole calado — o formulário abre e
   * simplesmente não funciona uma parte dele.
   */
  it("abre tudo que a tela pública do formulário precisa chamar", () => {
    for (const rota of [
      "/api/formularios/form-123",
      "/api/formularios/form-123/horarios",
      "/api/formularios/form-123/respostas",
      "/api/formularios/form-123/contatos",
    ]) {
      expect(ehRotaPublica(rota), `${rota} precisa abrir sem login`).toBe(true);
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

  it("abre as rotas que o AZUZ Flow chama, e só elas", () => {
    // Quem chama é o servidor do Flow, sem navegador nem sessão. Sem isto o proxy devolve 307 pro
    // /login, o Flow recebe a página de login com status de sucesso e dá a entrega por feita: o
    // lead some sem erro em lugar nenhum.
    expect(ehRotaPublica("/api/integracoes/azuz-flow/leads")).toBe(true);
    expect(ehRotaPublica("/api/integracoes/azuz-flow/ping")).toBe(true);
    // A lista é por CAMINHO, não por prefixo: cada rota nova do Flow precisa entrar aqui à mão, e
    // é este teste que faz o esquecimento aparecer em vez de virar um 307 silencioso.
    expect(ehRotaPublica("/api/integracoes/azuz-flow/confirmacoes")).toBe(true);

    // A gestão da chave é da TELA, com sessão de administrador. Abrir junto deixaria qualquer um
    // gerar uma chave de integração da empresa dos outros.
    expect(ehRotaPublica("/api/integracoes/azuz-flow/chave")).toBe(false);
    // E a liberação não pode vazar pro resto das integrações.
    expect(ehRotaPublica("/api/integracoes/meta/whatsapp/conectar")).toBe(false);
    expect(ehRotaPublica("/api/integracoes/azuz-flow")).toBe(false);
  });

  it("abre a rota de saúde do banco, que a tela de login consulta sem sessão", () => {
    /*
     * Quem chama é a tela de login, DEPOIS de um `signIn` recusado, para escolher entre "e-mail ou
     * senha incorretos" e "o banco não está respondendo". Quem está nessa tela não tem sessão por
     * definição — então fora da lista o proxy devolve 307 e o que chega na tela é a página de
     * login, nunca o JSON. A rota escrita para explicar a queda não explicava nada.
     *
     * Foi o que prolongou a queda de 14/10/2026: a causa e o código do driver estavam calculados e
     * prontos dentro da rota, e não chegavam na tela.
     */
    expect(ehRotaPublica("/api/saude/banco")).toBe(true);

    // A irmã dela lista tabela e coluna que faltam: isso é mapa do schema e continua exigindo
    // sessão de administrador.
    expect(ehRotaPublica("/api/saude/estrutura")).toBe(false);

    // E a liberação é do caminho exato, não da pasta: nenhuma rota de saúde futura nasce aberta
    // por acidente.
    expect(ehRotaPublica("/api/saude")).toBe(false);
    expect(ehRotaPublica("/api/saude/banco/detalhe")).toBe(false);
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
    // O link rastreado do botão de WhatsApp. Quem clica é visitante do site de outra empresa: não
    // tem conta no CRM e nunca vai ter. Exigir sessão transformaria o botão numa tela de login,
    // e o lead se perderia antes de existir.
    expect(ehRotaPublica("/ir/clinica-aurora")).toBe(true);
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
