import type { BotaoTemplate } from "@/lib/templates/regras";

/**
 * Modelos de mensagem escritos pela AZUZ, prontos pra copiar.
 *
 * São PONTO DE PARTIDA, não conteúdo pronto pra disparar: nascem como cópia dentro do workspace,
 * onde a pessoa troca o que quiser antes de usar. É por isso que ficam separados dos modelos do
 * cliente na tela: misturar os dois faria alguém mandar pro cliente dele um texto que ele nunca
 * leu, achando que era seu.
 *
 * Todos são de Instagram, e todos respeitam os limites reais do Direct: até 1.000 caracteres de
 * texto e até 13 respostas rápidas de 20 caracteres.
 */
export type ModeloAzuz = {
  id: string;
  nome: string;
  /** Quando usar. A frase que faz a pessoa escolher entre um e outro. */
  quando: string;
  corpo: string;
  botoes?: BotaoTemplate[];
};

export const MODELOS_AZUZ: ModeloAzuz[] = [
  {
    id: "azuz-boas-vindas",
    nome: "Boas-vindas no Direct",
    quando: "Primeira mensagem de quem nunca falou com você.",
    corpo:
      "Oi, {{nome}}! Que bom te ver por aqui 💙\n\nMe conta o que você procura que eu te ajudo agora mesmo.",
    botoes: [{ texto: "Quero comprar" }, { texto: "Tenho uma dúvida" }],
  },
  {
    id: "azuz-comentario-link",
    nome: "Resposta a quem comentou",
    quando: "Depois de um comentário que pediu o link ou o material.",
    corpo:
      "Oi, {{nome}}! Vi seu comentário 💙 Aqui está o que prometi:\n\n(cole o link)\n\nQualquer dúvida é só responder por aqui.",
  },
  {
    id: "azuz-story",
    nome: "Quem respondeu o story",
    quando: "Logo depois de uma resposta a story, pra virar conversa.",
    corpo:
      "Oi, {{nome}}! Obrigado por responder 💙\n\nQuer que eu te mande os detalhes ou prefere falar com alguém do time?",
    botoes: [{ texto: "Manda os detalhes" }, { texto: "Falar com alguém" }],
  },
  {
    id: "azuz-retomar",
    nome: "Retomar conversa parada",
    quando: "Alguém escreveu, você respondeu e a conversa morreu. Ainda dentro das 24 horas.",
    corpo:
      "Oi, {{nome}}! Passando pra saber se ficou alguma dúvida do que conversamos.\n\nSe quiser, respondo por aqui mesmo.",
  },
  {
    id: "azuz-mencao",
    nome: "Agradecer a menção",
    quando: "Quando alguém marca seu perfil num story.",
    corpo: "Vi que você nos marcou, {{nome}}. Muito obrigado! 💙",
  },
];
