// Backup completo do banco em UM arquivo JSON.
//
// Rode com: npx tsx scripts/backup-banco.ts
//
// Por que JSON e não `mysqldump`: o dump em SQL é melhor tecnicamente, mas exige ter o cliente do
// MySQL instalado na máquina, e quem mais precisa do backup é justamente quem não vai instalar
// nada num momento de aperto. Este script usa o Prisma, que o projeto já tem — funciona em
// qualquer computador que consiga rodar o CRM, sem instalar mais nada.
//
// O arquivo sai na pasta `backups/`, com data e hora no nome. GUARDE EM DOIS LUGARES (o computador
// não conta como dois): um backup que mora só na máquina que pode quebrar não é backup.
import "dotenv/config";
import { setDefaultResultOrder } from "node:dns";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../src/generated/prisma/client";

setDefaultResultOrder("ipv4first");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não encontrada — confira se o arquivo .env existe na raiz do projeto.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL) });

/**
 * Todas as tabelas, na ordem em que aparecem no schema. A lista é explícita de propósito: descobrir
 * as tabelas por reflexão pareceria mais esperto, mas uma tabela nova que ninguém lembrou de
 * incluir some do backup em silêncio, e só se descobre no dia de restaurar. Aqui, esquecer uma
 * significa esquecer no schema E aqui — e o total impresso no fim denuncia.
 */
const TABELAS = [
  "contato",
  "conversa",
  "compromisso",
  "tarefaEtapa",
  "tarefaCard",
  "workspace",
  "membro",
  "tokenRedefinicaoSenha",
  "sessaoAtiva",
  "funil",
  "funilEtapa",
  "negocioCard",
  "motivoPerda",
  "preferencia",
  "mensagemExtra",
  "documentoBiblioteca",
  "formulario",
  "respostaFormulario",
  "fluxoAutomacao",
  "documento",
  "modeloPersonalizado",
  "integracao",
  "assinatura",
  "acaoEnvio",
  "relatorioGerado",
  "whatsappTemplate",
  "anexoPublico",
  "arquivoArmazenado",
  "instagramEvento",
  "automacaoExecucao",
  "eventoDoLead",
  "campanha",
  "campanhaDestinatario",
] as const;

async function main() {
  const inicio = Date.now();
  const conteudo: Record<string, unknown[]> = {};
  let totalLinhas = 0;

  for (const tabela of TABELAS) {
    const modelo = prisma[tabela as keyof typeof prisma] as unknown as {
      findMany: (args?: unknown) => Promise<unknown[]>;
    };
    if (typeof modelo?.findMany !== "function") {
      console.error(`✗ Tabela "${tabela}" não existe no client do Prisma — o schema mudou?`);
      process.exit(1);
    }
    const linhas = await modelo.findMany();
    conteudo[tabela] = linhas;
    totalLinhas += linhas.length;
    console.log(`  ${String(linhas.length).padStart(7)} × ${tabela}`);
  }

  const agora = new Date();
  const carimbo = agora.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const pasta = path.join(process.cwd(), "backups");
  await mkdir(pasta, { recursive: true });
  const destino = path.join(pasta, `crm-azuz-${carimbo}.json`);

  // `Date` e `BigInt` não sobrevivem ao JSON.stringify padrão: Date vira string ISO (ok, dá pra
  // reconstruir) mas BigInt LANÇA erro e derrubaria o backup inteiro no fim do processo, depois de
  // toda a leitura. Converter aqui é o que garante que o arquivo sempre seja escrito.
  const json = JSON.stringify(
    { geradoEm: agora.toISOString(), totalLinhas, tabelas: conteudo },
    (_chave, valor) => (typeof valor === "bigint" ? valor.toString() : valor),
    2,
  );
  await writeFile(destino, json, "utf-8");

  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
  const mb = (Buffer.byteLength(json) / 1024 / 1024).toFixed(1);
  console.log(`\n✓ Backup salvo em ${destino}`);
  console.log(`  ${totalLinhas} linhas, ${TABELAS.length} tabelas, ${mb} MB, ${segundos}s`);
  console.log(`\n  Copie esse arquivo pra fora do computador AGORA (Drive, pen drive, e-mail).`);
  console.log(`  Backup que mora num lugar só não é backup.`);
}

main()
  .catch((erro) => {
    console.error("\n✗ O backup NÃO foi concluído:", erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
