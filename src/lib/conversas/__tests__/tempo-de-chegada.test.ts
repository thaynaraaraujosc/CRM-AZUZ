import { describe, expect, it } from "vitest";

import { CANAL_INSTAGRAM, CANAL_NAO_OFICIAL, CANAL_OFICIAL } from "@/lib/integracoes/conta-canal";
import {
  esperaDaTela,
  nomeDoCanal,
  percentil,
  resumirTempoDeChegada,
  type AmostraDeChegada,
} from "@/lib/conversas/tempo-de-chegada";

/** Açúcar: uma mensagem com os três carimbos em segundos relativos a um instante fixo. */
const BASE = Date.parse("2026-10-27T12:00:00.000Z");
function amostra(
  canal: string | null,
  segundos: { criado: number | null; recebido: number | null; gravado: number | null },
): AmostraDeChegada {
  const instante = (s: number | null) => (s === null ? null : new Date(BASE + s * 1000));
  return {
    canal,
    criadoEm: instante(segundos.criado),
    recebidoEm: instante(segundos.recebido),
    gravadoEm: instante(segundos.gravado),
  };
}

describe("percentil", () => {
  it("devolve o único valor quando há só um", () => {
    expect(percentil([42], 0.5)).toBe(42);
    expect(percentil([42], 0.9)).toBe(42);
  });

  it("interpola em vez de pular pro vizinho", () => {
    // Com 10 valores, o p90 cai exatamente no índice 9*0.9 = 8.1: entre 90 e 100.
    const ordenados = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentil(ordenados, 0.5)).toBeCloseTo(55);
    expect(percentil(ordenados, 0.9)).toBeCloseTo(91);
  });

  it("recusa lista vazia em vez de devolver NaN", () => {
    expect(() => percentil([], 0.5)).toThrow();
  });
});

describe("nomeDoCanal", () => {
  it("traduz os valores crus que o banco guarda", () => {
    // `whatsapp_nao_oficial` é o que os webhooks gravam HOJE (`CANAL_NAO_OFICIAL`). Errar isto
    // fazia a conexão por QR Code aparecer como um "WhatsApp" genérico, indistinguível da oficial
    // — e aí o painel não respondia a pergunta que ele existe pra responder: qual das duas
    // conexões está demorando.
    expect(nomeDoCanal("whatsapp_nao_oficial")).toBe("WhatsApp (QR Code)");
    expect(nomeDoCanal("meta_whatsapp")).toBe("WhatsApp (API oficial)");
    expect(nomeDoCanal("meta_instagram")).toBe("Instagram");
    expect(nomeDoCanal("Instagram")).toBe("Instagram");
  });

  it("entende o nome antigo do canal não oficial, que continua gravado", () => {
    expect(nomeDoCanal("whatsapp_baileys")).toBe("WhatsApp (QR Code)");
  });

  /*
   * A TRAVA CONTRA A DIVERGÊNCIA DAS DUAS CÓPIAS.
   *
   * `nomeDoCanal` repete, de propósito, a normalização que `conta-canal.ts` já faz — aquele arquivo
   * importa o Prisma e este precisa ficar puro. A cópia é aceitável; a cópia que cala quando o
   * original muda, não. Então o teste lê as constantes DE VERDADE e exige que cada uma seja
   * reconhecida. Renomear um canal lá passa a quebrar aqui, em vez de aparecer na tela como um
   * "WhatsApp" genérico meses depois.
   */
  it("reconhece toda constante de canal que os webhooks realmente gravam", () => {
    const genericos = ["WhatsApp"];
    for (const constante of [CANAL_NAO_OFICIAL, CANAL_OFICIAL, CANAL_INSTAGRAM]) {
      expect(genericos).not.toContain(nomeDoCanal(constante));
    }
  });

  it("trata o histórico sem canal como WhatsApp, que é o que ele é", () => {
    expect(nomeDoCanal(null)).toBe("WhatsApp");
    expect(nomeDoCanal("WhatsApp")).toBe("WhatsApp");
  });
});

