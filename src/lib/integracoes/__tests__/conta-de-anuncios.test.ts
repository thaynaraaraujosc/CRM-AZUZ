import { describe, expect, it } from "vitest";

import { escolherContaPadrao, rotuloDoStatusDaConta } from "@/lib/integracoes/conta-de-anuncios";

const conta = (id: string, account_status: number) => ({ id, account_status });

describe("escolherContaPadrao", () => {
  it("prefere uma conta ativa, mesmo que não seja a primeira da lista", () => {
    // A ordem da Meta não é significativa: a conta velha de teste pode vir antes da que está
    // rodando campanha. Pegar `data[0]` cru era o que punha a conta errada no CRM.
    const escolhida = escolherContaPadrao([conta("act_velha", 101), conta("act_viva", 1)]);
    expect(escolhida?.id).toBe("act_viva");
  });

  it("sem nenhuma ativa, fica com a primeira — é palpite, e a tela deixa trocar", () => {
    expect(escolherContaPadrao([conta("act_a", 2), conta("act_b", 3)])?.id).toBe("act_a");
  });

  it("sem conta nenhuma, devolve null em vez de undefined disfarçado", () => {
    expect(escolherContaPadrao([])).toBeNull();
  });
});

describe("rotuloDoStatusDaConta", () => {
  it("diz o que trava a entrega, e não só um número", () => {
    expect(rotuloDoStatusDaConta(1)).toBe("Ativa");
    expect(rotuloDoStatusDaConta(2)).toBe("Desativada");
    expect(rotuloDoStatusDaConta(3)).toBe("Com pendência de pagamento");
  });

  it("estado que a Meta ainda não documentou não vira frase inventada", () => {
    expect(rotuloDoStatusDaConta(999)).toBe("Estado desconhecido");
  });
});
