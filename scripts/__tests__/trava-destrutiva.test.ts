import { describe, expect, it } from "vitest";

/**
 * A trava que impede o `aplicar-schema-em-producao.ts` de rodar comando destrutivo num banco com
 * dados de cliente.
 *
 * Os padrões estão repetidos aqui de propósito: o script é um executável que roda sozinho, com o
 * mínimo de dependências, e importá-lo executaria o corpo dele (que lê `DATABASE_URL` e sai). O que
 * este teste garante é que os padrões CASAM com o SQL que o Prisma 7 gera de verdade — os trechos
 * abaixo foram copiados da saída real de `prisma migrate diff --script` em 14/10/2026, não
 * inventados.
 */
const DESTRUTIVOS = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bDROP\s+DATABASE\b/i,
  /\bTRUNCATE\b/i,
  /\bRENAME\b/i,
  /\bMODIFY\s+COLUMN\b/i,
  /\bCHANGE\s+COLUMN\b/i,
  /\bDELETE\s+FROM\b/i,
];

const temDestrutivo = (sql: string) => DESTRUTIVOS.some((padrao) => padrao.test(sql));

/** Saída real do diff "banco de produção em 14/10/2026 → schema da entrega do AZUZ Flow". */
const ADITIVO_DE_VERDADE = `-- AlterTable
ALTER TABLE \`Contato\` ADD COLUMN \`consentimentoWhatsApp\` BOOLEAN NULL,
    ADD COLUMN \`consentimentoWhatsAppEm\` DATETIME(3) NULL,
    ADD COLUMN \`consentimentoWhatsAppOrigem\` VARCHAR(191) NULL,
    ADD COLUMN \`consentimentoWhatsAppTexto\` TEXT NULL;

-- CreateTable
CREATE TABLE \`ChaveDeIntegracao\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`hashDaChave\` VARCHAR(191) NOT NULL,
    UNIQUE INDEX \`ChaveDeIntegracao_hashDaChave_key\`(\`hashDaChave\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE \`LeadRecebido\` ADD CONSTRAINT \`LeadRecebido_workspaceId_fkey\` FOREIGN KEY (\`workspaceId\`) REFERENCES \`Workspace\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE;`;

describe("a trava de comando destrutivo", () => {
  it("DEIXA passar o SQL aditivo de verdade", () => {
    // Falso positivo aqui é tão ruim quanto falso negativo: travaria a correção de uma produção
    // quebrada, que foi exatamente a situação em que este script nasceu.
    expect(temDestrutivo(ADITIVO_DE_VERDADE)).toBe(false);
  });

  it("RECUSA apagar tabela", () => {
    expect(temDestrutivo("DROP TABLE `Contato`;")).toBe(true);
  });

  it("RECUSA apagar coluna", () => {
    expect(temDestrutivo("ALTER TABLE `Contato` DROP COLUMN `whatsapp`;")).toBe(true);
  });

  it("RECUSA mudar o tipo de uma coluna", () => {
    // Destrutivo mesmo quando o MySQL aceita sem reclamar: varchar(191) virando varchar(50) corta
    // o que não couber, em silêncio.
    expect(temDestrutivo("ALTER TABLE `Contato` MODIFY COLUMN `nome` VARCHAR(50) NOT NULL;")).toBe(true);
    expect(temDestrutivo("ALTER TABLE `Contato` CHANGE COLUMN `nome` `nomeCompleto` VARCHAR(191);")).toBe(true);
  });

  it("RECUSA renomear, truncar e apagar linha", () => {
    expect(temDestrutivo("RENAME TABLE `Contato` TO `ContatoAntigo`;")).toBe(true);
    expect(temDestrutivo("TRUNCATE TABLE `Conversa`;")).toBe(true);
    expect(temDestrutivo("DELETE FROM `Contato` WHERE 1;")).toBe(true);
  });

  it("não se confunde com palavra parecida dentro de nome", () => {
    // `\b` nas bordas: uma coluna chamada `dropdownPadrao` ou uma tabela `RenameHistorico` não
    // podem travar uma migração legítima.
    expect(temDestrutivo("ALTER TABLE `Form` ADD COLUMN `dropdownPadrao` VARCHAR(191) NULL;")).toBe(false);
    expect(temDestrutivo("CREATE TABLE `RenomearHistorico` (`id` VARCHAR(191) NOT NULL);")).toBe(false);
  });
});
