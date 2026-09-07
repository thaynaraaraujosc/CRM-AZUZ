// Copia as versões publicadas que hoje vivem dentro de `FluxoAutomacao.historicoVersoes` (um Json)
// para a tabela `VersaoAutomacao`.
//
// Rode com: npx tsx scripts/migrar-versoes-automacao.ts
// Só pra ver o que aconteceria: npx tsx scripts/migrar-versoes-automacao.ts --contar
//
// POR QUE ISTO EXISTE: o motor novo executa a VERSÃO PUBLICADA, não o rascunho aberto no editor.
// Pra isso a versão precisa ser uma linha consultável, e não um Json que cresce sem limite dentro
// do fluxo. Este script traz o que já existe pra nova tabela, sem apagar nada do formato antigo —
// o editor continua escrevendo os dois enquanto a migração roda, e o Json só sai depois que o motor
// novo estiver rodando em produção.
//
// É seguro rodar quantas vezes quiser: a gravação é por (fluxo, versão), então repetir atualiza em
// vez de duplicar.
//
// Fluxo publicado que NÃO tem nenhuma versão no histórico (publicado antes de o histórico existir,
// ou seed) ganha uma versão a partir do estado atual — senão ele ficaria publicado e sem nada pra
// executar, que é pior do que uma versão aproximada.
import "dotenv/config";
import { setDefaultResultOrder } from "node:dns";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../src/generated/prisma/client";
import type { ConfiguracoesFluxo, FlowEdge, FlowNode, VersaoFluxo } from "../src/lib/automation-flow/types";

setDefaultResultOrder("ipv4first");

const soContar = process.argv.includes("--contar");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não encontrada — confira se o arquivo .env existe na raiz do projeto.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL) });

async function main() {
  const fluxos = await prisma.fluxoAutomacao.findMany({
    select: {
      id: true,
      workspaceId: true,
      nome: true,
      status: true,
      versaoAtual: true,
      nodes: true,
      edges: true,
      configuracoes: true,
      historicoVersoes: true,
      publicadoEm: true,
      publicadoPor: true,
    },
  });

  console.log(`Destino: ${process.env.DATABASE_URL!.replace(/:[^:@]+@/, ":***@")}`);
  console.log(`${fluxos.length} fluxo(s) no banco.\n`);

  let versoesGravadas = 0;
  let fluxosSemHistorico = 0;

  for (const fluxo of fluxos) {
    const historico = (Array.isArray(fluxo.historicoVersoes) ? fluxo.historicoVersoes : []) as VersaoFluxo[];
    const versoes = historico.filter((v) => typeof v?.versao === "number");

    // Publicado sem histórico: cria a versão atual a partir do estado gravado. Sem isto o fluxo
    // ficaria "publicado" e sem nenhuma versão pro motor executar.
    if (!versoes.length && fluxo.status === "publicado") {
      fluxosSemHistorico++;
      versoes.push({
        versao: fluxo.versaoAtual || 1,
        nodes: (fluxo.nodes ?? []) as FlowNode[],
        edges: (fluxo.edges ?? []) as FlowEdge[],
        configuracoes: (fluxo.configuracoes ?? {}) as ConfiguracoesFluxo,
        publicadoEm: (fluxo.publicadoEm ?? new Date()).toISOString(),
        publicadoPor: fluxo.publicadoPor ?? "",
      });
    }
    if (!versoes.length) continue;

    console.log(`  ${String(versoes.length).padStart(3)} versão(ões) · ${fluxo.nome}`);
    if (soContar) {
      versoesGravadas += versoes.length;
      continue;
    }

    for (const v of versoes) {
      const conteudo = {
        nodes: (v.nodes ?? []) as never,
        edges: (v.edges ?? []) as never,
        configuracoes: (v.configuracoes ?? {}) as never,
        publicadoPor: v.publicadoPor || null,
        ...(v.publicadoEm ? { publicadoEm: new Date(v.publicadoEm) } : {}),
      };
      await prisma.versaoAutomacao.upsert({
        where: { fluxoId_versao: { fluxoId: fluxo.id, versao: v.versao } },
        create: {
          id: `ver-${fluxo.id}-${v.versao}`,
          workspaceId: fluxo.workspaceId,
          fluxoId: fluxo.id,
          versao: v.versao,
          ...conteudo,
        },
        update: conteudo,
      });
      versoesGravadas++;
    }
  }

  console.log(
    soContar
      ? `\n(--contar: nada foi gravado.) ${versoesGravadas} versão(ões) seriam migradas.`
      : `\n✓ ${versoesGravadas} versão(ões) na tabela VersaoAutomacao.`,
  );
  if (fluxosSemHistorico) {
    console.log(`  ${fluxosSemHistorico} fluxo(s) publicado(s) sem histórico ganharam uma versão a partir do estado atual.`);
  }
  console.log("  O formato antigo (historicoVersoes) continua intacto — nada foi apagado.");
}

main()
  .catch((erro) => {
    console.error("\n✗ A migração NÃO foi concluída:", erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
