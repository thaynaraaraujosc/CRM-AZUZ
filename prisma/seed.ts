import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";

import {
  contatos as contatosIniciais,
  equipe as equipeInicial,
  tarefas as tarefasIniciais,
  funis as funisIniciais,
} from "../src/lib/data";
import { DOCUMENTOS_INICIAIS as BIBLIOTECA_INICIAL } from "../src/lib/biblioteca-documentos-context";
import { FORMULARIOS_INICIAIS } from "../src/lib/formularios-context";
import { fluxosIniciaisPadrao } from "../src/lib/automation-flow-context";
import { DOCUMENTOS_INICIAIS } from "../src/lib/documentos-context";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const WORKSPACE_SEED_ID = "clinicavitta";

/** Multi-tenancy Fase 1 — Workspace "Clínica Vitta" (mesmo nome do mock atual), dono dos 6 membros
 * já semeados em `semearEquipe`. */
async function semearWorkspace() {
  const existente = await prisma.workspace.findUnique({ where: { id: WORKSPACE_SEED_ID } });
  if (existente) {
    console.log("Workspace Clínica Vitta já existe — nada a semear.");
    return;
  }

  await prisma.workspace.create({
    data: { id: WORKSPACE_SEED_ID, nome: "Clínica Vitta", slug: WORKSPACE_SEED_ID },
  });
  console.log("Semeado o Workspace Clínica Vitta.");
}

async function semearContatos() {
  const total = await prisma.contato.count();
  if (total > 0) {
    console.log(`Tabela Contato já tem ${total} registro(s) — nada a semear.`);
    return;
  }

  await prisma.contato.createMany({
    data: contatosIniciais.map((c) => ({ ...c, etiquetas: c.etiquetas ?? undefined })),
  });
  console.log(`Semeados ${contatosIniciais.length} contatos.`);
}

async function semearEquipe() {
  const total = await prisma.membro.count();
  if (total > 0) {
    console.log(`Tabela Membro já tem ${total} registro(s) — nada a semear.`);
    return;
  }

  const membros = await Promise.all(
    equipeInicial.map(async (m) => ({
      ...m,
      workspaceId: WORKSPACE_SEED_ID,
      permissoes: m.permissoes,
      // Senha do mock era texto puro (resquício do piloto) — vira hash bcrypt real no seed.
      senha: m.senha ? await bcrypt.hash(m.senha, 10) : null,
    })),
  );
  await prisma.membro.createMany({ data: membros });
  console.log(`Semeados ${equipeInicial.length} membros da equipe.`);
}

async function semearTarefas() {
  const total = await prisma.tarefaEtapa.count();
  if (total > 0) {
    console.log(`Tabela TarefaEtapa já tem ${total} registro(s) — nada a semear.`);
    return;
  }

  let totalCards = 0;
  for (const [indice, coluna] of tarefasIniciais.entries()) {
    const etapa = await prisma.tarefaEtapa.create({
      data: { id: `etapa-seed-${indice}`, titulo: coluna.titulo, ordem: indice },
    });
    for (const [ordem, card] of coluna.cards.entries()) {
      await prisma.tarefaCard.create({
        data: {
          id: card.id,
          etapaId: etapa.id,
          ordem,
          titulo: card.titulo,
          contato: card.contato,
          contatoId: card.contatoId,
          data: card.data,
          atrasada: card.atrasada ?? false,
          responsavelNome: card.responsavel.nome,
          responsavelInitials: card.responsavel.initials,
          concluida: card.concluida ?? false,
          urgencia: card.urgencia,
          descricao: card.descricao,
          anexoArquivo: card.anexo?.arquivo,
          anexoDetalhe: card.anexo?.detalhe,
          modelo: card.modelo,
        },
      });
      totalCards += 1;
    }
  }
  console.log(`Semeadas ${tarefasIniciais.length} etapas e ${totalCards} tarefas.`);
}

