import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ORDEM_DE_EXCLUSAO } from "../apagar-workspace";

/**
 * A LISTA DE EXCLUSÃO SE DENUNCIA QUANDO ENVELHECE.
 *
 * Apagar uma empresa percorre 45 tabelas na ordem certa. Uma tabela nova com `workspaceId` que
 * ninguém lembrou de acrescentar na lista não dá erro nenhum agora: ela dá erro daqui a meses, em
 * produção, no meio de uma exclusão — com parte da conta já apagada e a outra parte não.
 *
 * Então o teste lê o schema de verdade, acha toda tabela com `workspaceId` e exige que ela esteja
 * na lista. Esquecer passa a ser um teste vermelho com o nome da tabela.
 */
function tabelasComWorkspaceId(): string[] {
  const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
  const modelos: string[] = [];
  let atual: string | null = null;
  let temWorkspaceId = false;
  for (const linha of schema.split("\n")) {
    const inicio = linha.match(/^model\s+(\w+)\s*\{/);
    if (inicio) {
      atual = inicio[1];
      temWorkspaceId = false;
      continue;
    }
    if (!atual) continue;
    if (/^\s*workspaceId\s+String/.test(linha)) temWorkspaceId = true;
    if (/^\}/.test(linha)) {
      if (temWorkspaceId && atual !== "Workspace") modelos.push(atual);
      atual = null;
    }
  }
  return modelos;
}

/** `NegocioCard` no schema é `negocioCard` no cliente do Prisma. */
function comoNoCliente(modelo: string): string {
  return modelo[0].toLowerCase() + modelo.slice(1);
}

describe("apagar uma empresa inteira", () => {
  it("a lista cobre TODA tabela com workspaceId", () => {
    const esperadas = tabelasComWorkspaceId().map(comoNoCliente).sort();
    const naLista: string[] = [...ORDEM_DE_EXCLUSAO].sort();
    const faltando = esperadas.filter((t) => !naLista.includes(t));
    expect(faltando, `tabelas com workspaceId que ficaram de fora de ORDEM_DE_EXCLUSAO: ${faltando.join(", ")}`).toEqual([]);
  });

  it("não lista tabela que não existe mais", () => {
    const esperadas = tabelasComWorkspaceId().map(comoNoCliente);
    const sobrando = (ORDEM_DE_EXCLUSAO as readonly string[]).filter((t) => !esperadas.includes(t));
    expect(sobrando, `tabelas na lista que não têm workspaceId (ou não existem): ${sobrando.join(", ")}`).toEqual([]);
  });

  it("filho vem antes do pai", () => {
    // As quatro duplas que o MySQL recusaria na ordem errada. Não é a lista inteira de propósito:
    // o que importa é travar os casos em que a chave estrangeira existe de verdade.
    const posicao = (t: string) => ORDEM_DE_EXCLUSAO.indexOf(t as (typeof ORDEM_DE_EXCLUSAO)[number]);
    expect(posicao("funilEtapa")).toBeLessThan(posicao("funil"));
    expect(posicao("negocioCard")).toBeLessThan(posicao("funilEtapa"));
    expect(posicao("tarefaCard")).toBeLessThan(posicao("tarefaEtapa"));
    expect(posicao("passoAutomacao")).toBeLessThan(posicao("execucaoAutomacao"));
    expect(posicao("versaoAutomacao")).toBeLessThan(posicao("fluxoAutomacao"));
    expect(posicao("conversa")).toBeLessThan(posicao("contato"));
    expect(posicao("origemDoLead")).toBeLessThan(posicao("contato"));
    expect(posicao("campanhaDestinatario")).toBeLessThan(posicao("campanha"));
    expect(posicao("gatilhoEtapa")).toBeLessThan(posicao("funilEtapa"));
    // O membro é o último antes da empresa: tudo que aponta pra ele já saiu.
    expect(posicao("membro")).toBe(ORDEM_DE_EXCLUSAO.length - 1);
  });
});
