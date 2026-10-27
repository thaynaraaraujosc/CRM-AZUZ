import { normalizarTelefoneParaComparacao } from "@/lib/telefone";

/**
 * O que uma resposta de formulário do CRM tem de interesse pro atendimento.
 *
 * Puro de propósito — sem banco, sem rede. A leitura acontece no SERVIDOR, a partir do JSON de
 * `paginas` que já está gravado, e não no navegador de quem responde. Isso não é detalhe: hoje o
 * contato e o card são criados por chamadas disparadas da aba do lead, e quem fecha a aba no meio
 * deixa metade acontecer. Mensagem automática não pode depender disso.
 */

export type LeadDaResposta = {
  nome: string | null;
  /** Normalizado (DDI + DDD + 9), ou `null` quando não veio ou não dá pra usar. */
  whatsapp: string | null;
  email: string | null;
  /**
   * O instante da reunião, em UTC, vindo do campo "Agendar reunião".
   *
   * `null` quando o formulário não tem esse campo ou a pessoa não preencheu. Repare que o TIPO do
   * campo é que decide: um "Data e hora" comum pode ser nascimento, prazo ou data da obra, e
   * nenhum deles deve virar reunião na agenda nem gerar mensagem.
   */
  reuniao: Date | null;
  /**
   * `true` só quando existe uma pergunta mapeada como consentimento E ela foi marcada.
   *
   * Sem a pergunta o valor é `false`, não `null`: esta mensagem parte do CRM pra quem nunca
   * escreveu, e aí "não se sabe" vale como não.
   */
  consentiu: boolean;
};

type Pergunta = { id?: unknown; tipo?: unknown; mapeamentoCrm?: unknown };

/** As respostas que contam como "sim" numa caixa de consentimento, em qualquer dos formatos que os
 *  campos do formulário gravam (`sim_nao`, `checkbox`, `opcao_unica`). */
const SIM = new Set(["sim", "true", "1", "on", "aceito", "concordo", "autorizo"]);

export function lerLeadDaResposta(paginas: unknown, valores: Record<string, string>): LeadDaResposta {
  const porMapeamento = new Map<string, string>();
  let reuniaoBruta = "";

  for (const pagina of Array.isArray(paginas) ? paginas : []) {
    const perguntas = (pagina as { perguntas?: unknown })?.perguntas;
    for (const bruta of Array.isArray(perguntas) ? perguntas : []) {
      const pergunta = bruta as Pergunta;
      const id = typeof pergunta.id === "string" ? pergunta.id : null;
      if (!id) continue;
      const valor = (valores[id] ?? "").trim();
      if (!valor) continue;

      if (pergunta.tipo === "agendamento") reuniaoBruta = valor;
      const mapeamento = typeof pergunta.mapeamentoCrm === "string" ? pergunta.mapeamentoCrm : null;
      // O PRIMEIRO campo de cada mapeamento vence: dois campos mapeados pro mesmo lugar é erro de
      // quem montou o formulário, e trocar o valor no meio do caminho esconderia esse erro.
      if (mapeamento && !porMapeamento.has(mapeamento)) porMapeamento.set(mapeamento, valor);
    }
  }

  const telefone = porMapeamento.get("whatsapp") ?? "";
  const normalizado = telefone ? normalizarTelefoneParaComparacao(telefone) : "";

  return {
    nome: porMapeamento.get("nome") ?? null,
    // Telefone que não vira número utilizável é o mesmo que telefone ausente: melhor não ter do
    // que tentar mandar mensagem pra uma sequência de dígitos.
    whatsapp: normalizado.length >= 12 ? normalizado : null,
    email: porMapeamento.get("email") ?? null,
    reuniao: lerInstanteEmBrasilia(reuniaoBruta),
    consentiu: SIM.has((porMapeamento.get("consentimentoWhatsApp") ?? "").trim().toLowerCase()),
  };
}

/**
 * O horário escolhido no formulário → o instante em UTC.
 *
 * DOIS FORMATOS, e a diferença entre eles são três horas na agenda de alguém.
 *
 * 1. COM FUSO ("...Z" ou "...-03:00"), que é o que o campo "Agendar reunião" grava hoje: o
 *    instante já está decidido, e a única coisa certa a fazer é ler como está.
 * 2. SEM FUSO ("AAAA-MM-DDTHH:MM"), como gravava a primeira versão do campo e como ainda está em
 *    toda resposta já recebida: aí o que a pessoa viu na tela era hora de Brasília, e é assim que
 *    precisa ser lido. O CRM inteiro trabalha nesse fuso (agenda, disparos, avisos, relatórios).
 *
 * Tratar o caso 1 como se fosse o 2 é o erro caro: o prefixo de "2026-10-22T12:00:00.000Z" casa
 * com o padrão do caso 2, e lê-lo assim marcaria 12h de Brasília uma reunião que é às 9h.
 */
export function lerInstanteEmBrasilia(valor: string): Date | null {
  const texto = valor.trim();
  if (!texto) return null;

  const temFuso = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(texto);
  if (temFuso) {
    const instante = new Date(texto);
    return Number.isNaN(instante.getTime()) ? null : instante;
  }

  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(texto);
  if (!m) return null;
  const [, ano, mes, dia, hora, minuto] = m;
  // -03:00 fixo: o Brasil não tem horário de verão desde 2019, e inventar uma conversão por data
  // seria prometer uma precisão que nenhuma outra parte do CRM tem.
  const instante = new Date(`${ano}-${mes}-${dia}T${hora}:${minuto}:00.000-03:00`);
  return Number.isNaN(instante.getTime()) ? null : instante;
}
