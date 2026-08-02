/**
 * Linha do tempo unificada de um contato — deriva eventos reais a partir dos
 * dados que já existem em cada módulo (conversas, tarefas, funil, perdas),
 * em vez de manter uma lista de eventos separada e hardcoded.
 *
 * LIMITAÇÃO CONHECIDA (documentada aqui de propósito): como o CRM ainda não
 * tem backend/persistência, os dados de origem não guardam timestamp real —
 * só strings de exibição em formatos variados ("Há 6 min", "28 jul",
 * "22/07/2026", "09:14"...). `estimarMinutosAtras()` faz o melhor parse
 * possível desses formatos pra poder ordenar a timeline, mas é uma
 * heurística, não um relógio real. Quando existir timestamp de verdade
 * (após a camada de backend), essa função deixa de ser necessária — troque
 * `minutosAtras` por diferença de `Date` real e o resto do módulo não muda.
 */

import {
  contatos as contatosPadrao,
  conversas as conversasPadrao,
  funis as funisPadrao,
  oportunidadesPerdidas as perdasPadrao,
  tarefas as tarefasPadrao,
  type ColunaTarefas,
  type Contato,
  type Conversa,
  type Funil,
  type Origem,
} from "@/lib/data";
import { slugId } from "@/lib/ids";

export type EventoTipo =
  | "contato_criado"
  | "mensagem_recebida"
  | "mensagem_enviada"
  | "sistema"
  | "tarefa_criada"
  | "tarefa_concluida"
  | "entrou_etapa"
  | "negociacao_perdida"
  | "negociacao_fechada";

export const EVENTO_LABELS: Record<EventoTipo, string> = {
  contato_criado: "Contato criado",
  mensagem_recebida: "Mensagem recebida",
  mensagem_enviada: "Mensagem enviada",
  sistema: "Automação / sistema",
  tarefa_criada: "Tarefa",
  tarefa_concluida: "Tarefa concluída",
  entrou_etapa: "Mudança de etapa",
  negociacao_perdida: "Negociação perdida",
  negociacao_fechada: "Negociação fechada",
};

export type Evento = {
  id: string;
  contatoId: string;
  tipo: EventoTipo;
  titulo: string;
  descricao?: string;
  /** Texto original tal como registrado no módulo de origem. */
  quando: string;
  /** Chave de ordenação — ver nota de limitação no topo do arquivo. */
  minutosAtras: number;
  origem?: Origem;
  responsavel?: string;
  link?: { modulo: "conversa" | "tarefa" | "funil" | "perdas"; href: string };
};

const MESES: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

/** Dia de referência de todo o CRM — mesmo "hoje" usado em `data.ts`. */
const HOJE = new Date(2026, 6, 30);

function diffMinutos(data: Date): number {
  return Math.round((HOJE.getTime() - data.getTime()) / 60000);
}

/** Sentinela usado quando não dá pra estimar — cai no fim da timeline. */
const SEM_DATA = 10 ** 8;

export function estimarMinutosAtras(raw: string): number {
  const texto = raw.trim();
  if (!texto) return SEM_DATA;
  const low = texto.toLowerCase();
  let m: RegExpMatchArray | null;

  if (low === "hoje" || low === "agora") return 0;
  if (low === "ontem") return 24 * 60;
  if ((m = low.match(/^há (\d+)\s*min/))) return Number(m[1]);
  if ((m = low.match(/^há (\d+)\s*h(?:oras?)?\s*(\d+)?/))) return Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0);
  if ((m = low.match(/^(\d+)h(\d+)?$/))) return Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0);
  if ((m = low.match(/^há (\d+)\s*dias?/))) return Number(m[1]) * 1440;

  // ISO aaaa-mm-dd
  if ((m = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/))) {
    return diffMinutos(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }
  // dd/mm/aaaa
  if ((m = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/))) {
    return diffMinutos(new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  }
  // "28 jul" / "01 ago"
  if ((m = low.match(/^(\d{1,2})\s+([a-zç]{3})\.?$/))) {
    const mes = MESES[m[2]];
    if (mes) return diffMinutos(new Date(2026, mes - 1, Number(m[1])));
  }
  // "HH:MM" (assume dia de hoje)
  if ((m = low.match(/^(\d{1,2}):(\d{2})/))) {
    return diffMinutos(new Date(2026, 6, 30, Number(m[1]), Number(m[2])));
  }
  return SEM_DATA;
}

export type EstadoCicloDeVida =
  | "Novo lead"
  | "Em atendimento"
  | "Em negociação"
  | "Cliente"
  | "Perdido";

/**
 * Estado do ciclo de vida do contato — derivado da etapa atual dele no funil
 * e de eventuais negociações perdidas registradas, nunca de um campo
 * separado que possa dessincronizar. Ver seção 5 do escopo: os estados são
 * transições, não um campo solto editado à mão.
 */
export function inferirEstadoCicloDeVida(
  contato: Pick<Contato, "nome" | "etapa">,
  oportunidadesPerdidas: FontesTimeline["oportunidadesPerdidas"],
): EstadoCicloDeVida {
  if (contato.etapa === "Fechado") return "Cliente";
  const perdeu = oportunidadesPerdidas.some((o) => o.cliente === contato.nome);
  if (perdeu && contato.etapa === "Novo") return "Perdido";
  if (contato.etapa === "Proposta") return "Em negociação";
  if (contato.etapa === "Qualificado") return "Em atendimento";
  return "Novo lead";
}

