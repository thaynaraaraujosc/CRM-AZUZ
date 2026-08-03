/**
 * Deriva os "itens do dia" a partir de dados que já existem em outros módulos do CRM (conversas,
 * tarefas, funis, fluxos de automação) — a Central do Dia nunca guarda o próprio estado de negócio,
 * só agrega e prioriza. As únicas exceções são "Agenda de hoje" (o CRM ainda não tem um módulo de
 * compromissos com hora/local/modalidade — só derivava datas de tarefas) e "Recomendações", que são
 * regras locais mockadas (não é IA de verdade), ambas comentadas como tal.
 */

import type { Conversa, ColunaTarefas, Funil, TaskCard } from "@/lib/data";
import type { FluxoAutomacao } from "@/lib/automation-flow/types";
import { validarFluxo } from "@/lib/automation-flow/validacao";
import type { AcaoItemDia, CompromissoDia, ItemDia, RecomendacaoDia } from "./tipos";

/** Converte "9 min" / "1h" / "4 dias" em minutos — só pra comparar/ordenar, nunca mostrado direto. */
export function tempoParaMinutos(tempo: string): number {
  const m = tempo.match(/(\d+)\s*min/);
  if (m) return Number(m[1]);
  const h = tempo.match(/(\d+)\s*h(?:oras?)?(?!\w)/);
  if (h) return Number(h[1]) * 60;
  const d = tempo.match(/(\d+)\s*dias?/);
  if (d) return Number(d[1]) * 24 * 60;
  return 0;
}

function acaoAbrirConversa(nome: string): AcaoItemDia {
  return { label: "Abrir conversa", href: `/conversas?contato=${encodeURIComponent(nome)}` };
}

/** Conversas em que a última mensagem foi do contato (tipo "in") — é a nossa vez de responder,
 * independente do rótulo de status (que descreve o estado geral do atendimento, não "de quem é a vez"). */
export function itensDeConversas(conversas: Conversa[]): ItemDia[] {
  return conversas
    .filter((c) => c.status !== "Finalizado")
    .filter((c) => {
      const ultima = c.mensagens[c.mensagens.length - 1];
      return ultima?.tipo === "in";
    })
    .map((c) => {
      const ultima = c.mensagens[c.mensagens.length - 1];
      const minutos = tempoParaMinutos(c.tempo);
      const prioridade = minutos >= 120 ? "urgente" : minutos >= 30 ? "atencao" : "oportunidade";
      return {
        id: `conversa-${c.id}`,
        modulo: "conversa",
        tipo: "Conversa",
        titulo: `${c.nome} aguarda resposta`,
        descricao: `Última mensagem recebida há ${c.tempo}${ultima?.texto ? `: "${ultima.texto.slice(0, 60)}${ultima.texto.length > 60 ? "…" : ""}"` : "."}`,
        responsavel: c.atendenteSelecionado,
        tempoEspera: c.tempo,
        prioridade,
        motivo: minutos >= 120 ? "Cliente aguardando resposta acima do tempo limite" : "Contato ainda sem resposta",
        acaoPrincipal: { label: "Responder agora", href: `/conversas?contato=${encodeURIComponent(c.nome)}` },
        acoesSecundarias: [
          acaoAbrirConversa(c.nome),
          { label: "Transferir", onClick: () => {} },
          { label: "Criar tarefa", onClick: () => {} },
        ],
        extra: { canal: c.canal, initials: c.initials, naoLidas: c.naoLidas },
      } satisfies ItemDia;
    });
}

/** Tarefas atrasadas (coluna "Atrasadas") e as de hoje/próximas — mesma fonte usada em Tarefas/Agenda. */
export function itensDeTarefas(colunas: ColunaTarefas[]): ItemDia[] {
  const itens: ItemDia[] = [];
  colunas.forEach((coluna) => {
    if (coluna.titulo === "Concluídas") return;
    coluna.cards.forEach((t: TaskCard) => {
      const atrasada = coluna.titulo === "Atrasadas" || !!t.atrasada;
      const prioridade = atrasada ? "urgente" : t.urgencia === "Alta" ? "atencao" : "oportunidade";
      itens.push({
        id: `tarefa-${t.id}`,
        modulo: "tarefa",
        tipo: atrasada ? "Tarefa atrasada" : `Tarefa · ${coluna.titulo}`,
        titulo: t.titulo,
        descricao: t.descricao,
        responsavel: t.responsavel.nome,
        horario: t.data,
        prioridade,
        motivo: atrasada ? "Tarefa vencida" : undefined,
        acaoPrincipal: { label: "Abrir", href: "/tarefas" },
        acoesSecundarias: [
          { label: "Concluir", onClick: () => {} },
          { label: "Reatribuir", onClick: () => {} },
          { label: "Adiar", onClick: () => {} },
        ],
        extra: { coluna: coluna.titulo, urgencia: t.urgencia, modelo: t.modelo },
      });
    });
  });
  return itens;
}

