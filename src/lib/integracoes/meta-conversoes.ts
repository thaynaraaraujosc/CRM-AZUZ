import { createHash } from "node:crypto";

import { META_GRAPH_URL } from "@/lib/integracoes/meta";

/**
 * Devolver pra Meta a venda que o funil fechou.
 *
 * O equivalente do que já existe pro Google, e o desenho é diferente porque a Meta é diferente.
 *
 * O Google recebe conversão por CLIQUE: manda-se o `gclid` e ele acha o clique. A Meta recebe
 * EVENTO, num "dataset" — a mesma caixa onde o pixel do site deposita. Pro lead que veio de um
 * anúncio de Click-to-WhatsApp, o elo é o `ctwa_clid`, que a própria Meta entrega junto da
 * primeira mensagem e o CRM já guarda desde que o rastreamento entrou.
 *
 * NADA AQUI FUNCIONA SEM APROVAÇÃO. A permissão `ads_management` já é pedida no login, mas a Meta
 * só entrega ela de verdade pra quem tem cargo no app até a análise passar. Pra todo mundo mais
 * ela é descartada em silêncio, sem erro — então a chamada falha com "permissão insuficiente" e é
 * isso que o cliente vai ver na tela, até a revisão sair.
 */

/** Resumo SHA-256 minúsculo, mesmo formato que o Google pede. A Meta exige o mesmo. */
function resumo(valor: string): string {
  return createHash("sha256").update(valor, "utf8").digest("hex");
}

export type DatasetDaMeta = { id: string; nome: string };

/**
 * Acha o dataset onde os eventos devem ser depositados.
 *
 * A conexão de anúncios guarda a conta, não o dataset — são coisas diferentes, e uma conta pode
 * ter vários. Pega-se o primeiro: quem tem mais de um é anunciante grande com time próprio, e
 * esse caso merece escolha explícita, não adivinhação. Por isso o nome volta junto, pra a tela
 * poder mostrar em qual está mandando.
 */
export async function resolverDataset(params: {
  accessToken: string;
  adAccountId: string;
}): Promise<{ ok: true; dataset: DatasetDaMeta } | { ok: false; erro: string }> {
  try {
    const conta = params.adAccountId.startsWith("act_") ? params.adAccountId : `act_${params.adAccountId}`;
    const resposta = await fetch(
      `${META_GRAPH_URL}/${conta}/adspixels?fields=id,name&access_token=${encodeURIComponent(params.accessToken)}`,
    );
    const corpo = (await resposta.json()) as {
      data?: { id: string; name?: string }[];
      error?: { message?: string };
    };
    if (!resposta.ok) return { ok: false, erro: corpo?.error?.message ?? `HTTP ${resposta.status}` };

    const primeiro = corpo.data?.[0];
    if (!primeiro) {
      return {
        ok: false,
        erro: "Nenhum conjunto de dados encontrado nessa conta de anúncios. Crie um pixel no Gerenciador de Eventos da Meta.",
      };
    }
    return { ok: true, dataset: { id: primeiro.id, nome: primeiro.name ?? primeiro.id } };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Falha de rede" };
  }
}

export type ConversaoMeta = {
  /** O código do clique que a Meta entregou junto da primeira mensagem. */
  ctwaClid: string | null;
  /** E-mail e telefone em texto puro: o resumo é feito aqui, nunca fora. */
  email?: string | null;
  telefone?: string | null;
  quando: Date;
  valor: number;
  /** Identificador do negócio, pra a Meta não contar duas vezes o que o pixel do site já mandou. */
  idDoNegocio: string;
};

/**
 * Manda os eventos de venda pro dataset.
 *
 * `action_source: "business_messaging"` é o que diz pra Meta que a venda nasceu de uma conversa, e
 * não de uma página — é essa marcação, junto do `ctwa_clid`, que liga o evento ao anúncio de
 * Click-to-WhatsApp que trouxe a pessoa. Mandar como evento de site faria a Meta aceitar e não
 * casar com anúncio nenhum.
 *
 * `event_id` é o identificador do negócio: se o site do cliente também dispara compra pelo pixel,
 * a Meta entende que é o mesmo evento e conta uma vez.
 */
export async function enviarConversoesMeta(params: {
  accessToken: string;
  datasetId: string;
  conversoes: ConversaoMeta[];
}): Promise<{ ok: true; recebidos: number } | { ok: false; erro: string }> {
  if (params.conversoes.length === 0) return { ok: true, recebidos: 0 };

  const eventos = params.conversoes.map((c) => {
    const userData: Record<string, unknown> = {};
    if (c.ctwaClid) userData.ctwa_clid = c.ctwaClid;
    // Telefone só com dígitos e com DDI, sem "+", que é como a Meta documenta.
    const telefone = (c.telefone ?? "").replace(/\D/g, "");
    if (telefone) {
      const comDdi = telefone.length === 10 || telefone.length === 11 ? `55${telefone}` : telefone;
      userData.ph = [resumo(comDdi)];
    }
    const email = (c.email ?? "").trim().toLowerCase();
    if (email.includes("@")) userData.em = [resumo(email)];

    return {
      event_name: "Purchase",
      // Em SEGUNDOS, não milissegundos. Em milissegundos a Meta aceita e joga o evento a
      // cinquenta mil anos no futuro, onde ele nunca casa com o clique.
      event_time: Math.floor(c.quando.getTime() / 1000),
      action_source: "business_messaging",
      messaging_channel: "whatsapp",
      event_id: c.idDoNegocio,
      user_data: userData,
      custom_data: { value: c.valor, currency: "BRL" },
    };
  });

  try {
    const resposta = await fetch(`${META_GRAPH_URL}/${params.datasetId}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: eventos, access_token: params.accessToken }),
    });
    const corpo = (await resposta.json()) as {
      events_received?: number;
      error?: { message?: string };
    };
    if (!resposta.ok) return { ok: false, erro: corpo?.error?.message ?? `HTTP ${resposta.status}` };
    return { ok: true, recebidos: corpo.events_received ?? eventos.length };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Falha de rede" };
  }
}
