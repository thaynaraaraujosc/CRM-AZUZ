"use client";

import Link from "next/link";

import { IconAutomacoes, IconCalendar, IconConversas, IconPipeline, IconTarefas } from "@/components/icons";
import { useCentralDia, type PeriodoAdiamento } from "@/lib/central-dia-context";
import type { ItemDia, ModuloOrigem } from "@/lib/central-dia/tipos";
import { AcoesMenu } from "./AcoesMenu";
import { AdiarMenu } from "./AdiarMenu";

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
 * Card padrão de item do dia (item 4 do pedido) — reaproveitado por todas as seções da Central do
 * Dia (grupos de prioridade, conversas, tarefas, leads, automações). Um componente só, pra não
 * duplicar o mesmo layout de card 6 vezes.
 */
export function ItemCard({ item }: { item: ItemDia }) {
  const { marcarConcluido, adiarItem } = useCentralDia();
  const Icone = ICONE_MODULO[item.modulo];

  function resolver() {
    marcarConcluido({
      itemId: item.id,
      titulo: item.titulo,
      tipo: item.tipo,
      horario: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      usuario: "Ana Ferreira",
      acao: "Marcado como resolvido",
    });
  }

  function adiar(periodo: PeriodoAdiamento, data?: string, hora?: string) {
    adiarItem(item.id, periodo, data, hora);
  }

  return (
    <div className={`central-dia-card is-${item.prioridade}`} data-item-id={item.id}>
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
      <div className="central-dia-card-acoes">
        {item.acaoPrincipal.href ? (
          <Link href={item.acaoPrincipal.href} className="btn primary">
            {item.acaoPrincipal.label}
          </Link>
        ) : (
          <button type="button" className="btn primary" onClick={item.acaoPrincipal.onClick}>
            {item.acaoPrincipal.label}
          </button>
        )}
        <button type="button" className="btn ghost" onClick={resolver}>
          Marcar como resolvido
        </button>
        <AdiarMenu onAdiar={adiar} />
        <AcoesMenu acoes={item.acoesSecundarias} label={`Mais ações para ${item.titulo}`} />
      </div>
    </div>
  );
}
