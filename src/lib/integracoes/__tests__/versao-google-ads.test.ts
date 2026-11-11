import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A VERSÃO DA API DO GOOGLE NÃO PODE FICAR PARADA ATÉ MORRER.
 *
 * O comentário dela já dizia "fixa de propósito: o Google descontinua versão antiga em prazo
 * conhecido, e descobrir isso por quebra em produção é pior do que por aviso no calendário". E foi
 * exatamente assim que se descobriu: ficou em `v18`, ninguém olhou o calendário, e em 11/11/2026 a
 * página de descontinuação do Google listava a v18 como ENCERRADA. A devolução de venda ganha pro
 * Google não funcionava mais — nem a listagem de contas, nem o estorno. Falhava inteira, numa
 * versão que não existe.
 *
 * O Google encerra uma versão cerca de um ano depois de lançá-la. Então este piso não é um número
 * mágico: é a versão mais antiga que ainda tinha prazo em aberto quando isto foi escrito. Subir o
 * piso é parte de subir a versão, e o teste quebrando é o aviso que faltou.
 *
 * Teste estático, de leitura do arquivo: o que se quer travar é a constante, e importar o módulo
 * arrastaria `node:crypto` e a configuração de ambiente pra dentro de uma verificação de texto.
 */
describe("versão da API do Google Ads", () => {
  /** A mais antiga com prazo em aberto em 11/11/2026 (encerramento previsto: fevereiro de 2027). */
  const PISO = 23;

  const arquivo = readFileSync(join(process.cwd(), "src/lib/integracoes/google-ads.ts"), "utf8");

  it("está fixada numa constante só", () => {
    expect(arquivo.match(/const VERSAO = "v\d+";/g) ?? []).toHaveLength(1);
  });

  it("não é uma versão já encerrada pelo Google", () => {
    const achado = /const VERSAO = "v(\d+)";/.exec(arquivo);
    expect(achado, "não achei a constante VERSAO").not.toBeNull();
    const numero = Number(achado![1]);
    expect(
      numero,
      `v${numero} está abaixo do piso v${PISO}. Confira https://developers.google.com/google-ads/api/docs/sunset-dates, suba a versão e suba o piso deste teste junto.`,
    ).toBeGreaterThanOrEqual(PISO);
  });

  it("todas as chamadas usam a constante, nenhuma tem a versão escrita no endereço", () => {
    // Uma chamada com a versão colada na URL sobreviveria à troca da constante e continuaria
    // batendo numa versão encerrada — sem nada apontando pra ela.
    expect(arquivo).not.toMatch(/googleads\.googleapis\.com\/v\d+/);
  });
});
