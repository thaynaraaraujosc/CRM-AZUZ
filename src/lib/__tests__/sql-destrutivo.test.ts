import { describe, expect, it } from "vitest";

// Script de build, em .mjs: ele roda fora do app, antes do `next build`. O teste vive aqui
// porque é aqui que mora a suíte — e porque esta função decide se um deploy publica ou para.
import { podeAplicarSemPerder, trechosDestrutivos } from "../../../scripts/sql-destrutivo.mjs";

/**
 * A DECISÃO QUE SEPARA "PUBLICA" DE "NÃO PUBLICA".
 *
 * Cinco deploys seguidos falharam em 07/11/2026 porque o `db push` junta num aviso só duas coisas
 * muito diferentes: "isto apaga dado" e "isto pode não ser aceito". A primeira tem que parar o
 * build; a segunda, não. Cada caso aqui é um lado dessa linha.
 */

describe("o que NÃO perde dado", () => {
  it("criar índice único: ou aplica, ou o banco recusa em voz alta", () => {
    // É exatamente o SQL que travou a publicação. Nada é apagado: índice duplicado faz o comando
    // falhar, e falhar é barulhento.
    const sql = "CREATE UNIQUE INDEX `Integracao_workspaceId_provedor_slot_key` ON `Integracao`(`workspaceId`, `provedor`, `slot`);";
    expect(podeAplicarSemPerder(sql)).toBe(true);
  });

  it("derrubar um índice não é derrubar dado", () => {
    // Índice é caminho pro dado, não o dado. Trocar um índice por outro é o miolo desta mudança.
    expect(podeAplicarSemPerder("DROP INDEX `Integracao_workspaceId_provedor_key` ON `Integracao`;")).toBe(true);
  });

  it("coluna nova com padrão", () => {
    expect(podeAplicarSemPerder("ALTER TABLE `Integracao` ADD COLUMN `slot` INTEGER NOT NULL DEFAULT 1;")).toBe(true);
  });

  it("tabela nova", () => {
    expect(podeAplicarSemPerder("CREATE TABLE `Coisa` (`id` VARCHAR(191) NOT NULL);")).toBe(true);
  });

  it("a mudança inteira do slot, como o Prisma a escreveria", () => {
    const sql = [
      "ALTER TABLE `Integracao` ADD COLUMN `slot` INTEGER NOT NULL DEFAULT 1;",
      "DROP INDEX `Integracao_workspaceId_provedor_key` ON `Integracao`;",
      "CREATE UNIQUE INDEX `Integracao_workspaceId_provedor_slot_key` ON `Integracao`(`workspaceId`, `provedor`, `slot`);",
    ].join("\n");
    expect(trechosDestrutivos(sql)).toEqual([]);
  });
});

describe("o que PERDE dado e precisa continuar parando o build", () => {
  it("apagar coluna", () => {
    const achados = trechosDestrutivos("ALTER TABLE `Contato` DROP COLUMN `whatsapp`;");
    expect(achados).toHaveLength(1);
    expect(achados[0]).toContain("DROP COLUMN");
  });

  it("apagar tabela", () => {
    expect(podeAplicarSemPerder("DROP TABLE `MensagemExtra`;")).toBe(false);
  });

  it("mudar o tipo de uma coluna, porque às vezes isso trunca em silêncio", () => {
    // VARCHAR(255) → VARCHAR(50) corta o resto sem avisar. Daqui não dá pra saber se corta, e o
    // lado errado de errar é o que apaga texto de cliente.
    expect(podeAplicarSemPerder("ALTER TABLE `Contato` MODIFY COLUMN `nome` VARCHAR(50) NOT NULL;")).toBe(false);
  });

  it("esvaziar tabela", () => {
    expect(podeAplicarSemPerder("TRUNCATE TABLE `Conversa`;")).toBe(false);
  });

  it("acha o destrutivo mesmo no meio de comandos inofensivos", () => {
    const sql = [
      "ALTER TABLE `Integracao` ADD COLUMN `slot` INTEGER NOT NULL DEFAULT 1;",
      "ALTER TABLE `Contato` DROP COLUMN `telefoneFixo`;",
      "CREATE UNIQUE INDEX `x` ON `Integracao`(`slot`);",
    ].join("\n");
    expect(trechosDestrutivos(sql)).toHaveLength(1);
  });
});

describe("o que está comentado não conta", () => {
  it("um DROP TABLE dentro de comentário não é um DROP TABLE", () => {
    expect(podeAplicarSemPerder("-- DROP TABLE `Contato`;\nCREATE INDEX `i` ON `Contato`(`nome`);")).toBe(true);
  });
});
