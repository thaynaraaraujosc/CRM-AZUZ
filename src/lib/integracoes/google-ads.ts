import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Google Ads: a segunda plataforma de anúncio da tela de Tráfego.
 *
 * Existe porque os clientes da Azuz anunciam nos dois lugares, e até aqui a tela dizia "Google Ads"
 * em quatro pontos sem ter integração nenhuma por trás: filtrar por ele devolvia vazio SEMPRE, e
 * qualquer campanha que não fosse Meta era rotulada como dele. Esses rótulos foram removidos; este
 * arquivo é o que permite trazê-los de volta com dado real atrás.
 *
 * DUAS COISAS SÃO NECESSÁRIAS, e é diferente da Meta, que pede só um app:
 *
 * 1. `GOOGLE_ADS_CLIENT_ID` e `GOOGLE_ADS_CLIENT_SECRET`: credenciais OAuth do projeto no Google
 *    Cloud. É por elas que o cliente autoriza o CRM a ler a conta dele — e, desde setembro de
 *    2026, é o PROJETO DO CLOUD que gerou essas credenciais que carrega o nível de acesso à API.
 *    Credencial tirada de outro projeto do Cloud é recusada mesmo estando correta.
 * 2. `GOOGLE_ADS_LOGIN_CUSTOMER_ID`: a conta de administrador (MCC) da Azuz, sem hífen. É o que
 *    diz ao Google "estou agindo como esta agência", e é obrigatório quando se lê conta de
 *    cliente em vez da própria.
 *
 * O TOKEN DE DESENVOLVEDOR NÃO ESTÁ MAIS NESSA LISTA. Em 10/09/2026 o Google tirou o token de
 * desenvolvedor da decisão de acesso e moveu o pedido de nível ("Exploração", "Básico") da Central
 * de API da MCC pra página da Google Ads API no Google Cloud. O cabeçalho virou opcional e é
 * IGNORADO pelos servidores, e o Google avisou que vai passar a RECUSÁ-LO numa versão futura — por
 * isso ele só é enviado se a variável existir, e nunca é exigido. Instalação nova não tem um, e
 * exigir um faria a integração ficar invisível esperando algo que não se consegue mais obter.
 *
 * SEM AS TRÊS VARIÁVEIS OBRIGATÓRIAS, A INTEGRAÇÃO NÃO APARECE NA TELA. Não é botão desabilitado
 * nem aviso de "em breve": some. A tela de Tráfego acabou de ser limpa de opção que não funciona,
 * e seria incoerente repor o mesmo problema pelo outro lado. Ver `googleAdsConfigurado`.
 */

/** Versão da API. Fixa de propósito: o Google descontinua versão antiga em prazo conhecido, e
 *  descobrir isso por quebra em produção é pior do que por aviso no calendário. */
const VERSAO = "v18";

const ESCOPO = "https://www.googleapis.com/auth/adwords";

export type ConfiguracaoGoogleAds = {
  clientId: string;
  clientSecret: string;
  loginCustomerId: string;
  /** Vazio na instalação nova, e tudo bem: ver o cabeçalho deste arquivo. */
  developerToken: string;
};

function configuracao(): ConfiguracaoGoogleAds | null {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET ?? "";
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "";
  // Sem hífen: o Google aceita só dígitos neste cabeçalho, e o painel mostra o número COM hífen
  // (692-239-4762). Tirar aqui evita que a diferença vire um 401 sem explicação.
  const loginCustomerId = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "").replace(/\D/g, "");
  // `developerToken` NÃO entra nesta checagem: é opcional desde 10/09/2026, e exigi-lo deixaria a
  // integração invisível pra sempre esperando um valor que o Google não emite mais.
  if (!clientId || !clientSecret || !loginCustomerId) return null;
  return { clientId, clientSecret, loginCustomerId, developerToken };
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
      "Google Ads não configurado. Faltam GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET " +
        "ou GOOGLE_ADS_LOGIN_CUSTOMER_ID.",
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

/**
 * Cabeçalhos de toda chamada à API.
 *
 * `login-customer-id` diz que a leitura é feita pela MCC da agência, e continua obrigatório.
 *
 * `developer-token` só vai se existir. Hoje ele é ignorado pelos servidores do Google, e numa
 * versão futura passa a ser RECUSADO: mandar um cabeçalho vazio seria o pior dos dois mundos,
 * porque não ajuda agora e quebra depois.
 */
