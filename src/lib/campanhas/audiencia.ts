import { prisma } from "@/lib/prisma";
import type { ContatoParaVariaveis } from "./variaveis";
import type { CanalCampanha } from "./ritmo";
import type { Audiencia } from "./audiencia-tipos";

export type { Audiencia, ModoAudiencia } from "./audiencia-tipos";
export { descreverAudiencia } from "./audiencia-tipos";

/**
 * Quem recebe um disparo: e como isso é decidido NO SERVIDOR.
 *
 * A tela descreve o público ("etiqueta VIP", "etapa Proposta do funil X") e o servidor resolve
 * pra uma lista de contatos do workspace da sessão. Resolver no servidor é o que garante duas
 * coisas: a prévia ("327 contatos receberão") e o disparo de verdade olham pra MESMA lista, e
 * nenhum nome de contato de outro workspace entra, porque a consulta já nasce filtrada.
 *
 * Só campos leves são lidos. Nunca `fotoUrl` (imagem em base64): um público de mil contatos
 * viraria dezenas de MB saindo do banco por prévia.
 */
export type ContatoDaAudiencia = ContatoParaVariaveis & { nome: string; origem: string; etiquetas: unknown };

const SELECAO_LEVE = {
  nome: true,
  origem: true,
  etiquetas: true,
  sobrenome: true,
  empresa: true,
  cargo: true,
  cidade: true,
  email: true,
  whatsapp: true,
  responsavel: true,
} as const;

/** Resolve o público pra contatos do workspace. Ordem estável (nome), sem duplicata. */
export async function resolverAudiencia(workspaceId: string, audiencia: Audiencia): Promise<ContatoDaAudiencia[]> {
  const base = { workspaceId };

  if (audiencia.modo === "funil" || audiencia.modo === "etapa") {
    if (!audiencia.valor) return [];
    // Card do funil → nome do contato (é a chave que liga funil, conversa e contato hoje).
    const cards = await prisma.negocioCard.findMany({
      where:
        audiencia.modo === "etapa"
          ? { workspaceId, etapaId: audiencia.valor }
          : { workspaceId, etapa: { funilId: audiencia.valor } },
      select: { nome: true },
    });
    const nomes = Array.from(new Set(cards.map((c) => c.nome)));
    if (!nomes.length) return [];
    return prisma.contato.findMany({ where: { ...base, nome: { in: nomes } }, select: SELECAO_LEVE, orderBy: { nome: "asc" } });
  }

  if (audiencia.modo === "selecionados") {
    const nomes = Array.from(new Set(audiencia.nomes ?? [])).filter(Boolean);
    if (!nomes.length) return [];
    return prisma.contato.findMany({ where: { ...base, nome: { in: nomes } }, select: SELECAO_LEVE, orderBy: { nome: "asc" } });
  }

  if (audiencia.modo === "origem") {
    if (!audiencia.valor) return [];
    return prisma.contato.findMany({ where: { ...base, origem: audiencia.valor }, select: SELECAO_LEVE, orderBy: { nome: "asc" } });
  }

  if (audiencia.modo === "periodo") {
    const de = audiencia.de ? new Date(audiencia.de) : null;
    const ate = audiencia.ate ? new Date(audiencia.ate) : null;
    if (ate) ate.setHours(23, 59, 59, 999);
    return prisma.contato.findMany({
      where: { ...base, criadoEm: { ...(de ? { gte: de } : {}), ...(ate ? { lte: ate } : {}) } },
      select: SELECAO_LEVE,
      orderBy: { nome: "asc" },
    });
  }

  const todos = await prisma.contato.findMany({ where: base, select: SELECAO_LEVE, orderBy: { nome: "asc" } });
  if (audiencia.modo === "etiqueta") {
    const alvo = (audiencia.valor ?? "").trim().toLowerCase();
    if (!alvo) return [];
    // Etiquetas moram num JSON (lista de strings); filtrar aqui é mais simples e mais previsível
    // do que depender do suporte a JSON do banco, e a lista já veio leve.
    return todos.filter((c) => Array.isArray(c.etiquetas) && (c.etiquetas as unknown[]).some((e) => String(e).trim().toLowerCase() === alvo));
  }
  return todos;
}

/** Destino de um contato num canal, ou `null` se ele não tem o dado. */
export function destinoDoContato(contato: ContatoDaAudiencia, canal: CanalCampanha): string | null {
  const bruto = canal === "email" ? contato.email : contato.whatsapp;
  const limpo = bruto?.trim();
  return limpo ? limpo : null;
}

/** Opções que a tela oferece pra montar o público, todas do workspace. */
export async function opcoesDeAudiencia(workspaceId: string) {
  const [contatos, funis] = await Promise.all([
    prisma.contato.findMany({ where: { workspaceId }, select: { origem: true, etiquetas: true } }),
    prisma.funil.findMany({
      where: { workspaceId },
      select: { id: true, nome: true, etapas: { select: { id: true, titulo: true }, orderBy: { ordem: "asc" } } },
      orderBy: { nome: "asc" },
    }),
  ]);
  const origens = new Map<string, number>();
  const etiquetas = new Map<string, number>();
  for (const c of contatos) {
    if (c.origem) origens.set(c.origem, (origens.get(c.origem) ?? 0) + 1);
    if (Array.isArray(c.etiquetas)) {
      for (const e of c.etiquetas as unknown[]) {
        const chave = String(e).trim();
        if (chave) etiquetas.set(chave, (etiquetas.get(chave) ?? 0) + 1);
      }
    }
  }
  const ordenar = (m: Map<string, number>) => Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map(([valor, total]) => ({ valor, total }));
  return { totalContatos: contatos.length, origens: ordenar(origens), etiquetas: ordenar(etiquetas), funis };
}
