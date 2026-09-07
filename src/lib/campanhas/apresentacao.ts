import type { Audiencia } from "./audiencia-tipos";
import type { LIMITES } from "@/lib/templates/regras";

/** Só apresentação (sem banco): rótulos e contagens que a lista e o detalhe de disparos compartilham. */
export type CampanhaResumo = {
  id: string;
  titulo: string;
  canal: keyof typeof LIMITES;
  status: string;
  agendadaPara: string;
  iniciadaEm: string | null;
  concluidaEm: string | null;
  erroMensagem: string | null;
  templateId: string | null;
  audiencia: Audiencia | null;
  criadoEm: string;
  contagem: Record<string, number>;
};

export const STATUS_CAMPANHA: Record<string, { label: string; badge: string }> = {
  agendada: { label: "Agendado", badge: "badge-info" },
  enviando: { label: "Processando", badge: "badge-warning" },
  pausada: { label: "Pausado", badge: "badge-neutral" },
  concluida: { label: "Concluído", badge: "badge-success" },
  concluida_com_erros: { label: "Concluído com falhas", badge: "badge-danger" },
  cancelada: { label: "Cancelado", badge: "badge-neutral" },
};

export const STATUS_DESTINATARIO: Record<string, string> = {
  pendente: "Na fila",
  enviando: "Enviando",
  enviado: "Enviado",
  entregue: "Entregue",
  lido: "Lido",
  falhou: "Falhou",
  cancelado: "Cancelado",
};

/** Agrega o `contagem` por status em números que a tela mostra. "Enviadas" inclui entregues e
 * lidas (uma mensagem lida foi enviada); "entregues" inclui lidas, pelo mesmo motivo. */
export function contagens(c: Record<string, number>) {
  const enviado = c.enviado ?? 0;
  const entregue = c.entregue ?? 0;
  const lido = c.lido ?? 0;
  const falhou = c.falhou ?? 0;
  const pendente = (c.pendente ?? 0) + (c.enviando ?? 0);
  const cancelado = c.cancelado ?? 0;
  return {
    total: enviado + entregue + lido + falhou + pendente + cancelado,
    enviadas: enviado + entregue + lido,
    entregues: entregue + lido,
    lidas: lido,
    respondidas: c.respondido ?? 0,
    falhas: falhou,
    pendentes: pendente,
  };
}

export function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}