describe("resumirTempoDeChegada", () => {
  /*
   * A razão de `total` existir. Com transporte e processamento ANTICORRELACIONADOS, somar as duas
   * medianas dá 3s, e nenhuma das duas mensagens levou 3s: uma levou 4 e a outra 2. Somando por
   * mensagem, a mediana é a de uma mensagem que existiu.
   */
  it("soma as duas pernas por mensagem, não soma mediana com mediana", () => {
    const [resumo] = resumirTempoDeChegada([
      amostra("meta_whatsapp", { criado: 0, recebido: 3, gravado: 4 }),
      amostra("meta_whatsapp", { criado: 10, recebido: 11, gravado: 13 }),
    ]);
    expect(resumo.transporte?.mediana).toBe(2000);
    expect(resumo.processamento?.mediana).toBe(1500);
    // Somar as medianas daria 3500. As somas por mensagem são 4000 e 3000: mediana 3500 por
    // coincidência aqui, mas o p90 separa os dois métodos.
    expect(resumo.total?.pior).toBe(4000);
    expect(resumo.total?.p90).toBe(3900);
  });

  it("não conta no total a mensagem cujo transporte foi descartado", () => {
    // Relógio adiantado: o processamento continua valendo, mas a soma não existe pra essa linha.
    const [resumo] = resumirTempoDeChegada([
      amostra("Instagram", { criado: 5, recebido: 2, gravado: 3 }),
      amostra("Instagram", { criado: 0, recebido: 2, gravado: 3 }),
    ]);
    expect(resumo.processamento?.mediana).toBe(1000);
    expect(resumo.total?.mediana).toBe(3000);
    expect(resumo.total?.pior).toBe(3000);
  });

  it("separa transporte de processamento", () => {
    const [resumo] = resumirTempoDeChegada([
      amostra("meta_whatsapp", { criado: 0, recebido: 2, gravado: 3 }),
      amostra("meta_whatsapp", { criado: 10, recebido: 12, gravado: 13 }),
    ]);
    expect(resumo.transporte?.mediana).toBe(2000);
    expect(resumo.processamento?.mediana).toBe(1000);
    expect(resumo.amostras).toBe(2);
  });

  it("agrupa por canal e ordena pelo canal com mais amostras", () => {
    const resumos = resumirTempoDeChegada([
      amostra("Instagram", { criado: 0, recebido: 1, gravado: 2 }),
      amostra("meta_whatsapp", { criado: 0, recebido: 1, gravado: 2 }),
      amostra("meta_whatsapp", { criado: 0, recebido: 1, gravado: 2 }),
    ]);
    expect(resumos.map((r) => r.canal)).toEqual(["WhatsApp (API oficial)", "Instagram"]);
  });

  /*
   * O caso que invalidaria a medição se fosse escondido: o relógio de quem manda é o aparelho dele.
   * Dois segundos adiantado e o "transporte" fica negativo. Clampar em zero diria "chegou
   * instantaneamente", que é uma afirmação falsa sobre a Meta; descartar em silêncio diria que a
   * amostra era menor do que foi. Então sai da conta E é contado.
   */
  it("não deixa relógio adiantado virar transporte zero", () => {
    const [resumo] = resumirTempoDeChegada([
      amostra("Instagram", { criado: 5, recebido: 2, gravado: 3 }),
      amostra("Instagram", { criado: 0, recebido: 4, gravado: 5 }),
    ]);
    expect(resumo.relogioAdiantado).toBe(1);
    expect(resumo.transporte?.mediana).toBe(4000);
    // O processamento das DUAS continua valendo: ele não depende do relógio alheio.
    expect(resumo.amostras).toBe(2);
    expect(resumo.processamento?.mediana).toBe(1000);
  });

  it("ignora linha sem os carimbos novos (histórico anterior à medição)", () => {
    expect(resumirTempoDeChegada([amostra("Instagram", { criado: 0, recebido: null, gravado: null })])).toEqual([]);
  });

  /*
   * Reexecução da Meta e importação de histórico gravam linhas cujo "processamento" é de horas. Um
   * único desses define o pior caso e a tela passa a dizer que o CRM leva 3 horas pra gravar uma
   * mensagem, o que é falso sobre o caminho normal.
   */
  it("descarta disparate de horas em vez de deixá-lo definir o pior caso", () => {
    const [resumo] = resumirTempoDeChegada([
      amostra("meta_whatsapp", { criado: 0, recebido: 1, gravado: 2 }),
      amostra("meta_whatsapp", { criado: 0, recebido: 1, gravado: 3 }),
      amostra("meta_whatsapp", { criado: 0, recebido: 1, gravado: 4 * 3600 }),
    ]);
    expect(resumo.amostras).toBe(2);
    expect(resumo.processamento?.pior).toBe(2000);
  });

  it("não devolve canal sem nenhuma amostra utilizável", () => {
    expect(
      resumirTempoDeChegada([amostra("Instagram", { criado: 0, recebido: 10, gravado: 2 })]),
    ).toEqual([]);
  });
});

describe("esperaDaTela", () => {
  it("é metade do intervalo na média e o intervalo inteiro no pior caso", () => {
    expect(esperaDaTela(5000)).toEqual({ media: 2500, pior: 5000 });
  });
});
