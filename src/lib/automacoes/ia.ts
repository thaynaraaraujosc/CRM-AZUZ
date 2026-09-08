import { perguntarClaude } from "@/lib/azuz-ia/claude";

/**
 * A IA das automações, atrás de uma interface.
 *
 * Duas razões pra não chamar a Anthropic direto do motor:
 *
 * 1. **Trocar de provedor não pode virar uma reescrita.** O CRM já fala com a Anthropic no chat
 *    interno; se amanhã for outro provedor (ou um modelo local), muda uma função aqui e o motor
 *    não sabe da diferença.
 * 2. **Quando não há IA configurada, o bloco precisa DIZER isso.** Sem chave, `provedorDeIA()`
 *    devolve `null` e o bloco registra "IA não configurada" no histórico — em vez de o fluxo
 *    parecer ter respondido o cliente e não ter respondido nada.
 */
export type ProvedorIA = {
  /** Nome pra aparecer no histórico ("respondido pela IA (Claude)"). */
  nome: string;
  responder: (params: { sistema: string; pergunta: string }) => Promise<string>;
};

export function provedorDeIA(): ProvedorIA | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return {
    nome: "Claude",
    responder: ({ sistema, pergunta }) => perguntarClaude({ systemPrompt: sistema, mensagens: [{ role: "user", content: pergunta }] }),
  };
}

/**
 * O texto que a IA recebe como contexto da conversa.
 *
 * Sem histórico, a resposta sai genérica e o cliente percebe na primeira frase. Com histórico
 * demais, o custo por mensagem sobe sem melhorar a resposta — por isso o corte nas últimas trocas.
 */
export function conversaEmTexto(mensagens: { tipo: string; texto: string }[], limite = 10): string {
  return mensagens
    .slice(-limite)
    .map((m) => `${m.tipo === "in" ? "Cliente" : "Nós"}: ${m.texto}`)
    .join("\n");
}

/**
 * Qual categoria a IA escolheu.
 *
 * A resposta de um modelo nunca é garantidamente uma das opções — ele pode responder "Parece ser
 * uma dúvida sobre preço". Por isso a leitura é tolerante, e quando nada bate devolve `null`: o
 * fluxo segue pela saída de "não classificado" em vez de escolher um ramo no chute.
 */
export function categoriaEscolhida(resposta: string, categorias: string[]): string | null {
  const limpa = resposta.trim().toLowerCase();
  const exata = categorias.find((c) => c.trim().toLowerCase() === limpa);
  if (exata) return exata;
  const contida = categorias.find((c) => c.trim() && limpa.includes(c.trim().toLowerCase()));
  return contida ?? null;
}
