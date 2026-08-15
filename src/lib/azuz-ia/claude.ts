const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

/** Modelo configurável por env var — se o alias padrão não estiver disponível na conta do
 * usuário, dá pra trocar sem precisar mexer em código. */
function modelo(): string {
  return process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
}

type MensagemClaude = { role: "user" | "assistant"; content: string };

type RespostaClaude = {
  content?: { type: string; text?: string }[];
  error?: { message?: string };
};

/**
 * Chama a API da Anthropic direto via `fetch` (mesmo estilo já usado pra Graph API da Meta em
 * `src/app/api/integracoes/meta/callback/route.ts` — sem SDK nova, um padrão só de "chamar API
 * externa" no projeto todo). Sem streaming nesta fase: o chat espera a resposta completa.
 */
export async function perguntarClaude(params: { systemPrompt: string; mensagens: MensagemClaude[] }): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada no servidor.");

  const resposta = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: modelo(),
      max_tokens: 1024,
      system: params.systemPrompt,
      messages: params.mensagens,
    }),
  });

  const corpo = (await resposta.json()) as RespostaClaude;
  if (!resposta.ok) {
    throw new Error(corpo.error?.message ?? `Falha na API da Anthropic (${resposta.status})`);
  }

  const texto = corpo.content?.find((bloco) => bloco.type === "text")?.text;
  if (!texto) throw new Error("Resposta da Anthropic sem texto.");
  return texto;
}
