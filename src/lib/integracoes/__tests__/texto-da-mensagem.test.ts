import { describe, expect, it } from "vitest";

import { chavesDaMensagem, desembrulharMensagem, extrairTextoDaMensagem } from "../texto-da-mensagem";

/**
 * O defeito que estes testes prendem: "chega mensagem de umas pessoas e de outras não".
 *
 * O WhatsApp embrulha o conteúdo em vários casos corriqueiros, e o mais traiçoeiro é a conversa
 * com MENSAGENS TEMPORÁRIAS ligadas: quem liga isso é o contato, do lado dele, numa conversa só.
 * O CRM lia só o nível de cima do payload, então mensagem embrulhada simplesmente não existia pra
 * ele e era descartada em silêncio. Sem padrão visível: chegava de uns, não chegava de outros.
 */
describe("extrairTextoDaMensagem", () => {
  it("lê a mensagem de texto comum", () => {
    expect(extrairTextoDaMensagem({ conversation: "oi, bom dia" })).toBe("oi, bom dia");
  });

  it("lê a resposta a uma mensagem citada", () => {
    expect(extrairTextoDaMensagem({ extendedTextMessage: { text: "é esse mesmo" } })).toBe("é esse mesmo");
  });

  // O caso que fazia a mensagem sumir. Conversa com mensagens temporárias ligadas pelo contato.
  it("abre o embrulho de mensagem temporária", () => {
    const payload = { ephemeralMessage: { message: { conversation: "some em 24h" } } };
    expect(extrairTextoDaMensagem(payload)).toBe("some em 24h");
  });

  it("abre o embrulho de ver uma vez, nas três versões que existem", () => {
    expect(extrairTextoDaMensagem({ viewOnceMessage: { message: { conversation: "olha isso" } } })).toBe("olha isso");
    expect(extrairTextoDaMensagem({ viewOnceMessageV2: { message: { conversation: "olha isso" } } })).toBe("olha isso");
    expect(
      extrairTextoDaMensagem({ viewOnceMessageV2Extension: { message: { conversation: "olha isso" } } }),
    ).toBe("olha isso");
  });

  it("abre embrulho dentro de embrulho", () => {
    const payload = {
      ephemeralMessage: { message: { viewOnceMessageV2: { message: { imageMessage: { caption: "a proposta" } } } } },
    };
    expect(extrairTextoDaMensagem(payload)).toBe("a proposta");
  });

  it("lê o texto novo de uma mensagem editada", () => {
    expect(
      extrairTextoDaMensagem({ protocolMessage: { editedMessage: { conversation: "corrigindo: é 15h" } } }),
    ).toBe("corrigindo: é 15h");
  });

  it("lê documento com legenda, que também vem embrulhado", () => {
    const payload = { documentWithCaptionMessage: { message: { documentMessage: { fileName: "contrato.pdf" } } } };
    expect(extrairTextoDaMensagem(payload)).toBe("📄 Documento: contrato.pdf");
  });

  // Mídia sem legenda não tem texto, mas sumir sem deixar rastro é pior do que virar um aviso.
  it("anuncia a mídia que chegou sem legenda", () => {
    expect(extrairTextoDaMensagem({ audioMessage: {} })).toContain("Mensagem de voz");
    expect(extrairTextoDaMensagem({ imageMessage: {} })).toContain("Foto");
    expect(extrairTextoDaMensagem({ videoMessage: {} })).toContain("Vídeo");
    expect(extrairTextoDaMensagem({ stickerMessage: {} })).toContain("Figurinha");
    expect(extrairTextoDaMensagem({ locationMessage: {} })).toContain("Localização");
    expect(extrairTextoDaMensagem({ contactMessage: {} })).toContain("Contato");
    expect(extrairTextoDaMensagem({ pollCreationMessage: { name: "Qual horário?" } })).toContain("Qual horário?");
  });

  it("prefere a legenda ao aviso genérico", () => {
    expect(extrairTextoDaMensagem({ imageMessage: { caption: "segue a tabela" } })).toBe("segue a tabela");
  });

  it("lê o que a pessoa escolheu num botão ou numa lista", () => {
    expect(extrairTextoDaMensagem({ buttonsResponseMessage: { selectedDisplayText: "Quero sim" } })).toBe("Quero sim");
    expect(extrairTextoDaMensagem({ listResponseMessage: { title: "Plano Prata" } })).toBe("Plano Prata");
  });

  // Confirmação de entrega e afins não são mensagem de ninguém: viram bolha fantasma se entrarem.
  it("devolve nulo pro que não é mensagem", () => {
    expect(extrairTextoDaMensagem({ protocolMessage: { type: "REVOKE" } })).toBeNull();
    expect(extrairTextoDaMensagem({})).toBeNull();
    expect(extrairTextoDaMensagem(null)).toBeNull();
  });

  it("não aceita texto em branco como texto", () => {
    expect(extrairTextoDaMensagem({ conversation: "   " })).toBeNull();
  });
});

describe("desembrulharMensagem", () => {
  // O conteúdo desembrulhado é o que decide se a mídia fica buscável depois. Olhar o nível de cima
  // deixava áudio e foto embrulhados sem o registro que permite buscá-los.
  it("devolve o conteúdo de dentro, não o embrulho", () => {
    const dentro = desembrulharMensagem({ ephemeralMessage: { message: { audioMessage: { seconds: 3 } } } });
    expect(dentro).toHaveProperty("audioMessage");
  });

  it("não gira pra sempre num payload estranho", () => {
    const circular: Record<string, unknown> = {};
    circular.ephemeralMessage = { message: circular };
    expect(() => desembrulharMensagem(circular)).not.toThrow();
  });
});

describe("chavesDaMensagem", () => {
  it("descreve o que veio, pra descobrir formato novo sem adivinhar", () => {
    expect(chavesDaMensagem({ ephemeralMessage: { message: { algoNovoMessage: {} } } })).toBe("algoNovoMessage");
    expect(chavesDaMensagem(null)).toBe("sem conteúdo");
  });
});
