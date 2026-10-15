/**
 * SÓ LEITURA: diz QUAL banco a `DATABASE_URL` do seu .env está apontando, e se ele está VIVO.
 *
 * Existe por causa de 14/10/2026. A produção tinha mudado de servidor e o `.env` da máquina ficou
 * apontando pro banco antigo. Todo diagnóstico rodou no lugar errado, e nada denunciava: o banco
 * antigo responde, tem as mesmas tabelas e os mesmos nomes de cliente. Só o que não tem é o
 * movimento de hoje.
 *
 * É por aí que este script responde: ele não tenta adivinhar o endereço certo, ele mostra quando
 * foi a ÚLTIMA VEZ que alguma coisa aconteceu neste banco. Banco de produção de um CRM em uso tem
 * atividade de hoje. Banco abandonado para no dia da mudança.
 *
 * Rode com:
 *   npx tsx scripts/qual-banco-e-este.mjs
 *
 * Nada é escrito. Nenhuma senha é impressa.
 */
import "dotenv/config";
import { setDefaultResultOrder } from "node:dns";

import { createConnection } from "mariadb";

setDefaultResultOrder("ipv4first");

/**
 * Prefere a credencial de MIGRAÇÃO, com a do site como reserva.
 *
 * Mesma regra do `prisma.config.ts`: as ferramentas falam com o banco por um cliente diferente do
 * que o site usa, e a credencial própria existe justamente pra cada lado poder ter a sua. Uma regra
 * só, em todos os scripts, pra não haver dúvida sobre qual banco cada comando está olhando.
 */
const URL_DO_BANCO = process.env.DATABASE_URL_MIGRACAO ?? process.env.DATABASE_URL ?? "";

if (!URL_DO_BANCO) {
  console.error("Nenhuma DATABASE_URL_MIGRACAO nem DATABASE_URL: confira o .env na raiz do projeto.");
  process.exit(1);
}

function enderecoVisivel(databaseUrl) {
  try {
    const u = new URL(databaseUrl.replace(/^mysql:\/\//, "http://"));
    return `${u.hostname}:${u.port || "3306"}`;
  } catch {
    return "(não deu pra ler o endereço)";
  }
}

function comTempoDeSobra(databaseUrl) {
  const url = databaseUrl.replace(/^mysql:\/\//, "mariadb://");
  // `allowPublicKeyRetrieval`: o MySQL 8.4 autentica com `caching_sha2_password`, e quando o cache
  // do servidor está frio a negociação exige a chave pública RSA. O driver se recusa a buscá-la sem
  // esta opção. O CRM já a usa (ver `montarUrlDoBanco`); os scripts NÃO usavam, e essa diferença
  // custou horas em 14/10/2026: eles falhavam com uma mensagem e o CRM com outra, para a mesma
  // causa. Ferramenta de diagnóstico tem que conectar igual ao que ela diagnostica.
  return `${url}${url.includes("?") ? "&" : "?"}allowPublicKeyRetrieval=true&connectTimeout=15000&socketTimeout=60000`;
}

/** Quando foi a última coisa que aconteceu em cada canto do CRM. */
const SINAIS_DE_VIDA = [
  { tabela: "MensagemExtra", coluna: "atualizadoEm", oQueE: "última mensagem (enviada ou recebida)" },
  { tabela: "MensagemExtra", coluna: "criadoEm", oQueE: "última mensagem criada" },
  { tabela: "Conversa", coluna: "criadoEm", oQueE: "última conversa aberta" },
  { tabela: "Contato", coluna: "criadoEm", oQueE: "último contato criado" },
];

const CONTAGENS = ["Contato", "Conversa", "MensagemExtra", "NegocioCard", "Workspace", "Membro"];

const endereco = enderecoVisivel(URL_DO_BANCO);
console.log(`Servidor: ${endereco}\n`);

let conexao;
try {
  conexao = await createConnection(comTempoDeSobra(URL_DO_BANCO));
} catch (erro) {
  console.error(`Não foi possível conectar em ${endereco}.`);
  console.error(`Motivo: ${erro?.message ?? erro}`);
  process.exit(1);
}

try {
  const [{ banco }] = await conexao.query("SELECT DATABASE() AS banco");
  const [{ versao }] = await conexao.query("SELECT VERSION() AS versao");
  console.log(`Nome do banco: ${banco}`);
  console.log(`Versão do servidor: ${versao}\n`);

  console.log("Quantas linhas:");
  for (const tabela of CONTAGENS) {
    try {
      const [{ total }] = await conexao.query(`SELECT COUNT(*) AS total FROM \`${tabela}\``);
      console.log(`  ${String(total).padStart(8)} × ${tabela}`);
    } catch {
      console.log(`  ${"—".padStart(8)} × ${tabela} (tabela não existe aqui)`);
    }
  }

  console.log("\nÚltimo sinal de vida:");
  let maisRecente = null;
  for (const sinal of SINAIS_DE_VIDA) {
    try {
      const [linha] = await conexao.query(
        `SELECT MAX(\`${sinal.coluna}\`) AS quando FROM \`${sinal.tabela}\``,
      );
      const quando = linha?.quando ? new Date(linha.quando) : null;
      console.log(`  ${sinal.oQueE}: ${quando ? quando.toLocaleString("pt-BR") : "nunca"}`);
      if (quando && (!maisRecente || quando > maisRecente)) maisRecente = quando;
    } catch {
      console.log(`  ${sinal.oQueE}: (não deu pra ler)`);
    }
  }

  console.log("");
  if (!maisRecente) {
    console.log("Este banco não tem movimento nenhum registrado. Dificilmente é a produção em uso.");
  } else {
    const diasParados = Math.floor((Date.now() - maisRecente.getTime()) / 86_400_000);
    if (diasParados <= 1) {
      console.log("Tem movimento de HOJE OU ONTEM: este banco está sendo usado agora.");
      console.log("Muito provavelmente é o da produção.");
    } else {
      console.log(`O movimento mais recente tem ${diasParados} dia(s).`);
      console.log("Um CRM em uso diário não fica parado tanto tempo: isto tem cara de banco ANTIGO,");
      console.log("deixado pra trás numa troca de servidor. Confira antes de aplicar qualquer coisa.");
    }
  }

  console.log("\nCompare com o CRM aberto no navegador: a última mensagem que você vê lá tem que");
  console.log("bater com a data acima. Se não bater, este NÃO é o banco que a produção usa.");
} finally {
  await conexao.end();
}
