import { prisma } from "@/lib/prisma";
import { chaveDeContato } from "@/lib/contatos/chave-nome";

/**
 * Conserto dos registros que já estão gravados com o nome escrito de jeitos diferentes.
 *
 * O defeito que gerou isso está corrigido (ver `chaveDeContato`), mas o estrago continua no banco:
 * na conta real eram 69 negócios no funil pra 35 conversas, porque cada variação do nome ("Thais "
 * com espaço, "LUCAS ARANTES" em maiúsculas) ganhava um card novo.
 *
 * São duas operações com riscos bem diferentes, e por isso elas vivem separadas:
 *
 * - Padronizar o nome NÃO apaga nada e pode rodar sozinha, quantas vezes for.
 * - Juntar os cards duplicados APAGA linha, e isso não roda sozinho em nenhuma hipótese: quem
 *   decide é a pessoa, olhando a lista do que vai sair.
 */

/** O nome que vale pro grupo todo. */
function nomeCanonico(candidatos: { nome: string; deConversa: boolean }[]): string {
  // O nome da CONVERSA ganha: é o que o canal usa pra falar com a pessoa, e é por ele que o envio
  // encontra o destinatário. Empatou, ou não há conversa: o mais comprido, que costuma ser o mais
  // completo ("Maria Silva" em vez de "Maria").
  const daConversa = candidatos.filter((c) => c.deConversa).map((c) => c.nome.trim());
  if (daConversa.length) return daConversa.sort((a, b) => b.length - a.length)[0];
  return candidatos
    .map((c) => c.nome.trim())
    .sort((a, b) => b.length - a.length)[0];
}

export type PadronizacaoNomes = {
  contatosRenomeados: number;
  cardsRenomeados: number;
};

/**
 * Deixa contatos e negócios com o MESMO nome que a conversa daquela pessoa usa.
 *
 * Só mexe em quem está fora do padrão, então repetir não custa nada. Conversa nenhuma é renomeada:
 * o nome dela é a chave que o canal usa, e é dela que o padrão sai.
 */
export async function padronizarNomes(workspaceId: string): Promise<PadronizacaoNomes> {
  const [conversas, contatos, cards] = await Promise.all([
    prisma.conversa.findMany({ where: { workspaceId }, select: { nome: true } }),
    prisma.contato.findMany({ where: { workspaceId }, select: { id: true, nome: true } }),
    prisma.negocioCard.findMany({ where: { workspaceId }, select: { id: true, nome: true } }),
  ]);

  const porChave = new Map<string, { nome: string; deConversa: boolean }[]>();
  const juntar = (nome: string, deConversa: boolean) => {
    const chave = chaveDeContato(nome);
    if (!chave) return;
    const atual = porChave.get(chave) ?? [];
    atual.push({ nome, deConversa });
    porChave.set(chave, atual);
  };
  conversas.forEach((c) => juntar(c.nome, true));
  contatos.forEach((c) => juntar(c.nome, false));
  cards.forEach((c) => juntar(c.nome, false));

  const canonico = new Map<string, string>();
  porChave.forEach((lista, chave) => canonico.set(chave, nomeCanonico(lista)));

  let contatosRenomeados = 0;
  for (const contato of contatos) {
    const certo = canonico.get(chaveDeContato(contato.nome));
    if (!certo || certo === contato.nome) continue;
    await prisma.contato.update({ where: { id: contato.id }, data: { nome: certo } }).then(
      () => { contatosRenomeados += 1; },
      (erro) => console.error(`[consolidar] falha ao renomear contato ${contato.id}:`, erro),
    );
  }

  let cardsRenomeados = 0;
  for (const card of cards) {
    const certo = canonico.get(chaveDeContato(card.nome));
    if (!certo || certo === card.nome) continue;
    await prisma.negocioCard.update({ where: { id: card.id }, data: { nome: certo } }).then(
      () => { cardsRenomeados += 1; },
      (erro) => console.error(`[consolidar] falha ao renomear negócio ${card.id}:`, erro),
    );
  }

  return { contatosRenomeados, cardsRenomeados };
}

export type CardParaJuntar = {
  nome: string;
  fica: { id: string; etapa: string; valor: string; responsavel: string | null };
  saem: { id: string; etapa: string; valor: string; responsavel: string | null }[];
};

