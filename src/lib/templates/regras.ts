import { extrairVariaveis, paraNumeradas, type MapeamentoVariavel } from "@/lib/campanhas/variaveis";

/**
 * Regras de um template por canal. O que a tela mostra, o que o servidor recusa.
 *
 * Os limites do WhatsApp oficial são os da Meta, não escolha nossa: 3 botões de resposta rápida,
 * 25 caracteres por botão, 1.024 no corpo, nome só com minúsculas/números/underscore. Passar
 * disso não é "ficar feio", é a Meta recusar o modelo na criação. Os outros dois canais não têm
 * análise nem botão: no WhatsApp por QR o CRM manda texto puro (botão interativo pelo WhatsApp
 * Web é instável e a Evolution não garante), e e-mail simplesmente não tem esse conceito.
 *
 * Puro (sem banco), pra tela e servidor usarem a MESMA validação. Se a regra mudar, muda aqui e
 * os dois lados acompanham.
 */
export type CanalTemplate = "whatsapp_oficial" | "whatsapp_nao_oficial" | "email";

export type BotaoTemplate = { texto: string };

export type TemplateEditavel = {
  nome: string;
  canal: CanalTemplate;
  categoria?: string | null;
  idioma?: string | null;
  assunto?: string | null;
  corpo: string;
  variaveis?: MapeamentoVariavel[] | null;
  botoes?: BotaoTemplate[] | null;
};

export type LimitesDoCanal = {
  label: string;
  corpoMaximo: number;
  botoesMaximo: number;
  botaoMaximo: number;
  exigeCategoria: boolean;
  exigeIdioma: boolean;
  exigeAssunto: boolean;
  /** Passa por análise externa (Meta) antes de poder ser usado. */
  temAnalise: boolean;
  /** O que a tela explica pra pessoa sobre esse canal. */
  explicacao: string;
};

export const CATEGORIAS_META = [
  { valor: "MARKETING", label: "Marketing", explicacao: "Promoções, novidades, ofertas. É a maioria dos disparos." },
  { valor: "UTILITY", label: "Utilidade", explicacao: "Confirmação, lembrete, atualização de algo que a pessoa pediu." },
  { valor: "AUTHENTICATION", label: "Autenticação", explicacao: "Código de verificação. Formato fixo, quase nunca é o caso de um CRM." },
] as const;

export const IDIOMAS = [
  { valor: "pt_BR", label: "Português (Brasil)" },
  { valor: "pt_PT", label: "Português (Portugal)" },
  { valor: "en_US", label: "Inglês (EUA)" },
  { valor: "es", label: "Espanhol" },
] as const;

export const LIMITES: Record<CanalTemplate, LimitesDoCanal> = {
  whatsapp_oficial: {
    label: "WhatsApp API Oficial",
    corpoMaximo: 1024,
    botoesMaximo: 3,
    botaoMaximo: 25,
    exigeCategoria: true,
    exigeIdioma: true,
    exigeAssunto: false,
    temAnalise: true,
    explicacao:
      "Precisa ser aprovado pela Meta antes de ser usado. A análise costuma levar minutos, às vezes horas. " +
      "É o único jeito de falar primeiro com quem não escreveu nas últimas 24h.",
  },
  whatsapp_nao_oficial: {
    label: "WhatsApp (QR Code)",
    corpoMaximo: 4096,
    botoesMaximo: 0,
    botaoMaximo: 0,
    exigeCategoria: false,
    exigeIdioma: false,
    exigeAssunto: false,
    temAnalise: false,
    explicacao: "Texto puro, sem aprovação. Botões não funcionam de forma confiável por este canal, por isso não existem aqui.",
  },
  email: {
    label: "E-mail",
    corpoMaximo: 100_000,
    botoesMaximo: 0,
    botaoMaximo: 0,
    exigeCategoria: false,
    exigeIdioma: false,
    exigeAssunto: true,
    temAnalise: false,
    explicacao: "Assunto e corpo. Sem aprovação.",
  },
};

export const CANAIS_TEMPLATE = Object.keys(LIMITES) as CanalTemplate[];

/** Nome no formato que a Meta aceita: minúsculas, números e underscore. */
export function normalizarNomeMeta(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 512);
}

