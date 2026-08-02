/**
 * Modelo único de evento de linha do tempo — pensado pra ser o mesmo tipo
 * usado em WhatsApp, Contato, Empresa, Negociação, Funil, Gestão de
 * Atividade e Relatórios (seção 17 do pedido). Hoje os eventos nascem no
 * front-end (funções `evento*` abaixo); quando o back-end existir, essas
 * funções viram só o mapeamento da resposta da API pro mesmo tipo, sem
 * mudar quem consome `EventoTimeline`.
 */

export type CategoriaEventoTimeline =
  | "conversa"
  | "anotacao"
  | "atividade"
  | "funil"
  | "automacao"
  | "negociacao"
  | "documento"
  | "sistema";

export const CATEGORIAS_TIMELINE: {
  id: CategoriaEventoTimeline;
  label: string;
  icone: string;
}[] = [
  { id: "conversa", label: "Conversas", icone: "💬" },
  { id: "anotacao", label: "Anotações", icone: "📝" },
  { id: "atividade", label: "Atividades", icone: "✅" },
  { id: "funil", label: "Funil", icone: "🧭" },
  { id: "automacao", label: "Automações", icone: "⚡" },
  { id: "negociacao", label: "Negociações", icone: "💰" },
  { id: "documento", label: "Documentos", icone: "📄" },
  { id: "sistema", label: "Sistema", icone: "●" },
];

export function iconeCategoriaTimeline(categoria: CategoriaEventoTimeline) {
  return CATEGORIAS_TIMELINE.find((c) => c.id === categoria)?.icone ?? "●";
}

export type EventoTimeline = {
  id: string;
  categoria: CategoriaEventoTimeline;
  /** Rótulo curto do subtipo — "Etapa alterada", "E-mail enviado", etc. Livre porque cada módulo tem os seus. */
  tipo: string;
  titulo: string;
  descricao?: string;
  /** Texto de exibição por enquanto ("Há 6 min") — troca pra ISO real quando o back-end existir, os consumidores já leem por essa mesma chave. */
  quando: string;
  responsavel?: string;
  origem?: string;
  /** Preenchido quando o evento tem uma tela própria pra abrir ("Ver tarefa", "Ver negociação"...). */
  aoAbrirDetalhes?: () => void;
};

let proximoIdTimeline = 0;
/** Gera um id estável o bastante pro front-end — o back-end substitui por id real de banco. */
export function gerarIdTimeline(prefixo: string) {
  proximoIdTimeline += 1;
  return `${prefixo}-${Date.now()}-${proximoIdTimeline}`;
}
