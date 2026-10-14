// Backup completo do banco em UM arquivo JSON.
//
// Rode com: npx tsx scripts/backup-banco.ts
//
// Por que JSON e não `mysqldump`: o dump em SQL é melhor tecnicamente, mas exige ter o cliente do
// MySQL instalado na máquina, e quem mais precisa do backup é justamente quem não vai instalar
// nada num momento de aperto. Este script usa o Prisma, que o projeto já tem. Funciona em
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

/**
 * Prefere a credencial de MIGRAÇÃO, com a do site como reserva.
 *
 * Mesma regra do `prisma.config.ts`: as ferramentas falam com o banco por um cliente diferente do
 * que o site usa, e a credencial própria existe justamente pra cada lado poder ter a sua. Uma regra
 * só, em todos os scripts, pra não haver dúvida sobre qual banco cada comando está olhando.
 */
const URL_DO_BANCO: string = process.env.DATABASE_URL_MIGRACAO ?? process.env.DATABASE_URL ?? "";

if (!URL_DO_BANCO) {
  console.error("Nenhuma DATABASE_URL_MIGRACAO nem DATABASE_URL: confira o .env na raiz do projeto.");
  process.exit(1);
}

/**
 * Tempo de conexão maior que o padrão de 1 SEGUNDO do conector mariadb.
 *
 * Um segundo serve pra banco na mesma rede. Visto de uma internet doméstica, o backup morria com
 * "failed to create socket after 1001ms" antes mesmo de autenticar — e um backup que não roda é a
 * pior hora pra descobrir um padrão mal escolhido. O `socketTimeout` é folgado porque backup de
 * banco grande demora, e cortar no meio produziria um arquivo incompleto.
 */
function comTempoDeSobra(databaseUrl: string): string {
  const url = databaseUrl.replace(/^mysql:\/\//, "mariadb://");
  // `allowPublicKeyRetrieval`: o MySQL 8.4 autentica com `caching_sha2_password`, e quando o cache
  // do servidor está frio a negociação exige a chave pública RSA. O driver se recusa a buscá-la sem
  // esta opção. O CRM já a usa (ver `montarUrlDoBanco`); os scripts NÃO usavam, e essa diferença
  // custou horas em 14/10/2026: eles falhavam com uma mensagem e o CRM com outra, para a mesma
  // causa. Ferramenta de diagnóstico tem que conectar igual ao que ela diagnostica.
  return `${url}${url.includes("?") ? "&" : "?"}allowPublicKeyRetrieval=true&connectTimeout=15000&socketTimeout=600000`;
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(comTempoDeSobra(URL_DO_BANCO)),
});

/**
 * Todas as tabelas, na ordem em que aparecem no schema. A lista é explícita de propósito: descobrir
 * as tabelas por reflexão pareceria mais esperto, mas uma tabela nova que ninguém lembrou de
 * incluir some do backup em silêncio, e só se descobre no dia de restaurar. Aqui, esquecer uma
 * significa esquecer no schema E aqui. E o total impresso no fim denuncia.
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
  // Entraram com a entrega do AZUZ Flow. Ficaram de fora da lista na hora, que é exatamente o
  // esquecimento que o comentário acima descreve — e só apareceu quando foi preciso usar o backup.
  // Enquanto o schema não for aplicado neste banco elas saem como AUSENTE, e isso é a resposta
  // certa: a falta precisa ser gritada, não ignorada.
  "chaveDeIntegracao",
  "leadRecebido",
] as const;

async function main() {
  const inicio = Date.now();
  const conteudo: Record<string, unknown[]> = {};
  const faltando: string[] = [];
  let totalLinhas = 0;

  for (const tabela of TABELAS) {
    const modelo = prisma[tabela as keyof typeof prisma] as unknown as {
      findMany: (args?: unknown) => Promise<unknown[]>;
    };
    // Tabela ausente ANOTA e segue, em vez de abortar. A primeira versão disto saía na hora. E o
    // resultado foi ler 31 tabelas, esbarrar na 32ª e não gravar arquivo nenhum. Backup pela
    // metade é melhor que backup nenhum; o que não pode é a falta passar despercebida, e por isso
    // ela é gritada no fim e o processo termina com erro mesmo tendo gravado.
    if (typeof modelo?.findMany !== "function") {
      faltando.push(tabela);
      console.warn(`  ${"AUSENTE".padStart(7)} × ${tabela}`);
      continue;
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
    { geradoEm: agora.toISOString(), totalLinhas, tabelasAusentes: faltando, tabelas: conteudo },
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

  if (faltando.length) {
    console.error(`\n⚠ BACKUP INCOMPLETO: ${faltando.length} tabela(s) de fora: ${faltando.join(", ")}`);
    console.error(`  Quase sempre é o client do Prisma desatualizado nesta máquina (ele não vem no`);
    console.error(`  repositório, é gerado aqui). Rode "npx prisma generate" e repita o backup.`);
    process.exit(1);
  }
}

main()
  .catch((erro) => {
    console.error("\n✗ O backup NÃO foi concluído:", erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
