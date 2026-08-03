import { currentUser } from "@/lib/data";

/**
 * Contratos e helpers de "recentes" da Jornada do cliente — hoje persistidos
 * em `localStorage` (por navegador, não por usuário de verdade), mas já no
 * formato que o back-end vai usar quando existir uma tabela real de
 * "contato_recente" por usuário (seção 28 do escopo).
 */
export type ContatoRecente = {
  usuario: string;
  contatoId: string;
  /** ISO 8601 — quando o back-end existir, isso vem do servidor, não de `Date.now()` local. */
  data: string;
  contexto: "aberto" | "consultado";
};

export type HistoricoRecente = {
  usuario: string;
  contatoId: string;
  data: string;
  ultimaInteracaoRegistrada: string;
  etapa: string;
  responsavel: string;
};

const CHAVE_CONTATOS_RECENTES = "azuz-jornada-contatos-recentes-v1";
const CHAVE_HISTORICOS_RECENTES = "azuz-jornada-historicos-recentes-v1";
const LIMITE = 12;

function ler<T>(chave: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const salvo = localStorage.getItem(chave);
    return salvo ? (JSON.parse(salvo) as T[]) : [];
  } catch {
    return [];
  }
}

function escrever<T>(chave: string, valor: T[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // localStorage indisponível — só não persiste entre sessões
  }
}

export function lerContatosRecentes(): ContatoRecente[] {
  return ler<ContatoRecente>(CHAVE_CONTATOS_RECENTES);
}

export function registrarContatoRecente(contatoId: string): ContatoRecente[] {
  const atual = lerContatosRecentes().filter((r) => r.contatoId !== contatoId);
  const proximo: ContatoRecente[] = [
    { usuario: currentUser.name, contatoId, data: new Date().toISOString(), contexto: "aberto" as const },
    ...atual,
  ].slice(0, LIMITE);
  escrever(CHAVE_CONTATOS_RECENTES, proximo);
  return proximo;
}

export function removerContatoRecente(contatoId: string): ContatoRecente[] {
  const proximo = lerContatosRecentes().filter((r) => r.contatoId !== contatoId);
  escrever(CHAVE_CONTATOS_RECENTES, proximo);
  return proximo;
}

export function lerHistoricosRecentes(): HistoricoRecente[] {
  return ler<HistoricoRecente>(CHAVE_HISTORICOS_RECENTES);
}

export function registrarHistoricoRecente(
  item: Omit<HistoricoRecente, "usuario" | "data">,
): HistoricoRecente[] {
  const atual = lerHistoricosRecentes().filter((r) => r.contatoId !== item.contatoId);
  const proximo: HistoricoRecente[] = [
    { usuario: currentUser.name, data: new Date().toISOString(), ...item },
    ...atual,
  ].slice(0, LIMITE);
  escrever(CHAVE_HISTORICOS_RECENTES, proximo);
  return proximo;
}
