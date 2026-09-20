import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  assinarState,
  cabecalhosParaTeste,
  deMicros,
  ehVenda,
  googleAdsConfigurado,
  enviarConversoes,
  somarLinhas,
  urlDeAutorizacao,
  verificarState,
} from "../google-ads";

/**
 * O que estes testes prendem, em ordem de dano.
 *
 * MICROS. O Google devolve dinheiro multiplicado por um milhão. Esquecer a divisão faz um gasto de
 * R$ 150 aparecer como R$ 150.000.000, e o custo por lead da tela de Tráfego vira ficção. O erro
 * passa despercebido em número pequeno e é o mais fácil de cometer nesta API.
 *
 * O STATE. Ele volta do Google pelo navegador de quem clicou, que é um canal sob controle da
 * pessoa. Sem assinatura, trocar o workspace na URL conectaria a conta de anúncio de uma empresa
 * dentro do workspace de outra: vazamento entre clientes.
 *
 * O REFRESH TOKEN. O Google só devolve refresh token quando `access_type=offline` e
 * `prompt=consent` vão juntos. Sem eles a conexão funciona no primeiro dia e morre no segundo,
 * sem erro que aponte pra causa.
 */

const AMBIENTE = { ...process.env };

beforeEach(() => {
  process.env.GOOGLE_ADS_CLIENT_ID = "cliente-de-teste";
  process.env.GOOGLE_ADS_CLIENT_SECRET = "segredo-de-teste";
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "token-de-teste";
  process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID = "692-239-4762";
});

afterEach(() => {
  process.env = { ...AMBIENTE };
});

describe("deMicros", () => {
  it("converte micros em reais", () => {
    expect(deMicros("150000000")).toBe(150);
  });

  it("aguenta número e texto", () => {
    expect(deMicros(2_500_000)).toBe(2.5);
    expect(deMicros("2500000")).toBe(2.5);
  });

  it("ausência vira zero, não NaN", () => {
    // NaN numa soma contamina o total inteiro e a tela mostra "R$ NaN".
    expect(deMicros(null)).toBe(0);
    expect(deMicros(undefined)).toBe(0);
  });
});

describe("googleAdsConfigurado", () => {
  it("é verdadeiro com as três variáveis obrigatórias", () => {
    expect(googleAdsConfigurado()).toBe(true);
  });

  // A regra que evita repor na tela o problema que acabou de sair dela: sem configuração, a opção
  // não aparece. Nada de botão que não funciona.
  it("é falso se faltar qualquer uma das obrigatórias", () => {
    for (const chave of [
      "GOOGLE_ADS_CLIENT_ID",
      "GOOGLE_ADS_CLIENT_SECRET",
      "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
    ]) {
      const guardado = process.env[chave];
      delete process.env[chave];
      expect(googleAdsConfigurado(), `sem ${chave}`).toBe(false);
      process.env[chave] = guardado;
    }
  });

  /**
   * O teste que destrava a instalação nova.
   *
   * Em 10/09/2026 o Google tirou o token de desenvolvedor da decisão de acesso: quem manda agora é
   * o projeto do Google Cloud que gerou as credenciais OAuth, e o pedido de nível saiu da Central
   * de API da MCC. Quem monta a integração hoje NÃO CONSEGUE MAIS obter um token — a tela que o
   * emitia agora avisa que serve pra outra API.
   *
   * Exigir a variável deixaria a integração invisível pra sempre, esperando um valor que não
   * existe mais, e sem nada na tela explicando isso. Foi exatamente o que aconteceu: a Thaynara
   * passou por quatro telas do Google atrás de um campo que tinha sido removido quatro dias antes.
   */
  it("continua verdadeiro sem o token de desenvolvedor, que o Google não emite mais", () => {
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    expect(googleAdsConfigurado()).toBe(true);
  });
});

/**
 * O cabeçalho que some.
 *
 * Hoje o `developer-token` é IGNORADO pelos servidores do Google, e o próprio Google avisou que
 * numa versão futura ele passa a ser RECUSADO. Mandar a chave com valor vazio seria o pior dos
 * dois mundos: não ajuda agora e quebra depois. Então ou vai com valor, ou não vai.
 */
describe("cabeçalhos da chamada", () => {
  it("não manda developer-token quando não há token configurado", () => {
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    expect(cabecalhosParaTeste("token-de-acesso")).not.toHaveProperty("developer-token");
  });

  it("manda o developer-token de quem ainda tem um", () => {
    expect(cabecalhosParaTeste("token-de-acesso")["developer-token"]).toBe("token-de-teste");
  });

  // Continua obrigatório, e continua sem hífen: o Google recusa este cabeçalho com hífen, e o
  // painel mostra o número COM hífen. É o erro de digitação que vira 401 sem explicação.
  it("manda a MCC só com dígitos", () => {
    expect(cabecalhosParaTeste("token-de-acesso")["login-customer-id"]).toBe("6922394762");
  });
});