/**
 * Quem fica quando a mesma pessoa tem mais de um negócio no mesmo funil.
 *
 * O critério, em ordem, e é ele que precisa ser óbvio pra quem vai confirmar:
 *
 * 1. O que está MAIS À FRENTE no funil. Se alguém arrastou o card até "Proposta", esse é o que
 *    carrega o trabalho feito; o outro nasceu por engano numa etapa inicial.
 * 2. Empatou: o que tem mais campo preenchido (valor, responsável, desfecho).
 * 3. Empatou de novo: o mais antigo, pela ordem do id, pra a escolha ser sempre a mesma.
 */
export type CardComparavel = {
  id: string;
  ordemEtapa: number;
  valor: string;
  responsavel: string | null;
  statusFechamento: string | null;
};

/** Ordena um grupo de duplicados: o primeiro é o que fica. Pura, pra poder ser testada. */
export function ordenarPorQuemFica<T extends CardComparavel>(cards: T[]): T[] {
  const preenchidos = (c: CardComparavel) =>
    (c.valor?.trim() ? 1 : 0) + (c.responsavel ? 1 : 0) + (c.statusFechamento ? 1 : 0);
  return [...cards].sort((a, b) => {
    if (b.ordemEtapa !== a.ordemEtapa) return b.ordemEtapa - a.ordemEtapa;
    const pa = preenchidos(a);
    const pb = preenchidos(b);
    if (pb !== pa) return pb - pa;
    return a.id.localeCompare(b.id);
  });
}

/** Monta o plano: quem fica e quem sai, sem tocar em nada. */
export async function planejarJuncaoDeCards(workspaceId: string): Promise<CardParaJuntar[]> {
  const cards = await prisma.negocioCard.findMany({
    where: { workspaceId },
    include: { etapa: { select: { titulo: true, ordem: true, funilId: true } } },
  });

  const grupos = new Map<string, typeof cards>();
  for (const card of cards) {
    const chave = chaveDeContato(card.nome);
    if (!chave) continue;
    grupos.set(chave, [...(grupos.get(chave) ?? []), card]);
  }

  const plano: CardParaJuntar[] = [];
  grupos.forEach((doGrupo) => {
    if (doGrupo.length < 2) return;
    const ordenados = ordenarPorQuemFica(
      doGrupo.map((c) => ({ ...c, ordemEtapa: c.etapa?.ordem ?? 0 })),
    );
    const [fica, ...saem] = ordenados;
    const resumir = (c: (typeof cards)[number]) => ({
      id: c.id,
      etapa: c.etapa?.titulo ?? "(sem etapa)",
      valor: c.valor,
      responsavel: c.responsavel,
    });
    plano.push({ nome: fica.nome, fica: resumir(fica), saem: saem.map(resumir) });
  });
  return plano.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Executa o plano. Só é chamado por quem confirmou, nunca por relógio. */
export async function juntarCardsDuplicados(workspaceId: string): Promise<{
  gruposJuntados: number;
  cardsRemovidos: number;
  plano: CardParaJuntar[];
}> {
  const plano = await planejarJuncaoDeCards(workspaceId);
  const idsParaRemover = plano.flatMap((g) => g.saem.map((c) => c.id));
  if (!idsParaRemover.length) return { gruposJuntados: 0, cardsRemovidos: 0, plano };

  // Confere o workspace no `where` da remoção também, e não só no plano: id que veio de outra
  // empresa nunca pode ser apagado por esta chamada.
  const { count } = await prisma.negocioCard.deleteMany({
    where: { workspaceId, id: { in: idsParaRemover } },
  });
  return { gruposJuntados: plano.length, cardsRemovidos: count, plano };
}

/**
 * Passa a padronização em todo workspace. Chamado pelo relógio.
 *
 * Só renomeia quem está fora do padrão, então no estado normal a rodada lê e não escreve nada. Não
 * apaga linha nenhuma: a junção dos duplicados, que apaga, nunca roda sozinha.
 */
export async function padronizarNomesDeTodosOsWorkspaces(): Promise<{
  workspaces: number;
  renomeados: number;
}> {
  const workspaces = await prisma.workspace.findMany({ select: { id: true } });
  let renomeados = 0;
  let tocados = 0;
  for (const w of workspaces) {
    const r = await padronizarNomes(w.id).catch((erro) => {
      console.error(`[consolidar] falha no workspace ${w.id}:`, erro);
      return { contatosRenomeados: 0, cardsRenomeados: 0 };
    });
    const total = r.contatosRenomeados + r.cardsRenomeados;
    if (total > 0) tocados += 1;
    renomeados += total;
  }
  return { workspaces: tocados, renomeados };
}
