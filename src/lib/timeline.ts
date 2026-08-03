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
  type Canal,
  type ColunaTarefas,
  type Contato,
  type Conversa,
  type Funil,
  type Origem,
} from "@/lib/data";
import { slugId } from "@/lib/ids";
import { estimarMinutosAtras } from "@/lib/datas";

export { estimarMinutosAtras };

export type EventoTipo =
  | "contato_criado"
  | "mensagem_recebida"
  | "mensagem_enviada"
  | "sistema"
  | "tarefa_criada"
  | "tarefa_concluida"
  | "entrou_etapa"
  | "negociacao_perdida"
  | "negociacao_fechada"
  | "documento_enviado"
  | "anotacao";

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
  documento_enviado: "Documento",
  anotacao: "Anotação",
};

/**
 * Categoria de exibição pra filtro da linha do tempo (seção 8 do escopo:
 * Tudo / Conversas / Atividades / Funil / Automações / Negociações /
 * Compras / Documentos / Anotações). Cada tipo bruto de evento pertence a
 * exatamente uma categoria.
 */
export type CategoriaEvento =
  | "Conversas"
  | "Atividades"
  | "Funil"
  | "Automações"
  | "Negociações"
  | "Compras"
  | "Documentos"
  | "Anotações";

export const CATEGORIAS_EVENTO: CategoriaEvento[] = [
  "Conversas",
  "Atividades",
  "Funil",
  "Automações",
  "Negociações",
  "Compras",
  "Documentos",
  "Anotações",
];

