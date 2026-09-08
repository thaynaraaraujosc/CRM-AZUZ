import { prisma } from "@/lib/prisma";
import { dispararAutomacoesDoCrm } from "@/lib/automation-flow/disparar-no-servidor";
import type { FluxoAutomacao } from "@/lib/automation-flow/types";
import { ehVazio } from "../vazio";

/**
 * Os gatilhos que dependem do RELÓGIO, não de alguém fazer alguma coisa.
 *
 * "Aniversário", "lead parado na etapa", "data personalizada" e "horário programado" não têm um
 * evento que os acione: ninguém clica, nenhuma mensagem chega. Alguém precisa perguntar, de tempos
 * em tempos, "chegou a hora de algum deles?". É o que esta varredura faz, na batida de cron que já
 * existe.
 *
 * **Custo**: a varredura começa procurando FLUXOS com esses gatilhos. Sem nenhum fluxo desses no
 * workspace, ela não toca na tabela de contatos nem na de cards. O custo é uma consulta e acabou.
 * Isso importa: é código que roda a cada minuto, para sempre.
 *
 * **Repetição**: cada disparo carrega uma chave com a DATA. Aniversário dispara uma vez por dia,
 * não uma vez por minuto. Mesmo a varredura passando 1.440 vezes por dia por cima do mesmo
 * contato.
 */
const TIPOS_DE_TEMPO = [
  "aniversario",
  "data_personalizada",
  "horario_programado",
  "lead_parado_etapa",
  "tarefa_vencida",
  "lead_nao_respondeu",
] as const;

type GatilhoDeTempo = (typeof TIPOS_DE_TEMPO)[number];

/** Os que acontecem NUM horário. O resto mede tempo decorrido e é conferido a cada rodada. */
const POR_HORA_DO_DIA = new Set<string>(["aniversario", "data_personalizada", "horario_programado", "tarefa_vencida"]);

export async function rodarGatilhosDeTempo(agora = new Date()): Promise<{ disparados: number }> {
  const fluxos = await prisma.fluxoAutomacao.findMany({
    where: { status: "publicado", ativa: true, arquivada: false },
  });
  if (!fluxos.length) return { disparados: 0 };

  let disparados = 0;

  for (const linha of fluxos) {
    const fluxo = linha as unknown as FluxoAutomacao;
    const gatilho = fluxo.nodes?.find((n) => n.category === "gatilho");
    if (!gatilho || !TIPOS_DE_TEMPO.includes(gatilho.type as GatilhoDeTempo)) continue;

    const data = (gatilho.data ?? {}) as Record<string, unknown>;
    // Só os gatilhos de HORA DO DIA respeitam o horário marcado. "Lead não respondeu em 2 horas" e
    // "lead parado há 3 dias" medem tempo DECORRIDO: prendê-los a um horário faria a cobrança de 2
    // horas chegar só no dia seguinte às 9h.
    if (POR_HORA_DO_DIA.has(gatilho.type) && !naHoraCerta(data.horario, agora)) continue;

    const alvos = await contatosAlvo({
      workspaceId: linha.workspaceId,
      tipo: gatilho.type as GatilhoDeTempo,
      data,
      agora,
    });

    for (const nome of alvos) {
      await dispararAutomacoesDoCrm({
        workspaceId: linha.workspaceId,
        contatoNome: nome,
        tipoGatilho: gatilho.type,
        // A data na chave é o que segura o disparo repetido: a varredura passa a cada minuto, e o
        // aniversário da pessoa é um acontecimento por dia.
        chaveEvento: `tempo:${gatilho.type}:${nome}:${diaDe(agora)}`,
      }).catch((erro) => console.error("[automacao] gatilho de tempo falhou:", erro));
      disparados++;
    }
  }

  return { disparados };
}

/**
 * Se agora é a hora configurada. Sem horário, vale 09:00: mandar mensagem automática de
 * madrugada é o tipo de coisa que faz o cliente bloquear o número.
 *
 * A janela é de um minuto porque a varredura roda a cada minuto: mais estreita perderia o disparo
 * se a batida atrasasse; mais larga dispararia duas vezes (e a chave do dia seguraria, mas por
 * acidente, não por desenho).
 */
function naHoraCerta(horario: unknown, agora: Date): boolean {
  const alvo = typeof horario === "string" && /^\d{1,2}:\d{2}$/.test(horario) ? horario : "09:00";
  const [h, m] = alvo.split(":").map(Number);
  return agora.getHours() === h && agora.getMinutes() === m;
}

