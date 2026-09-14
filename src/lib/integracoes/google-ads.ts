import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Google Ads: a segunda plataforma de anúncio da tela de Tráfego.
 *
 * Existe porque os clientes da Azuz anunciam nos dois lugares, e até aqui a tela dizia "Google Ads"
 * em quatro pontos sem ter integração nenhuma por trás: filtrar por ele devolvia vazio SEMPRE, e
 * qualquer campanha que não fosse Meta era rotulada como dele. Esses rótulos foram removidos; este
 * arquivo é o que permite trazê-los de volta com dado real atrás.
 *
 * TRÊS COISAS SÃO NECESSÁRIAS, e é diferente da Meta, que pede só um app:
 *
 * 1. `GOOGLE_ADS_CLIENT_ID` e `GOOGLE_ADS_CLIENT_SECRET`: credenciais OAuth do projeto no Google
 *    Cloud. É por elas que o cliente autoriza o CRM a ler a conta dele.
 * 2. `GOOGLE_ADS_DEVELOPER_TOKEN`: identifica o SISTEMA (o CRM), não o cliente. Vai num cabeçalho
 *    próprio em toda chamada, junto com o token do cliente. Sem ele o Google recusa tudo.
 * 3. `GOOGLE_ADS_LOGIN_CUSTOMER_ID`: a conta de administrador (MCC) da Azuz, sem hífen. É o que
 *    diz ao Google "estou agindo como esta agência", e é obrigatório quando se lê conta de
 *    cliente em vez da própria.
 *
 * SEM AS QUATRO VARIÁVEIS, A INTEGRAÇÃO NÃO APARECE NA TELA. Não é botão desabilitado nem aviso de
 * "em breve": some. A tela de Tráfego acabou de ser limpa de opção que não funciona, e seria
 * incoerente repor o mesmo problema pelo outro lado. Ver `googleAdsConfigurado`.
 */

/** Versão da API. Fixa de propósito: o Google descontinua versão antiga em prazo conhecido, e
 *  descobrir isso por quebra em produção é pior do que por aviso no calendário. */
const VERSAO = "v18";

const ESCOPO = "https://www.googleapis.com/auth/adwords";

export type ConfiguracaoGoogleAds = {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  loginCustomerId: string;
};

function configuracao(): ConfiguracaoGoogleAds | null {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET ?? "";
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "";
  // Sem hífen: o Google aceita só dígitos neste cabeçalho, e o painel mostra o número COM hífen
  // (692-239-4762). Tirar aqui evita que a diferença vire um 401 sem explicação.
  const loginCustomerId = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "").replace(/\D/g, "");
  if (!clientId || !clientSecret || !developerToken || !loginCustomerId) return null;
  return { clientId, clientSecret, developerToken, loginCustomerId };
}

/**
 * Se a integração está pronta pra aparecer.
 *
 * A tela consulta isto antes de mostrar qualquer coisa de Google Ads. Enquanto o token de
 * desenvolvedor não estiver aprovado e nas variáveis, o cliente não vê opção nenhuma, e é assim
 * que tem que ser: opção que não funciona faz quem clica concluir que não há investimento, e não
 * que o canal não está ligado.
 */
export function googleAdsConfigurado(): boolean {
  return configuracao() !== null;
}

function exigirConfiguracao(): ConfiguracaoGoogleAds {
  const conf = configuracao();
  if (!conf) {
    throw new Error(
      "Google Ads não configurado. Faltam GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, " +
        "GOOGLE_ADS_DEVELOPER_TOKEN ou GOOGLE_ADS_LOGIN_CUSTOMER_ID.",
    );
  }
  return conf;
}

/**
 * Assina o `state` do OAuth, no mesmo desenho do `meta.ts`.
 *
 * O `state` volta do Google pelo navegador de quem clicou, ou seja, por um canal que a pessoa
 * controla. Sem assinatura, bastaria trocar o workspace na URL pra conectar a conta de anúncio de
 * uma empresa dentro do workspace de outra.
 */
export function assinarState(workspaceId: string): string {
  const assinatura = createHmac("sha256", exigirConfiguracao().clientSecret)
    .update(`${workspaceId}.google_ads`)
    .digest("hex");
  return `${workspaceId}.${assinatura}`;
}

export function verificarState(state: string | null): { workspaceId: string } | null {
  if (!state) return null;
  const partes = state.split(".");
  if (partes.length !== 2) return null;
  const [workspaceId, assinatura] = partes;
  if (!workspaceId || !assinatura) return null;

  const esperada = createHmac("sha256", exigirConfiguracao().clientSecret)
    .update(`${workspaceId}.google_ads`)
    .digest("hex");
  const recebida = Buffer.from(assinatura);
  const correta = Buffer.from(esperada);
  if (recebida.length !== correta.length) return null;
  return timingSafeEqual(recebida, correta) ? { workspaceId } : null;
}

/**
 * O endereço do diálogo de autorização.
 *
 * `access_type=offline` e `prompt=consent` juntos são o que garante o refresh token. O Google só
 * devolve refresh token na PRIMEIRA autorização de cada conta; sem `prompt=consent`, quem
 * reconecta depois recebe só um token de uma hora, e a conexão morre sozinha no dia seguinte sem
 * ninguém entender por quê.
 */
export function urlDeAutorizacao(workspaceId: string, redirectUri: string): string {
  const conf = exigirConfiguracao();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", conf.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", ESCOPO);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", assinarState(workspaceId));
  return url.toString();
}

export type TokensGoogle = { accessToken: string; refreshToken: string | null; expiraEm: Date };

