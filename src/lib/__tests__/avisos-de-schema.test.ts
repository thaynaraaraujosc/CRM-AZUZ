import { describe, expect, it } from "vitest";

// Script de build, em .mjs: ele roda fora do app, antes do `next build`. O teste vive aqui porque
// é aqui que mora a suíte — e porque esta função decide se um deploy publica ou para.
import { avisosDoPush, avisosSaoSeguros } from "../../../scripts/avisos-de-schema.mjs";

/**
 * A DECISÃO QUE SEPARA "PUBLICA" DE "NÃO PUBLICA".
 *
 * Seis publicações seguidas falharam em 07/11/2026 porque o `db push` junta sob o mesmo título
 * duas coisas muito diferentes: "isto apaga dado" e "isto pode não ser aceito". A primeira tem
 * que parar o build; a segunda, não. Cada caso aqui é um lado dessa linha.
 */

/** A saída real que travou a publicação, copiada do log da Vercel. */
const SAIDA_REAL = `
Datasource "db": MySQL database "crm" at "187.77.48.77:3306"

⚠️  There might be data loss when applying the changes:

  • A unique constraint covering the columns \`[workspaceId,provedor,slot]\` on the table \`Integracao\` will be added. If there are existing duplicate values, this will fail.

Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma/schema.prisma.
Error: Use the --accept-data-loss flag to ignore the data loss warnings like prisma db push --accept-data-loss
`;

describe("o aviso que travou a publicação de 07/11/2026", () => {
  it("é lido como seguro: criar índice ou vale, ou é recusado em voz alta", () => {
    const { seguro, avisos } = avisosSaoSeguros(SAIDA_REAL);
    expect(avisos).toHaveLength(1);
    expect(seguro).toBe(true);
  });

  it("o texto do aviso é extraído sem o marcador", () => {
    expect(avisosDoPush(SAIDA_REAL)[0]).toMatch(/^A unique constraint covering/);
  });
});

describe("o que continua parando o build", () => {
  it("apagar coluna", () => {
    const saida = "⚠️  There might be data loss:\n\n  • You are about to drop the column `whatsapp` on the `Contato` table, which still contains 1200 non-null values.\n";
    const { seguro, perigosos } = avisosSaoSeguros(saida);
    expect(seguro).toBe(false);
    expect(perigosos?.[0]).toContain("drop the column");
  });

  it("apagar tabela", () => {
    const saida = "  • You are about to drop the `MensagemExtra` table, which is not empty (5000 rows).";
    expect(avisosSaoSeguros(saida).seguro).toBe(false);
  });

  it("mudar o tipo de uma coluna, que às vezes trunca em silêncio", () => {
    const saida = "  • You are about to alter the column `nome` on the `Contato` table, which contains 300 non-null values. The data in that column may be lost.";
    expect(avisosSaoSeguros(saida).seguro).toBe(false);
  });

  it("um aviso seguro JUNTO de um perigoso não passa", () => {
    // O índice sozinho passaria. Acompanhado, não: o conjunto é que é aplicado.
    const saida = [
      "  • A unique constraint covering the columns `[a,b]` on the table `X` will be added. If there are existing duplicate values, this will fail.",
      "  • You are about to drop the column `y` on the `X` table, which still contains 9 non-null values.",
    ].join("\n");
    const { seguro, perigosos } = avisosSaoSeguros(saida);
    expect(seguro).toBe(false);
    expect(perigosos).toHaveLength(1);
  });

  it("aviso desconhecido para o build, mesmo sem a palavra 'drop'", () => {
    // Um texto que o Prisma venha a escrever numa versão nova. Não está na lista do que se sabe
    // inofensivo, então não se aplica no escuro.
    const saida = "  • Something entirely new the Prisma team wrote this month.";
    expect(avisosSaoSeguros(saida).seguro).toBe(false);
  });

  it("sem conseguir ler aviso nenhum, não aplica", () => {
    // O `db push` pediu a bandeira e não deu pra saber por quê. Aplicar aqui seria no escuro.
    expect(avisosSaoSeguros("Error: Use the --accept-data-loss flag").seguro).toBe(false);
    expect(avisosSaoSeguros("").seguro).toBe(false);
  });
});
