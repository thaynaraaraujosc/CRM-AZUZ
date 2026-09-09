import { describe, expect, it } from "vitest";

import { tipoDeAudioCorrigido } from "../anexo-publico";

/**
 * O áudio que não chegava.
 *
 * O WhatsApp aceita OGG só com codec Opus, que é exatamente o que um arquivo `.opus` é. Mas o
 * navegador entrega esse arquivo como `audio/opus` (tipo que não existe na lista da Meta) ou sem
 * tipo nenhum, e a Cloud API recusa a mensagem inteira dizendo que o formato não é suportado,
 * mesmo o conteúdo estando certo. Do lado do CRM não aparece erro nenhum: o envio foi aceito.
 */
describe("tipo do áudio antes de publicar o link", () => {
  it("traduz opus pro que a Meta reconhece", () => {
    expect(tipoDeAudioCorrigido("audio/opus", "audio.opus")).toBe("audio/ogg");
  });

  it("resolve o arquivo que chegou sem tipo", () => {
    // É o caso do áudio exportado do WhatsApp: "WhatsApp Audio 2026-09-08 at 16.13.28.opus".
    expect(tipoDeAudioCorrigido("application/octet-stream", "WhatsApp Audio 2026-09-08 at 16.13.28.opus")).toBe(
      "audio/ogg",
    );
    expect(tipoDeAudioCorrigido("", "nota.ogg")).toBe("audio/ogg");
  });

  it("não mexe no que já está certo", () => {
    expect(tipoDeAudioCorrigido("audio/mpeg", "musica.mp3")).toBe("audio/mpeg");
    expect(tipoDeAudioCorrigido("image/jpeg", "foto.jpg")).toBe("image/jpeg");
    expect(tipoDeAudioCorrigido("application/pdf", "contrato.pdf")).toBe("application/pdf");
  });
});
