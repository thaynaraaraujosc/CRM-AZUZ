import { describe, expect, it } from "vitest";

import {
  formatarNumeroConectado,
  nomeDaConexao,
  numeroDaContaCanal,
  proximoSlotLivre,
  slotDaConversa,
} from "@/lib/integracoes/conexoes-whatsapp";

describe("de qual conexão é esta conversa", () => {
  const conexoes = [
    { slot: 1, numero: "5562939614730" },
    { slot: 2, numero: "5511988887777" },
  ];

  it("responde pelo número que recebeu", () => {
    expect(slotDaConversa(conexoes, "whatsapp_nao_oficial:5511988887777")).toBe(2);
    expect(slotDaConversa(conexoes, "whatsapp_nao_oficial:5562939614730")).toBe(1);
  });

  it("não se importa com a formatação do número gravado", () => {
    expect(slotDaConversa(conexoes, "whatsapp_nao_oficial:+55 (11) 98888-7777")).toBe(2);
  });

  it("aceita o nome antigo do canal", () => {
    expect(slotDaConversa(conexoes, "whatsapp_baileys:5511988887777")).toBe(2);
  });

  it("com UM número só, conversa sem marca continua funcionando", () => {
    // É a conta de hoje: histórico anterior à coluna, e conexão ligada cujo número o CRM não
    // descobriu. Antes desta mudança as duas enviavam normalmente, e precisam continuar enviando.
    const uma = [{ slot: 1, numero: null }];
    expect(slotDaConversa(uma, null)).toBe(1);
    expect(slotDaConversa(uma, "whatsapp_nao_oficial:5562939614730")).toBe(1);
  });

  it("com VÁRIOS números e nenhum batendo, não chuta", () => {
    // Chutar aqui é mandar a resposta de uma negociação pelo número de outro vendedor.
    expect(slotDaConversa(conexoes, null)).toBeNull();
    expect(slotDaConversa(conexoes, "whatsapp_nao_oficial:5531900000000")).toBeNull();
  });
});

describe("o próximo lugar livre", () => {
  it("preenche o primeiro buraco, e não o fim da fila", () => {
    // Desconectar o número 2 e conectar outro reusa a posição 2: sem isso, dez conexões e
    // desconexões esgotariam o limite de uma conta que nunca teve dois números ao mesmo tempo.
    expect(proximoSlotLivre([1, 3])).toBe(2);
    expect(proximoSlotLivre([])).toBe(1);
    expect(proximoSlotLivre([1, 2, 3])).toBe(4);
  });

  it("devolve nulo quando o teto foi batido", () => {
    expect(proximoSlotLivre([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBeNull();
  });
});

describe("como a conexão se chama na tela", () => {
  it("o apelido manda", () => {
    expect(nomeDaConexao({ slot: 2, numero: "5511988887777", apelido: "Closer — João" })).toBe("Closer — João");
  });

  it("sem apelido, o número legível", () => {
    expect(nomeDaConexao({ slot: 2, numero: "5511988887777", apelido: null })).toBe("+55 (11) 98888-7777");
  });

  it("sem número nenhum, a posição", () => {
    expect(nomeDaConexao({ slot: 3, numero: null, apelido: null })).toBe("Número 3");
  });
});

describe("o número conectado, legível", () => {
  it("formata celular e fixo brasileiros", () => {
    expect(formatarNumeroConectado("5562939614730")).toBe("+55 (62) 93961-4730");
    expect(formatarNumeroConectado("556239614730")).toBe("+55 (62) 3961-4730");
  });

  it("número de fora fica com o + e os dígitos, sem inventar formato", () => {
    expect(formatarNumeroConectado("14155550123")).toBe("+14155550123");
  });

  it("vazio continua vazio", () => {
    expect(formatarNumeroConectado(null)).toBe("");
  });
});

describe("o número dentro do contaCanal", () => {
  it("tira o prefixo e deixa só os dígitos", () => {
    expect(numeroDaContaCanal("whatsapp_nao_oficial:5562939614730")).toBe("5562939614730");
    expect(numeroDaContaCanal(null)).toBe("");
    expect(numeroDaContaCanal("whatsapp_nao_oficial:")).toBe("");
  });
});
