import { describe, expect, it } from "vitest";

import { CONFIG_PADRAO, lerConfigDoFlow } from "../azuz-flow-config";

/**
 * Isto lê um JSON que veio do banco, e o que veio do banco pode ter qualquer forma: linha escrita
 * por uma versão anterior, valor digitado errado por uma rota, conteúdo corrompido.
 *
 * O que está em jogo não é a opção: é a ENTREGA DO LEAD. Esta leitura acontece no meio dela, e um
 * `throw` aqui transformaria uma preferência de tela num lead perdido — com o Flow recebendo 500 e
 * repetindo a entrega.
 */
describe("lendo a configuração guardada", () => {
  it("valor válido passa", () => {
    expect(lerConfigDoFlow({ canal: "qrcode" })).toEqual({ canal: "qrcode" });
  });

  it("nada guardado vira o padrão", () => {
    expect(lerConfigDoFlow(undefined)).toEqual(CONFIG_PADRAO);
    expect(lerConfigDoFlow(null)).toEqual(CONFIG_PADRAO);
  });

  it("o padrão é automático, e não 'só oficial'", () => {
    // O padrão tem que funcionar pra quem acabou de ligar qualquer um dos dois canais. Com "só
    // oficial" como padrão, quem usa QR Code continuaria com lead sem conversa sem entender por quê.
    expect(CONFIG_PADRAO.canal).toBe("automatico");
  });

  it("lixo não derruba a entrega do lead: volta pro padrão", () => {
    for (const lixo of ["", 42, [], { canal: "telepatia" }, { canal: null }, { outra: "coisa" }]) {
      expect(lerConfigDoFlow(lixo)).toEqual(CONFIG_PADRAO);
    }
  });
});
