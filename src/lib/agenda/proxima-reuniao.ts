import { prisma } from "@/lib/prisma";
import { hojeEmBrasilia, horaEmBrasilia } from "./fuso";
import type { ReuniaoParaVariaveis } from "./reuniao-tipos";

/**
 * A PRÓXIMA reunião de um contato — a que as variáveis `reuniao.*` usam.
 *
 * Lida na hora do envio, nunca congelada: se a reunião for remarcada depois de o lead entrar, a
 * mensagem tem que sair com o horário novo. Guardar o valor junto do lead criaria a falha mais
 * cara possível aqui, que é confirmar com o cliente um horário que já mudou.
 *
 * "Que ainda não aconteceu" é mais do que "de hoje pra frente": uma reunião hoje às 9h, consultada
 * às 15h, já passou. O banco filtra por DIA (que é o que dá pra indexar com `dataIso` sendo texto)
 * e a hora é conferida aqui. Comparar "HH:MM" como string funciona porque os dois lados têm zero à
 * esquerda — "09:00" < "15:00" — e é por isso que a hora é guardada assim.
 */

/** Compromisso cancelado não conta. Os outros estados (agendado, confirmado…) contam. */
const STATUS_QUE_NAO_CONTA = ["cancelado"];

const SELECAO = { contato: true, dataIso: true, hora: true, local: true } as const;

function aindaNaoAconteceu(
  linha: { dataIso: string; hora: string },
  hoje: string,
  horaAgora: string,
): boolean {
  if (linha.dataIso > hoje) return true;
  if (linha.dataIso < hoje) return false;
  return linha.hora >= horaAgora;
}

/** O `local` só vale como link quando é um endereço: na Agenda ele também guarda "Sala 2". */
function linkDe(local: string | null): string | null {
  if (!local) return null;
  return /^https?:\/\//i.test(local) ? local : null;
}

export async function proximaReuniaoDoContato(
  workspaceId: string,
  contatoNome: string,
  agora: Date = new Date(),
): Promise<ReuniaoParaVariaveis | null> {
  const hoje = hojeEmBrasilia(agora);
  const linhas = await prisma.compromisso.findMany({
    where: {
      workspaceId,
      contato: contatoNome,
      status: { notIn: STATUS_QUE_NAO_CONTA },
      dataIso: { gte: hoje },
    },
    orderBy: [{ dataIso: "asc" }, { hora: "asc" }],
    select: SELECAO,
    // 1 passaria por cima da reunião de hoje que já passou; algumas bastam pra achar a primeira
    // que ainda vale, sem trazer a agenda inteira do contato.
    take: 20,
  });

  const horaAgora = horaEmBrasilia(agora);
  const proxima = linhas.find((l) => aindaNaoAconteceu(l, hoje, horaAgora));
  if (!proxima) return null;
  return { dataIso: proxima.dataIso, hora: proxima.hora, link: linkDe(proxima.local) };
}

/**
 * A próxima reunião de MUITOS contatos, numa consulta só.
 *
 * O disparo de campanha resolve o público inteiro antes de mandar: uma consulta por contato viraria
 * mil consultas num público de mil pessoas.
 */
export async function proximasReunioesPorContato(
  workspaceId: string,
  nomes: string[],
  agora: Date = new Date(),
): Promise<Map<string, ReuniaoParaVariaveis>> {
  const porContato = new Map<string, ReuniaoParaVariaveis>();
  if (!nomes.length) return porContato;

  const hoje = hojeEmBrasilia(agora);
  const horaAgora = horaEmBrasilia(agora);
  const linhas = await prisma.compromisso.findMany({
    where: {
      workspaceId,
      contato: { in: nomes },
      status: { notIn: STATUS_QUE_NAO_CONTA },
      dataIso: { gte: hoje },
    },
    orderBy: [{ dataIso: "asc" }, { hora: "asc" }],
    select: SELECAO,
  });

  // Em ordem crescente, a primeira que serve pra cada contato é a próxima dele.
  for (const linha of linhas) {
    if (porContato.has(linha.contato)) continue;
    if (!aindaNaoAconteceu(linha, hoje, horaAgora)) continue;
    porContato.set(linha.contato, { dataIso: linha.dataIso, hora: linha.hora, link: linkDe(linha.local) });
  }
  return porContato;
}
