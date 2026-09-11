import { describe, expect, it } from "vitest";

import { donoContradizOCanal, provedorDoCanal } from "../conta-canal";

/**
 * O defeito que estes testes prendem: "recebo a mensagem no celular e ela não aparece no CRM".
 *
 * Uma mensagem que entrou pelo QR Code ficava marcada como sendo da API oficial, porque a adoção
 * de mensagens órfãs copiava o dono da CONVERSA sem olhar por onde cada mensagem tinha entrado.
 * Com as duas conexões ligadas ninguém via diferença. Ao desconectar a oficial, essas mensagens
 * sumiram da tela com o número que as recebeu ainda conectado.
 *
 * A defesa é esta: `canal` é escrito por quem recebeu e não mente. Quando ele contradiz o dono, o
 * dono é que está errado.
 */
describe("provedorDoCanal", () => {
  it("reconhece o QR Code pelos dois nomes que já foram gravados", () => {
    expect(provedorDoCanal("whatsapp_nao_oficial")).toBe("whatsapp_nao_oficial");
    // Nome antigo do mesmo canal, ainda gravado em mensagem de saída.
    expect(provedorDoCanal("whatsapp_baileys")).toBe("whatsapp_nao_oficial");
  });

  it("reconhece a API oficial e o Instagram", () => {
    expect(provedorDoCanal("meta_whatsapp")).toBe("meta_whatsapp");
    expect(provedorDoCanal("meta_instagram")).toBe("meta_instagram");
  });

  // "WhatsApp" com maiúscula é o rótulo da CONVERSA, não do provedor: não distingue API oficial de
  // QR Code. Afirmar um provedor a partir dele reatribuiria mensagem pro dono errado.
  it("não afirma nada a partir do rótulo da conversa", () => {
    expect(provedorDoCanal("WhatsApp")).toBeNull();
    expect(provedorDoCanal("Instagram")).toBeNull();
    expect(provedorDoCanal(null)).toBeNull();
    expect(provedorDoCanal("")).toBeNull();
  });
});

describe("donoContradizOCanal", () => {
  it("pega o caso real: entrou pelo QR Code, marcada como oficial", () => {
    expect(donoContradizOCanal("whatsapp_nao_oficial", "meta_whatsapp:1253912927816351")).toBe(true);
  });

  it("aceita o nome antigo do canal como sendo do mesmo dono", () => {
    expect(donoContradizOCanal("whatsapp_baileys", "whatsapp_nao_oficial:556293961473")).toBe(false);
  });

  it("não acusa quando os dois lados concordam", () => {
    expect(donoContradizOCanal("meta_whatsapp", "meta_whatsapp:1253912927816351")).toBe(false);
    expect(donoContradizOCanal("meta_instagram", "meta_instagram:17841400642879350")).toBe(false);
  });

  // Só afirma quando os DOIS lados dizem algo. Sem isso o reparo mexeria em linha que não tem
  // defeito nenhum, que é como um conserto vira um estrago.
  it("cala quando falta um dos lados", () => {
    expect(donoContradizOCanal(null, "meta_whatsapp:123")).toBe(false);
    expect(donoContradizOCanal("whatsapp_nao_oficial", null)).toBe(false);
    expect(donoContradizOCanal("WhatsApp", "meta_whatsapp:123")).toBe(false);
  });
});