describe("state assinado", () => {
  it("volta o workspace quando a assinatura confere", () => {
    expect(verificarState(assinarState("empresa-a"))).toEqual({ workspaceId: "empresa-a" });
  });

  // O ataque que isto barra: trocar o workspace na URL de retorno.
  it("recusa state de outro workspace", () => {
    const state = assinarState("empresa-a");
    const adulterado = state.replace("empresa-a", "empresa-b");
    expect(verificarState(adulterado)).toBeNull();
  });

  it("recusa state vazio ou mal formado", () => {
    expect(verificarState(null)).toBeNull();
    expect(verificarState("")).toBeNull();
    expect(verificarState("so-uma-parte")).toBeNull();
    expect(verificarState("a.b.c")).toBeNull();
  });
});

describe("urlDeAutorizacao", () => {
  const url = () => new URL(urlDeAutorizacao("empresa-a", "https://azuzcrm.com.br/callback"));

  it("pede o escopo do Google Ads", () => {
    expect(url().searchParams.get("scope")).toBe("https://www.googleapis.com/auth/adwords");
  });

  /**
   * Os dois juntos, e não só o primeiro: sem `prompt=consent`, quem já autorizou uma vez reconecta
   * e recebe só o token de uma hora. A conexão morre sozinha no dia seguinte.
   */
  it("garante o refresh token", () => {
    expect(url().searchParams.get("access_type")).toBe("offline");
    expect(url().searchParams.get("prompt")).toBe("consent");
  });

  it("leva o state assinado", () => {
    expect(verificarState(url().searchParams.get("state"))).toEqual({ workspaceId: "empresa-a" });
  });

  it("aponta pro endereço de retorno informado", () => {
    expect(url().searchParams.get("redirect_uri")).toBe("https://azuzcrm.com.br/callback");
  });
});

/**
 * A aritmética da resposta do Google, que é onde mora o engano silencioso.
 *
 * Nenhum destes erros produz mensagem nenhuma: a tela desenha um número plausível e errado. São
 * três armadilhas, e as três estão ligadas à mesma decisão de pedir a categoria da conversão:
 *
 * 1. CUSTO REPETIDO. Pedir `segments.conversion_action_category` multiplica as linhas: o mesmo dia
 *    volta uma vez por categoria, com o custo INTEIRO repetido em cada uma. Somar tudo multiplica
 *    o investimento pelo número de categorias, e o ROAS despenca sem motivo.
 * 2. LEAD CONTADO COMO VENDA. Se tudo virar venda, as colunas "Leads" e "Vendas" da tela mostram o
 *    mesmo número e o custo por venda fica igual ao custo por lead.
 * 3. RECEITA DE LEAD. Valor de conversão de formulário preenchido é valor ESTIMADO. Somá-lo à
 *    receita faz o ROAS contar dinheiro que ninguém recebeu.
 */
describe("somarLinhas", () => {
  function linha(
    dia: string,
    categoria: string,
    conversoes: number,
    valor = 0,
    custoMicros = "150000000",
  ) {
    return {
      campaign: { id: "1", name: "Campanha de teste" },
      segments: { date: dia, conversionActionCategory: categoria },
      metrics: { costMicros: custoMicros, conversions: conversoes, conversionsValue: valor },
    };
  }

  it("conta o custo do dia UMA vez, mesmo com várias categorias na mesma data", () => {
    const campanhas = somarLinhas([
      linha("2026-09-01", "SUBMIT_LEAD_FORM", 3),
      linha("2026-09-01", "PURCHASE", 1, 900),
      linha("2026-09-01", "PAGE_VIEW", 20),
    ]);
    expect(campanhas[0].investido).toBe(150);
  });

  it("soma o custo de dias diferentes", () => {
    const campanhas = somarLinhas([
      linha("2026-09-01", "PURCHASE", 1, 900),
      linha("2026-09-02", "PURCHASE", 1, 900),
    ]);
    expect(campanhas[0].investido).toBe(300);
  });

  it("separa lead de venda pela categoria da conversão", () => {
    const campanhas = somarLinhas([
      linha("2026-09-01", "SUBMIT_LEAD_FORM", 7),
      linha("2026-09-01", "PURCHASE", 2, 1800),
    ]);
    expect(campanhas[0].leads).toBe(7);
    expect(campanhas[0].vendas).toBe(2);
  });

  it("só conta como receita o valor das conversões de venda", () => {
    const campanhas = somarLinhas([
      // Valor estimado de lead: não é dinheiro recebido.
      linha("2026-09-01", "SUBMIT_LEAD_FORM", 7, 700),
      linha("2026-09-01", "PURCHASE", 2, 1800),
    ]);
    expect(campanhas[0].receita).toBe(1800);
  });

  it("categoria desconhecida vira lead, e não venda", () => {
    // O Google pode criar categoria nova sem avisar. Inflar a receita por causa disso é pior do
    // que contar um lead a mais.
    const campanhas = somarLinhas([linha("2026-09-01", "CATEGORIA_QUE_NAO_EXISTIA", 4, 400)]);
    expect(campanhas[0].leads).toBe(4);
    expect(campanhas[0].vendas).toBe(0);
    expect(campanhas[0].receita).toBe(0);
  });

  it("separa campanhas diferentes", () => {
    const campanhas = somarLinhas([
      linha("2026-09-01", "PURCHASE", 1, 900),
      { ...linha("2026-09-01", "PURCHASE", 3, 2700), campaign: { id: "2", name: "Outra" } },
    ]);
    expect(campanhas).toHaveLength(2);
    expect(campanhas.find((c) => c.id === "2")?.vendas).toBe(3);
  });

  it("ignora linha sem campanha em vez de quebrar", () => {
    expect(somarLinhas([{ metrics: { costMicros: "1000000" } }])).toEqual([]);
  });
});