/** Negócios parados (dias ≥ 3) e sem etiqueta/etapa recente — reaproveita o mesmo regex de "dias" já
 * usado antes em Início pra achar negociações paradas. */
export function itensDeLeads(funis: Funil[]): ItemDia[] {
  const itens: ItemDia[] = [];
  funis.forEach((funil) => {
    funil.colunas
      .filter((c) => !c.titulo.startsWith("Fechado"))
      .forEach((coluna) => {
        coluna.cards.forEach((card) => {
          const m = card.dias.match(/(\d+)\s*dias?/i);
          const dias = m ? Number(m[1]) : 0;
          if (dias < 3) return;
          const prioridade = dias >= 7 ? "urgente" : "atencao";
          itens.push({
            id: `lead-${card.id}`,
            modulo: "lead",
            tipo: "Lead parado na etapa",
            titulo: card.nome,
            descricao: `Parado há ${card.dias} na etapa "${coluna.titulo}" do ${funil.nome}.`,
            responsavel: funil.responsavel,
            horario: card.dias,
            prioridade,
            motivo: `Sem avanço há ${card.dias}`,
            acaoPrincipal: { label: "Abrir lead", href: "/funil" },
            acoesSecundarias: [
              { label: "Atribuir responsável", onClick: () => {} },
              { label: "Criar tarefa", onClick: () => {} },
              { label: "Fazer follow-up", onClick: () => {} },
              { label: "Marcar como perdido", onClick: () => {} },
            ],
            extra: { etapa: coluna.titulo, funil: funil.nome, origem: card.origem, valor: card.valor },
          });
        });
      });
  });
  return itens;
}

/** Só fluxos com pendência de verdade (reaproveita o mesmo `validarFluxo` usado no construtor —
 * não inventa uma segunda lista de problemas em paralelo) ou pausados/rascunho há mais tempo. */
export function itensDeAutomacoes(fluxos: FluxoAutomacao[]): ItemDia[] {
  const itens: ItemDia[] = [];
  fluxos
    .filter((f) => !f.arquivada)
    .forEach((fluxo) => {
      const problemas = validarFluxo(fluxo);
      const erros = problemas.filter((p) => p.severidade === "erro");
      const rascunhoParado = fluxo.status === "rascunho";
      const pausada = fluxo.status === "publicado" && !fluxo.ativa;

      if (erros.length === 0 && !rascunhoParado && !pausada) return;

      const problema = erros[0]?.mensagem ?? (rascunhoParado ? "Em rascunho, ainda não publicada" : "Publicada, mas pausada");
      itens.push({
        id: `automacao-${fluxo.id}`,
        modulo: "automacao",
        tipo: "Automação",
        titulo: fluxo.nome,
        descricao: problema,
        // Não usa `fluxo.atualizadoEm` como horário de exibição: fluxos migrados do sistema legado
        // guardam esse campo como `new Date().toISOString()` computado em tempo de migração, que
        // diverge entre a renderização no servidor e a hidratação no cliente (bug pré-existente,
        // fora do escopo desta tela) — mostrar isso aqui causaria erro de hidratação toda vez.
        prioridade: erros.length > 0 ? "urgente" : "atencao",
        motivo: problema,
        acaoPrincipal: { label: "Corrigir agora", href: `/automacoes/editor/${fluxo.id}` },
        acoesSecundarias: [
          { label: "Abrir automação", href: `/automacoes/editor/${fluxo.id}` },
          { label: "Testar fluxo", onClick: () => {} },
          { label: "Ignorar hoje", onClick: () => {} },
        ],
        extra: { status: fluxo.status, ativa: fluxo.ativa ? "sim" : "não", gravidade: erros.length > 0 ? "erro" : "aviso" },
      });
    });
  return itens;
}