async function semearFunis() {
  const total = await prisma.funil.count();
  if (total > 0) {
    console.log(`Tabela Funil já tem ${total} registro(s) — nada a semear.`);
    return;
  }

  let totalEtapas = 0;
  let totalCards = 0;
  for (const funil of funisIniciais) {
    await prisma.funil.create({ data: { id: funil.id, nome: funil.nome, responsavel: funil.responsavel } });
    for (const [ordemEtapa, coluna] of funil.colunas.entries()) {
      await prisma.funilEtapa.create({
        data: { id: coluna.id, funilId: funil.id, titulo: coluna.titulo, ordem: ordemEtapa },
      });
      totalEtapas += 1;
      for (const [ordemCard, card] of coluna.cards.entries()) {
        await prisma.negocioCard.create({
          data: {
            id: card.id,
            etapaId: coluna.id,
            ordem: ordemCard,
            nome: card.nome,
            valor: card.valor,
            origem: card.origem,
            dias: card.dias,
            data: card.data,
            etiquetas: card.etiquetas ?? undefined,
            responsavel: card.responsavel,
          },
        });
        totalCards += 1;
      }
    }
  }
  console.log(`Semeados ${funisIniciais.length} funis, ${totalEtapas} etapas e ${totalCards} negócios.`);
}

async function semearBibliotecaDocumentos() {
  const total = await prisma.documentoBiblioteca.count();
  if (total > 0) {
    console.log(`Tabela DocumentoBiblioteca já tem ${total} registro(s) — nada a semear.`);
    return;
  }

  await prisma.documentoBiblioteca.createMany({
    data: BIBLIOTECA_INICIAL.map((d) => ({ ...d, tags: d.tags ?? undefined })),
  });
  console.log(`Semeados ${BIBLIOTECA_INICIAL.length} documentos da biblioteca.`);
}

async function semearFormularios() {
  const total = await prisma.formulario.count();
  if (total > 0) {
    console.log(`Tabela Formulario já tem ${total} registro(s) — nada a semear.`);
    return;
  }

  await prisma.formulario.createMany({
    data: FORMULARIOS_INICIAIS.map((f) => ({ ...f, integracoes: f.integracoes ?? undefined })),
  });
  console.log(`Semeados ${FORMULARIOS_INICIAIS.length} formulários.`);
}

async function semearFluxosAutomacao() {
  const total = await prisma.fluxoAutomacao.count();
  if (total > 0) {
    console.log(`Tabela FluxoAutomacao já tem ${total} registro(s) — nada a semear.`);
    return;
  }

  const fluxos = fluxosIniciaisPadrao();
  await prisma.fluxoAutomacao.createMany({
    // nodes/edges/configuracoes/historicoVersoes têm tipos TS ricos que o Prisma não casa
    // estruturalmente com InputJsonValue — em runtime já é JSON puro, o cast é só pro TS.
    data: fluxos.map((f) => ({
      ...f,
      publicadoEm: f.publicadoEm ? new Date(f.publicadoEm) : undefined,
    })) as unknown as NonNullable<Parameters<typeof prisma.fluxoAutomacao.createMany>[0]>["data"],
  });
  console.log(`Semeados ${fluxos.length} fluxos de automação.`);
}

async function semearDocumentos() {
  const total = await prisma.documento.count();
  if (total > 0) {
    console.log(`Tabela Documento já tem ${total} registro(s) — nada a semear.`);
    return;
  }

  await prisma.documento.createMany({
    // paginas/config/pessoasAcesso/comentarios/versoes têm tipos TS ricos que o Prisma não casa
    // estruturalmente com InputJsonValue — em runtime já é JSON puro, o cast é só pro TS.
    data: DOCUMENTOS_INICIAIS as unknown as NonNullable<Parameters<typeof prisma.documento.createMany>[0]>["data"],
  });
  console.log(`Semeados ${DOCUMENTOS_INICIAIS.length} documentos.`);
}

async function main() {
  await semearWorkspace();
  await semearContatos();
  await semearEquipe();
  await semearTarefas();
  await semearFunis();
  await semearBibliotecaDocumentos();
  await semearFormularios();
  await semearFluxosAutomacao();
  await semearDocumentos();
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