/** Problemas de um template, em português, prontos pra tela. Lista vazia = pode salvar. */
export function validarTemplate(t: TemplateEditavel): string[] {
  const limites = LIMITES[t.canal];
  const problemas: string[] = [];
  if (!limites) return ["Canal inválido."];

  if (!t.nome?.trim()) problemas.push("Dê um nome ao template.");
  if (!t.corpo?.trim()) problemas.push("Escreva a mensagem.");
  else if (t.corpo.length > limites.corpoMaximo) {
    problemas.push(`A mensagem passa de ${limites.corpoMaximo.toLocaleString("pt-BR")} caracteres neste canal.`);
  }
  if (limites.exigeCategoria && !t.categoria) problemas.push("Escolha a categoria (a Meta exige).");
  if (limites.exigeIdioma && !t.idioma) problemas.push("Escolha o idioma.");
  if (limites.exigeAssunto && !t.assunto?.trim()) problemas.push("E-mail precisa de assunto.");

  const botoes = (t.botoes ?? []).filter((b) => b.texto?.trim());
  if (botoes.length > limites.botoesMaximo) {
    problemas.push(
      limites.botoesMaximo === 0
        ? "Este canal não aceita botões."
        : `No máximo ${limites.botoesMaximo} botões neste canal.`,
    );
  }
  for (const b of botoes) {
    if (b.texto.length > limites.botaoMaximo) {
      problemas.push(`O botão "${b.texto.slice(0, 20)}…" passa de ${limites.botaoMaximo} caracteres.`);
    }
  }
  const textos = botoes.map((b) => b.texto.trim().toLowerCase());
  if (new Set(textos).size !== textos.length) problemas.push("Dois botões não podem ter o mesmo texto.");

  // Variável na mensagem que não está no mapeamento: a tela normalmente remonta o mapeamento a
  // cada tecla, mas o servidor não confia nisso.
  const chaves = extrairVariaveis(t.corpo ?? "");
  const mapeadas = new Set((t.variaveis ?? []).map((v) => v.chave));
  for (const chave of chaves) {
    if (!mapeadas.has(chave)) problemas.push(`A variável {{${chave}}} está na mensagem mas não foi configurada.`);
  }
  if (t.canal === "whatsapp_oficial") {
    // A Meta recusa modelo que COMEÇA ou TERMINA com variável, e variável colada em outra.
    const corpo = (t.corpo ?? "").trim();
    if (/^\{\{/.test(corpo) || /\}\}$/.test(corpo)) {
      problemas.push("No WhatsApp oficial a mensagem não pode começar nem terminar com uma variável.");
    }
  }
  return problemas;
}

/** Exemplo que a Meta exige pra cada variável na análise. Sem isso ela recusa o modelo. */
function exemploDe(v: MapeamentoVariavel): string {
  if (v.origem === "texto" && v.valor?.trim()) return v.valor.trim();
  const porOrigem: Record<string, string> = {
    "contato.nome": "Maria",
    "contato.sobrenome": "Silva",
    "contato.empresa": "Empresa Exemplo",
    "contato.cargo": "Gerente",
    "contato.cidade": "Goiânia",
    "contato.email": "maria@exemplo.com",
    "contato.whatsapp": "5562999999999",
    "contato.responsavel": "Ana",
  };
  return porOrigem[v.origem] ?? "exemplo";
}

/**
 * Os `components` do modelo no formato da Graph API, a partir do que a pessoa escreveu: corpo com
 * variáveis numeradas (mais os exemplos obrigatórios) e botões de resposta rápida.
 */
export function montarComponentesMeta(t: TemplateEditavel): Record<string, unknown>[] {
  const variaveis = [...(t.variaveis ?? [])].sort((a, b) => a.indice - b.indice);
  const corpo: Record<string, unknown> = { type: "BODY", text: paraNumeradas(t.corpo, variaveis) };
  if (variaveis.length) corpo.example = { body_text: [variaveis.map(exemploDe)] };

  const componentes: Record<string, unknown>[] = [corpo];
  const botoes = (t.botoes ?? []).filter((b) => b.texto?.trim());
  if (botoes.length) {
    componentes.push({
      type: "BUTTONS",
      buttons: botoes.map((b) => ({ type: "QUICK_REPLY", text: b.texto.trim() })),
    });
  }
  return componentes;
}

/** Status da Meta (`APPROVED`…) no vocabulário do CRM. */
export function statusDaMeta(status: string | null | undefined): "em_analise" | "aprovado" | "rejeitado" {
  switch ((status ?? "").toUpperCase()) {
    case "APPROVED":
      return "aprovado";
    case "REJECTED":
    case "DISABLED":
    case "PAUSED":
      return "rejeitado";
    default:
      return "em_analise";
  }
}

export const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};
