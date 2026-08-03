/**
 * Tipos da Central do Dia (página Início) — um "item do dia" é sempre derivado de dados que já
 * existem em outro módulo do CRM (conversa, tarefa, negócio, automação) ou, quando esse módulo não
 * tem o dado necessário ainda (agenda/compromissos), de um mock dedicado e claramente comentado como
 * tal. Nunca inventa estado próprio de negócio — só agrega e prioriza o que já existe.
 */

export type ModuloOrigem = "conversa" | "agenda" | "tarefa" | "lead" | "automacao";

export type PrioridadeDia = "urgente" | "atencao" | "oportunidade";

export type AcaoItemDia = {
  label: string;
  /** Presente quando a ação navega pra outra página do CRM. */
  href?: string;
  /** Presente quando a ação é só local (abrir drawer, marcar resolvido, etc). */
  onClick?: () => void;
};

export type ItemDia = {
  id: string;
  modulo: ModuloOrigem;
  /** Rótulo curto do tipo, mostrado no card (ex.: "Conversa", "Tarefa atrasada"). */
  tipo: string;
  titulo: string;
  descricao?: string;
  responsavel?: string;
  /** Horário/prazo já formatado pra exibição (ex.: "14:30", "Vence hoje"). */
  horario?: string;
  tempoEspera?: string;
  prioridade: PrioridadeDia;
  motivo?: string;
  acaoPrincipal: AcaoItemDia;
  acoesSecundarias: AcaoItemDia[];
  /** Campos extras só usados pela seção específica do módulo (canal, etapa, funil, status…). */
  extra?: Record<string, string | number | undefined>;
};

export type StatusCompromisso = "Confirmado" | "Aguardando confirmação" | "Cancelado" | "Concluído" | "Atrasado";

export type CompromissoDia = {
  id: string;
  horario: string;
  contato: string;
  tipo: string;
  responsavel: string;
  local: string;
  status: StatusCompromisso;
  /** Minutos até começar — só usado pro destaque "Começa em X minutos". */
  minutosParaComecar?: number;
};

export type RecomendacaoDia = {
  id: string;
  motivo: string;
  quantidade: number;
  impacto: "alto" | "medio" | "baixo";
  acaoSugerida: string;
  /** Pra "Ver itens" — filtro rápido que a recomendação representa. */
  filtroRelacionado?: string;
};
