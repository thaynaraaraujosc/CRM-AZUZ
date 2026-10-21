import { afterEach, describe, expect, it, vi } from "vitest";

import { horaDaMensagem, rotuloDoDiaEmBrasilia } from "../hora-da-mensagem";

/**
 * O DEFEITO QUE ESTE ARQUIVO IMPEDE DE VOLTAR: toda mensagem recebida aparecia 3 horas adiantada.
 *
 * A coluna `hora` guarda TEXTO já formatado, escrito pelo webhook — que roda na Vercel, cujo
 * relógio é UTC. "18:42" de Brasília era gravado como "21:42", para sempre. E a lista de conversas
 * ao lado mostrava 18:42, porque tirava a hora de outro lugar: a mesma mensagem com dois horários
 * na mesma tela.
 *
 * A hora agora sai de `criadoEm`, que é um instante de verdade. Nada depende do relógio de quem
 * olha nem do relógio do servidor.
 */

const traduzir = (t: string) => t;

afterEach(() => {
  vi.useRealTimers();
});

describe("a hora da bolha", () => {
  it("converte o instante pro relógio de Brasília", () => {
    // 21:42 UTC é 18:42 em Brasília: exatamente o que aparecia errado na tela.
    const instante = Date.UTC(2026, 9, 21, 21, 42);
    expect(horaDaMensagem({ hora: "21:42", criadoEm: instante })).toBe("18:42");
  });

  it("ignora o texto guardado quando existe o instante", () => {
    // O `hora` gravado pode estar errado (é o caso de todo o histórico). O instante manda.
    expect(horaDaMensagem({ hora: "99:99", criadoEm: Date.UTC(2026, 9, 21, 12, 0) })).toBe("09:00");
  });

  it("vira o dia pra trás quando precisa", () => {
    // 01:30 UTC do dia 22 é 22:30 do dia 21 em Brasília.
    expect(horaDaMensagem({ criadoEm: Date.UTC(2026, 9, 22, 1, 30) })).toBe("22:30");
  });

  it("sem instante, usa o que estava guardado", () => {
    // Mensagem de exemplo (semeada) não tem `criadoEm`. Melhor a hora antiga do que campo vazio.
    expect(horaDaMensagem({ hora: "14:00" })).toBe("14:00");
    expect(horaDaMensagem({ hora: "14:00", criadoEm: 0 })).toBe("14:00");
    expect(horaDaMensagem({ hora: "14:00", criadoEm: Number.NaN })).toBe("14:00");
  });

  it("sem instante e sem hora, não inventa nada", () => {
    expect(horaDaMensagem({})).toBe("");
  });
});

describe("o separador de dia", () => {
  it('"Hoje" é o dia de Brasília, não o do UTC', () => {
    /*
     * O caso que separa os dois: são 22:30 do dia 21 em Brasília, que já é 01:30 do dia 22 em UTC.
     * Comparando pelo relógio errado, a mensagem que acabou de chegar cairia em "Ontem".
     */
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 22, 1, 30)));

    expect(rotuloDoDiaEmBrasilia(Date.UTC(2026, 9, 22, 1, 0), traduzir, "pt-BR")).toBe("Hoje");
  });

  it('"Ontem" conta o dia de Brasília', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 22, 1, 30)));

    // 15:00 UTC do dia 20 = 12:00 do dia 20 em Brasília, e "hoje" em Brasília é dia 21.
    expect(rotuloDoDiaEmBrasilia(Date.UTC(2026, 9, 20, 15, 0), traduzir, "pt-BR")).toBe("Ontem");
  });

  it("mais antigo que ontem vira a data por extenso", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 22, 15, 0)));

    const rotulo = rotuloDoDiaEmBrasilia(Date.UTC(2026, 9, 10, 15, 0), traduzir, "pt-BR");
    expect(rotulo).toContain("10");
    expect(rotulo).toContain("outubro");
    // O ano corrente não entra: repetir "de 2026" em toda conversa é ruído.
    expect(rotulo).not.toContain("2026");
  });

  it("de outro ano, o ano aparece", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 22, 15, 0)));

    expect(rotuloDoDiaEmBrasilia(Date.UTC(2025, 2, 3, 15, 0), traduzir, "pt-BR")).toContain("2025");
  });

  it("sem instante, nenhum separador", () => {
    expect(rotuloDoDiaEmBrasilia(undefined, traduzir, "pt-BR")).toBeNull();
  });
});