type FontesTimeline = {
  contatos: Contato[];
  conversas: Conversa[];
  tarefas: ColunaTarefas[];
  funis: Funil[];
  oportunidadesPerdidas: typeof perdasPadrao;
};

const FONTES_PADRAO: FontesTimeline = {
  contatos: contatosPadrao,
  conversas: conversasPadrao,
  tarefas: tarefasPadrao,
  funis: funisPadrao,
  oportunidadesPerdidas: perdasPadrao,
};

/**
 * Gera a linha do tempo de um contato cruzando conversas, tarefas, funil e
 * negociações perdidas — todas ligadas pelo mesmo `id`/nome, sem duplicar
 * dado nenhum: cada evento é derivado, nunca copiado.
 */
export function gerarLinhaDoTempo(
  contatoId: string,
  fontes: FontesTimeline = FONTES_PADRAO,
): Evento[] {
  const contato = fontes.contatos.find((c) => c.id === contatoId);
  if (!contato) return [];

  const eventos: Evento[] = [];

  const conversa = fontes.conversas.find(
    (c) => c.id === contatoId || slugId(c.nome) === contatoId,
  );
  if (conversa) {
    const ancora = estimarMinutosAtras(conversa.tempo);
    let jaTeveMensagemRecebida = false;
    conversa.mensagens.forEach((msg, i) => {
      // Mensagens são cronológicas dentro da conversa (índice 0 = mais antiga).
      // Sem timestamp real por mensagem, aproxima cada uma como "2 min mais
      // antiga que a próxima", ancorado no tempo total da conversa (ver nota
      // de limitação no topo do arquivo).
      const passosAteFinal = conversa.mensagens.length - 1 - i;
      const minutosAtras = ancora + passosAteFinal * 2;
      const primeira = msg.tipo === "in" && !jaTeveMensagemRecebida;
      if (msg.tipo === "in") jaTeveMensagemRecebida = true;

      eventos.push({
        id: `${conversa.id}-msg-${i}`,
        contatoId,
        tipo: msg.tipo === "in" ? "mensagem_recebida" : msg.tipo === "out" ? "mensagem_enviada" : "sistema",
        titulo:
          msg.tipo === "system"
            ? msg.texto
            : primeira
              ? "Primeira mensagem recebida"
              : msg.tipo === "in"
                ? "Mensagem recebida"
                : "Mensagem enviada",
        descricao: msg.tipo === "system" ? undefined : msg.texto,
        quando: msg.hora || conversa.tempo,
        minutosAtras,
        origem: conversa.origem,
        link: { modulo: "conversa", href: `/conversas?id=${conversa.id}` },
      });
    });
  }

  for (const coluna of fontes.tarefas) {
    for (const t of coluna.cards) {
      if (t.contato !== contato.nome) continue;
      eventos.push({
        id: `${t.id}-criada`,
        contatoId,
        tipo: "tarefa_criada",
        titulo: t.titulo,
        descricao: t.descricao,
        quando: t.data,
        minutosAtras: estimarMinutosAtras(t.data),
        responsavel: t.responsavel.nome,
        link: { modulo: "tarefa", href: `/tarefas?id=${t.id}` },
      });
      if (t.concluida) {
        eventos.push({
          id: `${t.id}-concluida`,
          contatoId,
          tipo: "tarefa_concluida",
          titulo: `Tarefa concluída: ${t.titulo}`,
          quando: t.data,
          // Sem data real de conclusão, assume a mesma referência da tarefa
          // mas um pouco mais recente (concluída depois de criada).
          minutosAtras: Math.max(0, estimarMinutosAtras(t.data) - 5),
          responsavel: t.responsavel.nome,
          link: { modulo: "tarefa", href: `/tarefas?id=${t.id}` },
        });
      }
    }
  }

  for (const funil of fontes.funis) {
    for (const coluna of funil.colunas) {
      const card = coluna.cards.find((c) => c.nome === contato.nome);
      if (!card) continue;
      eventos.push({
        id: `${funil.id}-${coluna.id}-${card.id}`,
        contatoId,
        tipo: "entrou_etapa",
        titulo: `Entrou na etapa "${coluna.titulo}" — ${funil.nome}`,
        quando: card.dias,
        minutosAtras: estimarMinutosAtras(card.data || card.dias),
        origem: card.origem,
        link: { modulo: "funil", href: `/funil` },
      });
    }
  }

  for (const perda of fontes.oportunidadesPerdidas) {
    if (perda.cliente !== contato.nome) continue;
    eventos.push({
      id: `perda-${slugId(perda.cliente)}-${perda.data}`,
      contatoId,
      tipo: "negociacao_perdida",
      titulo: `Negociação perdida — ${perda.motivo}`,
      descricao: `Etapa: ${perda.etapa} · Valor: ${perda.valor}`,
      quando: perda.data,
      minutosAtras: estimarMinutosAtras(perda.data),
      responsavel: perda.responsavel,
      link: { modulo: "perdas", href: `/performance-vendas` },
    });
  }

  eventos.sort((a, b) => a.minutosAtras - b.minutosAtras);

  // Primeiro registro do contato — sempre o evento mais antigo da timeline,
  // já que não existe (ainda) um timestamp real de criação no modelo de dados.
  eventos.push({
    id: `${contatoId}-criado`,
    contatoId,
    tipo: "contato_criado",
    titulo: "Contato registrado no CRM",
    descricao: `Origem: ${contato.origem}`,
    quando: "—",
    minutosAtras: SEM_DATA + 1,
    origem: contato.origem,
  });

  return eventos;
}
