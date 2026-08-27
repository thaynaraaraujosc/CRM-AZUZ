import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Cria as colunas `contaCanal` (Conversa e MensagemExtra) direto no banco de produção.
 *
 * Por que existe: o comando que aplica mudanças de schema (`prisma db push`) roda no `start`, que
 * só executa num host com processo persistente — na Vercel, que é serverless, ele nunca roda. O
 * serviço do Railway que deveria fazer isso nunca foi configurado (nenhuma variável de ambiente,
 * `DATABASE_URL` inclusive), então na prática nada aplica migração hoje. E a `DATABASE_URL` não é
 * legível no painel da Vercel, o que impede rodar o SQL de fora.
 *
 * O CRM já tem essa conexão em mãos, então aplica ele mesmo. É deliberadamente estreito:
 *   - só admin do workspace;
 *   - os comandos são fixos no código, nada vem da requisição (sem injeção possível);
 *   - idempotente — confere no catálogo do banco antes, então rodar duas vezes não quebra;
 *   - só ADD COLUMN/CREATE INDEX de coisas novas e opcionais: nenhum dado existente é lido,
 *     alterado ou apagado.
 *
 * É temporário. Assim que existir um caminho de migração de verdade no deploy, esta rota sai.
 */
type Passo = { comando: string; resultado: "aplicado" | "ja_existia" };

/** Cada coluna com o índice que a acompanha — mesma definição do `prisma/schema.prisma`. */
const COLUNAS = [
  {
    tabela: "Conversa",
    coluna: "contaCanal",
    indice: "Conversa_workspaceId_contaCanal_idx",
    sqlColuna: "ALTER TABLE `Conversa` ADD COLUMN `contaCanal` VARCHAR(191) NULL",
    sqlIndice: "CREATE INDEX `Conversa_workspaceId_contaCanal_idx` ON `Conversa`(`workspaceId`, `contaCanal`)",
  },
  {
    tabela: "MensagemExtra",
    coluna: "contaCanal",
    indice: "MensagemExtra_workspaceId_contaCanal_idx",
    sqlColuna: "ALTER TABLE `MensagemExtra` ADD COLUMN `contaCanal` VARCHAR(191) NULL",
    sqlIndice:
      "CREATE INDEX `MensagemExtra_workspaceId_contaCanal_idx` ON `MensagemExtra`(`workspaceId`, `contaCanal`)",
  },
] as const;

async function colunaExiste(tabela: string, coluna: string): Promise<boolean> {
  const linhas = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*) AS total FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${tabela} AND COLUMN_NAME = ${coluna}
  `;
  return Number(linhas[0]?.total ?? 0) > 0;
}

async function indiceExiste(tabela: string, indice: string): Promise<boolean> {
  const linhas = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*) AS total FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${tabela} AND INDEX_NAME = ${indice}
  `;
  return Number(linhas[0]?.total ?? 0) > 0;
}

export async function POST() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (sessao.user.papelTipo !== "admin") {
    return NextResponse.json({ erro: "Só o admin do workspace pode rodar isto." }, { status: 403 });
  }

  const passos: Passo[] = [];
  try {
    for (const item of COLUNAS) {
      if (await colunaExiste(item.tabela, item.coluna)) {
        passos.push({ comando: `${item.tabela}.${item.coluna}`, resultado: "ja_existia" });
      } else {
        await prisma.$executeRawUnsafe(item.sqlColuna);
        passos.push({ comando: `${item.tabela}.${item.coluna}`, resultado: "aplicado" });
      }

      if (await indiceExiste(item.tabela, item.indice)) {
        passos.push({ comando: item.indice, resultado: "ja_existia" });
      } else {
        await prisma.$executeRawUnsafe(item.sqlIndice);
        passos.push({ comando: item.indice, resultado: "aplicado" });
      }
    }
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha ao aplicar a migração.";
    return NextResponse.json({ erro: mensagem, passos }, { status: 500 });
  }

  return NextResponse.json({ ok: true, passos });
}

/** GET só relata o estado atual — serve pra conferir antes e depois sem alterar nada. */
export async function GET() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (sessao.user.papelTipo !== "admin") {
    return NextResponse.json({ erro: "Só o admin do workspace pode ver isto." }, { status: 403 });
  }

  const estado = [];
  for (const item of COLUNAS) {
    estado.push({
      tabela: item.tabela,
      colunaExiste: await colunaExiste(item.tabela, item.coluna),
      indiceExiste: await indiceExiste(item.tabela, item.indice),
    });
  }
  return NextResponse.json({ estado });
}