function comExpiracao(dados: { access_token: string; refresh_token?: string; expires_in?: number }): TokensGoogle {
  return {
    accessToken: dados.access_token,
    refreshToken: dados.refresh_token ?? null,
    // Um minuto a menos que o informado: evita usar um token que vence no meio do voo.
    expiraEm: new Date(Date.now() + ((dados.expires_in ?? 3600) - 60) * 1000),
  };
}

async function pedirToken(corpo: Record<string, string>): Promise<TokensGoogle> {
  const resposta = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(corpo).toString(),
  });
  const dados = (await resposta.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!resposta.ok || !dados.access_token) {
    throw new Error(dados.error_description ?? dados.error ?? "Falha ao obter token do Google.");
  }
  return comExpiracao(dados as { access_token: string; refresh_token?: string; expires_in?: number });
}

export async function trocarCodigoPorTokens(codigo: string, redirectUri: string): Promise<TokensGoogle> {
  const conf = exigirConfiguracao();
  return pedirToken({
    code: codigo,
    client_id: conf.clientId,
    client_secret: conf.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
}

export async function renovarAccessToken(refreshToken: string): Promise<TokensGoogle> {
  const conf = exigirConfiguracao();
  return pedirToken({
    refresh_token: refreshToken,
    client_id: conf.clientId,
    client_secret: conf.clientSecret,
    grant_type: "refresh_token",
  });
}

/** Cabeçalhos de toda chamada à API. O token do desenvolvedor identifica o CRM; o
 *  `login-customer-id` diz que a leitura é feita pela MCC da agência. */
function cabecalhos(accessToken: string): Record<string, string> {
  const conf = exigirConfiguracao();
  return {
    authorization: `Bearer ${accessToken}`,
    "developer-token": conf.developerToken,
    "login-customer-id": conf.loginCustomerId,
    "content-type": "application/json",
  };
}

export type CampanhaGoogle = {
  id: string;
  nome: string;
  investido: number;
  leads: number;
  vendas: number;
  receita: number;
};

/**
 * Converte micros em reais.
 *
 * O Google devolve dinheiro em MICROS: um milhão de micros é uma unidade da moeda. Esquecer esta
 * divisão faz um gasto de R$ 150 aparecer como R$ 150.000.000 na tela, e o erro é fácil de não
 * notar em número pequeno.
 */
export function deMicros(valor: string | number | null | undefined): number {
  return Number(valor ?? 0) / 1_000_000;
}

type LinhaGaql = {
  campaign?: { id?: string; name?: string };
  metrics?: {
    costMicros?: string;
    conversions?: number;
    conversionsValue?: number;
    allConversions?: number;
  };
};

/**
 * As campanhas de uma conta, com investimento e conversões dos últimos 30 dias.
 *
 * A janela é a mesma do Meta Ads (`date_preset=last_30d` lá, `LAST_30_DAYS` aqui) de propósito: os
 * dois alimentam os MESMOS indicadores na tela de Tráfego, e períodos diferentes fariam o custo
 * por lead somar peras com maçãs sem que nada na tela avisasse.
 */
export async function buscarCampanhas(params: {
  accessToken: string;
  customerId: string;
}): Promise<CampanhaGoogle[]> {
  const customerId = params.customerId.replace(/\D/g, "");
  const consulta = `
    SELECT campaign.id, campaign.name, metrics.cost_micros, metrics.conversions,
           metrics.conversions_value
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS AND campaign.status != 'REMOVED'
  `;

  const resposta = await fetch(
    `https://googleads.googleapis.com/${VERSAO}/customers/${customerId}/googleAds:searchStream`,
    { method: "POST", headers: cabecalhos(params.accessToken), body: JSON.stringify({ query: consulta }) },
  );

  if (!resposta.ok) {
    const texto = await resposta.text().catch(() => "");
    throw new Error(`Google Ads recusou a consulta (${resposta.status}): ${texto.slice(0, 300)}`);
  }

  // `searchStream` devolve um ARRAY de blocos, cada um com suas linhas, e não um objeto único.
  const blocos = (await resposta.json()) as { results?: LinhaGaql[] }[];
  const porCampanha = new Map<string, CampanhaGoogle>();

  for (const bloco of blocos ?? []) {
    for (const linha of bloco.results ?? []) {
      const id = linha.campaign?.id;
      if (!id) continue;
      // A consulta traz uma linha por DIA. Somar aqui é o que transforma 30 linhas numa campanha.
      const atual = porCampanha.get(id) ?? {
        id,
        nome: linha.campaign?.name ?? "Campanha sem nome",
        investido: 0,
        leads: 0,
        vendas: 0,
        receita: 0,
      };
      atual.investido += deMicros(linha.metrics?.costMicros);
      atual.leads += Number(linha.metrics?.conversions ?? 0);
      atual.receita += Number(linha.metrics?.conversionsValue ?? 0);
      porCampanha.set(id, atual);
    }
  }

  return [...porCampanha.values()];
}

/** As contas de anúncio que o usuário autorizado consegue acessar. Usado logo depois de conectar,
 *  pra saber de qual conta ler sem pedir que a pessoa digite um número. */
export async function listarContasAcessiveis(accessToken: string): Promise<string[]> {
  const resposta = await fetch(
    `https://googleads.googleapis.com/${VERSAO}/customers:listAccessibleCustomers`,
    { headers: cabecalhos(accessToken) },
  );
  if (!resposta.ok) {
    const texto = await resposta.text().catch(() => "");
    throw new Error(`Não foi possível listar as contas do Google Ads (${resposta.status}): ${texto.slice(0, 300)}`);
  }
  const dados = (await resposta.json()) as { resourceNames?: string[] };
  // Vem como "customers/1234567890"; interessa só o número.
  return (dados.resourceNames ?? []).map((nome) => nome.split("/")[1]).filter(Boolean);
}
