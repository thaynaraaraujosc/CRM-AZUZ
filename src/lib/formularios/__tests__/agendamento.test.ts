import { describe, expect, it } from "vitest";

import { AGENDA_PADRAO, conflita, horarioValido, horariosLivres, lerConfiguracao } from "../agendamento";

/**
 * O erro que estes testes prendem é invisível pra quem monta o formulário e caro pra quem
 * responde: um fuso trocado oferece 14h e marca 11h, e quem descobre é o cliente sozinho na
 * chamada; um intervalo mal fechado oferece duas pessoas no mesmo horário.
 *
 * Tudo com `agora` fixo: um teste de agenda que depende do relógio passa hoje e quebra na
 * terça-feira seguinte, e aí ninguém sabe mais se o defeito é do teste ou do produto.
 */

// Quinta-feira, 22 de outubro de 2026, 08:00 em Brasília (11:00 UTC).
const AGORA = new Date("2026-10-22T11:00:00.000Z");

const config = (parcial: Partial<typeof AGENDA_PADRAO> = {}) => ({
  ...AGENDA_PADRAO,
  antecedenciaHoras: 0,
  janelaDias: 3,
  ...parcial,
});

describe("lerConfiguracao", () => {
  it("formulário sem nada configurado cai no padrão inteiro", () => {
    expect(lerConfiguracao(undefined)).toEqual(AGENDA_PADRAO);
    expect(lerConfiguracao({})).toEqual(AGENDA_PADRAO);
  });

  it("apagar todos os horários é uma escolha, não um descuido: não volta pro padrão", () => {
    expect(lerConfiguracao({ horarios: {} }).horarios).toEqual({});
  });

  it("joga fora dia e hora que não existem, em vez de aceitar lixo do banco", () => {
    const lido = lerConfiguracao({ horarios: { "1": ["09:00", "25:00", "xx"], "9": ["10:00"] } });
    expect(lido.horarios).toEqual({ "1": ["09:00"] });
  });

  it("ordena e tira repetido: a empresa digita na ordem que lembra", () => {
    expect(lerConfiguracao({ horarios: { "3": ["17:00", "09:00", "09:00"] } }).horarios).toEqual({
      "3": ["09:00", "17:00"],
    });
  });

  it("números fora de faixa caem no padrão; zero de antecedência é válido", () => {
    expect(lerConfiguracao({ duracao: 5 }).duracao).toBe(AGENDA_PADRAO.duracao);
    expect(lerConfiguracao({ duracao: 60 }).duracao).toBe(60);
    expect(lerConfiguracao({ antecedenciaHoras: 0 }).antecedenciaHoras).toBe(0);
    expect(lerConfiguracao({ janelaDias: 999 }).janelaDias).toBe(AGENDA_PADRAO.janelaDias);
  });
});

describe("conflita", () => {
  it("encostar não é conflito: uma reunião começa quando a outra acaba", () => {
    const a = { inicio: "2026-10-22T12:00:00.000Z", fim: "2026-10-22T12:30:00.000Z" };
    const b = { inicio: "2026-10-22T12:30:00.000Z", fim: "2026-10-22T13:00:00.000Z" };
    expect(conflita(a, b)).toBe(false);
  });

  it("sobrepor é conflito, em qualquer ordem", () => {
    const a = { inicio: "2026-10-22T12:00:00.000Z", fim: "2026-10-22T12:30:00.000Z" };
    const b = { inicio: "2026-10-22T12:15:00.000Z", fim: "2026-10-22T12:45:00.000Z" };
    expect(conflita(a, b)).toBe(true);
    expect(conflita(b, a)).toBe(true);
  });
});