function cabecalhos(accessToken: string): Record<string, string> {
  const conf = exigirConfiguracao();
  return {
    authorization: `Bearer ${accessToken}`,
    "login-customer-id": conf.loginCustomerId,
    "content-type": "application/json",
    ...(conf.developerToken ? { "developer-token": conf.developerToken } : {}),
  };
}

/** Exposto só pro teste: é o cabeçalho que some ou aparece conforme a variável. */
export function cabecalhosParaTeste(accessToken: string): Record<string, string> {
  return cabecalhos(accessToken);
}

export type LinhaCampanhaGoogle = LinhaGaql;

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
  segments?: { date?: string; conversionActionCategory?: string };
  metrics?: {
    costMicros?: string;
    conversions?: number;
    conversionsValue?: number;
  };
};

/**
 * As categorias de conversão que o Google trata como VENDA, e não como lead.
 *
 * A tela de Tráfego tem duas colunas diferentes, "Leads" e "Vendas", e no Meta elas vêm de eventos
 * diferentes (`lead` e `purchase`). No Google tudo chega como `conversions`, e a diferença está na
 * categoria da ação de conversão. Sem esta separação, as duas colunas mostrariam o mesmo número, e
 * o custo por venda ficaria idêntico ao custo por lead: dois indicadores dizendo a mesma coisa,
 * um deles errado.
 *
 * O que não está aqui conta como lead. É a escolha conservadora: uma categoria nova do Google cai
 * em "lead", que é o significado da maioria esmagadora das conversões de quem usa o CRM, em vez de
 * inflar a receita de vendas com evento que não é compra.
 */
const CATEGORIAS_DE_VENDA = new Set(["PURCHASE", "STORE_SALE", "SUBSCRIBE_PAID"]);

