import { describe, expect, it } from "vitest";

import { lerOrigemDaUrl, lerOrigemDoEndereco } from "../origem";

/**
 * O que estes testes protegem: o único momento em que a origem pode ser capturada.
 *
 * A marca do clique existe na URL em que a pessoa cai, e em mais lugar nenhum. Se ela não for lida
 * ali, não há como descobrir depois — nem no CRM, nem na plataforma. O lead fica sem origem para
 * sempre, e junto com ele some a possibilidade de dizer ao Google ou à Meta que aquele anúncio deu
 * venda. Um erro aqui não aparece em tela nenhuma: aparece meses depois, como uma tela de Tráfego
 * que não explica de onde vieram os clientes.
 */
function params(consulta: string) {
  return new URLSearchParams(consulta);
}

describe("lerOrigemDaUrl", () => {
  it("reconhece o clique do Google", () => {
    const origem = lerOrigemDaUrl(params("gclid=EAIaIQobChMI123"));
    expect(origem?.plataforma).toBe("google");
    expect(origem?.cliqueId).toBe("EAIaIQobChMI123");
    expect(origem?.tipoDoClique).toBe("gclid");
  });

  it("reconhece o clique da Meta", () => {
    const origem = lerOrigemDaUrl(params("fbclid=IwAR0abc"));
    expect(origem?.plataforma).toBe("meta");
    expect(origem?.tipoDoClique).toBe("fbclid");
  });

  /**
   * `wbraid` e `gbraid` aparecem quando o iOS impede o gclid. Guardar o TIPO importa tanto quanto
   * guardar o código: na devolução cada um entra num campo diferente, e no campo errado o Google
   * aceita a chamada e descarta o dado em silêncio — a pior falha possível, porque parece sucesso.
   */
  it("distingue wbraid e gbraid do gclid comum", () => {
    expect(lerOrigemDaUrl(params("wbraid=CjkKC123"))?.tipoDoClique).toBe("wbraid");
    expect(lerOrigemDaUrl(params("gbraid=0AAAAA456"))?.tipoDoClique).toBe("gbraid");
    expect(lerOrigemDaUrl(params("wbraid=CjkKC123"))?.plataforma).toBe("google");
  });

  it("prefere o gclid quando vêm vários", () => {
    // Acontece em link que passou por mais de uma plataforma. O gclid é o mais confiável.
    const origem = lerOrigemDaUrl(params("fbclid=IwAR0abc&gclid=EAIa123"));
    expect(origem?.tipoDoClique).toBe("gclid");
  });

  /**
   * A regra mais importante do arquivo: sem código de clique, não há origem.
   *
   * `utm_source=google` é texto livre que qualquer pessoa escreve, inclusive por engano num link
   * de e-mail ou de post orgânico. Tratar isso como "veio do Google Ads" contaminaria justamente
   * o número que a tela de Tráfego existe pra mostrar. Lead sem origem é melhor que lead com
   * origem errada.
   */
  it("não inventa origem a partir de UTM solta", () => {
    expect(lerOrigemDaUrl(params("utm_source=google&utm_medium=cpc"))).toBeNull();
  });

  it("não inventa origem quando não veio nada", () => {
    expect(lerOrigemDaUrl(params(""))).toBeNull();
  });

  it("ignora código vazio, que é o mesmo que não ter", () => {
    expect(lerOrigemDaUrl(params("gclid="))).toBeNull();
    expect(lerOrigemDaUrl(params("gclid=%20%20"))).toBeNull();
  });

  it("lê campanha, anúncio e palavra-chave do ValueTrack do Google", () => {
    const origem = lerOrigemDaUrl(
      params("gclid=EAIa1&campaignid=123&adgroupid=456&creative=789&keyword=implante%20dentario"),
    );
    expect(origem?.campanhaId).toBe("123");
    expect(origem?.conjuntoId).toBe("456");
    expect(origem?.anuncioId).toBe("789");
    expect(origem?.palavraChave).toBe("implante dentario");
  });

  it("lê os nomes equivalentes da Meta", () => {
    const origem = lerOrigemDaUrl(params("fbclid=IwA1&campaign_id=99&adset_id=88&ad_id=77&ad_name=Video%20A"));
    expect(origem?.campanhaId).toBe("99");
    expect(origem?.conjuntoId).toBe("88");
    expect(origem?.anuncioId).toBe("77");
    expect(origem?.anuncioNome).toBe("Video A");
  });

  it("guarda as UTMs junto, pra leitura humana", () => {
    const origem = lerOrigemDaUrl(params("gclid=EAIa1&utm_source=google&utm_medium=cpc&utm_campaign=setembro"));
    expect(origem?.utmSource).toBe("google");
    expect(origem?.utmCampaign).toBe("setembro");
  });

  // Parâmetro que a plataforma inventar amanhã continua gravado mesmo sem coluna. Lead mal
  // atribuído vira investigação em vez de mistério.
  it("guarda tudo que chegou, inclusive o que não tem coluna", () => {
    const origem = lerOrigemDaUrl(params("gclid=EAIa1&algo_novo_do_google=xyz"));
    expect(origem?.bruto.algo_novo_do_google).toBe("xyz");
    expect(origem?.bruto.gclid).toBe("EAIa1");
  });

  it("corta valor absurdamente grande em vez de estourar a coluna", () => {
    const origem = lerOrigemDaUrl(params(`gclid=${"x".repeat(900)}`));
    expect(origem?.cliqueId.length).toBe(512);
  });
});

describe("lerOrigemDoEndereco", () => {
  it("separa a página de entrada da consulta", () => {
    const origem = lerOrigemDoEndereco("https://clinica.com.br/implantes?gclid=EAIa1&utm_source=google");
    expect(origem?.paginaEntrada).toBe("https://clinica.com.br/implantes");
    expect(origem?.cliqueId).toBe("EAIa1");
  });

  /**
   * Endereço quebrado não pode derrubar o cadastro do lead. Um lead com origem ilegível ainda é um
   * lead; perder o contato por causa do rastreio seria trocar o essencial pelo acessório.
   */
  it("aguenta endereço inválido sem quebrar", () => {
    expect(lerOrigemDoEndereco("isso não é uma url")).toBeNull();
    expect(lerOrigemDoEndereco("")).toBeNull();
  });
});