describe("horariosLivres", () => {
  it("o horário sai em Brasília e volta como instante UTC certo", () => {
    const dias = horariosLivres({ config: config({ horarios: { "4": ["09:00"] } }), ocupados: [], agora: AGORA });
    expect(dias).toHaveLength(1);
    expect(dias[0].dia).toBe("2026-10-22");
    // 09:00 em Brasília é 12:00 UTC. Se isto virar 09:00Z, o cliente chega três horas atrasado.
    expect(dias[0].horarios[0].inicio).toBe("2026-10-22T12:00:00.000Z");
    expect(dias[0].horarios[0].fim).toBe("2026-10-22T12:30:00.000Z");
    expect(dias[0].horarios[0].hora).toBe("09:00");
  });

  it("dia que não está na configuração é dia fechado", () => {
    // 22/10/2026 é quinta (4). Configurando só a sexta (5), a quinta não aparece.
    const dias = horariosLivres({ config: config({ horarios: { "5": ["09:00"] } }), ocupados: [], agora: AGORA });
    expect(dias.map((d) => d.dia)).toEqual(["2026-10-23"]);
  });

  it("o que já passou não é oferecido", () => {
    const dias = horariosLivres({
      config: config({ horarios: { "4": ["07:00", "09:00"] }, janelaDias: 1 }),
      ocupados: [],
      agora: AGORA,
    });
    expect(dias[0].horarios.map((h) => h.hora)).toEqual(["09:00"]);
  });

  it("a antecedência mínima empurra o primeiro horário", () => {
    const dias = horariosLivres({
      config: config({ horarios: { "4": ["09:00", "14:00"] }, janelaDias: 1, antecedenciaHoras: 4 }),
      ocupados: [],
      agora: AGORA,
    });
    // 08:00 + 4h = 12:00 em Brasília: as 9h saem, as 14h ficam.
    expect(dias[0].horarios.map((h) => h.hora)).toEqual(["14:00"]);
  });

  it("horário ocupado some da lista — é isto que impede duas pessoas no mesmo momento", () => {
    const dias = horariosLivres({
      config: config({ horarios: { "4": ["09:00", "14:00"] }, janelaDias: 1 }),
      ocupados: [{ inicio: "2026-10-22T12:00:00.000Z", fim: "2026-10-22T12:30:00.000Z" }],
      agora: AGORA,
    });
    expect(dias[0].horarios.map((h) => h.hora)).toEqual(["14:00"]);
  });

  it("dia sem nenhum horário livre não aparece: oferecer o dia e nada dentro dele faz desistir", () => {
    const dias = horariosLivres({
      config: config({ horarios: { "4": ["09:00"] }, janelaDias: 1 }),
      ocupados: [{ inicio: "2026-10-22T12:00:00.000Z", fim: "2026-10-22T12:30:00.000Z" }],
      agora: AGORA,
    });
    expect(dias).toEqual([]);
  });

  it("a janela limita até onde dá pra marcar", () => {
    const dias = horariosLivres({
      config: config({ horarios: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), ["14:00"]])), janelaDias: 2 }),
      ocupados: [],
      agora: AGORA,
    });
    expect(dias.map((d) => d.dia)).toEqual(["2026-10-22", "2026-10-23"]);
  });

  it("sem horário nenhum configurado, não oferece nada", () => {
    expect(horariosLivres({ config: config({ horarios: {} }), ocupados: [], agora: AGORA })).toEqual([]);
  });
});

describe("horarioValido", () => {
  const base = { config: config({ horarios: { "4": ["09:00", "14:00"] }, janelaDias: 1 }), agora: AGORA };

  it("aceita o horário que continua livre e devolve o fim já calculado", () => {
    const r = horarioValido({ ...base, ocupados: [], inicio: "2026-10-22T12:00:00.000Z" });
    expect(r).toEqual({ ok: true, inicio: "2026-10-22T12:00:00.000Z", fim: "2026-10-22T12:30:00.000Z" });
  });

  it("recusa o que foi tomado entre escolher e enviar", () => {
    const r = horarioValido({
      ...base,
      ocupados: [{ inicio: "2026-10-22T12:00:00.000Z", fim: "2026-10-22T12:30:00.000Z" }],
      inicio: "2026-10-22T12:00:00.000Z",
    });
    expect(r.ok).toBe(false);
  });

  it("recusa horário que nunca foi oferecido, mesmo em dia aberto", () => {
    expect(horarioValido({ ...base, ocupados: [], inicio: "2026-10-22T15:00:00.000Z" }).ok).toBe(false);
  });

  it("recusa texto que não é instante, sem explodir", () => {
    expect(horarioValido({ ...base, ocupados: [], inicio: "amanhã de manhã" }).ok).toBe(false);
  });
});
