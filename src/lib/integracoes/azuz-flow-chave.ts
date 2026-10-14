import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/prisma";

/**
 * A chave que o AZUZ Flow usa pra entregar leads no CRM de uma agência.
 *
 * O CRM nunca guarda a chave em claro: guarda o SHA-256 dela. Isso tem duas consequências que
 * valem estar escritas, porque as duas já surpreenderam alguém em algum produto:
 *
 *   1. A chave aparece UMA vez, na tela de quem gerou. Perdeu, gera outra — não existe "mostrar de
 *      novo", e não é limitação de tela: nós literalmente não temos o valor.
 *   2. Um vazamento do banco não entrega acesso ao CRM de nenhum cliente.
 *
 * SHA-256 puro, e não bcrypt como nas senhas: a diferença é o que está sendo protegido. Senha é
 * escolhida por gente, tem pouca entropia e precisa de hash lento pra resistir a dicionário. Esta
 * chave são 32 bytes de `randomBytes` — não há dicionário que a alcance, e o hash lento só
 * acrescentaria latência a uma rota chamada a cada lead.
 */

const PREFIXO = "azflow_";
const PROVEDOR = "azuz_flow";

/** Quanto tempo esperar antes de gravar `ultimoUsoEm` de novo. A coluna existe pra a tela dizer
 *  "último uso: hoje às 14h"; gravar a cada lead seria uma escrita por requisição numa informação
 *  que ninguém lê com precisão de segundo. */
const INTERVALO_DE_USO_MS = 60_000;

export type ChaveGerada = {
  /** A chave inteira. Só existe aqui e na resposta que a tela mostra uma vez. */
  chave: string;
  prefixo: string;
};

function hashDe(chave: string): string {
  return createHash("sha256").update(chave).digest("hex");
}

/**
 * Gera a chave e grava só o hash. Revoga a anterior do mesmo provedor na MESMA transação: duas
 * chaves ativas significaria que revogar uma não corta o acesso, que é o oposto do que a tela
 * promete ao mostrar o botão "Revogar".
 */
export async function gerarChaveDoFlow(params: {
  workspaceId: string;
  criadaPor: string;
}): Promise<ChaveGerada> {
  const segredo = randomBytes(32).toString("base64url");
  const chave = `${PREFIXO}${segredo}`;
  // Prefixo curto o bastante pra identificar e curto o bastante pra não ajudar ninguém: 5
  // caracteres de 32 bytes não reduzem a busca de forma útil.
  const prefixo = `${PREFIXO}${segredo.slice(0, 5)}`;

  await prisma.$transaction(async (tx) => {
    await tx.chaveDeIntegracao.updateMany({
      where: { workspaceId: params.workspaceId, provedor: PROVEDOR, revogadaEm: null },
      data: { revogadaEm: new Date() },
    });
    await tx.chaveDeIntegracao.create({
      data: {
        workspaceId: params.workspaceId,
        provedor: PROVEDOR,
        prefixo,
        hashDaChave: hashDe(chave),
        criadaPor: params.criadaPor,
      },
    });
  });

  return { chave, prefixo };
}

export async function revogarChaveDoFlow(workspaceId: string): Promise<number> {
  const { count } = await prisma.chaveDeIntegracao.updateMany({
    where: { workspaceId, provedor: PROVEDOR, revogadaEm: null },
    data: { revogadaEm: new Date() },
  });
  return count;
}

export async function chaveAtivaDoFlow(workspaceId: string) {
  return prisma.chaveDeIntegracao.findFirst({
    where: { workspaceId, provedor: PROVEDOR, revogadaEm: null },
    orderBy: { criadaEm: "desc" },
    select: { prefixo: true, criadaEm: true, criadaPor: true, ultimoUsoEm: true },
  });
}

/**
 * Lê o cabeçalho `Authorization` e devolve de quem é a chave, ou `null`.
 *
 * `null` para TODOS os casos de recusa — ausente, mal formada, desconhecida, revogada — e quem
 * chama devolve sempre o mesmo 401. Distinguir "não existe" de "foi revogada" conta a quem está
 * sondando se um palpite acertou o formato, e não ajuda em nada quem é legítimo: a agência vê o
 * estado da chave na própria tela do CRM.
 */
export async function autenticarChaveDoFlow(
  cabecalhoAuthorization: string | null,
): Promise<{ workspaceId: string; chaveId: string } | null> {
  const bruto = cabecalhoAuthorization?.trim();
  if (!bruto) return null;

  const [esquema, valor] = bruto.split(/\s+/, 2);
  if (esquema?.toLowerCase() !== "bearer" || !valor) return null;
  if (!valor.startsWith(PREFIXO)) return null;

  const linha = await prisma.chaveDeIntegracao.findUnique({
    where: { hashDaChave: hashDe(valor) },
    select: { id: true, workspaceId: true, revogadaEm: true, ultimoUsoEm: true, hashDaChave: true },
  });
  if (!linha || linha.revogadaEm) return null;

  /*
   * Comparação em tempo constante do hash encontrado contra o hash calculado.
   *
   * O `findUnique` acima já é uma igualdade exata, então isto não muda o resultado: é defesa em
   * profundidade contra uma mudança futura que troque a busca por algo mais frouxo (um `startsWith`
   * de prefixo, por exemplo) e reintroduza comparação sensível a tempo sem ninguém notar.
   */
  const a = Buffer.from(hashDe(valor));
  const b = Buffer.from(linha.hashDaChave);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  await registrarUso(linha.id, linha.ultimoUsoEm);
  return { workspaceId: linha.workspaceId, chaveId: linha.id };
}

/** Falha em silêncio de propósito: anotar o último uso é conveniência de tela. Um erro aqui não
 *  pode recusar um lead que já foi autenticado. */
async function registrarUso(chaveId: string, ultimoUsoEm: Date | null): Promise<void> {
  const agora = Date.now();
  if (ultimoUsoEm && agora - ultimoUsoEm.getTime() < INTERVALO_DE_USO_MS) return;
  await prisma.chaveDeIntegracao
    .update({ where: { id: chaveId }, data: { ultimoUsoEm: new Date(agora) } })
    .catch(() => {});
}

export const PROVEDOR_FLOW = PROVEDOR;
export const PREFIXO_CHAVE_FLOW = PREFIXO;
