import { INSTAGRAM_GRAPH_VERSION } from "./instagram-login";

/**
 * Métricas do Instagram, e só as que a API devolve de verdade.
 *
 * A regra desta tela é a que mais custa quando se quebra: **número inventado é pior que número
 * nenhum**. Alcance estimado, engajamento calculado "por cima" e gráfico preenchido com o que
 * seria bonito ter fazem alguém tomar decisão de investimento em cima de ficção. Então aqui:
 *
 * - o que a API entrega, aparece;
 * - o que ela recusa, aparece como recusado, com o motivo dela;
 * - o que ela não tem, não aparece.
 *
 * As métricas são pedidas UMA A UMA de propósito. Num lote, uma métrica que a conta não tem
 * direito de ver derruba a resposta inteira, e o painel fica vazio por causa de um item só. Uma a
 * uma custa algumas chamadas a mais e devolve tudo que aquela conta realmente pode ver.
 */

/** As métricas de conta que este produto mostra, com o nome que a pessoa entende. */
export const METRICAS_CONTA = [
  { chave: "reach", label: "Contas alcançadas", ajuda: "Quantas contas diferentes viram algum conteúdo seu." },
  { chave: "accounts_engaged", label: "Contas que interagiram", ajuda: "Quantas contas curtiram, comentaram, salvaram ou compartilharam." },
  { chave: "total_interactions", label: "Interações", ajuda: "Curtidas, comentários, salvamentos e compartilhamentos somados." },
  { chave: "profile_views", label: "Visitas ao perfil", ajuda: "Quantas vezes seu perfil foi aberto." },
] as const;

export type MetricaInstagram = {
  chave: string;
  label: string;
  ajuda: string;
  valor: number;
};

export type MetricaRecusada = {
  chave: string;
  label: string;
  /** O que a Meta respondeu. Palavra dela, não nossa. */
  motivo: string;
};

export type PerfilInstagram = {
  username?: string;
  nome?: string;
  seguidores?: number;
  publicacoes?: number;
};

export type ResultadoMetricas = {
  perfil: PerfilInstagram | null;
  perfilErro?: string;
  metricas: MetricaInstagram[];
  recusadas: MetricaRecusada[];
};

type ErroGraph = { error_message?: string; error?: { message?: string } };

function mensagemDoErro(dados: ErroGraph, status: number): string {
  return dados.error_message ?? dados.error?.message ?? `A Meta respondeu ${status}.`;
}

/**
 * Dados do perfil conectado.
 *
 * `followers_count` e `media_count` só vêm em conta comercial ou de criador. Numa conta pessoal a
 * Meta simplesmente omite os campos, e aí eles ficam ausentes em vez de zerados: zero seria uma
 * afirmação errada ("você não tem seguidores"), ausência é a verdade ("não sabemos").
 */
export async function buscarPerfilInstagram(accessToken: string): Promise<{ perfil: PerfilInstagram | null; erro?: string }> {
  const url = `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/me?fields=username,name,followers_count,media_count&access_token=${accessToken}`;
  try {
    const resposta = await fetch(url);
    const dados = (await resposta.json()) as {
      username?: string;
      name?: string;
      followers_count?: number;
      media_count?: number;
    } & ErroGraph;
    if (!resposta.ok) return { perfil: null, erro: mensagemDoErro(dados, resposta.status) };
    return {
      perfil: {
        username: dados.username,
        nome: dados.name,
        seguidores: dados.followers_count,
        publicacoes: dados.media_count,
      },
    };
  } catch (erro) {
    return { perfil: null, erro: erro instanceof Error ? erro.message : "Falha ao falar com a Meta." };
  }
}

/**
 * Uma métrica de conta, no período pedido.
 *
 * `metric_type=total_value` é o formato atual: a Meta devolve um número só pelo período, em vez da
 * série diária antiga. É o que a tela precisa, e é o único formato que várias destas métricas
 * ainda aceitam.
 */
async function buscarUmaMetrica(
  accessToken: string,
  chave: string,
  desde: Date,
  ate: Date,
): Promise<{ valor: number } | { erro: string }> {
  const parametros = new URLSearchParams({
    metric: chave,
    metric_type: "total_value",
    period: "day",
    since: String(Math.floor(desde.getTime() / 1000)),
    until: String(Math.floor(ate.getTime() / 1000)),
    access_token: accessToken,
  });
  try {
    const resposta = await fetch(
      `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/me/insights?${parametros.toString()}`,
    );
    const dados = (await resposta.json()) as {
      data?: { name?: string; total_value?: { value?: number } }[];
    } & ErroGraph;
    if (!resposta.ok) return { erro: mensagemDoErro(dados, resposta.status) };

    const valor = dados.data?.[0]?.total_value?.value;
    if (typeof valor !== "number") {
      // A chamada deu certo mas veio sem número. Não é zero: é ausência, e a tela precisa saber a
      // diferença pra não afirmar "zero alcance" quando a verdade é "a Meta não informou".
      return { erro: "A Meta não devolveu valor pra esta métrica no período." };
    }
    return { valor };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Falha ao falar com a Meta." };
  }
}

/** O painel inteiro: perfil e as métricas de conta do período. */
export async function buscarMetricasInstagram(params: {
  accessToken: string;
  desde: Date;
  ate: Date;
}): Promise<ResultadoMetricas> {
  const { accessToken, desde, ate } = params;

  const { perfil, erro: perfilErro } = await buscarPerfilInstagram(accessToken);

  const respostas = await Promise.all(
    METRICAS_CONTA.map(async (m) => ({ definicao: m, resultado: await buscarUmaMetrica(accessToken, m.chave, desde, ate) })),
  );

  const metricas: MetricaInstagram[] = [];
  const recusadas: MetricaRecusada[] = [];
  for (const { definicao, resultado } of respostas) {
    if ("valor" in resultado) {
      metricas.push({ chave: definicao.chave, label: definicao.label, ajuda: definicao.ajuda, valor: resultado.valor });
    } else {
      recusadas.push({ chave: definicao.chave, label: definicao.label, motivo: resultado.erro });
    }
  }

  return { perfil, perfilErro, metricas, recusadas };
}