function diaDe(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/** Quem deve entrar no fluxo agora, conforme o tipo de gatilho. */
async function contatosAlvo(params: {
  workspaceId: string;
  tipo: GatilhoDeTempo;
  data: Record<string, unknown>;
  agora: Date;
}): Promise<string[]> {
  const { workspaceId, tipo, data, agora } = params;

  if (tipo === "aniversario") {
    // `nascimento` é texto livre no banco (dd/mm/aaaa, aaaa-mm-dd…). Comparar só dia e mês evita
    // depender do formato inteiro e é o que interessa aqui.
    const contatos = await prisma.contato.findMany({
      where: { workspaceId, nascimento: { not: null } },
      select: { nome: true, nascimento: true },
    });
    const hoje = `${String(agora.getDate()).padStart(2, "0")}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
    return contatos.filter((c) => diaMesDe(c.nascimento) === hoje).map((c) => c.nome);
  }

  if (tipo === "data_personalizada") {
    // Uma data marcada no calendário, uma vez. Não é "N dias antes da consulta do contato": o
    // contato não tem campo de data configurável no CRM hoje, e inventar um campo que não existe
    // faria o gatilho nunca encontrar ninguém.
    const marcada = typeof data.data === "string" ? paraIso(data.data) : null;
    if (!marcada || marcada !== diaDe(agora)) return [];
    return contatosDaEtapa(workspaceId, data.etapaId);
  }

  if (tipo === "lead_nao_respondeu") {
    // "Não respondeu" = a ÚLTIMA mensagem da conversa é nossa, e já faz um tempo. Medir só pelo
    // silêncio não serviria: uma conversa em que ninguém falou nada nunca teve pergunta pendente.
    const valor = Number(data.tempoValor ?? 2) || 2;
    const unidade = String(data.tempoUnidade ?? "horas");
    const limite = new Date(agora.getTime() - valor * (unidade.startsWith("dia") ? 86_400_000 : 3_600_000));

    const conversas = await prisma.conversa.findMany({ where: { workspaceId }, select: { nome: true } });
    if (!conversas.length) return [];

    const ultimas = await prisma.mensagemExtra.findMany({
      where: { workspaceId, contato: { in: conversas.map((c) => c.nome) } },
      orderBy: { criadoEm: "desc" },
      select: { contato: true, tipo: true, criadoEm: true },
      // Uma varredura por minuto não pode ler o histórico inteiro do workspace. Este teto cobre
      // com folga as conversas com movimento recente, que são as únicas que podem virar "não
      // respondeu" agora.
      take: 500,
    });

    const vistos = new Set<string>();
    const alvos: string[] = [];
    for (const m of ultimas) {
      if (vistos.has(m.contato)) continue;
      vistos.add(m.contato);
      if (m.tipo === "out" && m.criadoEm && m.criadoEm < limite) alvos.push(m.contato);
    }
    return alvos;
  }

  if (tipo === "tarefa_vencida") {
    // Vencida = passou da data e ninguém concluiu. A data da tarefa é texto ("aaaa-mm-dd" ou "Sem
    // data"), então a comparação é de string mesmo. E "Sem data" nunca vence, que é o certo.
    const hoje = diaDe(agora);
    const tarefas = await prisma.tarefaCard.findMany({
      where: { workspaceId, concluida: false },
      select: { contato: true, data: true },
    });
    return tarefas
      .filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.data) && t.data < hoje && t.contato && !ehVazio(t.contato))
      .map((t) => t.contato);
  }

  if (tipo === "horario_programado") {
    // Dia da semana, quando o bloco restringe: "toda segunda às 9h".
    const dias = Array.isArray(data.diasSemana) ? (data.diasSemana as string[]) : null;
    if (dias?.length) {
      const nomes = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
      if (!dias.includes(nomes[agora.getDay()])) return [];
    }
    return contatosDaEtapa(workspaceId, data.etapaId);
  }

  // lead_parado_etapa
  const etapaId = typeof data.etapaId === "string" ? data.etapaId : "";
  if (!etapaId) return [];
  const valor = Number(data.tempoValor ?? 2) || 2;
  const unidade = String(data.tempoUnidade ?? "dias");
  const limite = new Date(agora.getTime() - valor * (unidade.startsWith("hor") ? 3_600_000 : 86_400_000));

  const cards = await prisma.negocioCard.findMany({ where: { workspaceId, etapaId }, select: { nome: true } });
  if (!cards.length) return [];

  // "Parado" é medido pela última MENSAGEM, não pela última escrita na linha da conversa: mudar o
  // status ou favoritar não é sinal de vida do lead.
  const ultimas = await prisma.mensagemExtra.groupBy({
    by: ["contato"],
    where: { workspaceId, contato: { in: cards.map((c) => c.nome) } },
    _max: { criadoEm: true },
  });
  const ultimaPorContato = new Map(ultimas.map((u) => [u.contato, u._max.criadoEm]));

  return cards
    .filter((c) => {
      const ultima = ultimaPorContato.get(c.nome);
      // Sem nenhuma mensagem, o lead está parado desde sempre. E é justamente quem precisa ser
      // cutucado.
      return !ultima || ultima < limite;
    })
    .map((c) => c.nome);
}

/**
 * Quem está numa etapa do funil. O público dos gatilhos de relógio.
 *
 * Horário fixo e data marcada precisam de um público, senão não querem dizer nada. Sem etapa
 * escolhida devolve VAZIO, de propósito: o contrário seria disparar pra base inteira porque alguém
 * esqueceu de preencher um campo, e isso é uma mensagem indevida pra centenas de pessoas.
 */
async function contatosDaEtapa(workspaceId: string, etapaId: unknown): Promise<string[]> {
  if (typeof etapaId !== "string" || !etapaId) return [];
  const cards = await prisma.negocioCard.findMany({ where: { workspaceId, etapaId }, select: { nome: true } });
  return cards.map((c) => c.nome);
}

/** "dd-mm" de uma data escrita em qualquer um dos formatos que o campo aceita. */
function diaMesDe(bruto: string | null): string | null {
  if (!bruto) return null;
  const iso = bruto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}-${iso[2]}`;
  const br = bruto.match(/^(\d{2})[/-](\d{2})/);
  return br ? `${br[1]}-${br[2]}` : null;
}

/** Converte "dd/mm/aaaa" ou "aaaa-mm-dd" para "aaaa-mm-dd". Devolve `null` no que não reconhece.
 * Comparar formato desconhecido daria disparo no dia errado. */
function paraIso(bruto: string): string | null {
  const iso = bruto.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const br = bruto.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : null;
}
