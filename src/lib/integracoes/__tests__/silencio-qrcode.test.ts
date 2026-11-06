import { describe, expect, it } from "vitest";

import { SILENCIO_SUSPEITO_MS, estaEmSilencio } from "@/lib/integracoes/saude-qrcode";

/**
 * QUEM ESTÁ EM SILÊNCIO É QUEM PRECISA DE CONSERTO.
 *
 * O que se mede aqui é a ESCOLHA: a passada do minuto só pode tocar em quem parou de mandar
 * evento. Se ela mexesse em todo mundo, seria a varredura da hora cheia rodando sessenta vezes
 * por hora contra a Evolution — o tipo de conserto que vira o próximo problema.
 */
const AGORA = Date.parse("2026-11-06T12:00:00Z");
const minutosAtras = (n: number) => new Date(AGORA - n * 60_000).toISOString();

describe("esta conexão parou de falar com o CRM?", () => {
  it("evento recente: não é silêncio", () => {
    expect(estaEmSilencio({ ultimoEventoEm: minutosAtras(1) }, AGORA)).toBe(false);
    expect(estaEmSilencio({ ultimoEventoEm: minutosAtras(14) }, AGORA)).toBe(false);
  });

  it("passou da janela: é silêncio", () => {
    expect(estaEmSilencio({ ultimoEventoEm: minutosAtras(16) }, AGORA)).toBe(true);
    expect(estaEmSilencio({ ultimoEventoEm: minutosAtras(600) }, AGORA)).toBe(true);
  });

  it("nunca mandou evento nenhum é o pior caso, e entra", () => {
    // Conexão marcada como conectada que nunca falou com o CRM: é o "conectei e não chega nada".
    expect(estaEmSilencio(undefined, AGORA)).toBe(true);
    expect(estaEmSilencio({}, AGORA)).toBe(true);
  });

  it("data ilegível conta como silêncio, e não como 'tudo certo'", () => {
    // Na dúvida, conferir: conferir custa uma chamada; não conferir custa a cliente sem mensagem.
    expect(estaEmSilencio({ ultimoEventoEm: "ontem" }, AGORA)).toBe(true);
  });

  it("a janela é de quinze minutos", () => {
    // Fixada no teste de propósito: encurtar demais vira martelada na Evolution, alargar demais
    // devolve o problema de a pessoa responder pelo celular e não ver nada aqui.
    expect(SILENCIO_SUSPEITO_MS).toBe(15 * 60 * 1000);
  });
});