describe("ehVenda", () => {
  it("reconhece as categorias que são dinheiro recebido", () => {
    for (const c of ["PURCHASE", "STORE_SALE", "SUBSCRIBE_PAID"]) expect(ehVenda(c), c).toBe(true);
  });

  it("não trata lead, ligação nem visita como venda", () => {
    for (const c of ["SUBMIT_LEAD_FORM", "PHONE_CALL_LEAD", "CONTACT", "PAGE_VIEW", "STORE_VISIT"]) {
      expect(ehVenda(c), c).toBe(false);
    }
  });

  it("aguenta categoria ausente", () => {
    expect(ehVenda(null)).toBe(false);
    expect(ehVenda(undefined)).toBe(false);
  });
});

/**
 * O envio da conversão, prendendo os dois erros que o Google NÃO reclama.
 *
 * Ele aceita a chamada e descarta o dado em silêncio quando o código de clique vai no campo
 * errado, e joga a venda no dia errado quando a data vem sem fuso. Os dois parecem sucesso na
 * resposta e só aparecem semanas depois, como campanha que "não converte".
 */
describe("enviarConversoes", () => {
  const original = globalThis.fetch;
  let enviado: { conversions: Record<string, unknown>[]; partialFailure?: boolean } | null = null;

  beforeEach(() => {
    enviado = null;
    globalThis.fetch = (async (_url: string, init?: { body?: string }) => {
      enviado = JSON.parse(init?.body ?? "{}");
      return { ok: true, status: 200, json: async () => ({}) };
    }) as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = original;
  });

  async function enviarUm(tipoDoClique: string | null) {
    await enviarConversoes({
      accessToken: "t",
      customerId: "123-456-7890",
      acaoDeConversao: "customers/1/conversionActions/9",
      conversoes: [{ cliqueId: "CODIGO", tipoDoClique, quando: new Date("2026-09-20T15:30:00Z"), valor: 3200 }],
    });
    return enviado!.conversions[0];
  }

  it("gclid vai no campo gclid", async () => {
    const c = await enviarUm("gclid");
    expect(c.gclid).toBe("CODIGO");
    expect(c.wbraid).toBeUndefined();
    expect(c.gbraid).toBeUndefined();
  });

  it("wbraid vai no campo wbraid, nao no gclid", async () => {
    const c = await enviarUm("wbraid");
    expect(c.wbraid).toBe("CODIGO");
    expect(c.gclid).toBeUndefined();
  });

  it("gbraid vai no campo gbraid, nao no gclid", async () => {
    const c = await enviarUm("gbraid");
    expect(c.gbraid).toBe("CODIGO");
    expect(c.gclid).toBeUndefined();
  });

  it("tipo desconhecido cai em gclid, que e o caso esmagadoramente mais comum", async () => {
    const c = await enviarUm(null);
    expect(c.gclid).toBe("CODIGO");
  });

  it("a data leva fuso explicito e esta no horario de Brasilia", async () => {
    const c = await enviarUm("gclid");
    // 15:30 UTC = 12:30 em Brasília (-03:00).
    expect(c.conversionDateTime).toBe("2026-09-20 12:30:00-03:00");
  });

  it("manda valor e moeda, e pede falha parcial", async () => {
    const c = await enviarUm("gclid");
    expect(c.conversionValue).toBe(3200);
    expect(c.currencyCode).toBe("BRL");
    expect(enviado!.partialFailure).toBe(true);
  });

  it("lote vazio nao chama a rede", async () => {
    const r = await enviarConversoes({
      accessToken: "t",
      customerId: "1",
      acaoDeConversao: "x",
      conversoes: [],
    });
    expect(r).toEqual({ ok: true, falhas: [] });
    expect(enviado).toBeNull();
  });
});