export const EVENTO_CATEGORIA: Record<EventoTipo, CategoriaEvento> = {
  contato_criado: "Funil",
  mensagem_recebida: "Conversas",
  mensagem_enviada: "Conversas",
  sistema: "Automações",
  tarefa_criada: "Atividades",
  tarefa_concluida: "Atividades",
  entrou_etapa: "Funil",
  negociacao_perdida: "Negociações",
  negociacao_fechada: "Compras",
  documento_enviado: "Documentos",
  anotacao: "Anotações",
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

/** Sentinela usado quando não dá pra estimar — cai no fim da timeline. */
const SEM_DATA = 10 ** 8;

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
  /**
   * Eventos extras que não têm uma fonte derivável em `data.ts` ainda —
   * hoje anotações manuais e resultados de negociação registrados direto na
   * conversa (venda/perda/adiada/cancelada). Entram no mesmo merge/ordenação
   * dos eventos derivados; quando essas ações ganharem persistência própria,
   * viram só mais uma fonte em `FontesTimeline` e esse parâmetro some.
   */
  extras: Evento[] = [],
): Evento[] {
  const contato = fontes.contatos.find((c) => c.id === contatoId);
  if (!contato) return [];

  const eventos: Evento[] = [...extras];

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

      if (msg.documento) {
        eventos.push({
          id: `${conversa.id}-doc-${i}`,
          contatoId,
          tipo: "documento_enviado",
          titulo: `Documento: ${msg.documento.nome}`,
          descricao: `${msg.documento.formato.toUpperCase()} · ${msg.documento.origem === "crm" ? "biblioteca do CRM" : "enviado pelo computador"}`,
          quando: msg.hora || conversa.tempo,
          minutosAtras: minutosAtras - 0.1,
          origem: conversa.origem,
          link: { modulo: "conversa", href: `/conversas?id=${conversa.id}` },
        });
      }
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
      const minutosAtras = estimarMinutosAtras(card.data || card.dias);
      eventos.push({
        id: `${funil.id}-${coluna.id}-${card.id}`,
        contatoId,
        tipo: "entrou_etapa",
        titulo: `Entrou na etapa "${coluna.titulo}" — ${funil.nome}`,
        quando: card.dias,
        minutosAtras,
        origem: card.origem,
        link: { modulo: "funil", href: `/funil` },
      });
      if (coluna.titulo.startsWith("Fechado")) {
        eventos.push({
          id: `${funil.id}-${coluna.id}-${card.id}-venda`,
          contatoId,
          tipo: "negociacao_fechada",
          titulo: `Negociação fechada — ${card.valor}`,
          descricao: `Funil: ${funil.nome}`,
          quando: card.dias,
          minutosAtras: minutosAtras - 0.1,
          origem: card.origem,
          link: { modulo: "funil", href: `/funil` },
        });
      }
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

function parseValorMoeda(raw: string): number | null {
  if (!raw || raw === "—") return null;
  const limpo = raw.replace(/[^\d,]/g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) && limpo !== "" ? n : null;
}

function formatarMoedaResumo(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export type ResumoJornada = {
  primeiraEntrada: string | null;
  origem: Origem;
  canalInicial: Canal | null;
  tempoAtePrimeiraResposta: string | null;
  quantidadeNegociacoes: number;
  quantidadeCompras: number;
  receitaAcumulada: string | null;
  ticketMedio: string | null;
  ultimaCompra: string | null;
  ultimaInteracao: string;
  proximaAcao: string | null;
};

/**
 * Resumo executivo da jornada de um contato — usado tanto no painel lateral
 * quanto no relatório individual (mesma fonte, sem duplicar cálculo). Campos
 * que o modelo de dados atual não consegue derivar (ex.: tempo até
 * qualificação, porque o funil só guarda a etapa atual, não o histórico de
 * cada transição) voltam como `null` — a tela decide como mostrar isso
 * ("Não disponível" ou "Ainda não ocorreu", nunca um zero silencioso).
 */
export function calcularResumoJornada(
  contato: Contato,
  eventos: Evento[],
  fontes: Pick<FontesTimeline, "funis" | "tarefas" | "conversas"> = FONTES_PADRAO,
): ResumoJornada {
  const eventosReais = eventos.slice(0, -1); // o último é sempre o sentinela "contato_criado"
  const primeiraEntradaEvento = eventosReais[eventosReais.length - 1] ?? null;

  const mensagensRecebidas = eventosReais.filter((e) => e.tipo === "mensagem_recebida");
  const mensagensEnviadas = eventosReais.filter((e) => e.tipo === "mensagem_enviada");
  const primeiraRecebida = mensagensRecebidas[mensagensRecebidas.length - 1] ?? null;
  const primeiraRespostaDepois = primeiraRecebida
    ? mensagensEnviadas.find((e) => e.minutosAtras < primeiraRecebida.minutosAtras) ?? null
    : null;
  const tempoAtePrimeiraResposta =
    primeiraRecebida && primeiraRespostaDepois
      ? formatarMinutosDiferenca(primeiraRecebida.minutosAtras - primeiraRespostaDepois.minutosAtras)
      : null;

  const cardsDoContato = fontes.funis.flatMap((f) =>
    f.colunas.flatMap((c) => c.cards.filter((card) => card.nome === contato.nome).map((card) => ({ card, coluna: c }))),
  );
  const compras = cardsDoContato.filter(({ coluna }) => coluna.titulo.startsWith("Fechado"));
  const valoresCompras = compras.map(({ card }) => parseValorMoeda(card.valor)).filter((v): v is number => v !== null);
  const receitaAcumulada = valoresCompras.length > 0 ? valoresCompras.reduce((s, v) => s + v, 0) : null;
  const ultimaCompraEvento = eventosReais.find((e) => e.tipo === "negociacao_fechada") ?? null;

  const conversaDoContato = fontes.conversas.find(
    (c) => c.id === contato.id || slugId(c.nome) === contato.id,
  );

  const tarefasDoContato = fontes.tarefas
    .flatMap((c) => c.cards)
    .filter((t) => t.contato === contato.nome && !t.concluida);
  const proximaTarefa = tarefasDoContato.find((t) => !t.atrasada) ?? tarefasDoContato[0] ?? null;

  return {
    primeiraEntrada: primeiraEntradaEvento?.quando ?? null,
    origem: contato.origem,
    canalInicial: conversaDoContato?.canal ?? null,
    tempoAtePrimeiraResposta,
    quantidadeNegociacoes: cardsDoContato.length,
    quantidadeCompras: compras.length,
    receitaAcumulada: receitaAcumulada !== null ? formatarMoedaResumo(receitaAcumulada) : null,
    ticketMedio:
      receitaAcumulada !== null && compras.length > 0
        ? formatarMoedaResumo(receitaAcumulada / compras.length)
        : null,
    ultimaCompra: ultimaCompraEvento?.quando ?? null,
    ultimaInteracao: contato.ultima,
    proximaAcao: proximaTarefa ? `${proximaTarefa.titulo} · ${proximaTarefa.data}` : null,
  };
}

function formatarMinutosDiferenca(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m}min`;
  if (m < 1440) return `${Math.floor(m / 60)}h${m % 60 > 0 ? `${m % 60}min` : ""}`;
  return `${Math.floor(m / 1440)} dias`;
}