export function ehVenda(categoria: string | null | undefined): boolean {
  return CATEGORIAS_DE_VENDA.has((categoria ?? "").toUpperCase());
}

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
  /*
   * `segments.conversion_action_category` é o que separa lead de venda. Ele MULTIPLICA as linhas:
   * a resposta passa a ter uma linha por dia POR CATEGORIA, e o custo se repete em todas elas.
   * Somar o custo de todas somaria o mesmo gasto várias vezes, e é por isso que o custo é somado
   * uma vez por dia, na primeira linha daquele dia (ver `chaveDoDia` abaixo).
   */
  const consulta = `
    SELECT campaign.id, campaign.name, segments.date, segments.conversion_action_category,
           metrics.cost_micros, metrics.conversions, metrics.conversions_value
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
  return somarLinhas((blocos ?? []).flatMap((bloco) => bloco.results ?? []));
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

/**
 * Junta as linhas cruas do Google numa campanha por campanha.
 *
 * Fica separado da chamada de rede de propósito: é aqui que mora a aritmética que engana (custo
 * repetido por categoria, venda misturada com lead, micros), e teste que precisa de rede não é
 * teste que se roda.
 */
export function somarLinhas(linhas: LinhaGaql[]): CampanhaGoogle[] {
  const porCampanha = new Map<string, CampanhaGoogle>();
  // Custo já contado para este par campanha+dia. O Google repete o mesmo gasto em cada categoria
  // de conversão do dia; somar todas multiplicaria o investimento pelo número de categorias.
  const diasComCustoContado = new Set<string>();

  for (const linha of linhas) {
    const id = linha.campaign?.id;
    if (!id) continue;

    const atual = porCampanha.get(id) ?? {
      id,
      nome: linha.campaign?.name ?? "Campanha sem nome",
      investido: 0,
      leads: 0,
      vendas: 0,
      receita: 0,
    };

    const chaveDoDia = `${id}|${linha.segments?.date ?? ""}`;
    if (!diasComCustoContado.has(chaveDoDia)) {
      diasComCustoContado.add(chaveDoDia);
      atual.investido += deMicros(linha.metrics?.costMicros);
    }

    const conversoes = Number(linha.metrics?.conversions ?? 0);
    if (ehVenda(linha.segments?.conversionActionCategory)) {
      atual.vendas += conversoes;
      // Receita só de venda: valor de conversão de um formulário preenchido é valor ESTIMADO de
      // lead, e somá-lo à receita faria o ROAS contar dinheiro que ninguém recebeu.
      atual.receita += Number(linha.metrics?.conversionsValue ?? 0);
    } else {
      atual.leads += conversoes;
    }

    porCampanha.set(id, atual);
  }

  return [...porCampanha.values()];
}

/* ==============================================================================================
 * DEVOLVER A VENDA PRA PLATAFORMA
 *
 * Até aqui o caminho era de mão única: o Google manda a pessoa, o CRM anota de qual anúncio ela
 * veio, e o Google nunca fica sabendo se ela comprou. Pra ele todo mundo que clicou é igual, então
 * o algoritmo otimiza pra conseguir mais CLIQUES, não mais clientes.
 *
 * O que fecha o circuito é mandar de volta o mesmo código de clique junto do valor da venda. Aí o
 * Google passa a procurar gente parecida com quem pagou, e não com quem clicou.
 * ============================================================================================ */

/** O nome da ação de conversão que o CRM cria na conta do cliente. Fixo: é por ele que a busca
 *  reencontra a ação já existente e evita criar uma segunda. */
export const NOME_DA_CONVERSAO = "Venda · CRM AZUZ";

type RespostaDeBusca = { results?: { conversionAction?: { resourceName?: string } }[] }[];

/**
 * Garante que existe onde receber a venda, e devolve o endereço disso.
 *
 * O Google não aceita conversão solta: ela precisa apontar pra uma "ação de conversão" que já
 * exista dentro da conta. Ela não vem pronta, e pedir pro dono de uma clínica criar uma no painel
 * do Google Ads é pedir o que ele não vai fazer — então o CRM cria.
 *
 * PROCURA ANTES DE CRIAR, e é isso que torna a operação segura de repetir: chamada mil vezes, ela
 * cria no máximo uma. Sem essa busca, cada rodada do cron encheria a conta do cliente de ações
 * duplicadas com o mesmo nome, e os relatórios dele ficariam impossíveis de ler.
 */
export async function garantirAcaoDeConversao(params: {
  accessToken: string;
  customerId: string;
}): Promise<{ ok: true; resourceName: string } | { ok: false; erro: string }> {
  const customerId = params.customerId.replace(/\D/g, "");

  try {
    const busca = await fetch(
      `https://googleads.googleapis.com/${VERSAO}/customers/${customerId}/googleAds:searchStream`,
      {
        method: "POST",
        headers: cabecalhos(params.accessToken),
        body: JSON.stringify({
          query: `SELECT conversion_action.resource_name FROM conversion_action
                  WHERE conversion_action.name = '${NOME_DA_CONVERSAO.replace(/'/g, "\\'")}'
                    AND conversion_action.status != 'REMOVED'`,
        }),
      },
    );
    if (busca.ok) {
      const blocos = (await busca.json()) as RespostaDeBusca;
      const achado = blocos?.flatMap((b) => b.results ?? []).find((r) => r.conversionAction?.resourceName);
      if (achado?.conversionAction?.resourceName) {
        return { ok: true, resourceName: achado.conversionAction.resourceName };
      }
    }

    const criacao = await fetch(
      `https://googleads.googleapis.com/${VERSAO}/customers/${customerId}/conversionActions:mutate`,
      {
        method: "POST",
        headers: cabecalhos(params.accessToken),
        body: JSON.stringify({
          operations: [
            {
              create: {
                name: NOME_DA_CONVERSAO,
                // UPLOAD_CLICKS é o tipo que aceita conversão enviada por API a partir de um
                // gclid. Os outros tipos são medidos pelo próprio Google e recusam upload.
                type: "UPLOAD_CLICKS",
                category: "PURCHASE",
                status: "ENABLED",
                // Cada venda vale o que o funil registrou, não um valor fixo. `alwaysUseDefaultValue`
                // ligado faria toda venda valer o mesmo, e o algoritmo perderia justamente a
                // diferença entre o cliente de R$ 300 e o de R$ 30.000.
                valueSettings: { defaultValue: 0, alwaysUseDefaultValue: false },
                // Conta como conversão uma vez por clique. "MANY_PER_CLICK" faria uma recompra do
                // mesmo cliente inflar a campanha que trouxe ele na primeira vez.
                countingType: "ONE_PER_CLICK",
              },
            },
          ],
        }),
      },
    );
    const corpo = (await criacao.json()) as {
      results?: { resourceName?: string }[];
      error?: { message?: string };
    };
    if (!criacao.ok) {
      return { ok: false, erro: corpo?.error?.message ?? `HTTP ${criacao.status}` };
    }
    const resourceName = corpo.results?.[0]?.resourceName;
    if (!resourceName) return { ok: false, erro: "O Google aceitou a criação mas não devolveu o endereço da ação." };
    return { ok: true, resourceName };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Falha de rede" };
  }
}

