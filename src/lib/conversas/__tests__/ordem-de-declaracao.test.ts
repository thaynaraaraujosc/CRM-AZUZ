import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A ORDEM DAS DECLARAÇÕES NA TELA DE CONVERSAS.
 *
 * Teste esquisito, e ele existe por um defeito que já aconteceu DUAS VEZES, com o mesmo formato e
 * o mesmo estrago: a tela inteira de Conversas caindo com "Cannot access 'x' before
 * initialization" — e, como ela reabre a cada navegação, o app junto.
 *
 * COMO O DEFEITO SE MONTA. `conversasFiltradas` é calculado no CORPO do componente, ou seja,
 * durante a renderização. Ele chama `conversaEscondidaPeloWhatsapp`, que chama
 * `conversaUsaWhatsappNaoOficial`, que lê `mensagensExtraPorContato` e `canalEscolhido`. As
 * funções são declarações (hoisted) e não reclamam de nada; as variáveis são `const`, e um `const`
 * declarado DEPOIS fica em zona morta temporal — ler é um ReferenceError, não um `undefined`.
 *
 * POR QUE PASSA POR TUDO. Só uma combinação de estado chega a chamar a função: WhatsApp oficial
 * conectado e QR Code desconectado, que é o estado de quem acabou de trocar de celular. Nos outros
 * casos o filtro sai antes. Então não há erro de tipo, o build passa, os testes passam, e o defeito
 * espera pelo cliente que trocar de aparelho.
 *
 * ESTE TESTE É UM FIO DE SEGURANÇA, não uma análise: ele só confere que cada variável que a cadeia
 * lê nasce ANTES de quem a lê. Barato de manter, e pega exatamente a regressão que já voltou uma
 * vez.
 */

const ARQUIVO = join(process.cwd(), "src/app/(app)/conversas/page.tsx");

function linhaDe(fonte: string, trecho: string): number {
  const linhas = fonte.split("\n");
  const i = linhas.findIndex((l) => l.includes(trecho));
  return i;
}

describe("tela de Conversas: o que a renderização lê nasce antes", () => {
  const fonte = readFileSync(ARQUIVO, "utf8");

  const consumidor = "const conversasFiltradas = conversas";

  /* Cada uma destas é lida, direta ou indiretamente, por `conversasFiltradas` — durante a
     renderização. Acrescentar uma leitura nova à cadeia pede uma linha nova aqui. */
  const lidasNaRenderizacao = [
    "const [canalEscolhido, setCanalEscolhido]",
    "mensagensExtraPorContato,",
    "const naoOficialConectado =",
    "const [lidas, setLidas]",
    "const [filtroConversa, setFiltroConversa]",
    "const [canalAba, setCanalAba]",
    "const [mostrarArquivadas, setMostrarArquivadas]",
    "const [atendenteTopFiltro, setAtendenteTopFiltro]",
    "const [canalTopFiltro, setCanalTopFiltro]",
  ];

  it("o consumidor existe (se mudou de nome, este teste precisa ser atualizado junto)", () => {
    expect(linhaDe(fonte, consumidor)).toBeGreaterThan(0);
  });

  it.each(lidasNaRenderizacao)("%s é declarada antes de conversasFiltradas", (declaracao) => {
    const ondeDeclara = linhaDe(fonte, declaracao);
    const ondeUsa = linhaDe(fonte, consumidor);
    expect(ondeDeclara, `não achei a declaração "${declaracao}" no arquivo`).toBeGreaterThan(0);
    expect(
      ondeDeclara,
      `"${declaracao}" está na linha ${ondeDeclara + 1}, depois de conversasFiltradas (linha ${ondeUsa + 1}). ` +
        "Durante a renderização isso é um ReferenceError e derruba a tela de Conversas inteira. " +
        "Mova a declaração pra cima.",
    ).toBeLessThan(ondeUsa);
  });
});
