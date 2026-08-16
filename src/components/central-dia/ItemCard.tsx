"use client";

import Link from "next/link";

import { IconAutomacoes, IconCalendar, IconConversas, IconPipeline, IconTarefas } from "@/components/icons";
import type { ItemDia, ModuloOrigem } from "@/lib/central-dia/tipos";

const ICONE_MODULO: Record<ModuloOrigem, typeof IconConversas> = {
  conversa: IconConversas,
  agenda: IconCalendar,
  tarefa: IconTarefas,
  lead: IconPipeline,
  automacao: IconAutomacoes,
};

const LABEL_PRIORIDADE: Record<ItemDia["prioridade"], string> = {
  urgente: "Urgente",
  atencao: "Precisa de atenção",
  oportunidade: "Oportunidade",
};

/**
 * Card de pendência — só visualização. Clicar no card inteiro leva direto pra pendência
 * (conversa/tarefa/lead/automação); resolver/adiar continuam nas telas de origem, sem duplicar
 * botões de ação aqui (a Central do Dia é só um resumo do que precisa de atenção hoje).
 */
export function ItemCard({ item }: { item: ItemDia }) {
  const Icone = ICONE_MODULO[item.modulo];

  return (
    <Link href={item.acaoPrincipal.href ?? "#"} className={`central-dia-card is-${item.prioridade}`} data-item-id={item.id}>
      <div className="central-dia-card-icone" aria-hidden="true">
        <Icone width={16} height={16} />
      </div>
      <div className="central-dia-card-corpo">
        <div className="central-dia-card-topo">
          <span className="central-dia-card-tipo">{item.tipo}</span>
          <span className={`central-dia-badge is-${item.prioridade}`}>{LABEL_PRIORIDADE[item.prioridade]}</span>
        </div>
        <p className="central-dia-card-titulo">{item.titulo}</p>
        {item.descricao ? <p className="central-dia-card-desc">{item.descricao}</p> : null}
        <div className="central-dia-card-meta">
          {item.responsavel ? <span>Responsável: {item.responsavel}</span> : null}
          {item.horario ? <span>{item.horario}</span> : null}
          {item.tempoEspera ? <span>Aguardando há {item.tempoEspera}</span> : null}
        </div>
      </div>
    </Link>
  );
}