/**
 * Compromissos de hoje — mockados: o CRM ainda não tem um módulo de agenda com hora/local/modalidade
 * de verdade (a página Agenda só posiciona tarefas no calendário). Front-end apenas, nunca persistido
 * como dado real.
 */
export const COMPROMISSOS_HOJE_MOCK: CompromissoDia[] = [
  {
    id: "compromisso-1",
    horario: "09:00",
    contato: "Marcos Aurélio",
    tipo: "Retorno de avaliação",
    responsavel: "Dr. Hélio Marinho",
    local: "Presencial · Sala 2",
    status: "Confirmado",
  },
  {
    id: "compromisso-2",
    horario: "11:30",
    contato: "Renata Farias",
    tipo: "Reagendamento",
    responsavel: "Bruno Salles",
    local: "Ligação",
    status: "Aguardando confirmação",
    minutosParaComecar: 30,
  },
  {
    id: "compromisso-3",
    horario: "14:00",
    contato: "Camila Duarte",
    tipo: "Consulta particular",
    responsavel: "Ana Ferreira",
    local: "Presencial · Recepção",
    status: "Aguardando confirmação",
  },
  {
    id: "compromisso-4",
    horario: "08:00",
    contato: "Paulo Lacerda",
    tipo: "Demonstração",
    responsavel: "Bruno Salles",
    local: "Vídeo · Google Meet",
    status: "Atrasado",
  },
];

/** Recomendações — regras locais mockadas (nunca IA real), derivadas de contagens simples sobre os
 * mesmos itens já calculados acima. */
export function gerarRecomendacoes(itens: ItemDia[]): RecomendacaoDia[] {
  const leadsParados = itens.filter((i) => i.modulo === "lead" && i.prioridade !== "oportunidade").length;
  const semResponsavel = itens.filter((i) => i.modulo === "lead" && !i.responsavel).length;
  const agendamentosTarde = COMPROMISSOS_HOJE_MOCK.filter((c) => Number(c.horario.slice(0, 2)) >= 12 && c.status === "Aguardando confirmação").length;
  const automacoesPausadas = itens.filter((i) => i.modulo === "automacao" && i.extra?.status === "publicado" && i.extra?.ativa === "não").length;

  const recomendacoes: RecomendacaoDia[] = [];
  if (leadsParados > 0) {
    recomendacoes.push({
      id: "rec-followup-parados",
      motivo: `Criar follow-up para ${leadsParados} lead${leadsParados > 1 ? "s" : ""} parado${leadsParados > 1 ? "s" : ""}`,
      quantidade: leadsParados,
      impacto: leadsParados >= 4 ? "alto" : "medio",
      acaoSugerida: "Criar tarefa de follow-up",
      filtroRelacionado: "leads",
    });
  }
  if (semResponsavel > 0) {
    recomendacoes.push({
      id: "rec-sem-responsavel",
      motivo: `Atribuir ${semResponsavel} contato${semResponsavel > 1 ? "s" : ""} sem responsável`,
      quantidade: semResponsavel,
      impacto: "medio",
      acaoSugerida: "Atribuir responsável",
      filtroRelacionado: "leads",
    });
  }
  if (agendamentosTarde > 0) {
    recomendacoes.push({
      id: "rec-confirmar-tarde",
      motivo: `Confirmar ${agendamentosTarde} agendamento${agendamentosTarde > 1 ? "s" : ""} da tarde`,
      quantidade: agendamentosTarde,
      impacto: "medio",
      acaoSugerida: "Confirmar agendamentos",
      filtroRelacionado: "agenda",
    });
  }
  if (automacoesPausadas > 0) {
    recomendacoes.push({
      id: "rec-revisar-automacao",
      motivo: `Revisar ${automacoesPausadas} ${automacoesPausadas > 1 ? "automações" : "automação"} ainda não ativada${automacoesPausadas > 1 ? "s" : ""}`,
      quantidade: automacoesPausadas,
      impacto: "baixo",
      acaoSugerida: "Revisar automação",
      filtroRelacionado: "automacoes",
    });
  }
  return recomendacoes;
}