export type ConversaoParaEnviar = {
  /** O código do clique, do jeito que foi capturado. */
  cliqueId: string;
  /** Qual dos três: decide EM QUAL CAMPO ele entra, e mandar no errado faz o Google aceitar e descartar. */
  tipoDoClique: string | null;
  /** Quando a venda foi fechada. */
  quando: Date;
  valor: number;
};

export type ResultadoDaConversao = { indice: number; erro: string };

/**
 * Manda as vendas de volta pro Google.
 *
 * `gclid`, `wbraid` e `gbraid` vão em CAMPOS DIFERENTES. Eles se parecem e é tentador tratar os
 * três como a mesma coisa, mas o Google aceita a chamada e descarta o dado em silêncio quando o
 * código vai no campo errado — a pior falha possível, porque parece sucesso.
 *
 * `partialFailure` ligado: uma venda recusada (clique velho demais, código inválido) não pode
 * derrubar as outras vinte da mesma rodada.
 */
export async function enviarConversoes(params: {
  accessToken: string;
  customerId: string;
  acaoDeConversao: string;
  conversoes: ConversaoParaEnviar[];
}): Promise<{ ok: true; falhas: ResultadoDaConversao[] } | { ok: false; erro: string }> {
  if (params.conversoes.length === 0) return { ok: true, falhas: [] };
  const customerId = params.customerId.replace(/\D/g, "");

  const operacoes = params.conversoes.map((c) => {
    const tipo = (c.tipoDoClique ?? "gclid").toLowerCase();
    const campoDoClique =
      tipo === "wbraid" ? { wbraid: c.cliqueId } : tipo === "gbraid" ? { gbraid: c.cliqueId } : { gclid: c.cliqueId };
    return {
      ...campoDoClique,
      conversionAction: params.acaoDeConversao,
      conversionDateTime: dataParaGoogle(c.quando),
      conversionValue: c.valor,
      currencyCode: "BRL",
    };
  });

  try {
    const resposta = await fetch(
      `https://googleads.googleapis.com/${VERSAO}/customers/${customerId}:uploadClickConversions`,
      {
        method: "POST",
        headers: cabecalhos(params.accessToken),
        body: JSON.stringify({ conversions: operacoes, partialFailure: true }),
      },
    );
    const corpo = (await resposta.json()) as {
      partialFailureError?: { message?: string; details?: unknown[] };
      error?: { message?: string };
    };
    if (!resposta.ok) return { ok: false, erro: corpo?.error?.message ?? `HTTP ${resposta.status}` };

    // O erro parcial vem como UMA mensagem cobrindo o lote. Sem o detalhamento por índice não dá
    // pra saber qual linha caiu, então a mensagem inteira é guardada em todas as que não deram
    // certo — melhor uma pista grosseira do que nenhuma.
    const falhas: ResultadoDaConversao[] = corpo.partialFailureError?.message
      ? [{ indice: -1, erro: corpo.partialFailureError.message }]
      : [];
    return { ok: true, falhas };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Falha de rede" };
  }
}

/**
 * O formato de data que o Google exige: "aaaa-mm-dd hh:mm:ss+hh:mm", com fuso explícito.
 *
 * Sem o fuso ele recusa. Com o fuso errado ele aceita e joga a venda no dia errado, o que
 * desalinha a conversão do clique que a produziu.
 */
function dataParaGoogle(quando: Date, fuso = "-03:00"): string {
  const deslocamento = Number(fuso.slice(0, 3)) * 60 + Number(fuso.slice(0, 1) + fuso.slice(4, 6));
  const local = new Date(quando.getTime() + deslocamento * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${local.getUTCFullYear()}-${p(local.getUTCMonth() + 1)}-${p(local.getUTCDate())} ` +
    `${p(local.getUTCHours())}:${p(local.getUTCMinutes())}:${p(local.getUTCSeconds())}${fuso}`
  );
}
